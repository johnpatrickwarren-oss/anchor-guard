// validate/gate: changedFiles + quick mode. Quick keeps per-file checks + the meta-ratchet but skips
// whole-tree walks (require_tests/module_fanin) for fast in-loop feedback.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runGateJson, changedFiles } from '../src/validate/gate.mjs';

const SPRAG = `${dirname(fileURLToPath(import.meta.url))}/../../sprag`;
let failed = 0;
const ok = (n, c, d) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${n}${c ? '' : '  -- ' + d}`); if (!c) failed++; };
const git = (d, ...a) => spawnSync('git', ['-C', d, ...a], { encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });

const d = mkdtempSync(join(tmpdir(), 'guard-gate-'));
mkdirSync(join(d, 'src/ui'), { recursive: true }); mkdirSync(join(d, 'src/db'), { recursive: true });
writeFileSync(join(d, 'src/ui/page.js'), "export const r = () => 'p';\n");
writeFileSync(join(d, 'src/db/internal.js'), 'export const raw = () => [];\n');
writeFileSync(join(d, 'arch-invariants.json'), JSON.stringify([
  { id: 'tests', intent: 'every module ships a test', check: { kind: 'require_tests', dirs: ['src'] }, mode: 'ratchet', severity: 'block' },
  { id: 'no-ui-to-db', intent: 'UI not DB internals', check: { kind: 'forbid_path', dirs: ['src/ui'], path: 'db/internal' }, max: 0, mode: 'ratchet', severity: 'block' },
  { id: 'self-guard', intent: 'config moves forward only', check: { kind: 'config_relaxations', invariants: 'arch-invariants.json', baseline: 'arch-invariants.baseline.json', against: 'HEAD' }, max: 0, severity: 'block' },
]));
git(d, 'init', '-q');
spawnSync('node', [`${SPRAG}/arch-gate.mjs`, d, '--invariants', join(d, 'arch-invariants.json'), '--baseline', '--baseline-out', join(d, 'arch-invariants.baseline.json')]);
git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'clean');

// changedFiles
writeFileSync(join(d, 'src/ui/page.js'), "export const r = () => 'p2';\n");
ok('changedFiles reports the edit', changedFiles(d).includes('src/ui/page.js'), changedFiles(d).join());
git(d, 'checkout', '-q', '--', 'src/ui/page.js');

// a whole-tree violation (new untested module) -> FULL blocks, QUICK passes (require_tests skipped)
writeFileSync(join(d, 'src/newmod.js'), 'export const z = 1;\n');
ok('full gate blocks the require_tests regression', runGateJson(d).blocked === true, '');
ok('quick gate SKIPS whole-tree (require_tests) -> pass', runGateJson(d, { quick: true }).ok === true, JSON.stringify(runGateJson(d, { quick: true }).violations));
rmSync(join(d, 'src/newmod.js'));

// a per-file violation (forbid_path) is STILL caught in quick
writeFileSync(join(d, 'src/ui/page.js'), "import { raw } from '../db/internal.js';\nexport const r = () => raw();\n");
ok('quick STILL catches a per-file forbid_path violation', runGateJson(d, { quick: true }).blocked === true && runGateJson(d, { quick: true }).violations.some((v) => v.id === 'no-ui-to-db'), '');
git(d, 'checkout', '-q', '--', 'src/ui/page.js');

// the meta-ratchet is STILL enforced in quick (delete a rule)
writeFileSync(join(d, 'arch-invariants.json'), JSON.stringify([{ id: 'self-guard', intent: 'x', check: { kind: 'config_relaxations', invariants: 'arch-invariants.json', baseline: 'arch-invariants.baseline.json', against: 'HEAD' }, max: 0, severity: 'block' }]));
ok('quick STILL enforces the meta-ratchet (deleting a rule blocks)', runGateJson(d, { quick: true }).blocked === true, '');

console.log(failed === 0 ? '\nPASS: quick = per-file + meta-ratchet, whole-tree deferred; changedFiles works ✅' : `\nFAIL: ${failed}`);
process.exit(failed ? 1 : 0);
