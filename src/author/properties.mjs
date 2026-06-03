// author/properties — the behavioral half of authoring (Phase A). From a structured property SPEC (a
// sound shape + a target), it drafts a property test from a template, then validates it with sprag's
// `arch property` (holds + kills mutants + not a restatement). Only properties that pass are kept. v1 is
// templated (the operator/agent supplies the shape + examples from the interview); a model picking the
// shape from free-text intent is the fast-follow, and it would feed THIS same deterministic filter — so
// the model only ever proposes, never decides. The drafted property file imports the PUBLIC api only.
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { runProperty } from '../validate/gate.mjs';

const EQ = 'const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);';
// Each template -> a runnable property file (exit 0 = holds). Sound shapes from the catalog.
const TEMPLATES = {
  examples: (s) => `import { ${s.fn} as f } from '${s.module}';\n${EQ}\nconst cases=${JSON.stringify(s.cases)};\nprocess.exit(cases.every(([i,e])=>eq(f(i),e))?0:1);\n`,
  idempotence: (s) => `import { ${s.fn} as f } from '${s.module}';\n${EQ}\nconst xs=${JSON.stringify(s.samples)};\nprocess.exit(xs.every(x=>eq(f(f(x)),f(x)))?0:1);\n`,
  roundtrip: (s) => `import { ${s.fn} as f, ${s.inverse} as g } from '${s.module}';\n${EQ}\nconst xs=${JSON.stringify(s.samples)};\nprocess.exit(xs.every(x=>eq(g(f(x)),x))?0:1);\n`,
};

export const propertyShapes = () => Object.keys(TEMPLATES);

// Per-shape PARAMETER catalog for the free-text proposer (mirrors what each TEMPLATE reads). Guidance only —
// `arch property` still decides (holds + kills mutants). A test asserts every shape is documented.
export const SHAPE_PARAMS = {
  examples: { required: { module: 'relative import path of the module under test, e.g. "./src/age.js"', fn: 'the exported function name', cases: 'ARRAY of [input, expected] pairs — include BOUNDARY cases so the property kills mutants' } },
  idempotence: { required: { module: 'relative import path', fn: 'the exported function name (f(f(x)) must equal f(x))', samples: 'ARRAY of inputs to check' } },
  roundtrip: { required: { module: 'relative import path', fn: 'the forward function', inverse: 'the inverse function name (g(f(x)) must equal x)', samples: 'ARRAY of inputs to check' } },
};

// Draft a property file (filename + content) from a spec, or a reason if the shape is unknown.
export function draftProperty(spec) {
  const make = TEMPLATES[spec.shape];
  if (!make) return { ok: false, reason: `unknown property shape "${spec.shape}" (have: ${propertyShapes().join(', ')})` };
  return { ok: true, filename: `prop-${spec.fn}-${spec.shape}.mjs`, content: make(spec) };
}

// Draft -> validate -> keep or drop. Returns { accepted, file?, reason }. A rejected property is deleted
// (fail-small): a weak/tautological draft never lands.
export function authorProperty(dir, spec, opts = {}) {
  const d = draftProperty(spec);
  if (!d.ok) return { accepted: false, reason: d.reason };
  writeFileSync(join(dir, d.filename), d.content);
  const v = runProperty(dir, `node ${d.filename}`, { target: opts.target || join(dir, 'src'), minKill: opts.minKill || 50 });
  if (v.accepted) return { accepted: true, file: d.filename, reason: 'holds AND catches bugs (kills mutants)' };
  try { rmSync(join(dir, d.filename)); } catch { /* */ }
  const why = (v.out.match(/✗ REJECT[^\n]*/) || v.out.match(/⚠ INCONCLUSIVE[^\n]*/) || [`exit ${v.code}`])[0];
  return { accepted: false, reason: why.replace(/^[✗⚠]\s*/, '') };
}
