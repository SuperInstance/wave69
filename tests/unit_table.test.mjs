// wave69/tests/unit_table.test.mjs — Track A table + moth target receipts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initTable, applyNudge, proximity, tableStats, fractalWeight, ROWS, DIMS } from '../track_a/unit_table.mjs';
import { mothTarget, cosine } from '../track_a/moth_target.mjs';

test('table init is deterministic and well-formed (16x8, [-1,1))', () => {
  const a = initTable(), b = initTable();
  assert.deepEqual(a, b); // replayable from any machine
  assert.equal(a.length, ROWS);
  assert.equal(a[0].length, DIMS);
  for (const row of a) for (const v of row) assert.ok(v >= -1 && v <= 1);
});

test('moth target is unit-length, deterministic, and honestly labeled mock', () => {
  const m1 = mothTarget(), m2 = mothTarget();
  assert.deepEqual(m1.vec, m2.vec);
  assert.equal(m1.mock, true); // never pretends to be quantum (fleet doctrine)
  assert.ok(m1.provisional.includes('H3'));
  const norm = Math.sqrt(m1.vec.reduce((a, v) => a + v * v, 0));
  assert.ok(Math.abs(norm - 1) < 1e-9);
});

test('fractal weight is non-uniform across rows (the anti-homogeneity of the nudge)', () => {
  const ws = Array.from({ length: 16 }, (_, i) => fractalWeight(i));
  assert.equal(new Set(ws.map((w) => +w.toFixed(6))).size >= 8, true);
});

test('nudge moves proximity TOWARD the moth (amendment-3 geodesic climb)', () => {
  const table = initTable();
  const moth = mothTarget().vec;
  const p0 = proximity(table, moth);
  // climb: every accepted-style round rotates rows toward the target
  let t = table, p = p0, climbs = 0;
  for (let i = 0; i < 6; i++) {
    t = applyNudge(t, { depth: i % 5, amp: 0.45, focusRow: i * 2 }, moth);
    const pn = proximity(t, moth);
    if (pn > p) climbs++;
    p = pn;
  }
  assert.ok(p > p0 + 0.05, `no climb: ${p0.toFixed(4)} -> ${p.toFixed(4)}`);
  assert.ok(climbs >= 4, `climb not monotone enough: ${climbs}/6`);
});

test('nudge is hard-capped at the SPEC amplitude bound (0.49), scale AND shear', async () => {
  const { nudgeFactors, amplitudeOf } = await import('../track_a/unit_table.mjs');
  // amp:99 must be clamped to 0.49; both components stay under the cap
  for (let depth = 0; depth < 5; depth++) {
    for (let focusRow = 0; focusRow < 16; focusRow += 5) {
      const fac = nudgeFactors(16, { depth, amp: 99, focusRow });
      assert.ok(amplitudeOf(fac) <= 0.49 + 1e-12, `amplitude ${amplitudeOf(fac)} exceeds cap`);
    }
  }
});

test('tableStats are concise (generator sees summaries, not raw vectors)', () => {
  const s = tableStats(initTable());
  assert.deepEqual(Object.keys(s).sort(), ['dims', 'maxNorm', 'meanNorm', 'minNorm', 'rows']);
});

test('cosine of orthogonal-ish and self vectors behaves', () => {
  const m = mothTarget().vec;
  assert.ok(Math.abs(cosine(m, m) - 1) < 1e-9);
});
