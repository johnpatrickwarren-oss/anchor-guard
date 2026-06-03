// Tests for the structural-mapping milestone: interview answers -> sprag invariants, with the fail-small
// property (a bad answer yields NO invariant, never a wrong one).
import { mapIntent, mapInterview, intentVocabulary } from '../src/author/map-intent.mjs';

let failed = 0;
const ok = (n, c, d) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${n}${c ? '' : '  -- ' + d}`); if (!c) failed++; };

// generic intent -> direct invariant, no params needed
{ const r = mapIntent({ intent: 'no-god-functions' });
  ok('generic intent maps directly', r.ok && r.invariant.check.kind === 'max_complexity', JSON.stringify(r)); }

// specific intent with its param -> instantiated invariant
{ const r = mapIntent({ intent: 'coordinator-thin', subject: 'Model', max: 8 });
  ok('coordinator-thin with subject maps to struct_field_count', r.ok && r.invariant.check.kind === 'struct_field_count' && r.invariant.check.struct === 'Model', JSON.stringify(r)); }

// the headline product invariant: isolate a model SDK import to certain dirs
{ const r = mapIntent({ intent: 'isolate-import', forbidIn: ['src/validate', 'src/agent'], path: '@anthropic-ai/sdk' });
  ok('isolate-import maps to a forbid_path on the SDK', r.ok && r.invariant.check.kind === 'forbid_path' && r.invariant.check.path === '@anthropic-ai/sdk', JSON.stringify(r)); }

// FAIL-SMALL: missing required param -> a clear reason, NOT a silent/wrong invariant
{ const r = mapIntent({ intent: 'coordinator-thin' }); // no subject
  ok('missing param yields a reason, not an invariant', !r.ok && /subject/.test(r.reason), JSON.stringify(r)); }

// FAIL-SMALL: unknown intent -> reason, not a guess
{ const r = mapIntent({ intent: 'make-it-good' });
  ok('unknown intent yields a reason, not a guess', !r.ok && /unknown intent/.test(r.reason), JSON.stringify(r)); }

// a full interview: good answers map, bad ones land in `unmapped` (surfaced, not silently dropped)
{ const r = mapInterview([
    { intent: 'no-god-functions' },
    { intent: 'layering', from: ['src/cli'], forbid: 'src/db' },
    { intent: 'coordinator-thin' },     // missing subject -> unmapped
    { intent: 'nonsense' },             // unknown -> unmapped
  ]);
  ok('interview maps the good, surfaces the bad', r.invariants.length === 2 && r.unmapped.length === 2, JSON.stringify(r.unmapped)); }

ok('vocabulary is non-empty', intentVocabulary().length >= 10, `${intentVocabulary().length}`);

console.log(failed === 0 ? '\nPASS: structural-mapping turns intent into invariants, fails small on bad input ✅' : `\nFAIL: ${failed}`);
process.exit(failed ? 1 : 0);
