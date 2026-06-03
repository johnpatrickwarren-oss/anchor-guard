// envelope: the shared proposal contract. The discriminant enum IS the real vocabulary (so a proposal can
// only name something the deterministic filter understands), and params stay open for the filter to vet.
import { proposalSchema, proposerSystem, INVARIANT_ENVELOPE, PROPERTY_ENVELOPE, PROPOSER_SYSTEM } from '../src/author/envelope.mjs';
import { intentVocabulary } from '../src/author/map-intent.mjs';
import { propertyShapes } from '../src/author/properties.mjs';

let failed = 0;
const ok = (n, c, d) => { console.log(`${c ? 'ok  ' : 'FAIL'}  ${n}${c ? '' : '  -- ' + d}`); if (!c) failed++; };

const inv = proposalSchema(INVARIANT_ENVELOPE);
ok('invariant schema enum == the real intent vocabulary', JSON.stringify(inv.properties.intent.enum) === JSON.stringify(intentVocabulary()), JSON.stringify(inv.properties.intent.enum));
ok('invariant schema requires the discriminant', inv.required[0] === 'intent' && inv.type === 'object', JSON.stringify(inv.required));
ok('invariant schema leaves params open (filter validates them)', inv.additionalProperties === true, '');

const prop = proposalSchema(PROPERTY_ENVELOPE);
ok('property schema enum == the real property shapes', JSON.stringify(prop.properties.shape.enum) === JSON.stringify(propertyShapes()), JSON.stringify(prop.properties.shape.enum));
ok('property schema requires the discriminant', prop.required[0] === 'shape', JSON.stringify(prop.required));

ok('system prompt states the model only proposes', /only PROPOSE/i.test(PROPOSER_SYSTEM) && /verifier decides/i.test(PROPOSER_SYSTEM), '');

// The enriched per-envelope prompt carries the param catalog with EXACT names — this is what lifts
// parameterized-intent yield (the model uses `forbid`, not a guessed `to`).
const invSys = proposerSystem(INVARIANT_ENVELOPE);
ok('invariant prompt keeps the base instruction', /only PROPOSE/i.test(invSys), '');
ok('invariant prompt lists parameterized intents with EXACT required param names', /layering/.test(invSys) && /forbid/.test(invSys) && /from \[REQUIRED\]/.test(invSys), '');
const propSys = proposerSystem(PROPERTY_ENVELOPE);
ok('property prompt lists shape params (module/fn/cases)', /examples/.test(propSys) && /module \[REQUIRED\]/.test(propSys) && /cases \[REQUIRED\]/.test(propSys), '');

console.log(failed === 0 ? '\nPASS: the proposal envelope constrains the model to the real vocabulary ✅' : `\nFAIL: ${failed}`);
process.exit(failed ? 1 : 0);
