// validate/ — the deterministic boundary to sprag. The ONLY module that runs the gate. By layering
// invariant, validate/ (and agent/) must never import a model SDK: the gate stays model-free. This file
// shells out to sprag's arch-gate; it makes no judgment of its own.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spragBin } from '../core/sprag.mjs';

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

// Record/refresh the baseline (ratchet-from-current-state). Used by `guard author` after arming invariants.
export function recordBaseline(dir, opts = {}) {
  const inv = opts.invariants || join(dir, 'arch-invariants.json');
  const base = opts.baseline || join(dir, 'arch-invariants.baseline.json');
  const r = spawnSync('node', [spragBin('arch-gate.mjs'), dir, '--invariants', inv, '--baseline', '--baseline-out', base], { encoding: 'utf8' });
  return { ok: r.status === 0, code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
