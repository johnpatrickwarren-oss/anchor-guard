// author/model-propose — THE model boundary. The only file that imports a model SDK; the isolate-import
// invariant keeps it (and everything that loads it) out of the gate-time paths (validate/, agent/). It turns
// one free-text intent into ONE structured proposal that fills an envelope from from-text.mjs, using
// Anthropic tool-use so the model MUST return typed JSON we never have to parse out of prose. It only
// PROPOSES — the deterministic filter downstream (mapIntent / authorProperty) decides — so a wrong, weak, or
// hallucinated proposal is harmless: it is rejected exactly as a hand-written one would be.
//
// The `client` is injectable (default: `new Anthropic()`, reading ANTHROPIC_API_KEY); tests inject a fake,
// so no key or network is touched. This module is only ever loaded lazily (from-text.mjs default path, or its
// own test), mirroring how dispatch.mjs lazy-loads the MCP server.
import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.ANCHOR_GUARD_MODEL || 'claude-opus-4-8';

const SYSTEM = `You translate a developer's plain-English intent about code architecture or behavior into ONE structured proposal by calling the \`propose\` tool. Pick the closest intent/shape from the provided enum and fill in its parameters from the text. You only PROPOSE: a deterministic verifier decides whether to accept it, so never invent values you were not given — prefer to OMIT an uncertain parameter so the verifier can ask again rather than guess. Do not output prose; only call the tool.`;

// Build a tool whose input_schema is the envelope. The discriminant (intent|shape) is an enum of the REAL
// vocabulary, so the model can only pick something the downstream filter understands; params are open
// (additionalProperties) because they vary per intent/shape and the deterministic filter validates them.
export function proposalTool(envelope) {
  const isInvariant = envelope.kind === 'invariant';
  const key = isInvariant ? 'intent' : 'shape';
  const values = isInvariant ? envelope.intents : envelope.shapes;
  return {
    name: 'propose',
    description: `Propose one ${envelope.kind} capturing the user's intent. ${envelope.note}`,
    input_schema: {
      type: 'object',
      properties: { [key]: { type: 'string', enum: values } },
      required: [key],
      additionalProperties: true,
    },
  };
}

// Free text + envelope -> the model's structured proposal (the tool-call input), or null if it didn't call.
export async function modelPropose(text, envelope, { client = new Anthropic() } = {}) {
  const tool = proposalTool(envelope);
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    tools: [tool],
    tool_choice: { type: 'tool', name: 'propose' },
    messages: [{ role: 'user', content: text }],
  });
  const call = (msg.content || []).find((b) => b.type === 'tool_use');
  return call ? call.input : null;
}
