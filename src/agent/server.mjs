// agent/ — the MCP agent-loop server. Exposes the gate as tools an AI agent (Claude Code, Cursor, any
// MCP host) calls AS IT WRITES, so violations are caught and fixed in the turn — and the gate can't be
// talked past: relaxing or deleting a rule surfaces as a meta-ratchet violation here too. This module is
// gate-time and MODEL-FREE (isolate-import invariant): it orchestrates sprag via validate/, never imports
// a model SDK. The agent's model is external; @modelcontextprotocol/sdk is a protocol SDK, not a model.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { runGateJson, activeInvariants } from '../validate/gate.mjs';

const TOOLS = [
  {
    name: 'guard_invariants',
    description: 'List the architecture invariants this repo enforces — the contract you must respect as you write. Call BEFORE making structural changes.',
    inputSchema: { type: 'object', properties: { dir: { type: 'string', description: 'repo dir (default: cwd)' } } },
  },
  {
    name: 'guard_check',
    description: 'Run the architecture gate on the working tree. Call AFTER changes; fix any violation before finishing. The gate cannot be disabled — relaxing or deleting a rule is itself reported as a violation.',
    inputSchema: { type: 'object', properties: { dir: { type: 'string', description: 'repo dir (default: cwd)' } } },
  },
];

const textResult = (text, isError = false) => ({ content: [{ type: 'text', text }], isError });

function toolInvariants(dir) {
  const inv = activeInvariants(dir);
  if (!inv.length) return textResult('No arch-invariants.json — run `guard author` to arm the architecture contract first.');
  const lines = inv.map((i) => `- [${i.id}] ${i.intent}`).join('\n');
  return textResult(`This repo enforces ${inv.length} architecture invariant(s). Respect them as you write:\n${lines}`);
}

function toolCheck(dir) {
  const r = runGateJson(dir);
  if (r.engineError) return textResult(`Gate FAILED CLOSED (analysis engine unavailable) — a hard stop, not a pass. Fix the environment.\n${r.raw}`, true);
  if (r.ok) return textResult('Architecture gate: PASS. No violations; the contract holds.');
  const lines = r.violations.map((v) => `- [${v.id}] ${v.intent}\n    ${v.reason}`).join('\n');
  return textResult(`Architecture gate: BLOCKED. Fix these before finishing — you cannot pass by relaxing or deleting a rule (that is itself blocked):\n${lines || r.raw}`, true);
}

// Build the configured MCP server (not yet connected) — so tests can wire it to an in-memory transport.
export function createServer() {
  const server = new Server({ name: 'anchor-guard', version: '0.0.1' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const dir = req.params.arguments?.dir || process.cwd();
    if (req.params.name === 'guard_invariants') return toolInvariants(dir);
    if (req.params.name === 'guard_check') return toolCheck(dir);
    return textResult(`unknown tool: ${req.params.name}`, true);
  });
  return server;
}

// Start the server over stdio — the real entry for an MCP host (`guard mcp`).
export async function startStdio() {
  const server = createServer();
  await server.connect(new StdioServerTransport());
  return server;
}
