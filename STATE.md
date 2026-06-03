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

## Next (resumable)
- Benchmark vs a free competitor (dependency-cruiser) → `BENCHMARK.md` (in progress this session).
- Then: the interview UX, the MCP agent-loop server, the GitHub PR surface (all designed in
  `~/concord/sprag` session notes + the wedge spec).

## Honest status
Pre-product. The deterministic core is sprag (shipped, 35 suites green). This repo is the *glue*: the
authoring loop's structural-mapping milestone + the gate wrapper, dogfooded. Not pushed/published.
