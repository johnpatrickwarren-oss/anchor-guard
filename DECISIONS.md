# @anchor/guard — MVP decision log

Autonomous build session. **Method: for each fork, 3 options, take the best, log the reasoning.** Anything
here is reversible in the morning — the chosen option is in **bold** with a one-line "why" and the
trade-off accepted.

The MVP is the fused on-ramp: **install → interview → invariants armed → agent gated**, the deterministic
governance layer for teams running coding agents. Wedge: *"the governance an AI agent can't talk past."*

---

## D1 — MVP scope: which slice proves the wedge fastest?
- **(A) Authoring-loop only** — interview → invariants armed (no agent integration yet).
- **(B) Agent-gate only** — sprag in the agent loop, invariants hand-authored.
- **(C) ✅ Thin end-to-end vertical** — minimal interview (structural-mapping milestone) → invariants armed → a single agent-loop gate that blocks + can't be weakened, on ONE repo.

**Chosen: C.** The wedge is the *fusion*; proving either half alone proves nothing new (sprag already
gates; Anchor already interviews). The thin vertical is the smallest thing that demonstrates the actual
product claim. **Trade-off:** each layer is shallow (rules-only authoring, one agent runtime) — depth is
fast-follow.

## D2 — Language / runtime
- **(A) TypeScript + tsc build** — type-safety, dogfoods our own no-new-any story.
- **(B) ✅ ESM JavaScript (.mjs), Node 20+, no build** — matches sprag exactly, zero toolchain, sprag
  gates it natively, fastest iteration.
- **(C) TS via `node --experimental-strip-types`** — types without a build, but runtime-version risk.

**Chosen: B.** MVP velocity + native sprag dogfooding (sprag is .mjs; no generated-file ambiguity) +
zero build step. The product *targets* TS user repos regardless of its own language. **Trade-off:** no
static types on ourselves yet; TS migration is a clean fast-follow once the surface stabilizes.

## D3 — Internal architecture & layering (what we'll author invariants for)
- **(A) Flat `src/` modules** — fastest, but no enforceable boundaries (the thing we sell).
- **(B) ✅ Layered: `cli → {interview, author, agent} → validate → (sprag)`, `core` shared** — explicit
  layers, and the model SDK is isolated to `author/`.
- **(C) Plugin/hexagonal ports-and-adapters** — clean but over-built for an MVP.

**Chosen: B.** It lets us *enforce our own thesis architecturally*: the deterministic gate (`validate/`)
and the gate-time path (`agent/`) must **never import a model SDK** — only `author/` (offline) may. The
product's central promise ("no model at gate-time") becomes a machine-checked layering invariant — the
headline dogfood. **Trade-off:** a little ceremony up front; worth it because it *is* the demo.

## D4 — Agent-loop integration surface
- **(A) ✅ MCP server** — runtime-agnostic (Claude Code, Cursor, any MCP host), TS/Node-native, the
  emerging standard for agent tool integration.
- **(B) Claude Code skill + hook** — deepest in one runtime, but single-vendor lock.
- **(C) IDE extension (VS Code)** — broad reach but heavy, and misses headless/CI agents.

**Chosen: A.** MCP is the lowest-effort path to "works inside the agent loop" across the runtimes that
matter, and it matches where the ecosystem is standardizing. **Trade-off:** MCP can't *block* a write by
itself — it exposes a `guard.check` tool the agent is instructed to call and obey; true blocking lives in
the pre-commit hook + CI. MVP = MCP for in-loop feedback, hook for hard enforcement.

## D5 — Authoring approach (interview answers → invariants)
- **(A) Model-first** — LLM maps free-form intent → invariants. Flexible, but the risky/expensive part.
- **(B) ✅ Rules-first (decision table), model as later fuzzy-fallback** — deterministic intent→check-kind
  mapping from a fixed menu; the model only enters for ambiguous mappings, behind `arch property`.
- **(C) Manual templates** — operator edits JSON. Zero magic, high friction.

**Chosen: B.** The structural-mapping milestone is a *bounded classification* (~20 check kinds) — rules
handle most of it deterministically, which is faster, testable, and needs no model at all for v1. Keeps
the one model-in-the-loop step (behavioral properties) for later, gated by `arch property`. **Trade-off:**
v1 understands a fixed intent vocabulary; fuzzy free-text intent is a fast-follow.

## D6 — How `@anchor/guard` consumes sprag
- **(A) ✅ Subprocess (`node …/arch.mjs`)** — clean process boundary, version-pinned, no coupling to
  sprag internals; matches how sprag's own hook shells out.
- **(B) Import sprag modules directly** — faster calls, but couples to sprag's internal API (unstable).
- **(C) Vendor/fork sprag** — full control, but a maintenance fork and abandons the dogfood.

**Chosen: A.** Subprocess keeps the boundary honest (and is itself enforceable: `validate/` shells out to
sprag, nothing else touches it). Pin sprag by path/version. **Trade-off:** per-call process spawn cost —
negligible at authoring/gate cadence.

## D7 — Distribution (MVP)
- **(A) ✅ `npx @anchor/guard` CLI + the MCP server it ships** — one install, no account, dev-first.
- **(B) Hosted SaaS + GitHub App** — the eventual product, but premature pre-validation.
- **(C) IDE marketplace** — discovery, but heavy and runtime-narrow.

**Chosen: A.** Design-partner motion is "run this in your repo," not "sign up." Hosted/PR-app is the
post-validation step. **Trade-off:** no org dashboard yet — a PR-comment summary substitutes.

---

## D8 — MCP server implementation
- **(A) ✅ Official `@modelcontextprotocol/sdk`, low-level `Server` + raw JSON-Schema tools** — guaranteed
  protocol compatibility with real hosts (Claude Code/Cursor), no zod authoring, in-process testable via
  `InMemoryTransport.createLinkedPair`.
- **(B) Official SDK high-level `McpServer` + zod** — ergonomic but adds a zod authoring dependency.
- **(C) Hand-rolled JSON-RPC-over-stdio** — zero deps, but reimplements the protocol and risks subtle
  incompatibility — which defeats the point ("runs inside the agent loop").

**Chosen: A.** Compatibility is the whole value; the low-level `Server` keeps us off zod while staying
spec-correct. Tested both in-process (SDK client↔server) and over real stdio (initialize + tools/list).
The SDK is a *protocol* dep, not a model SDK — confirmed it doesn't trip the model-isolation invariant.
**Trade-off:** one runtime dependency (+92 transitive); justified for a protocol server.

## D9 — Interview I/O
- **(A) ✅ readline for TTY + read-all-stdin line-queue for piped/scripted input.**
- (B) readline only — but it drops bulk-piped lines (broke the smoke test) → not scriptable/CI-able.
- (C) prompt-library dep — unnecessary weight.
**Chosen: A.** Conversational interactively, *and* `guard init < answers.txt` works (CI / design-partner
scripting). The question logic is pure+tested; the I/O is a thin shell.

## D10 — Diff-scoped check
- **(A) ✅ `quick` mode = per-file checks + meta-ratchet, defer whole-tree walks (fanin/require_tests).**
- (B) true line-level diff scoping — needs sprag changes; premature.
- (C) always full — fine for small repos, slow for monorepos.
**Chosen: A.** Fast in-loop feedback that still can't be weakened; the full gate is the authority at
commit. Proven a strict subset by test (a whole-tree violation blocks full, passes quick; per-file +
meta-ratchet still enforced).

## D11 — PR surface
- **(A) ✅ `guard report` (markdown) + a workflow that posts it as a PR comment and blocks on exit code.**
- (B) full GitHub App (webhooks/OAuth) — premature.
- (C) CI check only, no comment — less visible.
**Chosen: A.** Visible + enforcing, minimal infra. The meta-ratchet runs in CI too — a PR that relaxes a
rule fails the check.

## D12 — Behavioral-property authoring
- **(A) ✅ Templated shapes from a structured spec, validated by `arch property`; model picks the shape
  later (fast-follow), behind the same filter.**
- (B) model-drafts-freely now — the risky/expensive part, premature and unguarded.
- (C) hand-written property files only — high friction.
**Chosen: A.** Rules-first (D5), deterministic acceptance. The model only ever *proposes*; `arch property`
(holds + kills mutants) decides, so a weak/tautological draft can't land (fail-small: rejected drafts are
deleted).

## Standing rule for the rest of the build
Every further fork gets the same treatment, appended here. The product is built **under its own
governance** (sprag gate from commit zero; STATE.md + ADRs as the trail) — if the dogfood ever fights us,
that's signal about the product, and it gets logged, not bypassed.
