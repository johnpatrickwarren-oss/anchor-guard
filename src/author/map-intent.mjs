// author/ — the ONE place a model may run (offline, authoring-time), and even here v1 is RULES-FIRST
// (decision D5): a bounded intent -> check-kind classifier, no model needed. Each interview answer names
// an intent from a fixed vocabulary; this maps it to a sprag invariant (the structural-mapping milestone).
// The model is reserved for fuzzy free-text intent + behavioral properties, both gated by `arch property`.
//
// An answer: { intent, ...params }. mapIntent returns { ok, invariant } or { ok:false, reason }.

// The decision table: intent -> (params -> sprag check). Generic intents need no params; specific ones
// (coordinator/layering/dispatch) name a symbol/path the interview supplies. `mode/max` set the baseline
// policy (ratchet vs absolute), matching the sprag check's nature.
const TABLE = {
  'coordinator-thin': (p) => p.subject
    ? { id: `coordinator-${slug(p.subject)}-thin`, check: { kind: 'struct_field_count', struct: p.subject }, max: p.max ?? 8, mode: 'ratchet', engine: 'ast-grep', lang: p.lang || 'ts' }
    : missing('coordinator-thin', 'subject (the coordinator type name)'),
  'no-god-functions': (p) => ({ id: 'no-god-functions', check: { kind: 'max_complexity', maxComplexity: p.max ?? 12 }, mode: 'ratchet', engine: 'ast-grep', lang: p.lang || 'ts' }),
  'no-god-files': (p) => ({ id: 'no-god-files', check: { kind: 'oversized_files', maxLines: p.max ?? 500 }, mode: 'ratchet' }),
  'layering': (p) => { const from = asArray(p.from); return (from && p.forbid)
    ? { id: `layer-${slug(from.join('-'))}-not-${slug(p.forbid)}`, check: { kind: 'forbid_path', dirs: from, path: p.forbid }, max: 0, mode: 'ratchet' }
    : missing('layering', 'from (ARRAY of source dirs) and forbid (a path regex the source must not reference)'); },
  'bounded-dispatch': (p) => p.on
    ? { id: `bounded-dispatch-${slug(p.on)}`, check: { kind: 'switch_case_count', on: p.on }, mode: 'ratchet', engine: 'ast-grep', lang: p.lang || 'ts' }
    : missing('bounded-dispatch', 'on (the dispatch discriminant expression)'),
  'typed-records': () => ({ id: 'no-positional-rows', check: { kind: 'magic_index_count' }, max: 0, mode: 'ratchet', engine: 'ast-grep', lang: 'ts' }),
  'no-coupling-hub': (p) => ({ id: 'no-coupling-hub', check: { kind: 'module_fanin', maxFanin: p.max ?? 8 }, mode: 'ratchet' }),
  'require-tests': (p) => ({ id: 'require-tests', check: { kind: 'require_tests', dirs: asArray(p.dirs) || ['src'] }, mode: 'ratchet' }),
  'no-secrets': () => ({ id: 'no-committed-secrets', check: { kind: 'secret_scan', dirs: ['.'] }, max: 0 }),
  'bounded-deps': () => ({ id: 'dependency-surface', check: { kind: 'dependency_count' }, mode: 'ratchet' }),
  'no-phantom-deps': () => ({ id: 'no-unlocked-deps', check: { kind: 'unlocked_dependencies' }, max: 0 }),
  'no-new-any': () => ({ id: 'no-new-any', check: { kind: 'ast_grep_tree', lang: 'ts', rule: { kind: 'predefined_type', regex: '^any$' } }, max: 0 }),
  'require-paths': (p) => { const paths = asArray(p.paths); return paths
    ? { id: 'require-project-trail', check: { kind: 'require_paths', paths }, max: 0 }
    : missing('require-paths', 'paths (ARRAY of required artifact paths)'); },
  // the headline product invariant: a path (e.g. a model SDK) may only be referenced under certain dirs.
  'isolate-import': (p) => { const forbidIn = asArray(p.forbidIn); return (forbidIn && p.path)
    ? { id: `isolate-${slug(p.path)}`, check: { kind: 'forbid_path', dirs: forbidIn, path: p.path }, max: 0, mode: 'ratchet' }
    : missing('isolate-import', 'forbidIn (ARRAY of dirs that must NOT import) and path (the import to isolate)'); },
  // the gate guards itself: config + baseline may only move forward (the meta-ratchet). This is what
  // makes the gate unweakenable — relaxing any rule above is itself a blocked violation.
  'self-guard': (p) => ({ id: 'no-config-relaxation', check: { kind: 'config_relaxations', invariants: p.invariants || 'arch-invariants.json', baseline: p.baseline || 'arch-invariants.baseline.json', against: 'HEAD' }, max: 0 }),
};

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const missing = (intent, need) => ({ __missing: true, intent, need });

// Coerce a value an array-valued param may arrive as into an array, or null if it isn't array-shaped. The
// free-text proposer (and a sloppy hand-authored answer) often gives a JSON-array STRING or a bare string
// instead of a real array; this normalizes both so the filter neither CRASHES (`.join` on a string) nor
// ACCEPTS a malformed invariant (a string where `dirs` must be an array) — the safe-by-construction contract.
function asArray(v) {
  if (Array.isArray(v)) return v.length ? v : null;
  if (typeof v === 'string') {
    const s = v.trim();
    if (s.startsWith('[')) { try { const p = JSON.parse(s); return Array.isArray(p) && p.length ? p : null; } catch { return null; } }
    return s ? [s] : null; // a bare path string -> single-element array
  }
  return null;
}

// Per-intent PARAMETER catalog — the EXACT param names each TABLE entry reads, so the free-text proposer can
// fill the right ones (the model guesses names otherwise — e.g. `to` instead of `forbid` — and gets
// rejected). This is authoring GUIDANCE, not validation: mapIntent above is still the arbiter, so a catalog
// that drifts only lowers yield, never safety. Kept beside TABLE; a test asserts every intent is documented.
export const INTENT_PARAMS = {
  'coordinator-thin': { required: { subject: 'the coordinator type/class name to keep thin' }, optional: { max: 'max members/fields (default 8)', lang: 'ts|js|go|… (default ts)' } },
  'no-god-functions': { optional: { max: 'max cyclomatic complexity (default 12)', lang: 'default ts' } },
  'no-god-files': { optional: { max: 'max lines per file (default 500)' } },
  'layering': { required: { from: 'ARRAY of source dirs that must not reference the target, e.g. ["src/validate"]', forbid: 'a path regex the source must not import, e.g. "src/cli/"' } },
  'bounded-dispatch': { required: { on: 'the switch/dispatch discriminant expression' }, optional: { lang: 'default ts' } },
  'typed-records': {},
  'no-coupling-hub': { optional: { max: 'max fan-in before a module is a hub (default 8)' } },
  'require-tests': { optional: { dirs: 'ARRAY of source dirs that need tests (default ["src"])' } },
  'no-secrets': {},
  'bounded-deps': {},
  'no-phantom-deps': {},
  'no-new-any': {},
  'require-paths': { required: { paths: 'ARRAY of artifact paths that must exist, e.g. ["STATE.md","docs/adr"]' } },
  'isolate-import': { required: { forbidIn: 'ARRAY of dirs that must not import the path, e.g. ["src/validate","src/agent"]', path: 'the import to isolate, e.g. "@anthropic-ai/sdk"' } },
  'self-guard': { optional: { invariants: 'invariants filename (default arch-invariants.json)', baseline: 'baseline filename (default arch-invariants.baseline.json)' } },
};

// Map one answer to one invariant candidate. Unknown intent or missing params -> a clear reason (so the
// interview can re-ask), never a silent or wrong invariant.
export function mapIntent(answer) {
  if (!answer || !answer.intent) return { ok: false, reason: 'answer has no `intent`' };
  const make = TABLE[answer.intent];
  if (!make) return { ok: false, reason: `unknown intent "${answer.intent}" (not in the v1 vocabulary)` };
  const out = make(answer);
  if (out && out.__missing) return { ok: false, reason: `intent "${out.intent}" needs: ${out.need}` };
  return { ok: true, invariant: { intent: answer.intent, severity: 'block', ...out } };
}

// Map a full interview (array of answers) -> { invariants, unmapped }. unmapped are surfaced to the
// operator ("couldn't derive these — refine?"), the fail-small property: a bad answer yields nothing.
export function mapInterview(answers) {
  const invariants = [], unmapped = [];
  for (const a of answers || []) {
    const r = mapIntent(a);
    if (r.ok) invariants.push(r.invariant); else unmapped.push({ answer: a, reason: r.reason });
  }
  return { invariants, unmapped };
}

export const intentVocabulary = () => Object.keys(TABLE);
