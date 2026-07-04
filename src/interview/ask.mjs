// interview/ — the conversational on-ramp. Turns plain-language answers into the structured `answers`
// the authoring loop maps to invariants. The QUESTION LOGIC (parsing a raw answer -> a structured intent)
// is pure and testable; the readline I/O lives in the CLI as a thin shell that calls runInterview(ask).
// v1 is deterministic (no model) — it elicits the structural-mapping vocabulary directly.

import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Each question: { key, prompt, parse(raw, dir) -> answer|answer[]|null }. null = skip (empty/no).
// `dir` is the TARGET repo (so parsers that need its layout don't assume this repo's).
const yes = (raw) => !/^\s*(n|no)\s*$/i.test(raw); // default-yes toggles
export const QUESTIONS = [
  { key: 'coordinator', prompt: 'Name the central coordinator type that must stay thin (or Enter to skip): ',
    parse: (r) => r.trim() ? { intent: 'coordinator-thin', subject: r.trim(), lang: 'ts' } : null },
  { key: 'layering', prompt: "Forbid a layer from importing another? e.g. 'src/ui -> src/db' (or Enter to skip): ",
    parse: (r) => { const m = r.match(/(.+?)\s*->\s*(.+)/); return m ? { intent: 'layering', from: [m[1].trim()], forbid: m[2].trim() } : null; } },
  { key: 'must-never-import', prompt: "Restrict an import to certain dirs? e.g. '@anthropic-ai/sdk only-in src/author' (or skip): ",
    parse: (r, dir) => { const m = r.match(/(.+?)\s+only-in\s+(.+)/); if (!m) return null;
      const forbidIn = invert(m[2].trim(), dir); return forbidIn ? { intent: 'isolate-import', path: m[1].trim(), forbidIn } : null; } },
  { key: 'complexity', prompt: 'Block over-complex / god functions? (Y/n): ', parse: (r) => yes(r) ? { intent: 'no-god-functions', lang: 'ts' } : null },
  { key: 'godfiles', prompt: 'Block god files (>500 lines)? (Y/n): ', parse: (r) => yes(r) ? { intent: 'no-god-files' } : null },
  { key: 'tests', prompt: 'Require every source module to ship a test? (Y/n): ', parse: (r) => yes(r) ? { intent: 'require-tests', dirs: ['src'] } : null },
  { key: 'secrets', prompt: 'Block committed secrets? (Y/n): ', parse: (r) => yes(r) ? { intent: 'no-secrets' } : null },
  { key: 'trail', prompt: 'Require a durable project trail (STATE.md + docs/adr)? (Y/n): ', parse: (r) => yes(r) ? { intent: 'require-paths', paths: ['STATE.md', 'docs/adr'] } : null },
];

// "only-in X" means "forbid everywhere except X" — the inverse is the TARGET repo's own top-level
// src/* siblings the user didn't name (enumerated from disk, same as scan.mjs — never this repo's
// layout). No src/ subdirs -> null, so the answer is skipped rather than armed wrong (fail-small).
function srcSubdirs(dir) {
  const src = join(dir || '.', 'src');
  if (!existsSync(src)) return [];
  return readdirSync(src)
    .filter((n) => { try { return statSync(join(src, n)).isDirectory(); } catch { return false; } })
    .map((n) => `src/${n}`).sort();
}
function invert(allowed, dir) {
  const out = srcSubdirs(dir).filter((d) => !allowed.includes(d) && d !== allowed);
  return out.length ? out : null;
}

// Run the interview: `ask` is an async (prompt) -> raw string; `dir` is the repo being armed. Returns
// the structured answers array. The meta-ratchet (self-guard) is always appended — the gate must
// guard itself, it's not optional.
export async function runInterview(ask, dir = '.') {
  const answers = [];
  for (const q of QUESTIONS) {
    const a = q.parse(await ask(q.prompt), dir);
    if (Array.isArray(a)) answers.push(...a); else if (a) answers.push(a);
  }
  answers.push({ intent: 'self-guard' });
  return answers;
}
