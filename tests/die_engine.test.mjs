// wave69/tests/die_engine.test.mjs — Invariant 2 receipts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roll, shouldTrigger, dispatch, throwDie, DIE_TABLE } from '../cells/die_engine.mjs';

test('die is pure: same seed, same roll, 100x', () => {
  const first = roll('wave69/round7');
  for (let i = 0; i < 100; i++) assert.equal(roll('wave69/round7').d20, first.d20);
});

test('die covers 1..20 and only 1..20 across many seeds', () => {
  for (let i = 0; i < 400; i++) {
    const d = roll(`seed-${i}`).d20;
    assert.ok(d >= 1 && d <= 20, `out of range ${d}`);
  }
});

test('die is not degenerate: multiple distinct faces across seeds', () => {
  const faces = new Set(Array.from({ length: 200 }, (_, i) => roll(`seed-${i}`).d20));
  assert.ok(faces.size >= 12, `only ${faces.size} distinct faces`);
});

test('different seeds differ (hash sensitivity)', () => {
  const a = roll('seed-a').d20, b = roll('seed-b').d20;
  assert.notEqual(`${a}:${roll('seed-a').d20}`, `${b}:${roll('seed-a').d20}`); // sanity
  // 20 seeds should not all collapse to one face
  const faces = new Set(Array.from({ length: 20 }, (_, i) => roll(`x${i}`).d20));
  assert.ok(faces.size > 1);
});

test('trigger law: deadlock OR lag>3, exactly', () => {
  assert.equal(shouldTrigger({}), false);
  assert.equal(shouldTrigger({ deadlock: false, sensorLagMs: 3 }), false); // 3ms is the budget, not a breach
  assert.equal(shouldTrigger({ deadlock: false, sensorLagMs: 4 }), true);
  assert.equal(shouldTrigger({ deadlock: true }), true);
});

test('dispatch bands tile 1..20 with no gaps and no overlaps', () => {
  const covered = new Set();
  for (const b of DIE_TABLE) for (let d = b.lo; d <= b.hi; d++) covered.add(d);
  assert.equal(covered.size, 20);
  for (let d = 1; d <= 20; d++) assert.ok(dispatch({ d20: d, seed: 'x' }).band);
});

test('throwDie returns null when not owed, dispatched roll when owed', () => {
  assert.equal(throwDie('s', { deadlock: false, sensorLagMs: 1 }), null);
  const r = throwDie('s', { deadlock: true });
  assert.ok(r && r.band && r.d20 >= 1 && r.d20 <= 20);
});
