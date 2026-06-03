# ADR-0001 — Fuse Anchor (intent) + sprag (gate) into one agent-loop product

**Status:** accepted (MVP). **Date:** 2026-06-03.

## Context
Market analysis (2026): "vibe and verify" is the consensus enterprise strategy — wrap probabilistic
agents in a deterministic gate. The deterministic-gate category is owned by giants (Sonar 7M devs,
Semgrep, Snyk, Socket); the hot money is in LLM PR review (CodeRabbit/Greptile/Qodo, $1.2B+ raised).
Competing on deterministic *breadth* addresses zero market. The whitespace is the intersection of three
things neither camp serves well: **architectural-invariant ratchet + a gate that can't be weakened +
agent-loop integration.** sprag holds verified-uncontested mechanisms (meta-ratchet, fail-closed); Anchor
holds the intent-capture interview. Neither alone is the product.

## Decision
Build **@anchor/guard**: Anchor's interview on the front, sprag's unweakenable gate on the back, fused
into the agent loop. sprag = the defensible core (moat); Anchor = the necessary-but-not-defensible
on-ramp; the product is the connective tissue (installer, conversational interview, the
answers→invariants authoring loop, the agent/PR integration).

## Consequences
- The only genuinely new engineering is glue; the load-bearing/defensible parts already run.
- We build the product **under its own governance** (sprag gates this repo) — the founding proof case.
- Wedge positioning: "the governance an AI agent can't talk past," sold to platform teams running
  production agents — not "another static analyzer."
