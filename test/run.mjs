// Runs every *.test.mjs in test/.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const tests = readdirSync(HERE).filter((f) => f.endsWith('.test.mjs')).sort();
let failed = 0;
for (const t of tests) {
  const r = spawnSync('node', [join(HERE, t)], { encoding: 'utf8' });
  const last = (r.stdout || '').trim().split('\n').filter(Boolean).pop() || '(no output)';
  console.log(`${r.status === 0 ? 'PASS' : 'FAIL'}  ${t.padEnd(28)} ${last.replace(/^PASS:\s*/, '').slice(0, 70)}`);
  if (r.status !== 0) { failed++; if (r.stderr) console.log(r.stderr.trim().split('\n').slice(-3).join('\n')); }
}
console.log(`\n${tests.length - failed}/${tests.length} test files passed.`);
process.exit(failed ? 1 : 0);
