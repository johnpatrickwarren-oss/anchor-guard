// author/from-text — the model-in-loop ON-RAMP, and the last model-touching piece of the MVP. It turns a
// developer's FREE-TEXT intent into the SAME structured shapes the deterministic filters already vet: an
// interview answer ({intent, ...params}) for mapIntent, or a property spec ({shape, ...}) for authorProperty.
//
// The contract that makes this safe by construction: the model only PROPOSES (inside a typed envelope whose
// discriminant is the real vocabulary); the DETERMINISTIC filter still DECIDES. A hallucinated intent, a
// missing parameter, or a weak/tautological property is rejected by exactly the same code path that vets a
// hand-authored one — the model never sits on the gate. This module is model-free: the `propose` function is
// injected (default lazily loads the SDK-backed proposer), so it loads and tests without any SDK or API key.
import { mapIntent } from './map-intent.mjs';
import { authorProperty } from './properties.mjs';
import { INVARIANT_ENVELOPE, PROPERTY_ENVELOPE, proposalSchema, proposerSystem } from './envelope.mjs';

// The typed envelopes (the contract: "pick from THIS vocabulary") live model-free in envelope.mjs and are
// re-exported here so from-text stays the public entry for the on-ramp.
export { INVARIANT_ENVELOPE, PROPERTY_ENVELOPE };

// Proposer backends — provider adapters, each loaded LAZILY so only the chosen provider's SDK loads (and none
// at gate-time). `detect` = "this provider's credentials are present". Every backend receives the SAME
// { system, schema } request (built here from the envelope) and only PROPOSES — the filter still decides — so
// the backends depend on those abstractions, not on envelope.mjs. Adding a provider = one entry + one adapter.
const BACKENDS = {
  anthropic: { detect: () => !!process.env.ANTHROPIC_API_KEY, load: () => import('./model-propose.mjs').then((m) => m.anthropicPropose) },
  openai: { detect: () => !!process.env.OPENAI_API_KEY, load: () => import('./openai-propose.mjs').then((m) => m.openaiPropose) },
  gemini: { detect: () => !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY), load: () => import('./gemini-propose.mjs').then((m) => m.geminiPropose) },
  cli: { detect: () => true, load: () => import('./cli-propose.mjs').then((m) => m.cliPropose) }, // claude subscription, no key
};
const AUTO_ORDER = ['anthropic', 'openai', 'gemini', 'cli'];
const ALIAS = { api: 'anthropic', claude: 'cli', google: 'gemini' };

// Choose a backend: an explicit ANCHOR_GUARD_BACKEND wins (friendly aliases accepted); else the first
// provider whose credentials are present; else the `claude` CLI (a Max-plan subscription — no API key).
export function chooseBackend() {
  const forced = process.env.ANCHOR_GUARD_BACKEND;
  if (forced) return ALIAS[forced] || forced;
  return AUTO_ORDER.find((b) => BACKENDS[b].detect()) || 'cli';
}

// Default proposer: build the { system, schema } request from the envelope, then lazy-load + call the backend.
async function defaultPropose(text, envelope) {
  const name = chooseBackend();
  const backend = BACKENDS[name];
  if (!backend) throw new Error(`unknown ANCHOR_GUARD_BACKEND "${name}" (have: ${Object.keys(BACKENDS).join(', ')})`);
  const propose = await backend.load();
  return propose(text, { system: proposerSystem(envelope), schema: proposalSchema(envelope) });
}

// Free text -> a vetted invariant (or a reason it was rejected). The model proposes {intent,...}; the
// deterministic mapIntent decides. `proposed` is echoed so the operator sees what the model suggested.
export async function fromTextToInvariant(text, { propose = defaultPropose } = {}) {
  const proposed = await propose(text, INVARIANT_ENVELOPE);
  return { ...mapIntent(proposed || {}), proposed };
}

// Free text -> a vetted property (drafted, then validated by `arch property`: holds + kills mutants + not a
// restatement). The model proposes the spec; authorProperty decides. A rejected draft is deleted (fail-small).
export async function fromTextToProperty(dir, text, opts = {}) {
  const { propose = defaultPropose, ...rest } = opts;
  const proposed = await propose(text, PROPERTY_ENVELOPE);
  return { ...authorProperty(dir, proposed || {}, rest), proposed };
}
