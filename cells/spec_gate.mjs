// wave69/cells/spec_gate.mjs — Invariant 3 + the self-defending compiler gate.
//
// WHY THIS EXISTS: discovery-skin's regression (novelty 1.0 → 0.2 after the
// fact) happened because the spec was written AFTER the result existed. The
// fix that survived wave-67 was sha-preregistration. Wave-69 upgrades that
// from a lab discipline to an ACTIVE GATE: compilation itself refuses when the
// spec is missing or drifted, and a breached cell is INDETERMINATE — refused
// downstream until a principal-override receipt lands. Specification-first
// layout, always; code generation is downstream of the spec, never upstream.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function sha256File(p) {
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}

/**
 * Gate: sha256(dir/SPEC.md) against manifest.spec_sha.
 *   missing spec file  → E_SPEC_MISSING  (refuse; a cell with no spec compiles never)
 *   hash mismatch      → E_SPEC_DRIFT   (refuse; post-hoc edits are drift, not updates)
 *   match              → { ok:true, spec_sha } — the sha rides in the artifact.
 * Guard ALSO refuses when cellStatus is INDETERMINATE (breach law, SPEC §4).
 */
export function compileCell(dir, manifest, cellStatus = 'OK') {
  if (cellStatus === 'INDETERMINATE') throw new Error('E_CELL_INDETERMINATE');
  const specPath = join(dir, 'SPEC.md');
  if (!existsSync(specPath)) throw new Error('E_SPEC_MISSING');
  const actual = sha256File(specPath);
  if (!manifest || typeof manifest.spec_sha !== 'string') throw new Error('E_MANIFEST_NO_SHA');
  if (actual !== manifest.spec_sha) throw new Error('E_SPEC_DRIFT');
  return { ok: true, spec_sha: actual, compiledAt: 'wave69-gate' };
}

/** Heterogeneity gate (SPEC §5): a cell PAIR with the same model family prefix
 *  is refused. Family = the segment between the two '/' and before the first
 *  '-' in a Workers AI model id (e.g. '@cf/meta/llama-…' → 'meta'). */
export function assertHeterogeneousPair(generatorModel, validatorModel) {
  const fam = (m) => m.split('/')[1].split('-')[0];
  if (fam(generatorModel) === fam(validatorModel)) {
    throw new Error('E_HOMOGENEOUS_CELL_PAIR');
  }
  return { ok: true, generatorFamily: fam(generatorModel), validatorFamily: fam(validatorModel) };
}

/** Threshold assertion against a PREREGISTERED bound (never computed here —
 *  bounds arrive from SPEC text, not from running code). Returns violations[]. */
export function assertThresholds(preregistered, observed) {
  const violated = [];
  for (const [name, { op, bound }] of Object.entries(preregistered)) {
    const v = observed[name];
    if (typeof v !== 'number' || Number.isNaN(v)) {
      violated.push({ name, why: 'E_OBSERVATION_NOT_A_NUMBER', got: String(v) });
      continue;
    }
    if (op === '>=' && !(v >= bound)) violated.push({ name, why: 'E_BELOW_BOUND', bound, got: v });
    if (op === '<=' && !(v <= bound)) violated.push({ name, why: 'E_ABOVE_BOUND', bound, got: v });
  }
  return violated;
}

/**
 * CellStatus machine: OK → INDETERMINATE on breach (one-way). Exit requires a
 * principal-override RECEIPT appended to the sticky ledger — the scar stays in
 * the chain either way. The machine never forgets because the ledger never
 * forgets; status flips are themselves receipted by the caller.
 */
export class CellStatus {
  constructor() { this.state = 'OK'; }

  breach(registry, event) {
    if (this.state === 'INDETERMINATE') return this.state; // idempotent; ledger holds history
    this.state = 'INDETERMINATE';
    // scar persists across any rewind (StickyLedger guarantees the rest)
    if (registry) registry.append('scar', { kind: 'verdict-breach', event }, { scar: true });
    return this.state;
  }

  principalOverride(registry, note) {
    if (this.state !== 'INDETERMINATE') return this.state;
    if (!registry) throw new Error('E_OVERRIDE_NEEDS_LEDGER');
    // The override receipt is NOT a scar, but it is permanent chain history —
    // the breach scar above it can never be removed by any rewind.
    registry.append('principal-override', { note });
    this.state = 'OK';
    return this.state;
  }
}
