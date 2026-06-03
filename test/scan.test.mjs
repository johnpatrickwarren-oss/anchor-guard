// scan: the repo-shape-aware on-ramp proposes a FITTING invariant set per repo shape — fixing the misfit
// defaults the anvil dogfood exposed (require-tests at a nonexistent src/, the doc-trail rule, wrong lang).
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanRepo } from '../src/author/scan.mjs';
import { mapInterview } from '../src/author/map-intent.mjs';

let failed = 0;
const ok = (n, c, d) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${n}${c ? '' : '  -- ' + d}`); if (!c) failed++; };
const mk = () => { const d = mkdtempSync(join(tmpdir(), 'guard-scan-')); return d; };
const w = (d, rel, body = 'export const x = 1;\n') => { const p = join(d, rel); mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, body); };
const intents = (ans) => ans.map((a) => a.intent);
const hasUniversal = (ids) => ['no-god-functions', 'no-god-files', 'no-secrets', 'self-guard'].every((i) => ids.includes(i));

// A — src/-shaped TS repo with matching test naming -> require-tests proposed at ['src'].
{ const d = mk(); w(d, 'src/calc.ts'); w(d, 'src/calc.test.ts');
  const s = scanRepo(d); const ids = intents(s.answers);
  ok('src repo: lang ts + universal set', s.detected.lang === 'ts' && hasUniversal(ids), JSON.stringify(s.detected));
  const rt = s.answers.find((a) => a.intent === 'require-tests');
  ok('src repo: require-tests proposed at ["src"]', !!rt && JSON.stringify(rt.dirs) === '["src"]', JSON.stringify(rt)); }

// B — anvil-shaped: sources at root + topic-prefixed tests that DON'T match a source basename -> require-tests SKIPPED.
{ const d = mk(); w(d, 'adapters/gremlin.ts'); w(d, 'types.ts'); w(d, 'test/q29-orchestrator-suppression.test.ts');
  const s = scanRepo(d); const ids = intents(s.answers);
  ok('anvil-shape: universal set present', hasUniversal(ids), JSON.stringify(ids));
  ok('anvil-shape: require-tests NOT proposed (naming mismatch)', !ids.includes('require-tests'), JSON.stringify(ids));
  ok('anvil-shape: a note explains the require-tests skip', s.notes.some((n) => /skipped require-tests/.test(n) && /naming/.test(n)), s.notes.join(' | '));
  ok('anvil-shape: doc-trail rule is NOT imposed', !ids.includes('require-paths') && s.notes.some((n) => /require-project-trail/.test(n)), JSON.stringify(ids)); }

// C — Go repo: lang go, no JS-only no-coupling-hub.
{ const d = mk(); w(d, 'main.go', 'package main\nfunc main() {}\n'); w(d, 'main_test.go', 'package main\n');
  const s = scanRepo(d); const ids = intents(s.answers);
  ok('go repo: lang go, no no-coupling-hub', s.detected.lang === 'go' && !ids.includes('no-coupling-hub'), JSON.stringify(s.detected)); }

// D — model-SDK repo: a note suggests isolate-import.
{ const d = mk(); w(d, 'src/agent.ts', "import Anthropic from '@anthropic-ai/sdk';\nexport const c = new Anthropic();\n");
  const s = scanRepo(d);
  ok('model-SDK repo: suggests isolate-import', s.notes.some((n) => /model SDK/.test(n) && /isolate-import/.test(n)), s.notes.join(' | ')); }

// E — a TS repo whose tooling is .mjs: tsconfig.json must win over the file-extension tally (-> ts, not js).
{ const d = mk(); w(d, 'tsconfig.json', '{}\n'); w(d, 'engine/detector.ts'); w(d, 'build.mjs'); w(d, 'scripts/gen.mjs');
  ok('tsconfig.json -> lang ts (beats the .mjs tally)', scanRepo(d).detected.lang === 'ts', JSON.stringify(scanRepo(d).detected)); }

// Every proposal maps cleanly through the deterministic filter (no unmapped/bad answers).
{ const d = mk(); w(d, 'src/a.ts'); w(d, 'src/a.test.ts');
  const { invariants, unmapped } = mapInterview(scanRepo(d).answers);
  ok('proposals all map via mapInterview (safe by construction)', unmapped.length === 0 && invariants.length >= 4, JSON.stringify(unmapped)); }

console.log(failed === 0 ? '\nPASS: scan proposes a repo-shape-fitting invariant set; misfit defaults avoided ✅' : `\nFAIL: ${failed}`);
process.exit(failed ? 1 : 0);
