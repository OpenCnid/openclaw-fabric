---
title: Hardening Review — OpenClaw Fabric RFC + Contract Note
date: 2026-04-14
method: docs/meta-prompts/new-specs.md
status: complete
reviewed_files:
  - projects/openclaw-fabric/RFC-0001-layer-boundaries.md
  - projects/openclaw-fabric/ARCHITECTURE_AND_CONTRACT.md
related_spec:
  - projects/openclaw-fabric/specs/openclaw-omo-bounded-worker-wrapper.md
---

# Hardening Review — OpenClaw Fabric RFC + Contract Note

## Goal

Apply the same meta-prompt hardening pass to the supporting OpenClaw Fabric docs without turning them into competing implementation specs.

## Reviewed Documents

- `RFC-0001-layer-boundaries.md`
- `ARCHITECTURE_AND_CONTRACT.md`

## High-Level Outcome

Both documents are now clearer about their role:

- the **RFC** is the canonical boundary and invariant document
- the **wrapper spec** remains the canonical prototype implementation spec
- the **contract note** remains explanatory support plus examples
- the **schema files** remain the source of truth for exact JSON shape

This directly hardens against authority drift and spec competition.

## Pass 1 — Structural

### P1-01 — Authority boundary was implied, not explicit
**Issue**
The RFC, contract note, and wrapper spec all described overlapping parts of the same system. Without a declared authority boundary, these docs could drift into contradictory instructions.

**Fix applied**
Added explicit `Document role and authority boundary` sections to both files.

### P1-02 — Supporting docs lacked definitions for recurring terms
**Issue**
Terms like `control plane`, `bounded worker`, `provider plane`, and `example contract` were used as if they were obvious, but those meanings matter for boundary design.

**Fix applied**
Added definitions to both documents, scoped to their purpose.

## Pass 2 — Semantic

### P2-01 — RFC risked becoming a build checklist
**Issue**
The RFC contained enough rollout guidance that it could be mistaken for the wrapper implementation plan.

**Fix applied**
Clarified that the RFC owns boundary ownership and rollout direction, not wrapper feature sequencing or fixture design.

### P2-02 — Contract note risked becoming a parallel spec
**Issue**
The contract note included examples and practical rules that could be misread as the final implementation authority.

**Fix applied**
Clarified that:
- the RFC wins for invariants
- the wrapper spec wins for prototype behavior and success criteria
- the schema files win for exact JSON shape

### P2-03 — Non-goals for supporting docs were underdefined
**Issue**
Without explicit non-goals, supporting docs can accrete implementation detail until they become shadow specs.

**Fix applied**
Added non-goals to the contract note and extended non-goals in the RFC.

## Pass 3 — Adversarial

### P3-01 — Authority split risk
**Failure pattern**
F023 Skill/Spec Authority Split

**Exposure**
Three documents described the same system from different angles.

**Mitigation**
Explicit precedence order now exists across RFC, wrapper spec, contract note, and schema files.

### P3-02 — Boundary drift risk
**Failure pattern**
F008 Orchestration Boundary Violation

**Exposure**
If supporting docs softened the line between OpenClaw, OMO, and Sable, implementation could follow the wrong ownership model.

**Mitigation**
The RFC now defines core terms more directly and reinforces what each layer must not own.

### P3-03 — Duplicate-spec drift
**Failure pattern**
Related to F012 Duplicate Implementation, but at the document layer

**Exposure**
The contract note could drift into a second implementation spec with slightly different task/result semantics.

**Mitigation**
The contract note now states that schema files outrank example JSON and that the wrapper spec outranks this note for prototype behavior.

## Net Result

The supporting docs are now better bounded:

- clearer roles
- fewer chances of shadow-spec drift
- tighter vocabulary
- stronger precedence order

That should make future hardening easier and reduce the odds of Ralph or a human reading the wrong document as the implementation authority.
