// author/envelope — model-free, SDK-free, CLI-free. The single definition of WHAT the model may propose:
// the typed envelopes (discriminant constrained to the real vocabulary) and the JSON Schema derived from one.
// Shared by BOTH proposer backends — the SDK tool-use backend (model-propose.mjs) and the claude-CLI
// --json-schema backend (cli-propose.mjs) — and by the tests, so "what shape is allowed" lives in one place.
import { intentVocabulary, INTENT_PARAMS } from './map-intent.mjs';
import { propertyShapes, SHAPE_PARAMS } from './properties.mjs';

// Computed once at load (the vocabulary is static); both backends read these on every proposal request.
export const INVARIANT_ENVELOPE = {
  kind: 'invariant',
  intents: intentVocabulary(),
  note: 'Choose one intent and supply its parameters; unknown intents or missing parameters are rejected.',
};
export const PROPERTY_ENVELOPE = {
  kind: 'property',
  shapes: propertyShapes(),
  note: 'Choose one shape and supply fn/module plus examples; the property must hold AND kill mutants.',
};

// The base instruction both backends use. Phrased backend-neutrally (SDK tool-use OR CLI structured output).
export const PROPOSER_SYSTEM = `You translate a developer's plain-English intent about code architecture or behavior into ONE structured proposal matching the provided schema. Pick the closest intent/shape from the enum and fill in its parameters from the text. You only PROPOSE: a deterministic verifier decides whether to accept it, so never invent values you were not given — prefer to OMIT an uncertain parameter so the verifier can ask again rather than guess. Respond only with the structured proposal.`;

// Render the per-intent/per-shape parameter catalog so the model uses the EXACT param names the filter reads
// (otherwise it guesses — e.g. `to` for `forbid` — and gets rejected). Guidance only; the filter still decides.
function formatCatalog(catalog) {
  return Object.entries(catalog).map(([name, spec]) => {
    const req = Object.entries(spec.required || {}).map(([k, d]) => `${k} [REQUIRED] ${d}`);
    const opt = Object.entries(spec.optional || {}).map(([k, d]) => `${k} ${d}`);
    const params = [...req, ...opt];
    return `- ${name}${params.length ? `: ${params.join('; ')}` : ' (no parameters)'}`;
  }).join('\n');
}

// The full system prompt for an envelope = base instruction + the parameter catalog for its vocabulary. Use
// the EXACT names shown; this is what turns parameterized intents from "rejected" into "accepted".
export function proposerSystem(envelope) {
  const isInvariant = envelope.kind === 'invariant';
  const catalog = isInvariant ? INTENT_PARAMS : SHAPE_PARAMS;
  const label = isInvariant ? 'intents' : 'property shapes';
  return `${PROPOSER_SYSTEM}\n\nThe available ${label} and their parameters (use these EXACT parameter names; provide every REQUIRED one, or the proposal is rejected):\n${formatCatalog(catalog)}`;
}

// The JSON Schema for a proposal: the discriminant (intent|shape) is an enum of the REAL vocabulary, so the
// model can only pick something the downstream filter understands; params stay open (the filter validates
// them per intent/shape). This IS the constraint that makes the on-ramp safe by construction.
export function proposalSchema(envelope) {
  const isInvariant = envelope.kind === 'invariant';
  const key = isInvariant ? 'intent' : 'shape';
  const values = isInvariant ? envelope.intents : envelope.shapes;
  return {
    type: 'object',
    properties: { [key]: { type: 'string', enum: values } },
    required: [key],
    additionalProperties: true,
  };
}
