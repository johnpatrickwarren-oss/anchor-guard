// author/gemini-propose — the GEMINI proposer backend (Google `@google/genai`). Lazy-loaded (not required
// unless chosen, never at gate-time). Uses JSON output mode (responseMimeType application/json), with the
// vocabulary+param catalog and the JSON Schema carried in the system instruction. Only PROPOSES — the
// deterministic filter decides. The `client` is injectable; tests pass a fake (no SDK / GEMINI_API_KEY needed).
const MODEL = process.env.ANCHOR_GUARD_GEMINI_MODEL || 'gemini-2.5-flash';

async function defaultClient() {
  let GoogleGenAI;
  try { ({ GoogleGenAI } = await import('@google/genai')); }
  catch { throw new Error('the gemini backend needs the `@google/genai` package: npm install @google/genai'); }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY });
}

function withSchema(system, schema) {
  return `${system}\n\nReturn ONE JSON object matching this JSON Schema (no prose, no code fence):\n${JSON.stringify(schema)}`;
}

function parseObject(s) {
  if (typeof s !== 'string') return null;
  try { const o = JSON.parse(s); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch { return null; }
}

export async function geminiPropose(text, { system, schema }, { client } = {}) {
  const c = client || await defaultClient();
  const r = await c.models.generateContent({
    model: MODEL,
    contents: text,
    config: { systemInstruction: withSchema(system, schema), responseMimeType: 'application/json' },
  });
  const out = typeof r?.text === 'function' ? r.text() : r?.text; // SDK exposes `.text` (getter or fn across versions)
  return parseObject(out);
}
