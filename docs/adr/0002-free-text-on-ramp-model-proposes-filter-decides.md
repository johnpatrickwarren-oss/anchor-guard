# ADR-0002 — Free-text on-ramp: the model proposes, the deterministic filter decides

**Status:** accepted (MVP). **Date:** 2026-06-03.

## Context
The authoring loop was rules-first by design (ADR-0001, decision D5): interview answers name an intent
from a fixed vocabulary, and `mapIntent` maps each to a sprag invariant; behavioral properties come from a
structured spec that `arch property` validates. That keeps v1 deterministic and testable, but it makes the
interview feel like a *form* — the operator must already know the vocabulary. The one remaining
model-in-loop piece is letting a developer describe intent in plain English and having the system fill in
the structured shape. The risk this introduces is the obvious one: a model that hallucinates an invariant,
omits a parameter, or proposes a weak/tautological property.

## Decision
Add a free-text front-end (`src/author/from-text.mjs`, CLI `guard suggest`) that is **safe by
construction**: the model only ever **proposes** a structured shape; the **same deterministic filter that
vets a hand-authored one decides**.
- The model is asked (via Anthropic tool-use) to fill a typed *envelope* whose discriminant is an **enum of
  the real vocabulary** (`intentVocabulary()` / `propertyShapes()`), so it can only pick something
  downstream understands. Params stay open because the filter validates them.
- Its proposal is handed verbatim to `mapIntent` (invariants) or `authorProperty` (properties). A
  hallucinated intent, a missing required parameter, or a property that fails to hold / kill mutants / is a
  restatement is **rejected by exactly the same path** as a hand-written one. The model never sits on the
  gate.
- The model SDK lives only in `src/author/model-propose.mjs`, lazily loaded — so the `isolate-import`
  invariant ("no model at gate-time") still holds machine-checked, and gate-time paths never load it.
- The model call is injectable; tests pass faithful **and adversarial** fakes (and a fake Anthropic
  client), so the safe-by-construction property is a CI test with no API key or network.

## Consequences
- The conversational on-ramp is complete: plain-English intent → vetted invariant/property, with the
  deterministic guarantee unchanged. This is the last model-in-loop piece of the MVP spine.
- New runtime dependency `@anthropic-ai/sdk` (lazy, author-only). Authoring-time needs `ANTHROPIC_API_KEY`;
  gate-time needs nothing — the central promise is preserved and still enforced on ourselves.
- The live model path is wired and fails cleanly without a key; its *logic* is fully tested via injection.
  An end-to-end live run is pending a key (deferred, not blocking).
