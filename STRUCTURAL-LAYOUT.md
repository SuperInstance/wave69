# WAVE-69 STRUCTURAL LAYOUT — Cells, State-Exchange Pathways, Receipts

**Status: VERIFIED BY EXECUTION.** This is the deliverable the Wave-69 directive
demanded: "the final, verified structural layout of the cells and their exact
state-exchange pathways." Every edge below was exercised live this session and
every claim carries a receipt pointer or a test name. Run 8 closed Track A with
a SUCCESS receipt at the directive's exact thresholds (proximity **0.8201 ≥
0.798**, amplitude **0.2791 ≤ 0.49**), under the Cloudflare-only key-rotation
regime.

## 1. Cell map

```
┌────────────────────────────────────────────────────────────────────────────┐
│ WAVE-69 CELL FLEET (local git: /home/z/my-project/wave69, push staged)     │
│                                                                            │
│  ┌ Invariant cells (pure, offline, fleet-portable) ─────────────────────┐  │
│  │ cells/die_engine.mjs      Deterministic Stochasticity (INV 2)        │  │
│  │ cells/sticky_receipts.mjs Sticky Receipts ledger (INV 1)             │  │
│  │ cells/spec_gate.mjs       spec_sha compiler gate (INV 3 + §4/§5)     │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌ Track A — Bridge 3, Unit Table GAN (live, CF Workers AI) ────────────┐  │
│  │ Cell 01 GENERATOR  @cf/meta/llama-3.1-8b-instruct   (meta, 8B)       │  │
│  │ Cell 02 VALIDATOR  @cf/qwen/qwen2.5-coder-32b-instruct (qwen, 32B)   │  │
│  │ track_a/unit_table.mjs  16×8 vector table + fractal geodesic nudge   │  │
│  │ track_a/moth_target.mjs deterministic moth (mock:true, H3-parked)    │  │
│  │ track_a/run_track_a.mjs the loop; track_a/live_run.mjs the runner    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌ Track B — Return Stick, Surface C (offline, bare metal) ─────────────┐  │
│  │ track_b/surface_c.py  one mmap = the surface; 99→99→99 flat control  │  │
│  │                        hierarchy at fixed offsets; JIT splitting     │  │
│  │                        from a 27-slot spare pool; ZERO locks         │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

## 2. Exact state-exchange pathways (all receipted)

| # | Edge | Transport | Payload | Proof |
|---|------|-----------|---------|-------|
| E1 | Cell 01 → Runner | HTTPS JSON (CF Workers AI `/ai/run/@cf/meta/llama-3.1-8b-instruct`) | `{depth:0-4, amp:0-0.49, focusRow:0-15}` hyper-concise | receipts `cell01-rtt` ×24 (run 8), all parsed |
| E2 | Runner → Cell 02 | HTTPS JSON (`/ai/run/@cf/qwen/qwen2.5-coder-32b-instruct`) | `{preregistered:{amplitude:{"<=":0.49}}, observed:{proximity, amplitude}}` | receipts `cell02-rtt` ×24, all `ok:true` |
| E3 | Cell 02 → Runner | same HTTP response | `{ok:bool, violated:[]}` strict JSON | `verdictFrom()` cross-checked against local `assertThresholds` |
| E4 | Runner → StickyLedger | in-process append | receipt `{seq, prev, kind, body, costMs, scar, id}` qmr1 dialect | `ledger.verify()` ok, 122 receipts, tip `c824f6cd…` |
| E5 | Die → Runner | pure function call | `{d20, band, seed}` (sha256-first16-BigInt-mod20) | `tests/die_engine.test.mjs` 7/7; bias bug receipted+fixed |
| E6 | Gate → any compile | throw named errors | `E_SPEC_MISSING / E_SPEC_DRIFT / E_CELL_INDETERMINATE / E_HOMOGENEOUS_CELL_PAIR` | `tests/spec_gate.test.mjs` 8/8 |
| E7 | Process → Surface C | ONE `mmap` (21008 B file) | fixed-offset nodes: `u32 id, parent, level; u8 flags; f64 value; 24B payload` | `tests/test_surface_c.py` 8/8 |
| E8 | Surface C writer → readers | flag-byte publish (0→1, single byte, LAST) | published-or-invisible slots, never torn | `test_reader_safety_during_split` |
| E9 | Surface C split → spare pool | freelist pop + in-place u32 parent + publish | child `{id:297+, parent:<oversized>, level:min(+1,2)}` | `test_split_preserves_data_and_links` |

**Latency/sensor pathway:** every live cell call is receipted with `ms`; RTT
> 3000 ms (the networked mapping of the directive's 3ms budget, fixed in SPEC
§1.2) trips the Die on the next round. Run 8 needed it zero times (worst cell
RTT stayed under budget).

## 3. Verified state machine of one Track A round

```
round-open ──► die check ────────► rest? ──► skip (streak reset) ─┐
                  │ deadlock(3×<0.005) or lag>3000ms               │
                  │ band 1-7 phase-jump · 8-12 pivot-local         │
                  │ 13-17 amp×1.1 · 20 full-re-layout (reseeds)    │
                  ▼                                                │
        Cell01 proposal {depth, amp, focusRow} ◄─ (unparseable ⇒     │
                  │                        die-band local sub)     │
                  ▼                                                │
        applyNudge: row' = f_i·row_i + s_i·û_i                     │
                  (û_i = orthogonalized moth, unit-row — amend. 6) │
                  ▼                                                │
        Cell02 amplitude assertion ──► ok:false ⇒ INDETERMINATE ────┤
                  │ ok                       (+ scar + REWIND:      │
                  ▼                           cost+scar STICKY)    ▼
        accept: proximity tracked ──► prox ≥ 0.798 AND amp ≤ 0.49
                  │                                     ⇒ SUCCESS receipt
                  └──► improvement < 0.005 ×3 ⇒ deadlock streak
```

## 4. What the runs proved (receipt lineage, runs 1–8)

| Run | Result | Forced change (all spec-amended through the front door) |
|-----|--------|----------------------------------------------------------|
| 1 (offline) | ledger verified, honest degradation under total cell outage | — |
| 2 | 12/12 rounds reverted, proximity pinned −0.5776, 12956 ms | **A1**: validator gates the BUDGET, never the GOAL |
| 3 | proximity drove DOWN to −0.8611 (target-blind shear = random walk) | **A3**: shear direction = orthogonalized moth |
| 4 | signed shear pushed low-weight rows away → −0.6180 | **A3b**: weight modulates step SIZE, never SIGN |
| 5 | climbs (−0.5776→−0.4134) but 12 rounds < measured need | **A4**: budget 12→48 |
| 6 | mechanically healthy (45/48 accepted) but amp peaked 0.2419/0.49 | **A5**: texture floor + die bands become actors + budget 120 |
| 7 | saturates at −0.35 for 50+ rounds (non-unit-row projection bug) | **A6**: correct geodesic direction |
| **8** | **SUCCESS: 0.8201 @ round 24, amp 0.2791, 0 scars, 122 receipts verified** | none — the mechanism as amended hit the untouched goal |

Also proven this session by the invariants themselves: the die's 5-face bias
(parseInt > 2^53 quantization) — caught by statistics, fixed with BigInt; the
sticky-ledger tamper trio (E_HASH_MISMATCH / E_PREV_MISMATCH / E_SEQ_MISMATCH);
rewind preserving cost (100+250 ⇒ cumulativeCost 350 after rewind) and scars.

## 5. Track B verified facts

- Layout arithmetic: `LEVEL_BASE = [256, 256+99·64, 256+2·99·64]`,
  `SPARE_BASE = 256+3·99·64`, surface 21008 B, node 64 B — all asserted.
- 99→99→99 projects full (297 published slots); walk L2[41]→L1→L0 ids
  `[239, 140, 41]`, root parent `0xFFFFFFFF`.
- Split never cannibalizes the hierarchy (27-slot spare pool), data preserved,
  parent u32 single-store, freelist advances.
- Reader-safety during split: concurrent reader saw zero torn states.
- **No locks**: source-scan proof passes (banned literals behind concatenation
  so the scan cannot false-positive on itself).

## 6. Spec chain (preregistration lineage)

`793b3ca1` (preregister) → `8ca716d1` (A1 scale+shear) → `fd99b9fd` (A2 budget-gate)
→ `59e12853` (A3 geodesic) → `b91cb4b4` (A3b magnitude) → `fd7676d8` (A4 budget 48)
→ `411e3049` (A5 texture floor/actors/120) → `f6bfdbe4` (A6 unit-row projection) —
goal pair (0.798, 0.49) **unchanged through all eight**. SPEC-SHA.txt always
matched the live SPEC.md (enforced by test).

## 7. Honest residuals (for the next wave)

1. The moth target is a deterministic labeled mock (`mock:true`,
   pending-H3-IonQ-recon). Moth key rotation parked the recon; a confirmed
   target REPLACES the mock wholesale — the ledger records which was used.
2. Cell 02's verdict is cross-checked but its `violated[]` list is advisory —
   local arithmetic is authoritative. (Heterogeneity is a signal, not a rubber
   stamp; a stricter merge policy is a v2 question.)
3. GitHub Actions yml ships unverified-on-remote (key rotation); local suite
   stands in: 30 node + 8 python, all green at commit time.
4. Surface C single-writer discipline is a LAW (documented), not an enforcement
   mechanism — multi-writer would need the flag protocol extended or the
   organ-store custody model.
5. CF account id lives at `scripts/.cf_account_id` (0600); it is an identifier,
   not a credential, but stays off-repo anyway.
