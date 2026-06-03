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
weakened) → PR gate → behavioral properties validated.** 6 test files green, self-gate green throughout
(the gate even caught our own over-complex function — decomposed, not relaxed).

## Next (resumable)
- Model picks the property shape / structural intent from free-text (the one remaining model-in-loop bit;
  feeds the same `arch property` / `guard author` filters).
- Broaden the benchmark (raised-threshold / severity-downgrade / re-baseline; Betterer + ESLint).
- Hosted PR app + org dashboard (post-validation); design-partner recruiting.
- **Not pushed/published** — public posting (named-competitor benchmark, repo) needs John's go-ahead.

## Honest status
Pre-product. The deterministic core is sprag (shipped, 35 suites green). This repo is the *glue*: the
authoring loop's structural-mapping milestone + the gate wrapper, dogfooded. Not pushed/published.
