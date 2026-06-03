// author/openai-propose — the OPENAI proposer backend. Lazy-loads the `openai` SDK (so it isn't required
// unless this backend is chosen, and never at gate-time — the isolate-import invariant forbids it in
// validate/agent). Uses JSON mode (response_format json_object), with the vocabulary+param catalog and the
// JSON Schema carried in the system prompt. Like every backend it only PROPOSES — the deterministic filter
// decides — so JSON mode's looser guarantee is fine: a malformed object is rejected, never enforced. The
// `client` is injectable; tests pass a fake, so no SDK or OPENAI_API_KEY is touched.
const MODEL = process.env.ANCHOR_GUARD_OPENAI_MODEL || 'gpt-4o';

async function defaultClient() {
  let OpenAI;
  try { ({ default: OpenAI } = await import('openai')); }
  catch { throw new Error('the openai backend needs the `openai` package: npm install openai'); }
  return new OpenAI(); // reads OPENAI_API_KEY
}

// JSON mode gives no structural schema channel, so we put the schema in the prompt; the filter validates.
function withSchema(system, schema) {
  return `${system}\n\nReturn ONE JSON object matching this JSON Schema (no prose, no code fence):\n${JSON.stringify(schema)}`;
}

function parseObject(s) {
  if (typeof s !== 'string') return null;
  try { const o = JSON.parse(s); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch { return null; }
}

export async function openaiPropose(text, { system, schema }, { client } = {}) {
  const c = client || await defaultClient();
  const r = await c.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: withSchema(system, schema) }, { role: 'user', content: text }],
  });
  return parseObject(r?.choices?.[0]?.message?.content);
}
