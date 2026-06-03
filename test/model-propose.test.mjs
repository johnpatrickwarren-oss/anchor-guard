// model-propose: the SDK boundary builds a constrained tool (enum = real vocabulary) and returns the model's
// structured tool-call input. We inject a FAKE Anthropic client, so this runs with no API key and no network
// — it tests the schema-building and extraction logic, not the live model. (The default `new Anthropic()` is
// only constructed when no client is injected, so importing this module never needs a key.)
import { proposalTool, modelPropose } from '../src/author/model-propose.mjs';
import { INVARIANT_ENVELOPE, PROPERTY_ENVELOPE } from '../src/author/from-text.mjs';

let failed = 0;
const ok = (n, c, d) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${n}${c ? '' : '  -- ' + d}`); if (!c) failed++; };

// proposalTool: the discriminant is an enum of the real vocabulary; params stay open for the filter to vet.
const it = proposalTool(INVARIANT_ENVELOPE);
ok('invariant tool constrains intent to the vocabulary enum', it.input_schema.properties.intent.enum.includes('layering') && it.input_schema.required[0] === 'intent', JSON.stringify(it.input_schema));
ok('invariant tool leaves params open (filter validates them)', it.input_schema.additionalProperties === true, '');
const pt = proposalTool(PROPERTY_ENVELOPE);
ok('property tool constrains shape to the shape enum', pt.input_schema.properties.shape.enum.includes('examples') && pt.input_schema.required[0] === 'shape', JSON.stringify(pt.input_schema));

// modelPropose: a fake client that returns a tool_use block -> we extract its `.input` verbatim.
let seen;
const fakeClient = { messages: { create: async (req) => { seen = req; return { content: [{ type: 'text', text: 'ignored' }, { type: 'tool_use', name: 'propose', input: { intent: 'no-god-functions', max: 10 } }] }; } } };
const out = await modelPropose('keep functions small', INVARIANT_ENVELOPE, { client: fakeClient });
ok('modelPropose returns the tool-call input', out && out.intent === 'no-god-functions' && out.max === 10, JSON.stringify(out));
ok('modelPropose forces the propose tool (structured output, no prose)', seen.tool_choice.type === 'tool' && seen.tool_choice.name === 'propose' && seen.tools[0].name === 'propose', JSON.stringify(seen.tool_choice));

// No tool call (model returned only prose) -> null, so the deterministic filter rejects an empty proposal.
const noCall = { messages: { create: async () => ({ content: [{ type: 'text', text: 'I am not sure' }] }) } };
ok('no tool_use -> null proposal', (await modelPropose('vague', INVARIANT_ENVELOPE, { client: noCall })) === null, '');

console.log(failed === 0 ? '\nPASS: model boundary builds a constrained tool and extracts structured output ✅' : `\nFAIL: ${failed}`);
process.exit(failed ? 1 : 0);
