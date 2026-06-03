// author/cli-propose — a proposer backend that uses your Claude SUBSCRIPTION instead of a metered API key,
// by shelling out to the `claude` CLI (Claude Code) in print mode. No model SDK and no ANTHROPIC_API_KEY: it
// reuses Claude Code's own auth (e.g. a Max plan), so an individual can try the on-ramp without per-token
// billing. Like the SDK backend it only PROPOSES — the deterministic filter still decides. `--json-schema`
// gives constrained structured output (the CLI analogue of forced tool-use); the proposal lands in the
// result's `structured_output` field. The runner is injectable so tests need no real `claude` call.
import { spawnSync } from 'node:child_process';
import { proposalSchema, PROPOSER_SYSTEM } from './envelope.mjs';

const MODEL = process.env.ANCHOR_GUARD_MODEL || 'opus'; // CLI accepts an alias ('opus') or a full id
const CLI = process.env.ANCHOR_GUARD_CLAUDE || 'claude';

export function cliPropose(text, envelope, { run = spawnSync } = {}) {
  const args = ['-p', text, '--output-format', 'json', '--model', MODEL,
    '--json-schema', JSON.stringify(proposalSchema(envelope)), '--append-system-prompt', PROPOSER_SYSTEM];
  const r = run(CLI, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (r.error) throw new Error(`could not run \`${CLI}\` (${r.error.message}). Is Claude Code installed and signed in?`);
  if (r.status !== 0) throw new Error(`\`${CLI} -p\` exited ${r.status}: ${(r.stderr || r.stdout || '').trim().slice(0, 300)}`);
  let out;
  try { out = JSON.parse(r.stdout); } catch { throw new Error(`\`${CLI} -p\` did not return JSON: ${(r.stdout || '').trim().slice(0, 200)}`); }
  return out.structured_output ?? null;
}
