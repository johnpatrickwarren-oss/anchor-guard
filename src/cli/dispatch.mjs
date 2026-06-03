// cli/ — the thin coordinator (decision D3: stays thin, enforced by its own gate). Parses argv, routes
// to a command, prints. No business logic lives here.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { runGate, recordBaseline } from '../validate/gate.mjs';
import { mapInterview, intentVocabulary } from '../author/map-intent.mjs';
import { runInterview } from '../interview/ask.mjs';
import { gateReport } from './report.mjs';

const USAGE = `guard <command>
  init   [dir]                       conversational interview -> arch-invariants.json, then baseline + arm
  check  <dir>                       run the gate (architecture invariants + meta-ratchet + fail-closed)
  author <dir> --answers <file.json> map a saved answers file -> arch-invariants.json, then baseline + arm
  mcp                                start the MCP agent-loop server (gate as tools the agent calls in-loop)
  report [dir]                       print a markdown gate summary (for a PR comment)
  suggest <text> [--property [dir]]  free-text intent -> a proposal the deterministic filter accepts or rejects
  vocab                              list the v1 intent vocabulary`;

// Shared arming: answers -> arch-invariants.json -> baseline (ratchet-from-current; meta-ratchet guards it).
function armFromAnswers(dir, answers) {
  const { invariants, unmapped } = mapInterview(answers);
  writeFileSync(join(dir, 'arch-invariants.json'), JSON.stringify(invariants, null, 2) + '\n');
  console.log(`guard: wrote ${invariants.length} invariant(s) -> ${join(dir, 'arch-invariants.json')}`);
  for (const u of unmapped) console.log(`  ~ couldn't derive (${u.reason})`);
  const b = recordBaseline(dir);
  console.log(b.ok ? 'guard: baselined from current state (ratchet armed; meta-ratchet guards this config).' : `guard: baseline failed:\n${b.out}`);
  return b.ok;
}

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
  process.exit(armFromAnswers(dir, answers) ? 0 : 1);
}

async function cmdInit(argv) {
  const dir = argv.find((a) => !a.startsWith('--')) || '.';
  console.log('guard: a few questions to author your architecture contract (Enter skips, Y/n toggles).\n');
  // Interactive TTY -> readline. Piped/scripted input (CI, `guard init < answers.txt`) -> read all stdin
  // and queue lines; readline drops bulk-piped lines, so we don't use it there.
  let ask, done = () => {};
  if (process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    ask = (p) => rl.question(p); done = () => rl.close();
  } else {
    let data = ''; for await (const chunk of process.stdin) data += chunk;
    const lines = data.split('\n'); let i = 0;
    ask = async (p) => { process.stdout.write(p); return lines[i++] ?? ''; };
  }
  const answers = await runInterview(ask);
  done();
  console.log('');
  process.exit(armFromAnswers(dir, answers) ? 0 : 1);
}

// suggest: the model-in-loop on-ramp. Free text -> the model PROPOSES a structured shape -> the SAME
// deterministic filter (mapIntent / arch property) ACCEPTS or REJECTS it. from-text.mjs is lazy-imported so
// the model SDK never loads for any other command (and stays out of gate-time paths). Uses an
// ANTHROPIC_API_KEY if set, else the signed-in `claude` CLI (your subscription) — see from-text.mjs.
async function cmdSuggest(argv) {
  const property = argv.includes('--property');
  const di = argv.indexOf('--dir');
  const dir = di >= 0 ? argv[di + 1] : '.';
  const text = argv.filter((a, i) => !a.startsWith('--') && !(di >= 0 && i === di + 1)).join(' ').trim();
  if (!text) { console.error('suggest: a plain-English intent is required, e.g. guard suggest "keep coordinators thin"'); process.exit(64); }
  const { fromTextToInvariant, fromTextToProperty } = await import('../author/from-text.mjs');
  let r;
  try { r = property ? await fromTextToProperty(dir, text) : await fromTextToInvariant(text); }
  catch (e) { console.error(`suggest: the proposal model call failed (${e?.message || e}).\nneeds either ANTHROPIC_API_KEY (metered API) OR a signed-in \`claude\` CLI (your subscription — used automatically when no key is set). Force with ANCHOR_GUARD_BACKEND=api|cli. The model only proposes — authoring-time only, never at gate-time.`); process.exit(70); }
  console.log(`guard: the model proposed:\n${JSON.stringify(r.proposed, null, 2)}\n`);
  const accepted = property ? r.accepted : r.ok;
  if (accepted) { console.log(`guard: ACCEPTED by the deterministic filter:\n${JSON.stringify(r.invariant ?? { file: r.file }, null, 2)}`); return process.exit(0); }
  console.log(`guard: REJECTED — ${r.reason} (the model only proposes; the filter decides).`);
  process.exit(1);
}

export function dispatch(argv) {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case 'init': return cmdInit(rest);
    case 'check': return cmdCheck(rest);
    case 'author': return cmdAuthor(rest);
    case 'mcp': return void import('../agent/server.mjs').then((m) => m.startStdio()); // lazy: MCP SDK only loaded here
    case 'report': console.log(gateReport(rest[0] || '.')); return process.exit(0); // markdown for a PR comment
    case 'suggest': return cmdSuggest(rest);
    case 'vocab': console.log(intentVocabulary().join('\n')); return process.exit(0);
    default: console.error(USAGE); return process.exit(cmd ? 64 : 0);
  }
}
