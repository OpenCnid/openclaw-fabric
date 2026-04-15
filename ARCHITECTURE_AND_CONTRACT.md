# OpenClaw Fabric — Architecture, Diagram, and Contract

## Document role and authority boundary

This document is an **explanatory companion** to the OpenClaw Fabric RFC and wrapper spec.

It is useful for:

- the layer diagram
- ownership summary
- example task/result contracts
- status semantics
- concise practical rules

It is **not** the implementation-driving spec for the wrapper prototype.

On conflict:

1. `RFC-0001-layer-boundaries.md` wins for layer ownership and invariants.
2. `specs/openclaw-omo-bounded-worker-wrapper.md` wins for prototype behavior, feature sequencing, success criteria, and live validation requirements.
3. `schemas/worker-task.schema.json` and `schemas/worker-result.schema.json` win for exact JSON shape.

This note should help people understand the system quickly without becoming a second competing spec.

## Definitions

### Example contract
An illustrative JSON object that shows the intended shape and semantics of the boundary, but does not outrank the schema files.

### Resume anchor
The stable artifact path or reference a later run can use to continue bounded work without hidden chat memory.

### Supporting contract note
A concise document that explains how the contract works without replacing the canonical schema or the prototype spec.

## Layer diagram

```text
                        ┌──────────────────────┐
                        │        User          │
                        └──────────┬───────────┘
                                   │
                                   v
                    ┌────────────────────────────┐
                    │          OpenClaw          │
                    │  workflow + session truth  │
                    │  routing + retries + mem   │
                    └───────┬─────────┬──────────┘
                            │         │
                            │         │ optional
                            │         ├───────────────┐
                            │         │               │
                            v         v               v
                   ┌────────────┐ ┌────────────┐ ┌────────────┐
                   │    OMO     │ │    OMC     │ │    OMX     │
                   │ general    │ │ multi-lane │ │ deep lane  │
                   │ execution  │ │ execution  │ │ execution  │
                   └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
                         │              │              │
                         └──────┬───────┴───────┬──────┘
                                │               │
                                v               v
                        ┌────────────────────────────┐
                        │           Sable            │
                        │ provider/model mediation   │
                        │ auth + routing + shaping   │
                        └─────────────┬──────────────┘
                                      │
                                      v
                         ┌──────────────────────────┐
                         │      Model Providers     │
                         └──────────────────────────┘
```

## Ownership summary

### OpenClaw owns
- workflow state
- task graph
- routing
- retries
- escalation
- user updates
- memory and continuity

### OMO / OMC / OMX own
- bounded execution
- local task completion
- artifact writing
- status reporting

### Sable owns
- provider auth
- model routing
- request / response normalization
- provider-safe mediation

## Minimal task contract

```json
{
  "taskId": "TASK-001",
  "cwd": "/absolute/project/path",
  "goal": "Produce X",
  "inputs": [
    "docs/TASK.md",
    "artifacts/context/current-state.md"
  ],
  "writeArtifacts": {
    "handoff": "artifacts/results/task-001.md",
    "result": "artifacts/results/task-001.json"
  },
  "stopCondition": "X exists and Y is verified",
  "verify": [
    "condition A",
    "condition B"
  ],
  "resumeFrom": "artifacts/results/task-001.md"
}
```

## Result contract

```json
{
  "taskId": "TASK-001",
  "status": "succeeded",
  "summary": "Produced initial schema and logged 2 open questions",
  "artifacts": {
    "handoff": "artifacts/results/task-001.md",
    "result": "artifacts/results/task-001.json"
  },
  "nextStep": "Review field conflicts in source B",
  "resumeFrom": "artifacts/results/task-001.md"
}
```

## Status semantics

### `succeeded`
- stop condition met
- expected artifacts written

### `blocked`
- work cannot proceed without missing input, clarification, credential, or dependency
- not a crash
- not a harness failure

### `failed`
- execution failure
- crash
- contract violation
- verification failure

## Practical rules

1. OpenClaw sends one bounded task object.
2. Worker gets one cwd and one stop condition.
3. Worker writes one `.md` handoff and one `.json` result.
4. OpenClaw alone decides the next task.
5. Resume starts from artifact paths, not hidden chat memory.
6. Sable stays below the worker boundary as generic model mediation.

## Non-goals of this document

- It does not replace the wrapper prototype spec.
- It does not define Ralph implementation order.
- It does not define the fixture suite.
- It does not define the live validation sandbox procedure.
- It does not authorize alternative task/result shapes that conflict with the schema files.
