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
import { proposalSchema, proposerSystem } from './envelope.mjs';

const MODEL = process.env.ANCHOR_GUARD_MODEL || 'claude-opus-4-8';

// Wrap the shared proposal schema (envelope.mjs) as an Anthropic tool; forcing this tool yields structured
// output. The schema's discriminant enum is the real vocabulary — the model can only pick a known intent/shape.
export function proposalTool(envelope) {
  return {
    name: 'propose',
    description: `Propose one ${envelope.kind} capturing the user's intent. ${envelope.note}`,
    input_schema: proposalSchema(envelope),
  };
}

// Free text + envelope -> the model's structured proposal (the tool-call input), or null if it didn't call.
export async function modelPropose(text, envelope, { client = new Anthropic() } = {}) {
  const tool = proposalTool(envelope);
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: proposerSystem(envelope),
    tools: [tool],
    tool_choice: { type: 'tool', name: 'propose' },
    messages: [{ role: 'user', content: text }],
  });
  const call = (msg.content || []).find((b) => b.type === 'tool_use');
  return call ? call.input : null;
}
