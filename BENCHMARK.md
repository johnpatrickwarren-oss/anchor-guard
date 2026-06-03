# Benchmark: `@anchor/guard` vs `dependency-cruiser` — the config-relaxation attack

**Date:** 2026-06-03 · **Reproduce:** `cd bench && npm install && SPRAG_HOME=<sprag> node run-benchmark.mjs`
**Versions:** dependency-cruiser **17.4.3**; `@anchor/guard` 0.0.1 over sprag (arch-gate).

## What this tests — and what it deliberately does *not*
A single, fair question: when an AI agent is told *"make the gate pass,"* and it **deletes the rule
instead of fixing the code**, does the gate notice?

This is **not** a detection-quality comparison. dependency-cruiser is an excellent, mature
architecture-rule tool, and on detection the two are **even**. The only variable here is what happens to
the *rule itself* under an adversarial author — the failure mode that matters once the author is an agent
optimizing for a green check.

## Setup (identical rule, both tools)
A tiny layered fixture: `src/ui` must never import `src/db` internals. The *same* rule is expressed in
both `.dependency-cruiser.cjs` (a `forbidden` rule, `severity: error`) and `arch-invariants.json` (a
`forbid_path` check). `@anchor/guard` additionally arms a **meta-ratchet** (`config_relaxations`) — its
config + baseline may only move forward vs git `HEAD`.

## The scenario (3 steps, both tools, real runs)

| Step | dependency-cruiser | `@anchor/guard` |
|---|---|---|
| **1 · clean** | exit 0 — **pass** | exit 0 — **pass** |
| **2 · agent adds the violation** (`ui` imports `db/internal`) | exit 1 — **BLOCK** | exit 3 — **BLOCK** |
| **3 · agent deletes the rule to "pass"** (violation still present) | exit 0 — **pass** ⚠️ | exit 3 — **BLOCK** ✅ |

Raw output (`results.json`, verbatim):
```
1 clean         dependency-cruiser    exit 0  pass
1 clean         @anchor/guard         exit 0  pass
2 violation     dependency-cruiser    exit 1  BLOCK
2 violation     @anchor/guard         exit 3  BLOCK
3 relax-config  dependency-cruiser    exit 0  pass    (rule silently deleted)
3 relax-config  @anchor/guard         exit 3  BLOCK   (meta-ratchet caught the deletion)
```

## Result
- **Steps 1–2: identical.** Both tools pass clean code and block the layering violation. No daylight.
- **Step 3: the divergence.** With the rule removed from its config, dependency-cruiser has nothing left
  to enforce — it reports a clean pass while the violating import is *still in the code*. `@anchor/guard`'s
  meta-ratchet compares the config to `HEAD`, sees the rule was deleted, and **blocks the relaxation
  itself** — exit 3, the violation un-hideable without an explicit, on-the-record override
  (`ARCH_ALLOW_RELAX=1`, which still prints what was loosened).

## Honest interpretation (no overclaim)
dependency-cruiser did exactly what it's designed to do at every step; "pass" at step 3 is *correct*
behavior for a tool whose contract is "enforce the rules I'm currently given." The gap isn't a quality
defect — it's a **category gap**: no free architecture-rule tool (dependency-cruiser, ArchUnit,
ESLint, Betterer's `--update`) treats *its own ruleset as something that must not silently weaken*. That
assumption was safe when humans wrote rules and code in separate acts. It is not safe when one agent edits
both in the same change.

**The narrow, true claim this benchmark supports:** on detection, `@anchor/guard` is at parity with the
best free tool; its differentiator is that **the gate cannot be silently turned off** — the precise
shortcut an agent reaches for to fake a pass is the one move the gate refuses to make quietly.

## Caveats / scope
- One rule, one language, one attack (rule deletion). The same result holds for raised thresholds,
  downgraded severity, and re-baselining (covered by sprag's meta-ratchet test suite), but those aren't
  re-run here.
- `--no-verify` / force-pushing `HEAD` bypass any local gate; the durable enforcement is the same check
  run in CI, where those don't apply. (See sprag's `THREAT-MODEL.md` for the full honest-limits list.)
- This compares the *deterministic* axis only; it says nothing about LLM PR-review tools, which are
  complementary, not competing.
