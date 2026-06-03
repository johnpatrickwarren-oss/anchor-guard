// MCP agent-loop server: in-process client<->server round-trip. Proves the agent can (a) read the
// architecture contract, (b) get actionable violations after a bad change, and (c) NOT talk past the gate
// by relaxing the config — the meta-ratchet violation surfaces through the MCP tool too.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/agent/server.mjs';

const SPRAG = `${dirname(fileURLToPath(import.meta.url))}/../../sprag`;
let failed = 0;
const ok = (n, c, d) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${n}${c ? '' : '  -- ' + d}`); if (!c) failed++; };
const git = (d, ...a) => spawnSync('git', ['-C', d, ...a], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });

// a fixture repo: src/ui must not import src/db/internal; meta-ratchet guards the config
const d = mkdtempSync(join(tmpdir(), 'guard-mcp-'));
mkdirSync(join(d, 'src/ui'), { recursive: true }); mkdirSync(join(d, 'src/db'), { recursive: true });
writeFileSync(join(d, 'src/ui/page.js'), "export const render = () => 'page';\n");
writeFileSync(join(d, 'src/db/internal.js'), 'export const rawRows = () => [];\n');
writeFileSync(join(d, 'arch-invariants.json'), JSON.stringify([
  { id: 'no-ui-to-db-internal', intent: 'UI must not reach into DB internals.', check: { kind: 'forbid_path', dirs: ['src/ui'], path: 'db/internal' }, max: 0, mode: 'ratchet', severity: 'block' },
  { id: 'no-config-relaxation', intent: 'The gate guards itself — a rule cannot be silently deleted.', check: { kind: 'config_relaxations', invariants: 'arch-invariants.json', baseline: 'arch-invariants.baseline.json', against: 'HEAD' }, max: 0, severity: 'block' },
], null, 2));
git(d, 'init', '-q');
spawnSync('node', [`${SPRAG}/arch-gate.mjs`, d, '--invariants', join(d, 'arch-invariants.json'), '--baseline', '--baseline-out', join(d, 'arch-invariants.baseline.json')]);
git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'clean');

// wire an MCP client to the server in-process
const [ct, st] = InMemoryTransport.createLinkedPair();
const server = createServer();
await server.connect(st);
const client = new Client({ name: 'test', version: '0.0.0' }, { capabilities: {} });
await client.connect(ct);
const call = async (name) => { const r = await client.callTool({ name, arguments: { dir: d } }); return { err: !!r.isError, text: r.content[0].text }; };

const { tools } = await client.listTools();
ok('lists guard_check + guard_invariants', tools.length === 2 && tools.some((t) => t.name === 'guard_check') && tools.some((t) => t.name === 'guard_invariants'), tools.map((t) => t.name).join());

{ const r = await call('guard_invariants');
  ok('guard_invariants returns the contract', !r.err && /no-ui-to-db-internal/.test(r.text) && /2 architecture invariant/.test(r.text), r.text); }

{ const r = await call('guard_check'); // clean
  ok('guard_check on clean tree -> PASS (not isError)', !r.err && /PASS/.test(r.text), r.text); }

// the agent writes a layering violation
writeFileSync(join(d, 'src/ui/page.js'), "import { rawRows } from '../db/internal.js';\nexport const render = () => rawRows();\n");
{ const r = await call('guard_check');
  ok('guard_check after a violation -> BLOCKED with the intent', r.err && /BLOCKED/.test(r.text) && /UI must not reach into DB internals/.test(r.text), r.text); }

// the agent tries to talk past the gate: delete the rule instead of fixing the code
const relaxed = JSON.parse(readFileSync(join(d, 'arch-invariants.json'), 'utf8')).filter((i) => i.id !== 'no-ui-to-db-internal');
writeFileSync(join(d, 'arch-invariants.json'), JSON.stringify(relaxed, null, 2));
{ const r = await call('guard_check');
  ok('agent CANNOT talk past it: deleting the rule -> meta-ratchet BLOCK through MCP', r.err && /BLOCKED/.test(r.text) && /no-config-relaxation|REMOVED|relaxation/i.test(r.text), r.text); }

await client.close(); await server.close();
console.log(failed === 0 ? '\nPASS: MCP server exposes the gate in-loop; the agent cannot weaken it through the protocol ✅' : `\nFAIL: ${failed}`);
process.exit(failed ? 1 : 0);
