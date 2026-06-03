// A markdown summary of the gate result, for posting as a PR comment. The full enforcement is the gate's
// exit code (the workflow fails the check on a block); this is the human-readable surface.
import { runGateJson, activeInvariants } from '../validate/gate.mjs';

export function gateReport(dir) {
  const r = runGateJson(dir);
  const inv = activeInvariants(dir);
  const head = r.ok
    ? '## ✅ Architecture gate: PASS\nAll invariants hold; the gate is intact.'
    : '## ❌ Architecture gate: BLOCKED\nFix these before merge — the gate **cannot** be passed by relaxing or deleting a rule (the meta-ratchet blocks that too).';
  const rows = r.violations.map((v) => `| \`${v.id}\` | ${v.intent} | ${v.reason} |`).join('\n');
  const table = r.violations.length ? `\n\n| invariant | intent | reason |\n|---|---|---|\n${rows}` : '';
  const foot = `\n\n<sub>${inv.length} invariant(s) enforced · governed by @anchor/guard — deterministic, model-free, unweakenable.</sub>`;
  return head + table + foot;
}
