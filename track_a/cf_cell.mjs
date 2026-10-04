// wave69/track_a/cf_cell.mjs — Cloudflare Workers AI cell client.
//
// Under the key-rotation regime this is the fleet's ONLY live model capacity,
// so the client is deliberately thin and honest:
//   - token sourced from CLOUDFLARE_API_TOKEN env (from .env.keys; never
//     hardcoded, never echoed, never receipted),
//   - response shape varies by model (llama returns a string `response`,
//     qwen returned a JSON dict in smoke) — both handled, unknown shapes
//     fail NAMED (E_CELL_SHAPE),
//   - offline/missing token ⇒ throw E_CF_CELL_OFFLINE so callers degrade to
//     their preregistered fallback path (the die band, SPEC §2 step (a)),
//   - every call returns its latency so the runner can receipt sensor lag
//     (the 3000ms budget feeds the Die trigger law).

const API_BASE = 'https://api.cloudflare.com/client/v4';

export const GENERATOR_MODEL = '@cf/meta/llama-3.1-8b-instruct'; // Cell 01 (meta family)
export const VALIDATOR_MODEL = '@cf/qwen/qwen2.5-coder-32b-instruct'; // Cell 02 (qwen family)

export function cfConfigured() {
  return typeof process.env.CLOUDFLARE_API_TOKEN === 'string'
    && process.env.CLOUDFLARE_API_TOKEN.startsWith('cfut_');
}

/** One cell call. Returns {ok, response, usage, ms, model}. */
export async function callCell(model, messages, { maxTokens = 128, accountId } = {}) {
  if (!cfConfigured()) throw new Error('E_CF_CELL_OFFLINE');
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(
      `${API_BASE}/accounts/${accountId}/ai/run/${model}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, max_tokens: maxTokens }),
        signal: AbortSignal.timeout(15000),
      },
    );
  } catch (e) {
    throw new Error(`E_CF_CELL_UNREACHABLE:${String(e && e.message).slice(0, 80)}`);
  }
  const ms = Date.now() - t0;
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(`E_CF_CELL_HTTP_${res.status}:${JSON.stringify(data.errors || {}).slice(0, 120)}`);
  }
  const r = data.result || {};
  let response = r.response;
  // Shape normalization: llama → string; qwen → sometimes already-parsed dict.
  if (typeof response === 'string') {
    const trimmed = response.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try { response = JSON.parse(trimmed); } catch { /* keep string */ }
    }
  } else if (response === undefined) {
    throw new Error('E_CELL_SHAPE:' + Object.keys(r).join(','));
  }
  return { ok: true, response, usage: r.usage || null, ms, model };
}

/** Strict JSON object extraction for validator verdicts. Fails named. */
export function verdictFrom(cellResult) {
  const v = cellResult.response;
  if (v && typeof v === 'object' && !Array.isArray(v) && typeof v.ok === 'boolean') return v;
  if (typeof v === 'string') {
    const m = v.match(/\{[\s\S]*\}/);
    if (m) { try { const p = JSON.parse(m[0]); if (typeof p.ok === 'boolean') return p; } catch {} }
  }
  throw new Error('E_VERDICT_UNPARSEABLE');
}
