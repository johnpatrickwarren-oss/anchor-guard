# STATE — @anchor/guard

_Cold-readable snapshot. Updated as work lands; history lives in `docs/adr/`._

## What this is
The MVP of **@anchor/guard** — deterministic governance for teams running coding agents: *the gate an AI
agent can't talk past.* Fuses Anchor's intent interview with sprag's unweakenable gate. Built **under its
own governance** (sprag gates this repo; this STATE.md + `docs/adr/` are the trail).

## Built so far (autonomous session, 2026-06-03)
- **Repo + foundational decisions** — `DECISIONS.md` (best-of-3 per fork: scope, language, architecture,
  agent surface, authoring approach, sprag-consumption, distribution).
- **Runnable MVP core (ESM JS, no build, subprocess to sprag):**
  - `src/author/map-intent.mjs` — the **structural-mapping milestone**: a rules-first decision table that
    turns interview answers → sprag invariants, fail-small on bad input (tested).
  - `src/validate/gate.mjs` — the deterministic boundary; shells out to sprag (`runGate`, `recordBaseline`).
  - `src/cli/dispatch.mjs` + `bin/guard.mjs` — `guard check | author | vocab`.
- **Self-governed:** `arch-invariants.json` authored *by `guard author` itself* from
  `anchor-guard.answers.json` — including the headline **model-SDK isolation** invariant and the
  **meta-ratchet** guarding its own config.

## Layering (enforced)
`cli → {interview, author, agent} → validate → (sprag)`, `core` shared. **The model SDK may only be
imported under `src/author/`** — `validate/` and `agent/` (gate-time) must stay model-free. That product
promise ("no model at gate-time") is a machine-checked invariant on ourselves.

## Benchmark — DONE (`BENCHMARK.md`)
Head-to-head vs **dependency-cruiser 17.4.3** on the same layering rule, under a config-relaxation attack
(an agent deletes the rule instead of fixing the code). Real outputs, reproducible (`bench/run-benchmark.mjs`):
- clean → both pass; violation → both BLOCK (detection **parity**).
- **agent deletes the rule:** dependency-cruiser → **pass** (silently bypassed); `@anchor/guard` → **BLOCK**
  (meta-ratchet caught the deletion). The narrow true claim: *parity on detection; the gate can't be
  silently turned off.*

## MCP agent-loop server — DONE (`src/agent/server.mjs`, `guard mcp`)
The gate runs *as the agent writes*. Two tools (official `@modelcontextprotocol/sdk`, low-level Server):
- **`guard_invariants`** — the architecture contract to respect (call before structural changes).
- **`guard_check`** — run the gate on the working tree; returns actionable violations. **The agent can't
  talk past it:** deleting/relaxing a rule surfaces the meta-ratchet block through the tool too (tested,
  in-process + over real stdio). `src/agent/` is gate-time + MODEL-FREE (isolate-import invariant holds).

Register with a host (e.g. Claude Code / Cursor `mcp.json`):
```json
{ "mcpServers": { "anchor-guard": { "command": "node", "args": ["bin/guard.mjs", "mcp"] } } }
```

## Pieces 1–4 — DONE (autonomous session 2)
1. **Conversational interview** (`guard init`, `src/interview/`) — TTY + scriptable; authors invariants.
2. **Diff-scoped `quick` check** (`src/validate/gate.mjs`) — per-file + meta-ratchet, defers whole-tree;
   exposed via `guard_check {quick}`; `changedFiles` context.
3. **GitHub PR surface** (`guard report`, `.github/workflows/guard.yml`) — markdown comment + blocking gate.
4. **Behavioral-property authoring** (`src/author/properties.mjs`) — templated shapes, `arch property`
   decides (strong accepted, weak dropped, fail-small).

The MVP spine is end-to-end: **init (interview) → armed & self-governed → in-loop MCP gate (can't be
weakened) → PR gate → behavioral properties validated.** Self-gate green throughout (the gate even caught
our own over-complex function — decomposed, not relaxed).

## Free-text on-ramp — DONE (`src/author/from-text.mjs`, `guard suggest`, ADR-0002, D13/D14)
The last model-in-loop piece. A developer describes intent in plain English; the model **proposes** a
structured shape (Anthropic tool-use, the discriminant constrained to the real vocabulary enum); the SAME
deterministic filter (`mapIntent` / `arch property`) **decides**. Safe by construction: a hallucinated
intent, a missing parameter, or a weak property is rejected by exactly the path that vets a hand-authored
one — the model never sits on the gate. The model SDK is confined to `src/author/model-propose.mjs` (lazy),
so the `isolate-import` "no model at gate-time" invariant still holds on ourselves (gate output:
`isolate-…: 0`). Tests inject faithful AND adversarial fakes (10/10 test files green) — the safe-
by-construction property is a CI test needing no API key.

**Four proposer backends (D15, D17), auto-selected by available creds:** `anthropic` = `@anthropic-ai/sdk`
(forced tool-use); `openai` = `openai` SDK (JSON mode); `gemini` = `@google/genai` (JSON mode); `cli` = shell
out to `claude -p --json-schema …` using Claude Code's own auth (e.g. a Max plan — no key, no per-token
bill). Auto order: anthropic → openai → gemini → claude-CLI; force with `ANCHOR_GUARD_BACKEND=anthropic|
openai|gemini|cli` (aliases api/google/claude). Per-provider model envs (`ANCHOR_GUARD_OPENAI_MODEL` default
gpt-4o; `ANCHOR_GUARD_GEMINI_MODEL` default gemini-2.5-flash). Each backend is a LAZILY-loaded pure adapter
receiving a `{ system, schema }` request that from-text.mjs builds from the envelope (dependency inversion —
backends don't import envelope.mjs, which our own coupling-hub limit forced). Only the chosen provider's SDK
loads, never at gate-time (isolate-import now also forbids `@google/genai`). All only propose. Anthropic +
claude-CLI verified live; OpenAI/Gemini adapters tested via injection, live run pending API keys. **Verified end-to-end LIVE on the `cli` backend (no API key).**

**Parameterized-intent enrichment — DONE (D16).** Two fixes, so layering/isolate-import/etc. now succeed:
(1) a per-intent/per-shape PARAMETER CATALOG (`INTENT_PARAMS` in map-intent.mjs, `SHAPE_PARAMS` in
properties.mjs) is rendered into the proposer's system prompt so the model uses the EXACT param names; a
test asserts every intent/shape is documented (no drift). (2) the FILTER now validates param TYPES, not just
presence — `mapIntent` coerces array params that arrive as a JSON-string or bare string and fails small on
anything non-array-shaped, so it never CRASHES (`.join` on a string) and never ACCEPTS a malformed invariant
(a string where `dirs` must be an array). Both verified live: "validate must not import cli" and "nothing in
src/agent or src/validate may import openai" now produce well-formed invariants with real array `dirs`.

## Next (resumable)
- **Find a design partner** — a platform team feeling "the agent keeps gaming our gate." Validation is a
  customer, not more building.
- Broaden the benchmark (the full attack matrix: raise-threshold / severity-downgrade / re-baseline /
  allow-list / stage-then-revert; vs dependency-cruiser AND Betterer). Deferred.
- Hosted PR app + org dashboard (post-validation).

## Honest status
Pre-product. The deterministic core is sprag (shipped, 35 suites green). This repo is the *glue*: the
authoring loop (structural-mapping + free-text on-ramp) + the gate wrapper, dogfooded. **Pushed to a
PRIVATE repo (`johnpatrickwarren-oss/anchor-guard`, 2026-06-03); BENCHMARK.md deliberately kept
non-public.** Not yet design-partnered.
