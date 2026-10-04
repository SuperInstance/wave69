// wave69/track_a/unit_table.mjs — the dynamic vector table (Bridge 3 surface).
//
// The table is a 16×8 float grid. Initialization is a deterministic stretched
// stream (moth doctrine) so any machine replays the same starting table.
// The generator's lever is the FRACTAL NUDGE: per-row multiplicative scale
// factors derived from φ-powers at two recursion depths — the SAME bump
// pattern reappears at row-group granularity and at table granularity
// (self-similar across scales), which is what makes it fractal rather than
// just "random scaling". Non-uniformity is the point: a uniform push would be
// a single scalar (homogeneous), and the GAN signal dies.

import { createHash } from 'node:crypto';
import { fnv1a64, stretch } from './moth_target.mjs';

export const ROWS = 16;
export const DIMS = 8;
export const PHI = (1 + Math.sqrt(5)) / 2;

/** Deterministic init: 16×8 dims from sha256("wave69-table-init"), stretched. */
export function initTable() {
  const seed = createHash('sha256').update('wave69-table-init').digest('hex');
  const u64s = stretch(seed, ROWS * DIMS);
  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let d = 0; d < DIMS; d++) {
      const u = u64s[r * DIMS + d];
      row.push((Number(u >> 1n) / 2 ** 63) * 2 - 1); // [-1,1)
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Fractal nudge. scale_i = 1 + amp * (φ-fractal weight in [-0.5, 0.5]).
 * Depth-1 weight: φ^((i*7) mod 11) / φ^11 — cycles through 11 exponent
 * classes across rows. Depth-2 weight: the same shape applied to the row's
 * GROUP index (floor(i/4)), at half strength. The two-depth product is the
 * fractal signature (group shape ⊗ row shape).
 */
export function fractalWeight(i) {
  const w1 = Math.pow(PHI, (i * 7) % 11) / Math.pow(PHI, 11);       // row level
  const g = Math.floor(i / 4);
  const w2 = Math.pow(PHI, (g * 7) % 11) / Math.pow(PHI, 11);       // group level
  return w1 * 0.75 + (w2 - 0.5) * 0.5;                               // mixed, in ~[-0.25,1]
}

/** Fixed deterministic unit pattern vector — the shear DIRECTION. Pure scale
 *  cannot change cosine similarity (scale-invariance), which the first test
 *  run proved by freezing proximity at −0.5776. The shear term is what makes
 *  the GAN signal physically possible; its direction is frozen in the stretched
 *  stream so no run can steer it post-hoc. */
export function patternVector() {
  const seed = createHash('sha256').update('wave69-nudge-pattern').digest('hex');
  const u64s = stretch(seed, DIMS);
  const v = u64s.map((u) => (Number(u >> 1n) / 2 ** 63) * 2 - 1);
  const n = Math.sqrt(v.reduce((a, x) => a + x * x, 0));
  return v.map((x) => x / n);
}

/**
 * Per-row nudge factors (SPEC §2 amended): scale f_i and shear s_i, both from
 * the φ-fractal weight, both bounded by the preregistered amplitude cap.
 * Returns {f[], s[]} so amplitude is computed FROM the applied factors —
 * never re-derived loosely by the caller.
 */
export function nudgeFactors(nRows, { depth, amp, focusRow }) {
  const a = Math.min(Math.max(Number(amp) || 0, 0), 0.49); // hard cap = SPEC bound
  const focus = Number.isInteger(focusRow) ? focusRow : null;
  const f = [], s = [];
  for (let i = 0; i < nRows; i++) {
    const w = fractalWeight((i + (focus ?? 0) + (depth ?? 0)) % nRows);
    f.push(1 + a * (w - 0.25) * 0.5);          // scale modulation (signed, cosine-invariant)
    // geodesic magnitude with a TEXTURE FLOOR (amendment 5, run 6 receipt):
    // raw |w−0.25| wastes up to 100% of the cap on low-texture rows (run 6
    // amp peaked at 0.2419 of 0.49 allowed); floor at 0.25 keeps the fractal
    // profile while every row keeps a live step.
    s.push(a * (0.25 + 0.75 * Math.abs(w - 0.25)));
  }
  return { f, s };
}

/**
 * Apply a nudge (SPEC §2 amendment 3): row'_i = f_i·row_i + s_i·u_i where
 * u_i is the ORTHOGONALIZED MOTH — the per-row objective-facing geodesic
 * direction (normalize(moth − (moth·row_i)row_i)). Each accepted round
 * therefore ROTATES row_i toward the target by a bounded angle; the generator
 * controls magnitude (amp) and distribution (depth/focusRow). The die-backed
 * pattern vector survives only as the degenerate-case fallback when a row is
 * already (anti)parallel to the moth. Scale alone is cosine-invariant (run 1
 * receipt); a fixed target-blind pattern is a random walk (run 3 receipt).
 */
export function applyNudge(table, params, mothVec = null) {
  const { f, s } = nudgeFactors(table.length, params);
  const pattern = patternVector();
  return table.map((row, i) => {
    let u = pattern;
    if (mothVec) {
      // AMENDMENT 6: project against the UNIT row — the amendment-3 formula
      // assumed |row| = 1; real rows have norm ≈ 2, which let a self-shrinking
      // component dominate and saturate the climb at ≈ −0.35 (run 7 receipt).
      const rn = Math.sqrt(row.reduce((a, v) => a + v * v, 0));
      const rh = row.map((v) => v / rn);
      const dot = rh.reduce((a, v, d) => a + v * mothVec[d], 0);
      const orth = mothVec.map((m, d) => m - dot * rh[d]);
      const n = Math.sqrt(orth.reduce((a, x) => a + x * x, 0));
      if (n > 1e-9) u = orth.map((x) => x / n); // else degenerate: keep pattern
    }
    return row.map((v, d) => v * f[i] + s[i] * u[d]);
  });
}

/** Amplitude (SPEC §2): max over rows of max(|f_i − 1|, |s_i|). */
export function amplitudeOf({ f, s }) {
  return Math.max(...f.map((fi) => Math.abs(fi - 1)), ...s.map((si) => Math.abs(si)));
}

/** Preregistered proximity: MEAN cosine(row, mothVec) across all rows. */
export function proximity(table, mothVec) {
  let sum = 0;
  for (const row of table) sum += cosine0(row, mothVec);
  return sum / table.length;
}

function cosine0(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Hyper-concise stats for Cell 01 (rows summarized, never raw vectors). */
export function tableStats(table) {
  const norms = table.map((r) => Math.sqrt(r.reduce((a, v) => a + v * v, 0)));
  return {
    rows: table.length, dims: table[0].length,
    meanNorm: +(norms.reduce((a, b) => a + b, 0) / norms.length).toFixed(4),
    minNorm: +Math.min(...norms).toFixed(4),
    maxNorm: +Math.max(...norms).toFixed(4),
  };
}
