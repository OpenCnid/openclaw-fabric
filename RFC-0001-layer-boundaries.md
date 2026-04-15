# RFC-0001: Layer Boundaries for OpenClaw, OMO / OMC / OMX, and Sable

**Status:** Draft  
**Last Updated:** 2026-04-13

## Summary

This RFC proposes a layered architecture with three clear responsibilities:

- **OpenClaw** is the workflow and session control plane
- **OMO / OMC / OMX** are bounded execution lanes
- **Sable** is the provider and model mediation plane

Core rule:

**OpenClaw owns workflow state. Workers execute bounded tasks. Sable mediates model/provider access.**

## Document role and authority boundary

This RFC is a **supporting boundary document**, not the prototype build spec.

It is canonical for:

- layer ownership
- invariants between layers
- rollout direction
- what each layer must not own

It is **not** canonical for:

- wrapper feature sequencing
- prototype file scaffold
- Ralph implementation order
- test fixture inventory
- live validation procedure details

On conflict:

1. This RFC wins for layer ownership and invariants.
2. `specs/openclaw-omo-bounded-worker-wrapper.md` wins for the first wrapper prototype's behavior, feature breakdown, and implementation order.
3. `ARCHITECTURE_AND_CONTRACT.md` remains an explanatory companion with examples, not a competing spec.

## Motivation

Without explicit boundaries, the stack risks overlapping control systems:

- OpenClaw routes tasks while OMO also thinks it owns orchestration
- execution tools silently create follow-up work outside the parent workflow
- model mediation logic leaks upward into harness design
- continuity lives in chat/session history instead of durable artifacts

That creates brittleness, unclear ownership, and difficult recovery.

The goal of this RFC is to keep the stack boring, inspectable, and composable.

## Definitions

### Workflow source of truth
The only layer allowed to decide what work exists next, what to retry, what to escalate, and what to tell the user. In this architecture, that is OpenClaw.

### Control plane
The layer that owns routing, permissions, memory, retries, escalation, and user-visible workflow lifecycle.

### Bounded worker
An execution lane that receives one explicit task contract, performs local work inside that boundary, and returns control through artifacts and explicit status.

### Provider plane
The layer that mediates model and provider access without taking ownership of workflow or worker lifecycle.

### Bounded task contract
The interface by which OpenClaw sends one task to a worker and receives one explicit result back.

### Supporting boundary document
A document that clarifies architecture, invariants, and intent without replacing the implementation-driving prototype spec.

## Decision

### 1. OpenClaw is the control plane

OpenClaw is the only system that should own:

- task intake
- routing
- retries
- escalation
- permissions and policy
- memory and continuity
- parent/child relationships
- user-visible messaging
- workflow lifecycle
- the decision about what work exists next

OpenClaw is the source of truth for task state.

### 2. OMO is the default execution lane

OMO should be treated as the default bounded worker for general execution.

It may perform implementation, inspection, verification, or artifact generation inside the scope of a single assigned task.

It should not become the source of truth for:

- workflow progression
- retry policy
- escalation
- cross-task continuity
- global task graph state

### 3. OMC is optional and selective

OMC should only be used when a bounded task genuinely requires coordinated multi-lane execution that OpenClaw does not already handle cleanly at the orchestration level.

OMC is not the default worker.

### 4. OMX is optional and selective

OMX should only be used for clearly deep or specialized lanes, such as:

- hard debugging
- contract-heavy changes
- narrow high-complexity execution

OMX is not the default worker.

### 5. Sable is the model/provider control plane

Sable owns:

- provider abstraction
- auth mediation
- model routing
- provider-safe translation
- normalized request/response behavior at the model boundary

Sable should not own:

- workflow state
- task lifecycle
- worker orchestration
- OMO / OMC / OMX-specific semantics

Sable should know how to talk to providers, not how to run workflows.

## Recommended architecture

### Initial shape

```text
User
-> OpenClaw
-> OMO
-> Sable
-> Model Providers
```

### Extended shape, only when justified

```text
User
-> OpenClaw
   -> OMO for general execution
   -> OMC for coordinated multi-lane execution
   -> OMX for deep specialist execution

All model access
-> Sable
-> Providers
```

## Interface boundaries

### Boundary A: OpenClaw -> Worker

This is a **bounded task contract**.

OpenClaw sends:

- task identity
- cwd
- goal
- explicit inputs
- declared artifact paths
- stop condition
- verification expectations
- optional resume anchor

The worker returns:

- `succeeded`, `blocked`, or `failed`
- machine-readable result artifact
- human-readable handoff artifact
- optional next-step hint
- resume anchor

Invariant:

**The worker does work. OpenClaw decides what work exists next.**

### Boundary B: Worker -> Sable

This is a **generic provider/model boundary**.

The worker may request model access through Sable, but Sable should receive only model-facing concerns:

- model selection or constraints
- prompt/messages/tool payloads
- provider-specific translation needs

Invariant:

**Sable knows models and providers, not workflow.**

### Boundary C: OpenClaw -> Sable

Allowed when OpenClaw itself needs direct model access.

However, this must still remain a provider boundary, not a worker-task boundary. OpenClaw should not encode OMO / OMC / OMX semantics into Sable.

## Invariants

The following rules must hold:

- OpenClaw is the only workflow source of truth
- Workers must not silently create follow-up tasks outside contract
- Workers must not require hidden chat memory to resume
- Artifact files, not stdout vibes, should carry task state
- `blocked` and `failed` must remain distinct
- Sable must remain generic and worker-agnostic

## Non-goals

This RFC does not recommend:

- treating OMO, OMC, and OMX as equal interchangeable defaults
- letting workers own retry or escalation policy
- making Sable aware of worker-specific task lifecycle
- storing continuity only in session history
- using stdout scraping as the primary result contract
- turning this RFC into the build checklist for the wrapper prototype

## Rollout plan

### Phase 1
Adopt:

```text
OpenClaw -> OMO -> Sable
```

Define one boring task contract and prove resumable bounded execution works.
Prototype task breakdown, validation details, and file-level implementation order belong in the wrapper spec, not this RFC.

### Phase 2
Add OMC only if real multi-lane bounded execution is needed.

### Phase 3
Add OMX only for explicit deep-specialist lanes.

### Phase 4
Keep Sable generic so any upper layer can consume it without coupling Sable to harness internals.

## Final rule

**OpenClaw owns workflow. OMO / OMC / OMX execute bounded tasks. Sable mediates models. No layer should silently absorb responsibility from another.**
