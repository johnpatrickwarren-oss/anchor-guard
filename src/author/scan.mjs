// author/scan — the repo-shape-aware on-ramp. Detects a repo's shape and PROPOSES a FITTING starter
// invariant set, instead of the generic interview defaults (which assume a `src/` dir, the STATE.md/docs/adr
// doc-trail, and `<source>.test.<ext>` test naming — the anvil dogfood showed those misfit a real repo and
// blocked its clean tree). Pure heuristic detection — no model — and the proposed answers feed the SAME
// deterministic mapInterview filter that vets a hand-authored set, so scan only ever PROPOSES.
import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'out', '.next', 'vendor', 'tmp']);
const LANG_BY_EXT = { '.ts': 'ts', '.tsx': 'ts', '.js': 'js', '.jsx': 'js', '.mjs': 'js', '.cjs': 'js', '.go': 'go', '.py': 'py' };
const TEST_RE = /\.(test|spec)\.[a-z]+$|_test\.(go|py)$|^test_.+\.py$/;
const SDK_RE = /@anthropic-ai\/sdk|@anthropic\b|\bopenai\b|@google\/genai/;
const baseName = (f) => f.replace(/\.(test|spec)\.[a-z]+$/, '').replace(/_test\.(go|py)$/, '').replace(/^test_/, '').replace(/\.[a-z]+$/, '');

// Walk source files (skipping build/vendor dirs), returning { rel, ext, isTest, dir1 } where dir1 is the
// top-level directory (or '' for a root file).
function walkSources(dir) {
  const out = [];
  const visit = (abs, rel) => {
    for (const name of readdirSync(abs)) {
      if (SKIP.has(name) || name.startsWith('.')) continue;
      const a = join(abs, name);
      const r = rel ? `${rel}/${name}` : name;
      if (statSync(a).isDirectory()) { visit(a, r); continue; }
      if (!(extname(name) in LANG_BY_EXT)) continue;
      out.push({ rel: r, ext: extname(name), isTest: TEST_RE.test(name), dir1: r.includes('/') ? r.split('/')[0] : '' });
    }
  };
  visit(dir, '');
  return out;
}

// The dominant language among non-test source files (drives the AST-based checks).
function dominantLang(files) {
  const tally = {};
  for (const f of files) if (!f.isTest) tally[LANG_BY_EXT[f.ext]] = (tally[LANG_BY_EXT[f.ext]] || 0) + 1;
  return Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || 'ts';
}

// Language: a build manifest is a stronger signal than file counts (a TS repo has many .js/.mjs config +
// tooling files that can outvote .ts). Prefer tsconfig/go.mod/pyproject; fall back to the extension tally.
function detectLang(dir, files) {
  if (existsSync(join(dir, 'tsconfig.json'))) return 'ts';
  if (existsSync(join(dir, 'go.mod'))) return 'go';
  if (existsSync(join(dir, 'pyproject.toml')) || existsSync(join(dir, 'requirements.txt'))) return 'py';
  return dominantLang(files);
}

// Where the source lives: a conventional `src`/`lib` if present, else the whole repo. (require-tests dirs.)
function sourceRoots(dir) {
  if (existsSync(join(dir, 'src'))) return ['src'];
  if (existsSync(join(dir, 'lib'))) return ['lib'];
  return ['.'];
}

// Does the repo's test naming match sprag's `<source>.test.<ext>` basename heuristic? If most tests don't
// map to a source basename (e.g. topic-prefixed `q29-*.test.ts`), require-tests would spuriously flag
// everything — so we DON'T propose it. Returns { fits, hasTests }.
function testNamingFits(files) {
  const tests = files.filter((f) => f.isTest);
  if (!tests.length) return { fits: false, hasTests: false };
  const sourceBases = new Set(files.filter((f) => !f.isTest).map((f) => baseName(f.rel.split('/').pop())));
  const matched = tests.filter((t) => sourceBases.has(baseName(t.rel.split('/').pop()))).length;
  return { fits: matched / tests.length >= 0.5, hasTests: true };
}

// Detect a model SDK import anywhere in source (for an isolate-import suggestion).
function detectsModelSdk(dir, files) {
  for (const f of files.filter((x) => !x.isTest)) {
    try { if (SDK_RE.test(readFileSync(join(dir, f.rel), 'utf8'))) return true; } catch { /* unreadable — skip */ }
  }
  return false;
}

// Scan a repo -> { answers, notes, detected }. `answers` are interview-shaped ({intent, ...params}) and
// feed mapInterview; `notes` explain what was tailored or deliberately skipped (and why).
export function scanRepo(dir) {
  const files = walkSources(dir);
  const lang = detectLang(dir, files);
  const roots = sourceRoots(dir);
  const { fits, hasTests } = testNamingFits(files);
  // Always-fitting structural invariants (universal — every repo benefits).
  const answers = [
    { intent: 'no-god-functions', lang },
    { intent: 'no-god-files' },
    { intent: 'no-secrets' },
    { intent: 'self-guard' },
  ];
  const notes = [`detected language: ${lang}; source roots: ${roots.join(', ')}`];
  if (lang !== 'go') answers.push({ intent: 'no-coupling-hub' });
  // require-tests ONLY when the repo's test naming will actually be credited by the heuristic.
  if (fits) { answers.push({ intent: 'require-tests', dirs: roots }); notes.push(`require-tests -> dirs ${JSON.stringify(roots)} (test naming matches <source>.test.<ext>)`); }
  else if (hasTests) notes.push(`skipped require-tests: tests don't follow <source>.test.<ext> naming, so sprag's matcher won't credit them (would flag everything)`);
  else notes.push('skipped require-tests: no tests detected (would flag every source file as untested)');
  // Convention-specific rules are NOT imposed.
  notes.push('not proposed: require-project-trail (a STATE.md/docs/adr doc convention, not a universal rule — add it manually if you keep that trail)');
  if (detectsModelSdk(dir, files)) notes.push('detected a model SDK import — consider authoring isolate-import to confine it to its dir(s) (the headline "no model at gate-time" invariant)');
  return { answers, notes, detected: { lang, roots, hasTests, testNamingFits: fits } };
}
