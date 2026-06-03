// cli-propose (CLAUDE SUBSCRIPTION backend): shells to `claude -p` and extracts structured_output. We inject
// a FAKE runner (no real claude call), verifying the argv it builds from the passed { system, schema } and how
// it handles success, a non-zero exit, and a non-tool/empty result — without a key or network.
import { cliPropose } from '../src/author/cli-propose.mjs';

let failed = 0;
const ok = (n, c, d) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${n}${c ? '' : '  -- ' + d}`); if (!c) failed++; };

const SCHEMA = { type: 'object', properties: { intent: { type: 'string', enum: ['no-god-functions', 'layering'] } }, required: ['intent'], additionalProperties: true };
const REQ = { system: 'You only PROPOSE; a verifier decides.', schema: SCHEMA };

// Success: a fake claude that echoes a structured_output proposal. Capture the argv for assertions.
let seen;
const okRun = (out) => (cmd, args) => { seen = { cmd, args }; return { status: 0, stdout: JSON.stringify({ type: 'result', structured_output: out }) }; };

const r = cliPropose('keep functions small', REQ, { run: okRun({ intent: 'no-god-functions', max: 12 }) });
ok('returns structured_output as the proposal', r && r.intent === 'no-god-functions' && r.max === 12, JSON.stringify(r));
ok('invokes claude in print + json mode', seen.cmd === 'claude' && seen.args.includes('-p') && seen.args[seen.args.indexOf('--output-format') + 1] === 'json', JSON.stringify(seen.args));
ok('passes the schema as --json-schema', seen.args[seen.args.indexOf('--json-schema') + 1] === JSON.stringify(SCHEMA), seen.args[seen.args.indexOf('--json-schema') + 1]);
ok('passes the system prompt via --append-system-prompt', seen.args[seen.args.indexOf('--append-system-prompt') + 1] === REQ.system, '');

// No structured_output (model returned only prose) -> null, so the filter rejects an empty proposal.
ok('missing structured_output -> null', cliPropose('vague', REQ, { run: () => ({ status: 0, stdout: JSON.stringify({ type: 'result', result: 'unsure' }) }) }) === null, '');

// Non-zero exit (e.g. not signed in) -> a clear throw, not a silent wrong proposal.
let threw = false;
try { cliPropose('x', REQ, { run: () => ({ status: 1, stderr: 'not authenticated' }) }); } catch (e) { threw = /exited 1/.test(e.message) && /not authenticated/.test(e.message); }
ok('non-zero claude exit throws a clear error', threw, '');

// Spawn error (claude not installed) -> a clear throw.
let threw2 = false;
try { cliPropose('x', REQ, { run: () => ({ error: new Error('ENOENT') }) }); } catch (e) { threw2 = /could not run/.test(e.message); }
ok('missing claude binary throws a clear error', threw2, '');

console.log(failed === 0 ? '\nPASS: the subscription backend builds a constrained claude -p call and extracts the proposal ✅' : `\nFAIL: ${failed}`);
process.exit(failed ? 1 : 0);
