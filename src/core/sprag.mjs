// Resolve the sprag install. @anchor/guard consumes sprag as a SUBPROCESS (decision D6) — a clean,
// version-pinnable boundary, never importing sprag internals. SPRAG_HOME overrides; default is the
// sibling checkout (~/concord/sprag) for local dev.
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export function spragHome() {
  const candidates = [process.env.SPRAG_HOME, resolve(HERE, '../../../sprag'), resolve(HERE, '../../node_modules/@johnpwarren.dev/sprag')];
  for (const c of candidates) if (c && existsSync(join(c, 'arch-gate.mjs'))) return c;
  throw new Error('sprag not found — set SPRAG_HOME to a sprag checkout (it ships arch-gate.mjs)');
}

export const spragBin = (name) => join(spragHome(), name);
