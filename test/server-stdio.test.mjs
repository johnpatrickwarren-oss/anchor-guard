// MCP over REAL stdio: spawns the actual product entry (`bin/guard.mjs mcp`) as a child process and
// drives it with the SDK's stdio client transport — initialize handshake, tools/list, tools/call.
// The in-process test (server.test.mjs) proves the tool logic; this one proves the transport an MCP
// host actually uses (framing over stdin/stdout, process lifecycle) — the claim in STATE.md / D8.
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const GUARD = join(HERE, '..', 'bin', 'guard.mjs');
const SPRAG = join(HERE, '..', '..', 'sprag');
let failed = 0;
const ok = (n, c, d) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${n}${c ? '' : '  -- ' + d}`); if (!c) failed++; };
const git = (d, ...a) => spawnSync('git', ['-C', d, ...a], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });

// same fixture shape as server.test.mjs: one layering rule + the meta-ratchet, committed clean
const d = mkdtempSync(join(tmpdir(), 'guard-mcp-stdio-'));
mkdirSync(join(d, 'src/ui'), { recursive: true }); mkdirSync(join(d, 'src/db'), { recursive: true });
writeFileSync(join(d, 'src/ui/page.js'), "export const render = () => 'page';\n");
writeFileSync(join(d, 'src/db/internal.js'), 'export const rawRows = () => [];\n');
writeFileSync(join(d, 'arch-invariants.json'), JSON.stringify([
  { id: 'no-ui-to-db-internal', intent: 'UI must not reach into DB internals.', check: { kind: 'forbid_path', dirs: ['src/ui'], path: 'db/internal' }, max: 0, mode: 'ratchet', severity: 'block' },
  { id: 'no-config-relaxation', intent: 'The gate guards itself.', check: { kind: 'config_relaxations', invariants: 'arch-invariants.json', baseline: 'arch-invariants.baseline.json', against: 'HEAD' }, max: 0, severity: 'block' },
], null, 2));
git(d, 'init', '-q');
spawnSync('node', [`${SPRAG}/arch-gate.mjs`, d, '--invariants', join(d, 'arch-invariants.json'), '--baseline', '--baseline-out', join(d, 'arch-invariants.baseline.json')]);
git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'clean');

// spawn the REAL entry point; the transport owns the child process
const transport = new StdioClientTransport({ command: process.execPath, args: [GUARD, 'mcp'], stderr: 'ignore' });
const client = new Client({ name: 'stdio-test', version: '0.0.0' }, { capabilities: {} });
await client.connect(transport); // performs the MCP initialize handshake — hangs/throws if framing is broken

const { tools } = await client.listTools();
ok('stdio: tools/list returns both guard tools', tools.length === 2 && tools.some((t) => t.name === 'guard_check') && tools.some((t) => t.name === 'guard_invariants'), tools.map((t) => t.name).join());

{ const r = await client.callTool({ name: 'guard_invariants', arguments: { dir: d } });
  ok('stdio: guard_invariants returns the contract', !r.isError && /no-ui-to-db-internal/.test(r.content[0].text), r.content[0].text); }

{ const r = await client.callTool({ name: 'guard_check', arguments: { dir: d } });
  ok('stdio: guard_check on clean tree -> PASS', !r.isError && /PASS/.test(r.content[0].text), r.content[0].text); }

// a violation written mid-session is caught over the same connection
writeFileSync(join(d, 'src/ui/page.js'), "import { rawRows } from '../db/internal.js';\nexport const render = () => rawRows();\n");
{ const r = await client.callTool({ name: 'guard_check', arguments: { dir: d } });
  ok('stdio: violation -> BLOCKED over the wire', !!r.isError && /BLOCKED/.test(r.content[0].text), r.content[0].text); }

await client.close(); // closes the transport, which kills the child
console.log(failed === 0 ? '\nPASS: the real `guard mcp` stdio entry speaks MCP end-to-end (handshake, list, call, block) ✅' : `\nFAIL: ${failed}`);
process.exit(failed ? 1 : 0);
