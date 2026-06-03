// from-text: the model-in-loop on-ramp is SAFE BY CONSTRUCTION. The model only proposes; the deterministic
// filter decides. We inject fake proposers — faithful AND adversarial — and prove a hallucinated intent, a
// missing parameter, or a weak property is rejected by the SAME path that vets a hand-authored one. No SDK,
// no API key: the injected `propose` means model-propose.mjs is never loaded here.
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fromTextToInvariant, fromTextToProperty } from '../src/author/from-text.mjs';

let failed = 0;
const ok = (n, c, d) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${n}${c ? '' : '  -- ' + d}`); if (!c) failed++; };
const fixed = (val) => async () => val; // a fake proposer that always returns `val` (ignores the text)

// (The envelope<->real-vocabulary link is asserted authoritatively in envelope.test.mjs.) Here we prove the
// FILTER decides: faithful proposals accepted, adversarial ones rejected by the same path.

// FAITHFUL proposal -> the filter accepts it (same as a hand-authored answer).
{ const r = await fromTextToInvariant('keep the Coordinator type thin', { propose: fixed({ intent: 'coordinator-thin', subject: 'Coordinator', max: 8 }) });
  ok('faithful invariant proposal ACCEPTED', r.ok === true && r.invariant.id === 'coordinator-coordinator-thin' && r.invariant.check.struct === 'Coordinator', JSON.stringify(r)); }

// ADVERSARIAL: a hallucinated intent not in the vocabulary -> REJECTED, with the proposal echoed for review.
{ const r = await fromTextToInvariant('make the code fast and clean', { propose: fixed({ intent: 'make-it-fast' }) });
  ok('hallucinated intent REJECTED (safe by construction)', r.ok === false && /unknown intent/.test(r.reason) && r.proposed.intent === 'make-it-fast', JSON.stringify(r)); }

// ADVERSARIAL: a real intent but a REQUIRED parameter omitted -> REJECTED with an actionable reason.
{ const r = await fromTextToInvariant('layers should not leak', { propose: fixed({ intent: 'layering', from: ['src/web'] }) });
  ok('real intent, missing required param REJECTED', r.ok === false && /needs:/.test(r.reason), JSON.stringify(r)); }

// PROPERTY path — faithful STRONG spec is accepted, kept.
const d = mkdtempSync(join(tmpdir(), 'guard-ft-')); mkdirSync(join(d, 'src'));
writeFileSync(join(d, 'src/age.js'), 'export const isAdult = (age) => age >= 18;\n');
{ const r = await fromTextToProperty(d, 'isAdult is true at 18 and false at 17', { propose: fixed({ shape: 'examples', module: './src/age.js', fn: 'isAdult', cases: [[18, true], [17, false]] }), target: join(d, 'src'), minKill: 50 });
  ok('faithful STRONG property ACCEPTED + kept', r.accepted === true && existsSync(join(d, r.file)), JSON.stringify(r)); }

// PROPERTY path — ADVERSARIAL WEAK spec (a non-boundary example) survives mutation -> REJECTED, draft deleted.
{ const d2 = mkdtempSync(join(tmpdir(), 'guard-ft-')); mkdirSync(join(d2, 'src'));
  writeFileSync(join(d2, 'src/age.js'), 'export const isAdult = (age) => age >= 18;\n');
  const r = await fromTextToProperty(d2, 'isAdult is true at 30', { propose: fixed({ shape: 'examples', module: './src/age.js', fn: 'isAdult', cases: [[30, true]] }), target: join(d2, 'src'), minKill: 50 });
  ok('weak property REJECTED + draft deleted (fail-small)', r.accepted === false && !existsSync(join(d2, 'prop-isAdult-examples.mjs')), JSON.stringify(r)); }

console.log(failed === 0 ? '\nPASS: free-text on-ramp is safe by construction — model proposes, deterministic filter decides ✅' : `\nFAIL: ${failed}`);
process.exit(failed ? 1 : 0);
