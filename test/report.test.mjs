// The PR markdown report: PASS vs BLOCKED, with the violation table.
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gateReport } from '../src/cli/report.mjs';

const SPRAG = `${dirname(fileURLToPath(import.meta.url))}/../../sprag`;
let failed = 0;
const ok = (n, c, d) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${n}${c ? '' : '  -- ' + d}`); if (!c) failed++; };
const git = (d, ...a) => spawnSync('git', ['-C', d, ...a], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });

const d = mkdtempSync(join(tmpdir(), 'guard-report-'));
mkdirSync(join(d, 'src/ui'), { recursive: true }); mkdirSync(join(d, 'src/db'), { recursive: true });
writeFileSync(join(d, 'src/ui/page.js'), "export const r = () => 'p';\n");
writeFileSync(join(d, 'src/db/internal.js'), 'export const raw = () => [];\n');
writeFileSync(join(d, 'arch-invariants.json'), JSON.stringify([
  { id: 'no-ui-to-db', intent: 'UI must not reach into DB internals', check: { kind: 'forbid_path', dirs: ['src/ui'], path: 'db/internal' }, max: 0, mode: 'ratchet', severity: 'block' },
]));
git(d, 'init', '-q');
spawnSync('node', [`${SPRAG}/arch-gate.mjs`, d, '--invariants', join(d, 'arch-invariants.json'), '--baseline', '--baseline-out', join(d, 'arch-invariants.baseline.json')]);
git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'clean');

ok('clean -> PASS report', /✅ Architecture gate: PASS/.test(gateReport(d)), gateReport(d).slice(0, 60));

writeFileSync(join(d, 'src/ui/page.js'), "import { raw } from '../db/internal.js';\nexport const r = () => raw();\n");
const rep = gateReport(d);
ok('violation -> BLOCKED report with the invariant row', /❌ Architecture gate: BLOCKED/.test(rep) && /no-ui-to-db/.test(rep) && /UI must not reach into DB internals/.test(rep), rep.slice(0, 120));

console.log(failed === 0 ? '\nPASS: PR report renders PASS/BLOCKED with the violation table ✅' : `\nFAIL: ${failed}`);
process.exit(failed ? 1 : 0);
