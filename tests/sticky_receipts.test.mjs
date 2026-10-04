// wave69/tests/sticky_receipts.test.mjs — Invariant 1 receipts:
// "Scars Survive Rewind" — the sticky properties, proven as arithmetic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StickyLedger, canonicalJSON } from '../cells/sticky_receipts.mjs';
import { createHash } from 'node:crypto';

test('chain builds with qmr1 dialect ids (re-derived independently)', () => {
  const l = new StickyLedger();
  l.append('a', { x: 1 }, { costMs: 5 });
  l.append('b', { y: 2 }, { costMs: 7 });
  // independent re-derivation of receipt 1's id from the dialect spec
  const expect = createHash('sha256')
    .update(`qmr1:1:${l.receipts[0].id}:${canonicalJSON({ kind: 'b', body: { y: 2 }, costMs: 7, scar: false })}`)
    .digest('hex');
  assert.equal(l.receipts[1].id, expect);
});

test('verify() re-derives full chain from genesis', () => {
  const l = new StickyLedger();
  l.append('a', {}, { costMs: 1 });
  l.append('b', {}, { costMs: 2 });
  l.checkpoint('cp1');
  const v = l.verify();
  assert.equal(v.ok, true);
  assert.equal(v.count, 3);
});

test('rewind is NON-destructive: chain length only grows', () => {
  const l = new StickyLedger();
  l.append('a', {}, { costMs: 10 });
  const cp = l.checkpoint('before-mistake');
  l.append('mistake', {}, { costMs: 40 });
  const before = l.receipts.length;
  l.rewind(cp.seq);
  assert.equal(l.receipts.length, before + 1); // rewind APPENDED, deleted nothing
  assert.equal(l.verify().ok, true);
});

test('THE STICKY PROPERTY: cumulative cost spans pre-rewind spend', () => {
  const l = new StickyLedger();
  l.append('a', {}, { costMs: 100 });
  const cp = l.checkpoint('cp');
  l.append('b', {}, { costMs: 250 });
  l.rewind(cp.seq);
  // cursor sits at cp, prefix cost is 100 — but the ledger still owes 350 total
  assert.equal(l.prefixCost(), 100);
  assert.equal(l.cumulativeCost(), 350); // scars survive rewind, as arithmetic
});

test('scars remain queryable across rewind', () => {
  const l = new StickyLedger();
  l.append('ok', {});
  l.append('breach', { why: 'threshold' }, { scar: true });
  const cp = l.checkpoint('cp');
  l.append('noise', {});
  l.rewind(cp.seq);
  assert.equal(l.scars().length, 1);
  assert.equal(l.scars()[0].kind, 'breach');
});

test('rewind to unknown seq fails NAMED', () => {
  const l = new StickyLedger();
  assert.throws(() => l.rewind(99), /E_REWIND_UNKNOWN_SEQ/);
});

test('tampering with a value breaks verify at that seq', () => {
  const l = new StickyLedger();
  l.append('a', { v: 1 });
  l.append('b', { v: 2 });
  l.receipts[0].body.v = 999; // tamper
  const v = l.verify();
  assert.equal(v.ok, false);
  assert.equal(v.at, 0);
  assert.equal(v.why, 'E_HASH_MISMATCH');
});

test('view() replays the prefix (rewound history excluded from STATE, kept in LEDGER)', () => {
  const l = new StickyLedger();
  l.append('add', { n: 1 });
  const cp = l.checkpoint('cp');
  l.append('add', { n: 10 });
  l.rewind(cp.seq);
  const sum = l.view((acc, r) => acc + (r.body.n || 0), 0);
  assert.equal(sum, 1);      // state sees only the prefix
  assert.equal(l.receipts.length, 4); // ledger keeps everything
});
