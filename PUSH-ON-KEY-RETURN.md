# PUSH-ON-KEY-RETURN — resume in one command each

The GitHub key is rotated out (2026-10-04). Everything below is committed
locally and verified (tests green, key-scan clean). When the principal returns
with the new key:

```bash
# 0. drop the new key into the vault (placeholder is waiting there):
#    GITHUB_TOKEN=...  >> /home/z/my-project/.env.keys   (chmod 600, gitignored)

# 1. wave69 — new repo (create via API, then):
cd /home/z/my-project/wave69
git remote add origin https://github.com/SuperInstance/wave69.git
../scripts/push_with_token.sh SuperInstance/wave69 main

# 2. key-rotation research doc (commit first — it is new/modified):
cd /home/z/my-project/quilt-research-canons
git add research/KEY-ROTATION-2026-10-04.md && git commit -m "research: key-rotation event 2026-10-04 — CF-only regime, key-loss != model-loss"
../scripts/push_with_token.sh SuperInstance/quilt-research-canons main

# 3. after ANY push: key-scan the committed tree (fleet law), then verify:
#    git ls-remote origin main   ==   git rev-parse HEAD
```

## Post-rotation checklist (order matters)

1. Re-verify CF token still active (`scripts/cf_verify.sh`) — it was NOT rotated.
2. Push wave69 first (the CI workflow runs green on push: 30 node + 8 python
   local-green at commit time; CI is the remote confirmation).
3. Update `quilt-research-canons/research/KEY-ROTATION-2026-10-04.md` status
   board: GitHub → restored.
4. Restored model keys (deepseek/kimi/typesafe/deepinfra) go into `.env.keys`
   ONLY — then the heterogeneous cell pair can widen beyond CF (SPEC §5: any
   new pair must be cross-family; the gate refuses same-family).
5. Moth key restored ⇒ unpark H3 IonQ recon: confirm or REPLACE the wave-69
   mock moth target (receipted either way, never silent).
6. Scrub checklist: `bash scripts/rotate_scrub.sh` should stay CLEAN.

## What was deliberately NOT done under the dead key

- No authenticated GitHub calls (no probes, no pushes) — token treated as
  burned from the directive message forward; no command embeds it.
- No history rewrites on the cot-quilt receipt that held a rotated DeepSeek
  key (fleet law: never delete data; the value is dead and redacted locally;
  rotation covers any remote exposure).
