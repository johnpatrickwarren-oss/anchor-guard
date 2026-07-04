// The conversational interview: pure question logic + runInterview with a scripted `ask` (no TTY needed).
import { mkdtempSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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

// 'only-in' inversion uses the TARGET repo's actual src/* layout (not this repo's hardcoded dirs)
{ const d = mkdtempSync(join(tmpdir(), 'ask-invert-'));
  for (const s of ['api', 'web', 'model']) mkdirSync(join(d, 'src', s), { recursive: true });
  const a = q('must-never-import').parse('some-sdk only-in src/model', d);
  ok('only-in inverts against the target repo layout', a && a.path === 'some-sdk' && JSON.stringify(a.forbidIn) === JSON.stringify(['src/api', 'src/web']), JSON.stringify(a)); }
{ const d = mkdtempSync(join(tmpdir(), 'ask-invert-flat-')); // no src/ subdirs -> cannot invert -> skip
  const a = q('must-never-import').parse('some-sdk only-in src/model', d);
  ok('only-in with no src/* subdirs fails small (skip, not a wrong rule)', a === null, JSON.stringify(a)); }

// runInterview with scripted answers -> the answers array, ending with the always-on meta-ratchet
{ const script = ['Model', 'src/ui -> src/db', '', 'y', 'y', 'y', 'y', 'n']; let i = 0;
  const answers = await runInterview(async () => script[i++]);
  const intents = answers.map((a) => a.intent);
  ok('interview yields answers + always-on self-guard', intents.includes('coordinator-thin') && intents.includes('layering') && intents.includes('self-guard'), intents.join()); }

console.log(failed === 0 ? '\nPASS: conversational interview elicits structured answers that map to invariants ✅' : `\nFAIL: ${failed}`);
process.exit(failed ? 1 : 0);
