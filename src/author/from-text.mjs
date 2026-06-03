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
import { INVARIANT_ENVELOPE, PROPERTY_ENVELOPE } from './envelope.mjs';

// The typed envelopes (the contract: "pick from THIS vocabulary") live model-free in envelope.mjs and are
// re-exported here so from-text stays the public entry for the on-ramp.
export { INVARIANT_ENVELOPE, PROPERTY_ENVELOPE };

// Pick the proposer backend by available auth: an ANTHROPIC_API_KEY -> the metered SDK (the product default
// for CI/customers); otherwise the `claude` CLI -> your Claude subscription (no key, no per-token bill).
// Override with ANCHOR_GUARD_BACKEND=api|cli. Both only PROPOSE; the deterministic filter still decides.
function chooseBackend() {
  return process.env.ANCHOR_GUARD_BACKEND || (process.env.ANTHROPIC_API_KEY ? 'api' : 'cli');
}

// Default proposer: lazy-import the chosen backend so neither the SDK nor a `claude` call loads until needed.
async function defaultPropose(text, envelope) {
  if (chooseBackend() === 'cli') { const { cliPropose } = await import('./cli-propose.mjs'); return cliPropose(text, envelope); }
  const { modelPropose } = await import('./model-propose.mjs');
  return modelPropose(text, envelope);
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
