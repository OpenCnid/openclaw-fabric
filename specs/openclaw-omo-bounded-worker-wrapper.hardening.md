---
title: Hardening Review — OpenClaw -> OMO Bounded Worker Wrapper
date: 2026-04-14
method: docs/meta-prompts/new-specs.md
spec: projects/openclaw-fabric/specs/openclaw-omo-bounded-worker-wrapper.md
status: complete
---

# Hardening Review — OpenClaw -> OMO Bounded Worker Wrapper

## Purpose

This note records the meta-prompt hardening pass applied to the current wrapper spec. It exists so spec review findings are durable and auditable, not hidden inside ad hoc edits.

## Scope Under Review

- `projects/openclaw-fabric/specs/openclaw-omo-bounded-worker-wrapper.md`
- supporting references:
  - `projects/openclaw-fabric/RFC-0001-layer-boundaries.md`
  - `projects/openclaw-fabric/ARCHITECTURE_AND_CONTRACT.md`
  - `projects/openclaw-fabric/schemas/worker-task.schema.json`
  - `projects/openclaw-fabric/schemas/worker-result.schema.json`
  - `projects/openclaw-fabric/sketches/openclaw-omo-wrapper.ts`
  - `harness/failures/index.json`

## Pass 1 — Structural

### P1-01 — Success-criteria terms were underdefined
**Issue**
The spec used terms like `fixture suite`, `boundary check`, and `durable validation note` in success criteria without defining them.

**Fix applied**
Added definitions for:
- `Fixture suite`
- `Boundary check`
- `Durable validation note`
- `Clean validation sandbox`

### P1-02 — Prototype scaffold was implicit, not explicit
**Issue**
The spec referenced many files across the project, but the minimal prototype file scaffold was only inferable from context.

**Fix applied**
Added `Prototype File Scaffold` under Architecture, naming the minimum expected file layout and explicitly forbidding competing wrapper entrypoints.

### P1-03 — Live validation environment shape was missing
**Issue**
The spec required a live OMO validation run but did not define the environment constraints needed to make that run trustworthy.

**Fix applied**
Added `Clean validation sandbox` as a defined term and updated F5 to require an isolated, non-nested repo/worktree for live validation.

## Pass 2 — Semantic

### P2-01 — “Run one real OMO task” was too loose
**Issue**
Without a stronger description, a “real run” could be claimed with weak evidence or from an unsafe repo state.

**Fix applied**
Strengthened F5 so the live run must:
- occur in a clean validation sandbox
- produce both required artifacts
- record the exact command
- record observed resume behavior
- record CLI mismatches in a durable validation note

### P2-02 — Repo hygiene risk was not captured in the spec
**Issue**
The failed Ralph attempt showed that dirty parent repos and nested project repos can distort git-scoped work and confuse validation.

**Fix applied**
Added:
- F5 edge case for dirty parent repo / nested project repo
- F5 mechanical success criterion rejecting nested project repos for live validation
- anti-pattern explicitly forbidding live validation from a dirty or nested repo context

### P2-03 — Duplicate-wrapper drift needed stronger protection
**Issue**
The spec said to promote existing assets, but the file-layout consequence of violating that rule was still easy to miss.

**Fix applied**
Strengthened architecture scaffold language so sketch promotion must replace or remove the prior path in the same change.

## Pass 3 — Adversarial

### P3-01 — Confabulation risk around live CLI assumptions
**Failure pattern**
F002 Agent Confabulation

**Exposure**
A builder could claim OMO `--json` or `--session-id` support from memory or plausible stdout rather than evidence.

**Mitigation already in spec**
- F3 guardrail: do not claim resume works without evidence
- F5 durable validation note requirement
- explicit blocked-path if live behavior diverges from the sketch

### P3-02 — Exit-code false success risk
**Failure pattern**
F001 Exit Code Lies

**Exposure**
The wrapper could treat process exit `0` as success even when no valid result artifact exists.

**Mitigation already in spec**
- F4 validates the result artifact after process completion
- fallback `failed` result is required when the contract is broken
- stdout and exit code remain diagnostic only

### P3-03 — Orchestration boundary leakage
**Failure pattern**
F008 Orchestration Boundary Violation

**Exposure**
Implementation could leak worker lifecycle semantics into Sable or import Sable internals directly.

**Mitigation already in spec**
- boundary lock at top of spec
- F5 mechanical boundary check for Sable imports / semantics leakage
- anti-pattern forbidding worker semantics below the worker boundary

### P3-04 — Duplicate implementation drift
**Failure pattern**
F012 Duplicate Implementation

**Exposure**
A builder could create `openclaw-omo-wrapper-v2.ts` or another parallel path instead of promoting the existing sketch.

**Mitigation already in spec**
- DP8 promote existing assets before creating parallel ones
- Ralph guardrail to prefer the current sketch path
- prototype file scaffold forbids competing wrapper entrypoints

### P3-05 — Plan vandalism / multi-task drift during Ralph execution
**Failure patterns**
- F013 Plan Vandalism
- F014 Multi-Task Violation

**Exposure**
A build loop could rewrite plan structure or implement multiple features in one iteration.

**Mitigation already in spec**
- Ralph guardrails for one task per iteration
- append-only plan-update spirit
- anti-pattern forbidding multi-feature iteration behavior

### P3-06 — Authority split across boundary docs and spec
**Failure pattern**
F023 Skill/Spec Authority Split

**Exposure**
The RFC, contract note, and implementation spec could drift into contradictory instructions.

**Mitigation already in spec**
- explicit authority boundary section
- RFC stays canonical for layer ownership
- wrapper spec stays canonical for prototype behavior and build order

### P3-07 — Git-boundary visibility risk
**Failure pattern**
F004 Git Boundary Invisible Docs

**Exposure**
Relevant wrapper rules could live outside the effective working boundary for a builder.

**Mitigation already in spec**
- canonical source map uses project-local paths
- prototype scaffold brings the critical files into one visible project surface
- validation sandbox requirement makes repo scope explicit during live validation

## Remaining Risks

These remain unresolved and require evidence, not speculation:

1. **Actual OMO CLI semantics**
   - `run --json`
   - `--session-id`
   - actual session-id discoverability
2. **Exact implementation destination**
   - whether the first production-ready file replaces the sketch in place or is promoted into another canonical path
3. **Harness behavior during Ralph execution**
   - the prior run showed the harness itself can silently enter OMC-style mission orchestration
   - this is a harness-boundary problem, not a wrapper-contract disproof

## Net Result

The spec is materially stronger after this pass:
- tighter definitions
- explicit prototype scaffold
- explicit clean-sandbox requirement for live validation
- stronger anti-confabulation evidence requirements
- stronger defenses against duplicate implementation and boundary drift

It is now in better shape for planning or future Ralph use, but the live OMO contract is still **unproven** until one evidence-backed validation run succeeds.
