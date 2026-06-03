// author/from-text — the model-in-loop ON-RAMP, and the last model-touching piece of the MVP. It turns a
// developer's FREE-TEXT intent into the SAME structured shapes the deterministic filters already vet: an
// interview answer ({intent, ...params}) for mapIntent, or a property spec ({shape, ...}) for authorProperty.
//
// The contract that makes this safe by construction: the model only PROPOSES (inside a typed envelope whose
// discriminant is the real vocabulary); the DETERMINISTIC filter still DECIDES. A hallucinated intent, a
// missing parameter, or a weak/tautological property is rejected by exactly the same code path that vets a
// hand-authored one — the model never sits on the gate. This module is model-free: the `propose` function is
// injected (default lazily loads the SDK-backed proposer), so it loads and tests without any SDK or API key.
import { mapIntent, intentVocabulary } from './map-intent.mjs';
import { authorProperty, propertyShapes } from './properties.mjs';

// The typed envelopes we ask the model to fill. Defined here (not in the SDK file) so the contract — "pick
// from THIS vocabulary" — is visible and testable without the SDK. The envelope's enum is the real vocabulary.
export const INVARIANT_ENVELOPE = {
  kind: 'invariant',
  get intents() { return intentVocabulary(); },
  note: 'Choose one intent and supply its parameters; unknown intents or missing parameters are rejected.',
};
export const PROPERTY_ENVELOPE = {
  kind: 'property',
  get shapes() { return propertyShapes(); },
  note: 'Choose one shape and supply fn/module plus examples; the property must hold AND kill mutants.',
};

// Default proposer: lazy-import the SDK-backed boundary so this module (and its tests) load without the SDK.
async function defaultPropose(text, envelope) {
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
