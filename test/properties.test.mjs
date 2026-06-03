// Behavioral-property authoring: a strong (behavior-pinning) property is ACCEPTED; a weak one is REJECTED
// — the deterministic `arch property` filter decides, not the drafter. Fail-small: a rejected draft is
// deleted, never lands.
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { draftProperty, authorProperty, propertyShapes } from '../src/author/properties.mjs';

let failed = 0;
const ok = (n, c, d) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${n}${c ? '' : '  -- ' + d}`); if (!c) failed++; };

// target with a mutable boundary operator so mutation can discriminate strong from weak
const d = mkdtempSync(join(tmpdir(), 'guard-prop-'));
mkdirSync(join(d, 'src'));
writeFileSync(join(d, 'src/age.js'), 'export const isAdult = (age) => age >= 18;\n');

ok('shapes available', propertyShapes().includes('examples') && propertyShapes().includes('idempotence'), '');
ok('draftProperty emits a runnable file', draftProperty({ shape: 'examples', module: './src/age.js', fn: 'isAdult', cases: [[18, true]] }).content.includes('isAdult'), '');
ok('unknown shape -> reason', draftProperty({ shape: 'nope', fn: 'x' }).ok === false, '');

// STRONG: pins the boundary (18 true, 17 false) -> kills the >= mutant -> ACCEPT
{ const r = authorProperty(d, { shape: 'examples', module: './src/age.js', fn: 'isAdult', cases: [[18, true], [17, false]] }, { target: join(d, 'src'), minKill: 50 });
  ok('strong (boundary-pinning) property ACCEPTED + kept', r.accepted === true && existsSync(join(d, r.file)), JSON.stringify(r)); }

// WEAK: a single non-boundary example -> survives the mutant -> REJECT, draft deleted (fresh dir to
// avoid colliding with the strong one's file)
{ const d2 = mkdtempSync(join(tmpdir(), 'guard-prop-')); mkdirSync(join(d2, 'src'));
  writeFileSync(join(d2, 'src/age.js'), 'export const isAdult = (age) => age >= 18;\n');
  const r = authorProperty(d2, { shape: 'examples', module: './src/age.js', fn: 'isAdult', cases: [[20, true]] }, { target: join(d2, 'src'), minKill: 50 });
  ok('weak property REJECTED + draft deleted (fail-small)', r.accepted === false && !existsSync(join(d2, 'prop-isAdult-examples.mjs')), JSON.stringify(r)); }

console.log(failed === 0 ? '\nPASS: property authoring keeps strong invariants, drops weak ones — arch property decides ✅' : `\nFAIL: ${failed}`);
process.exit(failed ? 1 : 0);
