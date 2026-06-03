// validate/ — the deterministic boundary to sprag. The ONLY module that runs the gate. By layering
// invariant, validate/ (and agent/) must never import a model SDK: the gate stays model-free. This file
// shells out to sprag's arch-gate; it makes no judgment of its own.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spragBin } from '../core/sprag.mjs';

// `quick` mode (for fast in-loop feedback on big repos) keeps the per-file architecture checks AND the
// meta-ratchet, but skips the whole-tree walks. The full gate (everything) runs at commit/PR.
const QUICK_SKIP = new Set(['module_fanin', 'require_tests']);

// Files the agent changed vs HEAD (tracked edits + new untracked) — context for the agent loop.
export function changedFiles(dir) {
  const d = spawnSync('git', ['-C', dir, 'diff', '--name-only', 'HEAD'], { encoding: 'utf8' });
  const o = spawnSync('git', ['-C', dir, 'ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' });
  return [...new Set([...(d.stdout || '').split('\n'), ...(o.stdout || '').split('\n')].filter(Boolean))];
}

// Filter the invariants to the quick set, written to a temp file. Returns its path (caller cleans up).
function quickInvariants(inv) {
  const fast = JSON.parse(readFileSync(inv, 'utf8')).filter((i) => !QUICK_SKIP.has(i.check?.kind));
  const tmp = join(tmpdir(), `guard-quick-${process.pid}-${fast.length}.json`);
  writeFileSync(tmp, JSON.stringify(fast));
  return tmp;
}

// Run sprag's gate over `dir` using the repo's committed invariants + baseline (if present). Returns
// { ok, code, out }. Exit 0 = pass, 3 = blocked (a violation OR a config relaxation the meta-ratchet
// caught), 2 = fail-closed (engine down). The meta-ratchet + fail-closed come for free from the invariants.
export function runGate(dir, opts = {}) {
  const inv = opts.invariants || join(dir, 'arch-invariants.json');
  const base = opts.baseline || join(dir, 'arch-invariants.baseline.json');
  const args = [spragBin('arch-gate.mjs'), dir];
  if (existsSync(inv)) args.push('--invariants', inv);
  if (existsSync(base)) args.push('--baseline-in', base);
  const r = spawnSync('node', args, { encoding: 'utf8', env: { ...process.env, ...(opts.env || {}) } });
  return { ok: r.status === 0, code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

// Structured gate result for the agent loop: parses sprag's --json so the MCP tools return clean data
// (violations with intent + reason), not raw text. Shape: { ok, blocked, violations:[{id,intent,reason}],
// raw }. A non-JSON exit (e.g. fail-closed exit 2) degrades to ok:false + the raw text.
export function runGateJson(dir, opts = {}) {
  let inv = opts.invariants || join(dir, 'arch-invariants.json');
  const base = opts.baseline || join(dir, 'arch-invariants.baseline.json');
  let tmp;
  if (opts.quick && existsSync(inv)) { tmp = quickInvariants(inv); inv = tmp; }
  const args = [spragBin('arch-gate.mjs'), dir, '--json'];
  if (existsSync(inv)) args.push('--invariants', inv);
  if (existsSync(base)) args.push('--baseline-in', base);
  const r = spawnSync('node', args, { encoding: 'utf8', env: { ...process.env, ...(opts.env || {}) } });
  if (tmp) try { rmSync(tmp); } catch { /* best effort */ }
  return parseGateOutput(r);
}

// Parse sprag's --json into { ok, blocked, violations:[{id,intent,reason}], raw }. A non-JSON exit (e.g.
// fail-closed exit 2) degrades to ok:false + raw text + engineError.
function parseGateOutput(r) {
  try {
    const j = JSON.parse(r.stdout);
    const violations = (j.violations || []).map((v) => ({ id: v.id, intent: v.intent || '', reason: (v.reasons || []).join('; ') }));
    return { ok: r.status === 0, blocked: !!j.blocked, violations, raw: r.stdout };
  } catch {
    return { ok: r.status === 0, blocked: r.status !== 0, violations: [], raw: (r.stdout || '') + (r.stderr || ''), engineError: r.status === 2 };
  }
}

// The active invariants + their intent (the architecture contract the agent must respect). Reads the
// repo's committed arch-invariants.json. Deterministic; no gate run needed.
export function activeInvariants(dir) {
  const inv = join(dir, 'arch-invariants.json');
  if (!existsSync(inv)) return [];
  try { return JSON.parse(readFileSync(inv, 'utf8')).map((i) => ({ id: i.id, intent: i.intent || '', kind: i.check?.kind })); }
  catch { return []; }
}

// Record/refresh the baseline (ratchet-from-current-state). Used by `guard author` after arming invariants.
export function recordBaseline(dir, opts = {}) {
  const inv = opts.invariants || join(dir, 'arch-invariants.json');
  const base = opts.baseline || join(dir, 'arch-invariants.baseline.json');
  const r = spawnSync('node', [spragBin('arch-gate.mjs'), dir, '--invariants', inv, '--baseline', '--baseline-out', base], { encoding: 'utf8' });
  return { ok: r.status === 0, code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
