// The conversational interview: pure question logic + runInterview with a scripted `ask` (no TTY needed).
import { QUESTIONS, runInterview } from '../src/interview/ask.mjs';
// (that the produced answers map cleanly through mapInterview is asserted in map-intent.test.mjs + scan.test.mjs)

let failed = 0;
const ok = (n, c, d) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${n}${c ? '' : '  -- ' + d}`); if (!c) failed++; };
const q = (key) => QUESTIONS.find((x) => x.key === key);

// parsers: a named coordinator, a 'A -> B' layering, and skips
ok('coordinator: a name -> intent', q('coordinator').parse('Model').intent === 'coordinator-thin' && q('coordinator').parse('Model').subject === 'Model', '');
ok('coordinator: empty -> skip', q('coordinator').parse('  ') === null, '');
{ const a = q('layering').parse('src/ui -> src/db'); ok('layering: A -> B parses', a && a.from[0] === 'src/ui' && a.forbid === 'src/db', JSON.stringify(a)); }
ok('layering: junk -> skip', q('layering').parse('nope') === null, '');
ok('toggle: blank/Y -> on', q('complexity').parse('').intent === 'no-god-functions', '');
ok('toggle: n -> off', q('complexity').parse('n') === null, '');

// runInterview with scripted answers -> the answers array, ending with the always-on meta-ratchet
{ const script = ['Model', 'src/ui -> src/db', '', 'y', 'y', 'y', 'y', 'n']; let i = 0;
  const answers = await runInterview(async () => script[i++]);
  const intents = answers.map((a) => a.intent);
  ok('interview yields answers + always-on self-guard', intents.includes('coordinator-thin') && intents.includes('layering') && intents.includes('self-guard'), intents.join()); }

console.log(failed === 0 ? '\nPASS: conversational interview elicits structured answers that map to invariants ✅' : `\nFAIL: ${failed}`);
process.exit(failed ? 1 : 0);
