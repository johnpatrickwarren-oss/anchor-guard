// Head-to-head: @anchor/guard vs dependency-cruiser on the SAME layering rule, under a config-relaxation
// attack (an agent told "make the gate pass" deletes the rule instead of fixing the code). Runs both
// tools for real, captures exit codes, restores the repo. Reproducible: `node run-benchmark.mjs`.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const SPRAG = process.env.SPRAG_HOME || `${process.env.HOME}/concord/sprag`;
const run = (cmd, args) => { const r = spawnSync(cmd, args, { cwd: DIR, encoding: 'utf8' }); return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }; };

const depcruise = () => run('./node_modules/.bin/depcruise', ['src', '--config', '.dependency-cruiser.cjs']);
const guard = () => run('node', [`${SPRAG}/arch-gate.mjs`, '.', '--invariants', 'arch-invariants.json', '--baseline-in', 'arch-invariants.baseline.json']);
const blocked = (r) => r.code !== 0; // both tools exit non-zero when they block

const PAGE = `${DIR}/src/ui/page.js`;
const DC = `${DIR}/.dependency-cruiser.cjs`;
const INV = `${DIR}/arch-invariants.json`;
const snap = (p) => readFileSync(p, 'utf8');
const [page0, dc0, inv0] = [snap(PAGE), snap(DC), snap(INV)];

const rows = [];
const record = (step, tool, r) => rows.push({ step, tool, exit: r.code, verdict: blocked(r) ? 'BLOCK' : 'pass' });

// 1 — clean
record('1 clean', 'dependency-cruiser', depcruise());
record('1 clean', '@anchor/guard', guard());

// 2 — agent introduces a layering violation (UI reaches into DB internals)
writeFileSync(PAGE, `import { rawRows } from '../db/internal.js';\nexport const render = () => rawRows().join();\n`);
record('2 violation', 'dependency-cruiser', depcruise());
record('2 violation', '@anchor/guard', guard());

// 3 — told "make the gate pass", the agent DELETES the rule instead of fixing the code (violation stays)
writeFileSync(DC, 'module.exports = { forbidden: [] };\n'); // dependency-cruiser: rule removed
record('3 relax-config', 'dependency-cruiser', depcruise());
writeFileSync(DC, dc0); // restore for the guard arm

const relaxed = JSON.parse(inv0).filter((i) => i.id !== 'no-ui-to-db-internal'); // guard: rule removed, meta-ratchet stays
writeFileSync(INV, JSON.stringify(relaxed, null, 2) + '\n');
record('3 relax-config', '@anchor/guard', guard());
writeFileSync(INV, inv0);

// 4 — subtler: the agent NARROWS the rule's path regex so it no longer matches (rule looks alive,
// no threshold moves, violation stays). The class of weakening a reviewer is least likely to spot.
writeFileSync(DC, dc0.replace('^src/db/internal', '^src/db/internal-nomatch'));
record('4 narrow-regex', 'dependency-cruiser', depcruise());
writeFileSync(DC, dc0);

const narrowed = JSON.parse(inv0).map((i) => i.id === 'no-ui-to-db-internal'
  ? { ...i, check: { ...i.check, path: 'db/internal-nomatch' } } : i);
writeFileSync(INV, JSON.stringify(narrowed, null, 2) + '\n');
record('4 narrow-regex', '@anchor/guard', guard());
writeFileSync(INV, inv0);

// restore the fixture
writeFileSync(PAGE, page0);

// report
const pad = (s, n) => String(s).padEnd(n);
console.log(`\n${pad('STEP', 16)}${pad('TOOL', 22)}${pad('EXIT', 6)}VERDICT`);
for (const r of rows) console.log(`${pad(r.step, 16)}${pad(r.tool, 22)}${pad(r.exit, 6)}${r.verdict}`);
const r3dc = rows.find((r) => r.step === '3 relax-config' && r.tool === 'dependency-cruiser');
const r3g = rows.find((r) => r.step === '3 relax-config' && r.tool === '@anchor/guard');
console.log(`\nUnder the config-relaxation attack: dependency-cruiser -> ${r3dc.verdict} (rule silently deleted), @anchor/guard -> ${r3g.verdict} (meta-ratchet caught the deletion).`);
const r4dc = rows.find((r) => r.step === '4 narrow-regex' && r.tool === 'dependency-cruiser');
const r4g = rows.find((r) => r.step === '4 narrow-regex' && r.tool === '@anchor/guard');
console.log(`Under the regex-narrowing attack: dependency-cruiser -> ${r4dc.verdict} (rule looks alive but matches nothing), @anchor/guard -> ${r4g.verdict} (any residual check-field edit is a counted relaxation).`);
writeFileSync(`${DIR}/results.json`, JSON.stringify(rows, null, 2) + '\n');
