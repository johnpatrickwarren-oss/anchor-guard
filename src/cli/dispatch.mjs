// cli/ — the thin coordinator (decision D3: stays thin, enforced by its own gate). Parses argv, routes
// to a command, prints. No business logic lives here.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { runGate, recordBaseline } from '../validate/gate.mjs';
import { mapInterview, intentVocabulary } from '../author/map-intent.mjs';

const USAGE = `guard <command>
  check  <dir>                       run the gate (architecture invariants + meta-ratchet + fail-closed)
  author <dir> --answers <file.json> map interview answers -> arch-invariants.json, then baseline + arm
  mcp                                start the MCP agent-loop server (gate as tools the agent calls in-loop)
  vocab                              list the v1 intent vocabulary`;

function cmdCheck(argv) {
  const dir = argv[0] || '.';
  const r = runGate(dir);
  process.stdout.write(r.out);
  console.log(r.ok ? '\nguard: PASS — architecture holds, gate intact.' : `\nguard: BLOCKED (exit ${r.code}).`);
  process.exit(r.code ?? 1);
}

function cmdAuthor(argv) {
  const dir = argv.find((a) => !a.startsWith('--')) || '.';
  const ai = argv.indexOf('--answers');
  if (ai < 0) { console.error('author: --answers <file.json> required'); process.exit(64); }
  const answers = JSON.parse(readFileSync(argv[ai + 1], 'utf8'));
  const { invariants, unmapped } = mapInterview(answers);
  const out = join(dir, 'arch-invariants.json');
  writeFileSync(out, JSON.stringify(invariants, null, 2) + '\n');
  console.log(`guard: wrote ${invariants.length} invariant(s) -> ${out}`);
  for (const u of unmapped) console.log(`  ~ couldn't derive (${u.reason})`);
  const b = recordBaseline(dir);
  console.log(b.ok ? 'guard: baselined from current state (ratchet armed; meta-ratchet guards this config).' : `guard: baseline failed:\n${b.out}`);
  process.exit(b.ok ? 0 : 1);
}

export function dispatch(argv) {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case 'check': return cmdCheck(rest);
    case 'author': return cmdAuthor(rest);
    case 'mcp': return void import('../agent/server.mjs').then((m) => m.startStdio()); // lazy: MCP SDK only loaded here
    case 'vocab': console.log(intentVocabulary().join('\n')); return process.exit(0);
    default: console.error(USAGE); return process.exit(cmd ? 64 : 0);
  }
}
