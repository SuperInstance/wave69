// wave69/track_a/moth_target.mjs — the moth target, fleet-doctrine edition.
//
// The moth key is rotated out (H3 IonQ recon parked). The fleet's own doctrine
// (quilt-murmur/murmur/moth.mjs) already handles exactly this: refuse live,
// degrade to a DETERMINISTIC LABELED MOCK that never pretends to be quantum.
// So the Track A moth target is derived by deterministic stretch from a
// commitment string — mock:true, provisional — and the derivation is frozen
// here so the recon can only CONFIRM or REPLACE it wholesale, never silently
// shift it (a shifted target would invalidate every proximity receipt).

import { createHash } from 'node:crypto';

/** fnv1a64 counter-mode stretch — same idiom as the fleet moth vault. */
export function fnv1a64(str) {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < str.length; i++) {
    h ^= BigInt(str.charCodeAt(i));
    h = (h * prime) & mask;
  }
  return h;
}

/** Counter-mode: derive n independent u64s from one seed. */
export function stretch(seed, n) {
  const out = [];
  for (let c = 0; c < n; c++) out.push(fnv1a64(`${seed}:${c}`));
  return out;
}

/**
 * The Wave-69 moth target: 8 dims from sha256("wave69-moth-commitment"),
 * stretched counter-mode, mapped to [-1,1), L2-normalized.
 * Labeled: { mock: true, provisional: 'pending-H3-IonQ-recon' }.
 */
export function mothTarget() {
  const seed = createHash('sha256').update('wave69-moth-commitment').digest('hex');
  const u64s = stretch(seed, 8);
  const dims = u64s.map((u) => (Number(u >> 1n) / 2 ** 63) * 2 - 1); // [-1,1)
  const norm = Math.sqrt(dims.reduce((a, d) => a + d * d, 0));
  const vec = dims.map((d) => d / norm);
  return {
    vec,
    mock: true,
    provisional: 'pending-H3-IonQ-recon',
    derivation: 'normalize(stretch8(sha256("wave69-moth-commitment")))',
  };
}

/** Cosine similarity (vec must be L2-normalized already, as target is). */
export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
