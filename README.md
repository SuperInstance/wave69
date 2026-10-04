# WAVE-69 — Multi-Model Cellular Paradigm / Sticky Evolution

Built during the 2026-10-04 key-rotation regime: **Cloudflare is the only live
external capacity**, everything else is local-first and push-staged.

## What's here

- `SPEC.md` + `SPEC-SHA.txt` — preregistered spec, amended 6 times through the
  front door, each amendment forced by a run receipt (lineage in
  `STRUCTURAL-LAYOUT.md` §6). Goal pair (proximity ≥ 0.798, amplitude ≤ 0.49)
  never moved.
- `cells/` — the three invariants as pure modules: die engine (deterministic
  d20, BigInt-corrected), sticky receipts (scars survive rewind, qmr1 dialect),
  spec gate (active compiler gate + heterogeneity + INDETERMINATE law).
- `track_a/` — Bridge 3 unit-table GAN. Cell 01 = `@cf/meta/llama-3.1-8b`
  (generator), Cell 02 = `@cf/qwen/qwen2.5-coder-32b` (validator), live on
  Cloudflare Workers AI. **Run 8 SUCCESS: 0.8201 proximity @ round 24.**
- `track_b/` — Return Stick Surface C: one mmap, 99→99→99 flat control
  hierarchy at fixed offsets, JIT topological splitting from a spare pool,
  zero locks (source-scan proof).
- `tests/` — 30 node + 8 python tests, all green (also the CI payload).
- `.github/workflows/test.yml` — CI ready; unverified-on-remote until the
  GitHub key returns.

## Run it

```bash
npm test                       # both suites, fully offline
npm run trackA                 # offline Track A (die-band fallbacks)
source ../.env.keys && export CLOUDFLARE_API_TOKEN
node track_a/live_run.mjs <accountId>   # live dual-cell run
```

## Read first

`STRUCTURAL-LAYOUT.md` is the directive deliverable: cell map, exact
state-exchange pathways (E1–E9), the receipt lineage of runs 1–8, and honest
residuals. `PUSH-ON-KEY-RETURN.md` is the one-command resume for when the
GitHub key is restored.
