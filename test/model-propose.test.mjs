// model-propose (ANTHROPIC backend): wraps the passed JSON schema as a forced tool and returns the model's
// structured tool-call input. We inject a FAKE Anthropic client, so this runs with no API key and no network.
// A literal { system, schema } request stands in for what from-text.mjs builds from the envelope.
import { proposalTool, anthropicPropose } from '../src/author/model-propose.mjs';

let failed = 0;
const ok = (n, c, d) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${n}${c ? '' : '  -- ' + d}`); if (!c) failed++; };

const SCHEMA = { type: 'object', properties: { intent: { type: 'string', enum: ['no-god-functions', 'layering'] } }, required: ['intent'], additionalProperties: true };
const REQ = { system: 'You only PROPOSE; a verifier decides.', schema: SCHEMA };

// proposalTool wraps the schema verbatim as the forced `propose` tool.
const tool = proposalTool(SCHEMA);
ok('proposalTool wraps the schema as the propose tool', tool.name === 'propose' && tool.input_schema === SCHEMA, JSON.stringify(tool));

// anthropicPropose: a fake client returning a tool_use block -> we extract its `.input` verbatim.
let seen;
const fakeClient = { messages: { create: async (req) => { seen = req; return { content: [{ type: 'text', text: 'ignored' }, { type: 'tool_use', name: 'propose', input: { intent: 'no-god-functions', max: 10 } }] }; } } };
const out = await anthropicPropose('keep functions small', REQ, { client: fakeClient });
ok('anthropicPropose returns the tool-call input', out && out.intent === 'no-god-functions' && out.max === 10, JSON.stringify(out));
ok('forces the propose tool (structured output, no prose)', seen.tool_choice.type === 'tool' && seen.tool_choice.name === 'propose' && seen.tools[0].input_schema === SCHEMA && seen.system === REQ.system, JSON.stringify(seen.tool_choice));

// No tool call (model returned only prose) -> null, so the deterministic filter rejects an empty proposal.
const noCall = { messages: { create: async () => ({ content: [{ type: 'text', text: 'I am not sure' }] }) } };
ok('no tool_use -> null proposal', (await anthropicPropose('vague', REQ, { client: noCall })) === null, '');

console.log(failed === 0 ? '\nPASS: anthropic backend forces the tool and extracts structured output ✅' : `\nFAIL: ${failed}`);
process.exit(failed ? 1 : 0);
