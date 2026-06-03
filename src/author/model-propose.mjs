// author/model-propose — the ANTHROPIC proposer backend. Imports a model SDK; the isolate-import invariant
// keeps it (and everything that loads it) out of the gate-time paths (validate/, agent/). It receives a
// { system, schema } request from from-text.mjs and uses Anthropic tool-use (forced) so the model MUST return
// typed JSON we never parse out of prose. It only PROPOSES — the deterministic filter downstream decides — so
// a wrong, weak, or hallucinated proposal is harmless: it is rejected exactly as a hand-written one would be.
//
// The `client` is injectable (default: `new Anthropic()`, reading ANTHROPIC_API_KEY); tests inject a fake, so
// no key or network is touched. Loaded only lazily (from-text.mjs backend registry, or its own test).
import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.ANCHOR_GUARD_MODEL || 'claude-opus-4-8';

// Wrap a JSON schema as the forced `propose` tool; forcing it yields structured output. The schema's
// discriminant enum is the real vocabulary — the model can only pick a known intent/shape.
export function proposalTool(schema) {
  return { name: 'propose', description: "Propose one structured proposal capturing the user's intent.", input_schema: schema };
}

// (text, { system, schema }) -> the model's structured proposal (the tool-call input), or null if it didn't call.
export async function anthropicPropose(text, { system, schema }, { client = new Anthropic() } = {}) {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    tools: [proposalTool(schema)],
    tool_choice: { type: 'tool', name: 'propose' },
    messages: [{ role: 'user', content: text }],
  });
  const call = (msg.content || []).find((b) => b.type === 'tool_use');
  return call ? call.input : null;
}
