// wave69/cells/sticky_receipts.mjs — Invariant 1: Sticky Receipts.
//
// WHY THIS EXISTS (directive: "Scars Survive Rewind"): classic undo destroys
// evidence of how much the failed path cost. That launders history and starves
// the next decision — the whole value of a failed branch is its measured cost
// and its structural anomalies. So rewind here is CURSOR movement, never
// deletion: the chain only ever grows, cost accounting always ranges over the
// FULL chain, and scar receipts (anomalies, breaches, die interventions) stay
// queryable no matter how many times the table rewinds underneath them.
//
// CHAIN DIALECT: deliberately the fleet's qmr1 (quilt-mcp-receipts @ 889960a9):
//   id = sha256("qmr1:" + seq + ":" + prev + ":" + canonicalJSON(payload))
//   genesis prev = 64×"0". One dialect across the fleet means this ledger can
//   later be uploaded to the MCP receipt organ verbatim — no translation layer.

import { createHash } from 'node:crypto';

const GENESIS = '0'.repeat(64);

/** Canonical JSON: recursive key-sort. Hash binds the canonical form, so
 *  whitespace/key-order edits don't break verify — only value edits do. */
export function canonicalJSON(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonicalJSON).join(',') + ']';
  const keys = Object.keys(v).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJSON(v[k])).join(',') + '}';
}

function qmr1Id(seq, prev, payload) {
  return createHash('sha256')
    .update(`qmr1:${seq}:${prev}:${canonicalJSON(payload)}`)
    .digest('hex');
}

export class StickyLedger {
  constructor() {
    this.receipts = []; // append-only, ALWAYS
    this.cursor = -1;   // index of the last receipt in the CURRENT logical state
  }

  /** Append a receipt. seq binds to FULL chain length (never resets). */
  append(kind, body = {}, { costMs = 0, scar = false } = {}) {
    const seq = this.receipts.length;
    const prev = seq === 0 ? GENESIS : this.receipts[seq - 1].id;
    const payload = { kind, body, costMs, scar };
    const receipt = { seq, prev, ...payload, ts: 0, id: qmr1Id(seq, prev, payload) };
    // ts:0 — wall-clock time is deliberately EXCLUDED from identity (pure
    // replay); callers who want it can add it to body. Determinism > timestamps.
    this.receipts.push(receipt);
    this.cursor = seq;
    return receipt;
  }

  /** Non-destructive rewind: appends a rewind receipt, moves the cursor.
   *  Nothing before toSeq is touched; its cost and scars remain sticky. */
  rewind(toSeq) {
    const target = this.receipts[toSeq];
    if (!target) throw new Error('E_REWIND_UNKNOWN_SEQ');
    // Refuse rewinding INTO the future (cursor can't exceed chain tip).
    if (toSeq > this.receipts.length - 1) throw new Error('E_REWIND_PAST_TIP');
    const r = this.append('rewind', { toSeq, toId: target.id });
    this.cursor = toSeq;
    return r;
  }

  /** Checkpoint marker receipt (kind='checkpoint', body carries the label). */
  checkpoint(label) {
    return this.append('checkpoint', { label });
  }

  /**
   * THE STICKY PROPERTY: cumulative cost sums the FULL chain — every receipt
   * ever written, regardless of where the cursor sits. Pre-rewind spend is
   * never laundered. This is "scars survive rewind" as arithmetic.
   */
  cumulativeCost() {
    return this.receipts.reduce((acc, r) => acc + (r.costMs || 0), 0);
  }

  /** Cost of only the current logical prefix (for comparison/receipts). */
  prefixCost() {
    return this.receipts.slice(0, this.cursor + 1).reduce((a, r) => a + (r.costMs || 0), 0);
  }

  /** Scar registry: anomalies across the FULL chain, cursor-independent. */
  scars() {
    return this.receipts.filter((r) => r.scar);
  }

  /** Full-chain verify: re-derive every id from genesis. O(n), receipted. */
  verify() {
    let prev = GENESIS;
    for (let i = 0; i < this.receipts.length; i++) {
      const r = this.receipts[i];
      const expect = qmr1Id(i, prev, { kind: r.kind, body: r.body, costMs: r.costMs, scar: r.scar });
      if (r.seq !== i) return { ok: false, at: i, why: 'E_SEQ_MISMATCH' };
      if (r.prev !== prev) return { ok: false, at: i, why: 'E_PREV_MISMATCH' };
      if (r.id !== expect) return { ok: false, at: i, why: 'E_HASH_MISMATCH' };
      prev = r.id;
    }
    return { ok: true, count: this.receipts.length, tip: prev };
  }

  /** The current logical state = the prefix, replayed by a consumer reducer. */
  view(reduce, init) {
    return this.receipts.slice(0, this.cursor + 1).reduce(reduce, init);
  }
}
