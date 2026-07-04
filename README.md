# @anchor/guard

Deterministic governance for teams running coding agents — **the gate an AI agent can't talk past.**
You state architectural intent in plain language; guard turns it into machine-checked invariants
(via [sprag](../sprag)) and enforces them in the agent's own loop. The distinguishing property:
**the gate cannot be silently weakened** — deleting a rule, raising a threshold, downgrading severity,
growing an exemption list, or even narrowing a rule's path regex is itself a blocked violation (the
meta-ratchet), overridable only explicitly and on the record (`ARCH_ALLOW_RELAX=1`).

Status: **pre-product MVP** (`private: true`, not yet published). Cold-readable project state lives in
`STATE.md`; decisions in `DECISIONS.md` and `docs/adr/`; the head-to-head vs dependency-cruiser in
`BENCHMARK.md`.

## Requirements

- Node ≥ 20
- A sibling checkout of [sprag](../sprag) (or point `SPRAG_HOME` at one) — guard shells out to it;
  no model SDK ever loads at gate-time (machine-checked on this repo itself).

## Quickstart

```bash
# arm a repo: conversational interview -> arch-invariants.json + baseline (ratchet-from-current)
node bin/guard.mjs init <dir>

# or non-interactively from a saved answers file
node bin/guard.mjs author <dir> --answers answers.json

# or let guard propose a set that fits the repo's shape (dry-run; --arm writes it)
node bin/guard.mjs scan <dir> [--arm]

# run the gate: architecture invariants + meta-ratchet + fail-closed
node bin/guard.mjs check <dir>       # exit 0 pass · 3 blocked · 2 fail-closed
```

## In the agent loop (MCP)

`guard mcp` starts an MCP server exposing `guard_invariants` (the contract to respect) and
`guard_check` (run the gate; `quick: true` for fast per-file + meta-ratchet feedback). Register with a
host, e.g. Claude Code / Cursor:

```json
{ "mcpServers": { "anchor-guard": { "command": "node", "args": ["bin/guard.mjs", "mcp"] } } }
```

Relaxing or deleting a rule surfaces the meta-ratchet block *through the tool* — tested in-process and
over real stdio.

## Free-text authoring (model proposes, filter decides)

```bash
node bin/guard.mjs suggest "keep coordinators thin"            # -> invariant proposal
node bin/guard.mjs suggest "retries back off" --property <dir> # -> behavioral property proposal
```

The model only ever **proposes**; the same deterministic filter (`mapIntent` / `arch property`)
accepts or rejects. Uses `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY`, or a signed-in
`claude` CLI when no key is set (`ANCHOR_GUARD_BACKEND` forces one). Authoring-time only — never at
gate-time.

## Other commands

```bash
node bin/guard.mjs report [dir]   # markdown gate summary (for a PR comment)
node bin/guard.mjs vocab          # the v1 intent vocabulary
```

## Development

```bash
npm test        # all test/*.test.mjs suites (no network, no keys needed)
npm run gate    # the gate on this repo itself — guard is built under its own governance
```
