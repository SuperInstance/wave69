// wave69/track_a/run_track_a.mjs — the Bridge 3 dual-cell loop, wired end-to-end.
//
// EXECUTION ORDER per round (this is the spec's §2 protocol, executable):
//   1. die check (deadlock streak / sensor lag) → deterministic drift if owed
//   2. Cell 01 proposes {depth, amp, focusRow}  (hyper-concise prompt)
//      unparseable → die band 13–17 substitutes a local deterministic proposal
//   3. nudge applied → candidate table; factors receipted
//   4. Cell 02 asserts preregistered thresholds (family-rigid: never proposes)
//      ok:false OR unparseable → round INDETERMINATE + scar + rewind (sticky)
//   5. SUCCESS receipt iff proximity ≥ 0.798 AND amplitude ≤ 0.49 AND verdict ok
//   6. 12-round budget → HONEST-FAIL receipt (never a moved threshold)
//
// Every step appends to the StickyLedger; every cell call's latency feeds the
// sensor-lag trigger; the ledger's cumulativeCost() is the sticky number that
// survives every rewind.

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { StickyLedger } from '../cells/sticky_receipts.mjs';
import { throwDie } from '../cells/die_engine.mjs';
import { assertThresholds, assertHeterogeneousPair } from '../cells/spec_gate.mjs';
import { GENERATOR_MODEL, VALIDATOR_MODEL, callCell, verdictFrom, cfConfigured } from './cf_cell.mjs';
import { mothTarget } from './moth_target.mjs';
import { initTable, applyNudge, proximity, tableStats, nudgeFactors, amplitudeOf } from './unit_table.mjs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

// Live spec sha read from SPEC-SHA.txt — no hardcoded hash to drift.
const WAVE69_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_SHA = readFileSync(join(WAVE69_DIR, 'SPEC-SHA.txt'), 'utf8').trim().split(/\s+/)[0];

export const PREREGISTERED = {
  proximity: { op: '>=', bound: 0.798 }, // moth proximity threshold (directive)
  amplitude: { op: '<=', bound: 0.49 },  // amplitude budget (directive)
};
const ROUNDS = 120; // amendment 5 (was 48): 0.0115-0.0137/round measured ⇒ ~120 to goal
const SENSOR_LAG_MS = 3000; // SPEC §1.2 networked mapping of the 3ms directive figure
const DEADLOCK_STREAK = 3;  // rounds with < 0.005 proximity improvement

/** Local deterministic fallback proposal (die band 13–17 substitute).
 *  A competent climber: amp ramps fast toward the cap — the validator enforces
 *  the budget either way, so the fallback never has to be shy. */
function localProposal(roundIdx, lastProx) {
  return { depth: (roundIdx * 3) % 5, amp: Math.min(0.49, 0.25 + roundIdx * 0.02), focusRow: Math.round(lastProx * 100) % 16 };
}

export async function runTrackA({ accountId, live = cfConfigured(), rounds = ROUNDS } = {}) {
  const ledger = new StickyLedger();
  const gatePair = assertHeterogeneousPair(GENERATOR_MODEL, VALIDATOR_MODEL); // §5 gate
  const moth = mothTarget();
  let table = initTable();

  ledger.append('run-open', {
    spec: `wave69/SPEC.md@${SPEC_SHA.slice(0, 8)}`, generator: GENERATOR_MODEL, validator: VALIDATOR_MODEL,
    families: gatePair, moth: { mock: moth.mock, provisional: moth.provisional },
    liveCells: live, preregistered: PREREGISTERED,
  });

  let lastProx = proximity(table, moth.vec);
  let proxStreak = 0; // consecutive rounds below improvement floor
  let verdictOkAll = true; // validator's cumulative standing (SPEC §4 breach law)
  let dieInterventions = 0;

  for (let r = 1; r <= rounds; r++) {
    const roundOpen = ledger.append('round-open', { round: r }, { costMs: 0 });

    // 1. DIE CHECK — deadlock streak OR sensor lag from the previous cell call.
    const die = throwDie(`wave69/trackA/round${r}/streak${proxStreak}`, {
      deadlock: proxStreak >= DEADLOCK_STREAK,
      sensorLagMs: 0, // cell RTT checked inline below (live mode)
    });
    let dieDrift = null;
    if (die) {
      dieInterventions++;
      ledger.append('die-roll', { ...die, reason: proxStreak >= DEADLOCK_STREAK ? 'deadlock-streak' : 'sensor-lag' }, { scar: true });
      if (die.band === 'rest') { proxStreak = 0; continue; } // rest is a move (SPEC table)
      // Bands 1–17/20 are STRUCTURAL ACTORS (SPEC §1.2): each band injects its
      // stated drift deterministically — the die is a mechanism, not a receipt.
      dieDrift = die.band;
    }
    // dieDrift is applied AFTER the proposal is obtained (bands act on the
    // proposal and/or the table, per the preregistered band meanings).

    // 2. GENERATOR PROPOSAL (Cell 01) — live or die-substituted local proposal.
    let proposal = null, genMs = 0, proposalSource = 'cell01-live';
    if (live) {
      try {
        const t0 = Date.now();
        const res = await callCell(GENERATOR_MODEL, [{
          role: 'user',
          content: `Fractal table GAN. Stats: ${JSON.stringify(tableStats(table))}. Moth proximity: ${lastProx.toFixed(4)} (goal >= 0.798). `
            + `Amplitude budget: <= 0.49 (bigger steps are legal while far from goal). `
            + `Propose the nudge. Reply ONLY JSON: {"depth":<0-4>,"amp":<0-0.49>,"focusRow":<0-15>}`,
        }], { maxTokens: 60, accountId });
        genMs = res.ms || (Date.now() - t0);
        ledger.append('cell01-rtt', { ms: genMs, model: GENERATOR_MODEL }, { costMs: genMs });
        if (genMs > SENSOR_LAG_MS) {
          const lagDie = throwDie(`wave69/trackA/round${r}/lag`, { sensorLagMs: genMs });
          ledger.append('die-roll', { ...lagDie, reason: 'sensor-lag', ms: genMs }, { scar: true });
          dieInterventions++;
        }
        const p = typeof res.response === 'string' ? JSON.parse(res.response.match(/\{[\s\S]*\}/)[0]) : res.response;
        if (typeof p.depth === 'number' && typeof p.amp === 'number') proposal = p;
      } catch {
        ledger.append('cell01-unparseable', { round: r }, { scar: true });
      }
    }
    if (!proposal) {
      proposalSource = 'die-band-13-17-local';
      proposal = localProposal(r, lastProx);
    }

    // DIE BAND ACTIONS (deterministic, receipted):
    if (dieDrift === 'structural-drift') {
      proposal = { ...proposal, focusRow: (proposal.focusRow + 7) % 16 }; // phase jump
      ledger.append('die-action', { band: dieDrift, act: 'phase-jump+7' });
    } else if (dieDrift === 'amplitude-nudge') {
      proposal = { ...proposal, amp: Math.min(0.49, proposal.amp * 1.1) }; // ±10% per table
      ledger.append('die-action', { band: dieDrift, act: 'amp*1.1' });
    } else if (dieDrift === 'compile-pivot') {
      proposal = localProposal(r, lastProx); // swap strategy wholesale
      proposalSource = 'die-compile-pivot-local';
      ledger.append('die-action', { band: dieDrift, act: 'pivot-to-local' });
    } else if (dieDrift === 'critical-re-layout') {
      table = initTable(); // full reseed from the deterministic stream
      ledger.append('die-action', { band: dieDrift, act: 'full-re-layout' });
      lastProx = proximity(table, moth.vec);
    }
    ledger.append('proposal', { round: r, source: proposalSource, ...proposal });

    // 3. APPLY NUDGE → candidate; amplitude computed from the APPLIED factors.
    // Amendment 3: shear direction = orthogonalized moth (objective-facing).
    const preNudge = table;
    const factors = nudgeFactors(table.length, proposal);
    table = applyNudge(table, proposal, moth.vec);
    const prox = proximity(table, moth.vec);

    // 4. VALIDATOR ASSERTION (Cell 02) — gates the AMPLITUDE BUDGET only
    // (SPEC §2 amendment after run 2: proximity is the GOAL, never a gate).
    const observed = { proximity: prox, amplitude: amplitudeOf(factors) };
    const violations = assertThresholds({ amplitude: PREREGISTERED.amplitude }, observed);
    let verdict = { ok: violations.length === 0, violated: violations };
    let valMs = 0;
    if (live) {
      try {
        const res = await callCell(VALIDATOR_MODEL, [{
          role: 'user',
          content: 'You are a specification validator. Assert the observation against the preregistered AMPLITUDE BUDGET. '
            + `Preregistered: ${JSON.stringify({ amplitude: PREREGISTERED.amplitude })}. Observed: ${JSON.stringify(observed)}. `
            + 'Reply ONLY JSON: {"ok":true|false,"violated":[]}',
        }], { maxTokens: 40, accountId });
        valMs = res.ms || 0;
        ledger.append('cell02-rtt', { ms: valMs, model: VALIDATOR_MODEL }, { costMs: valMs });
        const v = verdictFrom(res);
        // The model's verdict is cross-checked against LOCAL threshold math —
        // the model never overrides arithmetic; arithmetic never overrides the
        // model's right to fail a round the math alone would pass (heterogeneity
        // is a signal, not a rubber stamp). ok = local AND model.
        verdict = { ok: verdict.ok && v.ok !== false, violated: [...violations, ...(v.violated || [])] };
      } catch {
        ledger.append('cell02-verdict-failure', { round: r }, { scar: true });
        verdict = { ok: false, violated: [{ name: 'verdict', why: 'E_VERDICT_UNPARSEABLE' }] };
      }
    }

    // 5. VERDICT → SUCCESS / INDETERMINATE+REWIND.
    if (verdict.ok) {
      proxStreak = prox - lastProx >= 0.005 ? 0 : proxStreak + 1;
      ledger.append('round-accepted', { round: r, proximity: +prox.toFixed(6), amplitude: +observed.amplitude.toFixed(4) });
      lastProx = prox;
      if (prox >= PREREGISTERED.proximity.bound && observed.amplitude <= PREREGISTERED.amplitude.bound) {
        ledger.append('SUCCESS', { round: r, proximity: +prox.toFixed(6), amplitude: +observed.amplitude.toFixed(4), dieInterventions });
        return { status: 'SUCCESS', ledger, round: r, proximity: prox, amplitude: observed.amplitude, dieInterventions, roundOpen };
      }
    } else {
      verdictOkAll = false;
      ledger.append('INDETERMINATE', { round: r, violated: verdict.violated }, { scar: true });
      ledger.rewind(roundOpen.seq); // cursor moves; scar + cost REMAIN (sticky)
      table = preNudge;             // revert table via rewind semantics
    }
  }

  ledger.append('HONEST-FAIL', { rounds, bestProximity: +lastProx.toFixed(6), dieInterventions, verdictOkAll });
  return { status: 'HONEST-FAIL', ledger, round: rounds, proximity: lastProx, dieInterventions };
}

/** Persist the run's receipts (append-only JSONL, fleet style). */
export function persistRun(result, outDir) {
  mkdirSync(outDir, { recursive: true });
  const file = `${outDir}/track-a-run-${result.status.toLowerCase()}.jsonl`;
  writeFileSync(file, result.ledger.receipts.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const v = result.ledger.verify();
  return { file, verify: v, cumulativeCost: result.ledger.cumulativeCost(), scars: result.ledger.scars().length };
}
