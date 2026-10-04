// wave69/tests/spec_gate.test.mjs — the self-defending gate receipts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileCell, assertHeterogeneousPair, assertThresholds, CellStatus, sha256File } from '../cells/spec_gate.mjs';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';

const SPEC_SHA = sha256File(new URL('../SPEC.md', import.meta.url).pathname);

test('gate ACCEPTS the preregistered spec (sha match)', () => {
  const r = compileCell(new URL('..', import.meta.url).pathname, { spec_sha: SPEC_SHA });
  assert.equal(r.ok, true);
  assert.equal(r.spec_sha, SPEC_SHA);
});

test('gate refuses a MISSING spec (E_SPEC_MISSING)', () => {
  const dir = '/tmp/wave69-gate-empty';
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  assert.throws(() => compileCell(dir, { spec_sha: SPEC_SHA }), /E_SPEC_MISSING/);
});

test('gate refuses DRIFTED spec (E_SPEC_DRIFT)', () => {
  assert.throws(
    () => compileCell(new URL('..', import.meta.url).pathname, { spec_sha: '0'.repeat(64) }),
    /E_SPEC_DRIFT/,
  );
});

test('gate refuses INDETERMINATE cell before even reading the spec', () => {
  const cs = new CellStatus();
  cs.breach(null, { why: 'test-breach' });
  assert.throws(
    () => compileCell(new URL('..', import.meta.url).pathname, { spec_sha: SPEC_SHA }, cs.state),
    /E_CELL_INDETERMINATE/,
  );
});

test('heterogeneity gate: same-family pair refused, cross-family pair accepted', () => {
  assert.throws(() => assertHeterogeneousPair('@cf/meta/llama-3.1-8b-instruct', '@cf/meta/llama-3.3-70b-instruct-fp8-fast'), /E_HOMOGENEOUS_CELL_PAIR/);
  const r = assertHeterogeneousPair('@cf/meta/llama-3.1-8b-instruct', '@cf/qwen/qwen2.5-coder-32b-instruct');
  assert.equal(r.ok, true);
  assert.deepEqual([r.generatorFamily, r.validatorFamily], ['meta', 'qwen']);
});

test('thresholds: preregistered bounds, named violations', () => {
  const pre = { proximity: { op: '>=', bound: 0.798 }, amplitude: { op: '<=', bound: 0.49 } };
  assert.deepEqual(assertThresholds(pre, { proximity: 0.8, amplitude: 0.4 }), []);
  assert.equal(assertThresholds(pre, { proximity: 0.5, amplitude: 0.4 }).length, 1);
  assert.equal(assertThresholds(pre, { proximity: 0.8, amplitude: 0.6 }).length, 1);
  assert.equal(assertThresholds(pre, { proximity: NaN, amplitude: 0.4 })[0].why, 'E_OBSERVATION_NOT_A_NUMBER');
});

test('CellStatus: breach flips one-way; principal override requires a ledger receipt', async () => {
  const cs = new CellStatus();
  assert.equal(cs.state, 'OK');
  cs.breach(null, { why: 'x' });
  assert.equal(cs.state, 'INDETERMINATE');
  assert.throws(() => cs.principalOverride(null, 'no ledger'), /E_OVERRIDE_NEEDS_LEDGER/);

  // with a ledger: override appends a receipt, breach scar STAYS in chain
  const { StickyLedger } = await import('../cells/sticky_receipts.mjs');
  const l = new StickyLedger();
  const cs2 = new CellStatus();
  cs2.breach(l, { why: 'verdict-fail' });
  cs2.principalOverride(l, 'principal note');
  assert.equal(cs2.state, 'OK');
  assert.equal(l.scars().length, 1);                    // the scar never leaves
  assert.equal(l.receipts[l.receipts.length - 1].kind, 'principal-override');
});

test('SPEC-SHA.txt on disk matches the live SPEC.md (preregistration intact)', async () => {
  const { readFileSync } = await import('node:fs');
  const recorded = readFileSync(new URL('../SPEC-SHA.txt', import.meta.url), 'utf8').trim().split(/\s+/)[0];
  assert.equal(SPEC_SHA, recorded);
});
