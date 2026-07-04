// `suggest` argv parsing matches its documented form `<text> [--property [dir]]`: the token after
// --property is the property DIR, never silently absorbed into the intent text (the old bug), and
// `--dir <dir>` still works as the explicit form.
import { parseSuggestArgs } from '../src/cli/dispatch.mjs';

let failed = 0;
const ok = (n, c, d) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${n}${c ? '' : '  -- ' + d}`); if (!c) failed++; };

{ const r = parseSuggestArgs(['keep', 'coordinators', 'thin']);
  ok('plain text -> invariant mode, cwd', !r.property && r.dir === '.' && r.text === 'keep coordinators thin', JSON.stringify(r)); }

{ const r = parseSuggestArgs(['retries', 'back', 'off', '--property', '/tmp/foo']);
  ok('dir after --property is the DIR, not intent text', r.property && r.dir === '/tmp/foo' && r.text === 'retries back off', JSON.stringify(r)); }

{ const r = parseSuggestArgs(['retries', 'back', 'off', '--property']);
  ok('--property without dir defaults to cwd', r.property && r.dir === '.' && r.text === 'retries back off', JSON.stringify(r)); }

{ const r = parseSuggestArgs(['some', 'text', '--property', '--dir', '/tmp/bar']);
  ok('--dir works alongside --property', r.property && r.dir === '/tmp/bar' && r.text === 'some text', JSON.stringify(r)); }

{ const r = parseSuggestArgs(['some', 'text', '--dir', '/tmp/baz']);
  ok('--dir without --property', !r.property && r.dir === '/tmp/baz' && r.text === 'some text', JSON.stringify(r)); }

{ const r = parseSuggestArgs(['--property', '/tmp/foo']);
  ok('no text -> empty text (caller exits 64)', r.property && r.dir === '/tmp/foo' && r.text === '', JSON.stringify(r)); }

console.log(failed === 0 ? '\nPASS: suggest argv parsing matches the documented usage ✅' : `\nFAIL: ${failed}`);
process.exit(failed ? 1 : 0);
