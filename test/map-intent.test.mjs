// Tests for the structural-mapping milestone: interview answers -> sprag invariants, with the fail-small
// property (a bad answer yields NO invariant, never a wrong one).
import { mapIntent, mapInterview, intentVocabulary, INTENT_PARAMS } from '../src/author/map-intent.mjs';

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

// TYPE ROBUSTNESS: the proposer often returns an array param as a JSON STRING or a bare string. The filter
// must coerce it to a real array — never CRASH and never ACCEPT a malformed invariant (dirs must be array).
{ const r = mapIntent({ intent: 'layering', from: '["src/validate"]', forbid: 'src/cli/' }); // JSON-string array
  ok('layering coerces a JSON-string array param', r.ok && Array.isArray(r.invariant.check.dirs) && r.invariant.check.dirs[0] === 'src/validate', JSON.stringify(r)); }
{ const r = mapIntent({ intent: 'layering', from: 'src/validate', forbid: 'src/cli/' }); // bare string -> [string]
  ok('layering coerces a bare string to a single-element array', r.ok && Array.isArray(r.invariant.check.dirs) && r.invariant.check.dirs.length === 1, JSON.stringify(r)); }
{ const r = mapIntent({ intent: 'isolate-import', forbidIn: '["src/agent","src/validate"]', path: 'openai' });
  ok('isolate-import coerces forbidIn; dirs is a real array (no silent-malformed accept)', r.ok && Array.isArray(r.invariant.check.dirs) && r.invariant.check.dirs.length === 2, JSON.stringify(r)); }
{ const r = mapIntent({ intent: 'layering', from: 42, forbid: 'src/cli/' }); // non-coercible -> fail-small, no throw
  ok('non-array-shaped param fails small (no crash)', !r.ok && /from/.test(r.reason), JSON.stringify(r)); }

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

// No drift: every intent has a param catalog entry (so the free-text proposer is guided for ALL of them).
{ const undocumented = intentVocabulary().filter((i) => !(i in INTENT_PARAMS));
  ok('every intent is documented in INTENT_PARAMS', undocumented.length === 0, `undocumented: ${undocumented.join(', ')}`); }

console.log(failed === 0 ? '\nPASS: structural-mapping turns intent into invariants, fails small on bad input ✅' : `\nFAIL: ${failed}`);
process.exit(failed ? 1 : 0);
