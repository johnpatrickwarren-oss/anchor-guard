// openai-propose (OPENAI backend): JSON mode, schema carried in the system prompt; returns the parsed object.
// We inject a FAKE OpenAI client, so this runs with no SDK init, no OPENAI_API_KEY, and no network.
import { openaiPropose } from '../src/author/openai-propose.mjs';

let failed = 0;
const ok = (n, c, d) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${n}${c ? '' : '  -- ' + d}`); if (!c) failed++; };

const SCHEMA = { type: 'object', properties: { intent: { type: 'string', enum: ['no-god-functions', 'layering'] } }, required: ['intent'], additionalProperties: true };
const REQ = { system: 'You only PROPOSE; a verifier decides.', schema: SCHEMA };
const fakeOpenAI = (content) => { let seen; return { seen: () => seen, chat: { completions: { create: async (req) => { seen = req; return { choices: [{ message: { content } }] }; } } } }; };

{ const c = fakeOpenAI('{"intent":"layering","from":["src/validate"],"forbid":"src/cli/"}');
  const out = await openaiPropose('validate must not import cli', REQ, { client: c });
  ok('returns the parsed JSON object', out && out.intent === 'layering' && out.from[0] === 'src/validate', JSON.stringify(out));
  const req = c.seen();
  ok('requests json_object mode', req.response_format.type === 'json_object', JSON.stringify(req.response_format));
  ok('carries the schema + base instruction in the system message', /only PROPOSE/.test(req.messages[0].content) && /JSON Schema/.test(req.messages[0].content) && req.messages[1].content === 'validate must not import cli', ''); }

// Non-JSON / empty content -> null (the filter then rejects an empty proposal).
{ const out = await openaiPropose('x', REQ, { client: fakeOpenAI('I am not sure') }); ok('non-JSON content -> null', out === null, JSON.stringify(out)); }
{ const out = await openaiPropose('x', REQ, { client: fakeOpenAI('[1,2,3]') }); ok('JSON array (not an object) -> null', out === null, JSON.stringify(out)); }

console.log(failed === 0 ? '\nPASS: openai backend uses JSON mode and returns the parsed proposal ✅' : `\nFAIL: ${failed}`);
process.exit(failed ? 1 : 0);
