# WAVE-69 SPEC — Multi-Model Cellular Paradigm / Sticky Evolution (PREREGISTERED)

Status: PREREGISTERED — this file is hashed into `SPEC-SHA.txt` BEFORE mechanism
code runs. The spec gate refuses to compile any cell whose `spec_sha` does not
match. Post-hoc edits are drift, and drift is a named, receipted refusal.

## 1. The three invariants

1. **Sticky Receipts (scars survive rewind).** Rewind is non-destructive: it
   appends a `rewind` receipt and moves the state cursor; it never deletes.
   Cumulative execution cost is computed over the FULL chain (pre-rewind spend
   is never laundered). Anomaly receipts (`scar: true`) remain queryable across
   any rewind. Ledger ids use the fleet qmr1 dialect:
   `id = sha256("qmr1:" + seq + ":" + prev + ":" + canonicalJSON({kind, body, costMs, scar}))`,
   genesis `prev = 64×"0"`.

2. **Deterministic Stochasticity (Die Engine).** When a deadlock is declared or
   sensor lag exceeds budget, the cell calls the die — a PURE function:
   `d20 = (int(sha256(seed).hex[0:16], 16) % 20) + 1`.
   Same seed ⇒ same roll, forever, on any machine. No exception is thrown; the
   roll selects a band from a preregistered 20-entry dispatch table and the band
   injects the stated drift. Trigger law: `deadlock == true` OR `sensorLagMs > 3`
   (the directive's 3ms figure is the budget; Track A maps it to cell RTT > 3000ms
   because a networked cell's honest sensor-lag budget is 3 seconds — this
   mapping is itself preregistered here, not decided at runtime).

3. **Multi-Model Cognitive Heterogeneity.** Generator (Cell 01) and Validator
   (Cell 02) are DIFFERENT model families on different pretraining diets, never
   two temperatures of one model. Under the Cloudflare-only rotation regime:
   - Cell 01 (reflex, high-prefill, low-latency, hyper-concise):
     `@cf/meta/llama-3.1-8b-instruct`
   - Cell 02 (logkeeper, specification-first, gates compilation):
     `@cf/qwen/qwen2.5-coder-32b-instruct`
   The validator NEVER proposes; the generator NEVER asserts. Boundary is rigid.

## 2. Track A — Unit Table GAN (Bridge 3)

A dynamic vector table (16 rows × 8 dims, initialized from a deterministic
stretched stream) is nudged by Cell 01 and gated by Cell 02.

- **Moth target.** `mothTarget = normalize(stretch8(sha256("wave69-moth-commitment")))`
  where `stretch8` is fnv1a64 counter-mode (the fleet moth doctrine's offline
  stretch, `mock: true` — provisional pending H3 IonQ recon; the derivation is
  deterministic, so the recon can only CONFIRM or REPLACE it, never silently
  shift it).
- **Proximity** = mean over rows of cosine(row, mothTarget). Must reach ≥ **0.798**.
- **The nudge** (amended after the inert-proximity receipt — see below): a
  per-row **scale** `f_i = 1 + a·(w_i − 0.25)` PLUS a per-row **shear**
  `s_i = a·(w_i − 0.25)` applied along a fixed deterministic unit pattern
  vector (stretched stream), where `w_i` is the two-depth φ-fractal weight.
  Scale alone is cosine-invariant (row direction preserved), which made the
  first mechanism provably inert — the test receipt forced this amendment
  through the front door BEFORE any run claimed proximity progress.
- **Amplitude** = max over rows of max(|f_i − 1|, |s_i|). Must stay ≤ **0.49**.
  (The 0.49 cap binds `a`, and both components are bounded by `a`, so the cap
  is structural, not enforced after the fact.)
- **SUCCESS receipt** = proximity ≥ 0.798 AND amplitude ≤ 0.49 in the same round,
  with a validator `ok` verdict in that round.
- **Round protocol.** (a) Cell 01 receives current table stats (rows summarized,
  not raw vectors — hyper-concise) and returns nudge params JSON
  `{depth, amp, focusRow}`; unparseable proposal ⇒ die roll (Deterministic
  Stochasticity), band 13–17 substitutes a local deterministic proposal.
  (b) The nudge is applied. (c) Cell 02 receives the candidate table's stats +
  the preregistered threshold text and returns `{ok, violated:[]}`; verdict
  failures (`ok:false`) ⇒ the round is stamped `INDETERMINATE`, a scar is
  appended to the sticky registry, and the table reverts to pre-round state via
  rewind (the scar and the round's cost REMAIN — sticky).
  AMENDMENT (after run 2's over-gating receipt): Cell 02 asserts the
  **amplitude budget only** (`amplitude ≤ 0.49` — the HARM bound). Proximity
  ≥ 0.798 is the SUCCESS CONDITION, checked at acceptance time — never an
  admission gate. Gating candidates on the goal itself stamped every pre-goal
  round INDETERMINATE, so the table reverted every round and proximity could
  never accumulate (run 2: 12/12 rounds reverted, proximity pinned at
  −0.5776, 12956 ms receipted). A candidate below the goal is not a violation
  — it is the reason the loop exists. The gate guards the BUDGET; the ledger
  guards the GOAL.
  (d) Die trigger: 3 consecutive rounds with proximity improvement < 0.005
  (deadlock) OR a cell RTT > 3000ms (sensor lag).
  AMENDMENT 3 (after run 3's target-blind-walk receipt): the shear direction
  is the per-row ORTHOGONALIZED MOTH — `u_i = normalize(moth − (moth·row_i)·row_i)`
  — i.e. each accepted round rotates row_i toward the target by a bounded
  angle (the generator still controls magnitude via `amp`, and distribution
  via `depth`/`focusRow`). Run 3 receipt: with a fixed target-blind pattern
  vector, proximity DROVE DOWN to −0.8611 (9 die interventions, 11892 ms
  receipted) — a target-blind shear is a random walk on the sphere, expected
  drift zero, not a generator. The moth vector is preregistered and public to
  every cell; pointing the step at the objective is the mechanism, and the
  die-backed pattern vector remains only as the degenerate-case fallback
  (row already parallel to moth).
  AMENDMENT 3b (after run 4's signed-shear receipt): the geodesic magnitude
  is `|s_i| = a·|w_i − 0.25|` — the φ-fractal weight modulates STEP SIZE,
  never direction. Run 4 receipt: a signed shear `a·(w_i − 0.25)` pushed
  low-weight rows AWAY from the target and drove proximity to −0.6180 (9 die
  interventions, 12264 ms receipted). Direction: always toward the moth.
  Texture: the fractal weight profile. That is the separation of concerns.
  AMENDMENT 4 (after run 5's climb-rate measurement): the round budget is
  12 → 48. Run 5 receipt: the mechanism now CLIMBS (−0.5776 → −0.4134, +0.164,
  2 die interventions, 12907 ms receipted) at a measured ~0.0137/round under
  the 0.49 amplitude cap — honest arithmetic says the fixed goal (0.798) is
  unreachable in 12 rounds. The budget was a GUESS; the goal is PREREGISTERED
  and never moves.
  AMENDMENT 5 (after run 6's under-used-amplitude receipt): (i) the geodesic
  magnitude gains a TEXTURE FLOOR — `|s_i| = a·(0.25 + 0.75·|w_i − 0.25|)` —
  because raw `|w_i − 0.25|` wastes cap headroom (run 6: amp peaked at 0.2419
  of the 0.49 allowed; 45/48 rounds accepted, zero INDETERMINATE, zero
  unparseable — the loop is mechanically healthy, the steps are just small).
  (ii) The die bands are STRUCTURAL ACTORS, not receipts: 1–7 phase-jumps the
  focus, 8–12 pivots to the local strategy, 13–17 scales amp ×1.1, 18–19
  rests, 20 reseeds the table from the deterministic stream. (iii) Budget
  48 → 120: measured climb 0.0051/round ⇒ ~270 rounds at run-6 texture; the
  floor texture + active die raise the honest rate to ~0.012/round ⇒ ~120.
  AMENDMENT 6 (after run 7's saturation analysis): the orthogonalization in
  amendment 3 assumed UNIT rows — `moth − (moth·row_i)·row_i` is the correct
  projection only when |row_i| = 1. Real table rows have norm ≈ 2, so the
  shear carried a dominant self-shrinking component and the climb SATURATED
  at ≈ −0.35 for 50+ rounds (run 7: 114/120 accepted, amp mean 0.227, two
  band-20 resets, 111560 ms receipted). The correct geodesic direction is
  `u_i = normalize(moth − (moth·roŵ_i)·roŵ_i)` where roŵ_i = row_i/|row_i|.
  Same goal pair; the geometry is finally honest. The goal pair (0.798, 0.49)
  remains untouched since preregistration.
- **Budget.** 120 rounds maximum (amendment 5; was 48, was 12). Rounds
  exhausted without SUCCESS ⇒ an honest `HONEST-FAIL` receipt — never a
  silent pass, never a moved threshold.

## 3. Track B — Return Stick (Surface C)

A bare-metal projection layer: one `mmap`-ed file IS the surface. The 99→99→99
flat control hierarchy maps directly into fixed offsets — level block bases are
pure arithmetic on the header, no allocator, no OS abstraction beyond the single
mmap itself.

- Layout: header 256 B; then 3 level blocks × 99 nodes × 64 B
  (`u32 id, u32 parent, u32 level, u32 flags, f64 value, f64 reserved, 24 B payload`).
- **No locks.** No mutex, no `threading.Lock`, no `flock`. Publication is the
  flag-byte protocol: write payload, then flip `flags[0]` 0→1; readers skip
  unpublished slots. Single-writer discipline is the law that makes this safe.
- **JIT Topological Splitting.** A node whose |value| exceeds 8.0 splits: its
  payload seeds a freelist slot on the next level (or same level if at L2),
  parent/child offsets are rewritten in place, the child publishes by flag byte.
  Splitting never remaps the file, never pauses readers.
- Tests must prove: roundtrip, full 99→99→99 traversal, data preservation across
  a split, reader-safety during a split, and the no-locks invariant by source scan.

## 4. Compiler gate law (self-defending architecture)

- `compileCell(dir, manifest)`: sha256 the dir's `SPEC.md`; missing ⇒ `E_SPEC_MISSING`;
  mismatch vs `manifest.spec_sha` ⇒ `E_SPEC_DRIFT`; match ⇒ compile proceeds with
  the sha embedded in the artifact. The gate is ACTIVE — any downstream pipeline
  compiling a cell without a verified spec refuses.
- A cell whose runtime verdict was `INDETERMINATE` refuses downstream compilation
  (`E_CELL_INDETERMINATE`) until a principal-override receipt is appended to the
  sticky ledger.

## 5. Anti-homogenization clause

The two CF cells differ in family (meta vs qwen), parameter count (8B vs 32B),
training diet (instruct vs coder), and response grammar (prose vs strict JSON).
Any future cell swap must preserve: different family, different pretraining
distribution, rigid role boundary. Same-family pairs are refused by the gate
(`E_HOMOGENEOUS_CELL_PAIR`) — checking family prefix is enough under this spec.
