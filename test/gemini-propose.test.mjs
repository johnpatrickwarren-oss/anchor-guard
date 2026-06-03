// gemini-propose (GEMINI backend): JSON output mode, schema in the system instruction; returns the parsed
// object. We inject a FAKE @google/genai client, so this runs with no SDK init, no GEMINI_API_KEY, no network.
import { geminiPropose } from '../src/author/gemini-propose.mjs';

let failed = 0;
const ok = (n, c, d) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${n}${c ? '' : '  -- ' + d}`); if (!c) failed++; };

const SCHEMA = { type: 'object', properties: { intent: { type: 'string', enum: ['no-god-functions', 'layering'] } }, required: ['intent'], additionalProperties: true };
const REQ = { system: 'You only PROPOSE; a verifier decides.', schema: SCHEMA };
const fakeGemini = (text) => { let seen; return { seen: () => seen, models: { generateContent: async (req) => { seen = req; return { text }; } } }; };

{ const c = fakeGemini('{"intent":"no-god-functions","max":12}');
  const out = await geminiPropose('keep functions small', REQ, { client: c });
  ok('returns the parsed JSON object', out && out.intent === 'no-god-functions' && out.max === 12, JSON.stringify(out));
  const req = c.seen();
  ok('requests application/json output', req.config.responseMimeType === 'application/json', JSON.stringify(req.config));
  ok('carries the schema + base instruction in the system instruction; passes the text as contents', /only PROPOSE/.test(req.config.systemInstruction) && /JSON Schema/.test(req.config.systemInstruction) && req.contents === 'keep functions small', ''); }

// `.text` exposed as a function (older SDK shape) is also handled.
{ const c = { models: { generateContent: async () => ({ text: () => '{"intent":"layering","from":["src/x"],"forbid":"src/y"}' }) } };
  const out = await geminiPropose('x', REQ, { client: c }); ok('handles .text() function form', out && out.intent === 'layering', JSON.stringify(out)); }

// Non-JSON / empty -> null.
{ const out = await geminiPropose('x', REQ, { client: fakeGemini('no idea') }); ok('non-JSON text -> null', out === null, JSON.stringify(out)); }

console.log(failed === 0 ? '\nPASS: gemini backend uses JSON output mode and returns the parsed proposal ✅' : `\nFAIL: ${failed}`);
process.exit(failed ? 1 : 0);
