// wave69/cells/die_engine.mjs — Invariant 2: Deterministic Stochasticity.
//
// WHY THIS EXISTS (directive: "when deadlocked or 3ms sensor lag, do not throw
// a standard exception — roll the bones"): exceptions encode a failure story
// chosen by whoever wrote the throw site; a deterministic die encodes a
// STRUCTURAL response chosen by the preregistered table. The difference matters
// because exceptions launder history (each throw is ad-hoc, unreceipted,
// unrepeatable) while a die roll is pure, receipted, and replayable forever.
//
// PURITY CONTRACT: roll() touches nothing but its argument. No clock, no RNG,
// no I/O. sha256-first-16-hex mod 20 + 1. Two machines in ten years computing
// roll("wave69/round7") MUST agree — that is the entire point. This is the same
// doctrine as the fleet moth vault's offline stretch (fnv1a64 counter-mode):
// determinism is a first-class citizen, "mock" never pretends to be live, and
// the derivation is stable so downstream code can hard-depend on it.

import { createHash } from 'node:crypto';

/** The pure die. d20 = (BigInt(sha256(seed)[0:16]) % 20) + 1.
 *  BigInt is REQUIRED: parseInt on 16 hex chars exceeds 2^53 and quantizes the
 *  low bits (granularity 2048; gcd(2048,20)=4), leaving only 5 of 20 faces
 *  reachable — a bias the statistical test caught in the first run. Same seed,
 *  same roll, now on the FULL 64-bit residue. */
export function roll(seed) {
  if (typeof seed !== 'string' || seed.length === 0) {
    // Even the error path is deterministic-by-shape: named, not thrown blind.
    throw new Error('E_DIE_BAD_SEED');
  }
  const h = createHash('sha256').update(seed, 'utf8').digest('hex');
  const d20 = Number((BigInt('0x' + h.slice(0, 16)) % 20n) + 1n);
  return { d20, seed, source: 'die-engine', algo: 'sha256-first16-bigint-mod20+1' };
}

/**
 * Trigger law (preregistered in SPEC.md §1.2):
 *   die fires iff deadlock === true OR sensorLagMs > 3 (ms-budget mapping per
 *   spec: a networked cell's honest lag budget is 3000ms — caller passes the
 *   already-mapped number; the primitive stays literal at 3 to honor the
 *   directive's figure at the layer where the directive stated it).
 */
export function shouldTrigger({ deadlock = false, sensorLagMs = 0 } = {}) {
  return deadlock === true || sensorLagMs > 3;
}

// The preregistered dispatch table. Bands, not entries — the table IS the
// meaning of the die; changing it is a spec edit (SPEC-SHA drift), not a tweak.
//   1–7   structural drift   — perturb structure, keep goal
//   8–12  compile pivot      — swap the generator strategy wholesale
//   13–17 amplitude nudge    — scale the applied nudge magnitude ±10%
//   18–19 rest               — skip a cycle deliberately (rest is a move)
//   20    critical re-layout — full reseed from the deterministic stream
export const DIE_TABLE = [
  { lo: 1, hi: 7, band: 'structural-drift' },
  { lo: 8, hi: 12, band: 'compile-pivot' },
  { lo: 13, hi: 17, band: 'amplitude-nudge' },
  { lo: 18, hi: 19, band: 'rest' },
  { lo: 20, hi: 20, band: 'critical-re-layout' },
];

/** Map a roll to its preregistered band. Deterministic in, deterministic out. */
export function dispatch(rollResult) {
  const d = rollResult.d20;
  const band = DIE_TABLE.find((b) => d >= b.lo && d <= b.hi);
  // Unreachable by construction (bands tile 1..20) — but fail NAMED if the
  // table is ever edited into a gap. Fail-closed, never silently.
  if (!band) throw new Error('E_DIE_TABLE_GAP');
  return { ...rollResult, band: band.band, lo: band.lo, hi: band.hi };
}

/** Convenience: trigger check + one roll, in one receiptable step. */
export function throwDie(seed, trigger) {
  if (!shouldTrigger(trigger)) return null; // null = "die not owed", also receiptable
  return dispatch(roll(seed));
}
