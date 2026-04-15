---
title: OpenClaw -> OMO Bounded Worker Wrapper
status: draft
created: 2026-04-13
project: openclaw-fabric
authority:
  canonical_for:
    - wrapper prototype scope
    - wrapper feature requirements
    - implementation sequence
    - wrapper success criteria
  defers_to:
    - projects/openclaw-fabric/RFC-0001-layer-boundaries.md for layer ownership and invariants
    - projects/openclaw-fabric/ARCHITECTURE_AND_CONTRACT.md for explanatory diagrams and example contracts
sources:
  - projects/openclaw-fabric/RFC-0001-layer-boundaries.md
  - projects/openclaw-fabric/ARCHITECTURE_AND_CONTRACT.md
  - projects/openclaw-fabric/schemas/worker-task.schema.json
  - projects/openclaw-fabric/schemas/worker-result.schema.json
  - projects/openclaw-fabric/sketches/openclaw-omo-wrapper.ts
---

# OpenClaw -> OMO Bounded Worker Wrapper

## Boundary Lock, Plain English

- **OpenClaw owns workflow.** It decides what work exists, what to do next, when to retry, when to escalate, what to remember, and what to tell the user.
- **OMO is a bounded worker.** It receives one task, works inside the declared boundary, writes declared artifacts, and returns a status.
- **Sable stays generic.** It mediates model and provider access only. It must not learn OpenClaw task lifecycle or OMO-specific workflow semantics.

Final rule:

**OpenClaw owns workflow. OMO executes one bounded task. Sable mediates models.**

## Scope Test

This spec turns one OpenClaw task into one bounded OMO execution.

## Authority Boundary

This spec is canonical for the first buildable wrapper prototype only.

It does **not** replace the boundary RFC. On conflict:

1. `RFC-0001-layer-boundaries.md` wins for layer ownership and invariants.
2. This spec wins for prototype wrapper behavior, feature scope, and implementation order.
3. `ARCHITECTURE_AND_CONTRACT.md` remains explanatory support, not the final implementation authority.

This avoids a skill/spec-style authority split.

## Problem Statement

Today the project has:

- 1 RFC-style boundary note
- 1 contract note
- 2 JSON Schemas
- 1 TypeScript wrapper sketch
- **0 production wrappers**
- **0 live validated OMO runs through an OpenClaw-style contract**

That means the architecture direction exists, but the first executable lane does not.

The root problem is not missing ideas. The root problem is the absence of **one proven, artifact-backed bounded worker contract** that keeps ownership clean across three layers:

- OpenClaw must remain the workflow source of truth.
- OMO must remain a bounded execution lane.
- Sable must remain generic provider mediation.

Without that proven contract, the stack is exposed to four failure modes:

- workflow ownership drifts downward into OMO
- worker semantics leak sideways into Sable
- resume depends on hidden session history instead of durable artifacts
- `blocked` and `failed` collapse into one ambiguous error path

This spec exists to turn the existing design notes into one buildable wrapper prototype that proves the boundary with durable artifacts and one real run.

## Explicitly Out of Scope

This prototype does **not** cover:

- an OMC adapter
- an OMX adapter
- changes to Sable provider behavior
- redesigning OpenClaw memory, retries, or escalation policy
- a multi-task graph inside OMO
- stdout scraping as a primary result channel

## Design Principles

### DP1. One workflow owner
Only OpenClaw may decide what work exists next.

### DP2. One task in, one result out
The wrapper handles one bounded task object and returns one bounded result object.

### DP3. Artifact-first continuity
Resume and review must come from written artifacts and stable task IDs, not hidden chat scrollback.

### DP4. Status trinary stays intact
`succeeded`, `blocked`, and `failed` are different states and must remain different in prompt text, schemas, code paths, and tests.

### DP5. Sable remains worker-agnostic
The wrapper may sit above Sable, but it must not push worker lifecycle semantics into Sable.

### DP6. Minimal boring prototype first
The first lane should be `OpenClaw -> OMO -> Sable`, not a generalized multi-lane abstraction.

### DP7. Durable evidence beats claimed success
A task is not done because stdout looked good. It is done when required artifacts exist and validate.

### DP8. Promote existing assets before creating parallel ones
The first implementation must start from the existing sketch, schemas, and boundary docs. Do not create duplicate wrapper entrypoints or parallel contract files unless the spec is explicitly updated to justify them.

## Definitions

### Control plane
The layer that decides what work exists, routes it, retries it, escalates it, preserves memory, and sends user-visible updates. In this project, that is OpenClaw.

### Execution lane
A layer that performs one bounded work unit and returns control through artifacts and explicit status. In this spec, that lane is OMO.

### Provider plane
The layer that mediates model and provider access without owning workflow. In this project, that is Sable.

### Bounded task
A single worker assignment with one `taskId`, one `cwd`, one goal, declared inputs, declared artifact outputs, one stop condition, and optional verification expectations.

### Stop condition
The exact condition that must be true for the worker to report `succeeded`.

### Verification expectation
A named check that the worker must perform or report against before finishing.

### Handoff artifact
The required markdown file written by the worker for a human or parent workflow to inspect.

### Result artifact
The required JSON file written by the worker that conforms to `worker-result.schema.json`.

### Resume anchor
A stable artifact path that a later run can use to resume bounded work without depending on hidden chat memory.

### Task staging directory
The wrapper-owned directory used to persist wrapper inputs, prompts, and task metadata for a given run. In the prototype, this is `<cwd>/.openclaw-fabric/tasks/`.

### Session map
The wrapper-owned JSON file that maps `taskId -> omoSessionId` when OMO exposes a resumable session identifier. In the prototype, this is `<cwd>/.openclaw-fabric/omo-session-map.json`.

### Contract-valid result
A JSON result that passes schema validation, preserves the original `taskId`, and points at the declared artifact paths.

### Fixture suite
The set of automated contract tests that covers valid and invalid worker-task and worker-result scenarios for the prototype.

### Boundary check
A mechanical validation that the wrapper layer does not import Sable internals or encode worker lifecycle semantics below the worker boundary.

### Durable validation note
A committed markdown artifact that records one live validation attempt, the exact command used, the produced artifact paths, the observed status behavior, and any mismatch between assumptions and reality.

### Clean validation sandbox
An isolated worktree or repository used for live validation where the target project has no nested `.git` directory and the git diff is intentionally scoped to the project under test.

## Architecture

### Data Flow

1. OpenClaw creates a `WorkerTask` object.
2. The wrapper validates the task shape against `worker-task.schema.json`.
3. The wrapper resolves relative paths against `cwd`.
4. The wrapper writes a staged task JSON file and a staged prompt markdown file under `<cwd>/.openclaw-fabric/tasks/`.
5. The wrapper ensures parent directories exist for the declared handoff and result artifacts.
6. The wrapper reads `<cwd>/.openclaw-fabric/omo-session-map.json` if present.
7. The wrapper launches OMO with one bounded prompt and one working directory.
8. OMO performs the bounded task.
9. OMO writes the declared markdown handoff and JSON result artifacts.
10. The wrapper optionally extracts an OMO session ID and updates the session map.
11. The wrapper loads and validates the JSON result artifact.
12. OpenClaw receives the `WorkerResult` and alone decides what work exists next.

### Canonical Source Map

- **Layer ownership and invariants:** `projects/openclaw-fabric/RFC-0001-layer-boundaries.md`
- **Contract examples and diagram:** `projects/openclaw-fabric/ARCHITECTURE_AND_CONTRACT.md`
- **Task schema:** `projects/openclaw-fabric/schemas/worker-task.schema.json`
- **Result schema:** `projects/openclaw-fabric/schemas/worker-result.schema.json`
- **Prototype behavior sketch:** `projects/openclaw-fabric/sketches/openclaw-omo-wrapper.ts`
- **Prototype staging artifacts:** `<cwd>/.openclaw-fabric/tasks/`
- **Prototype resume mapping:** `<cwd>/.openclaw-fabric/omo-session-map.json`

### Integration Points

- OpenClaw provides the `WorkerTask` and consumes the `WorkerResult`.
- OMO receives a rendered bounded prompt and executes inside the declared `cwd`.
- Sable remains below this boundary as generic model/provider mediation only.
- The wrapper must never require Sable to understand `taskId`, `blocked`, `resumeFrom`, or worker follow-up semantics.

### Prototype File Scaffold

The prototype should converge on this minimal file scaffold:

```text
projects/openclaw-fabric/
├── specs/
│   └── openclaw-omo-bounded-worker-wrapper.md
├── schemas/
│   ├── worker-task.schema.json
│   └── worker-result.schema.json
├── sketches/
│   └── openclaw-omo-wrapper.ts
├── scripts/
│   └── validate.sh
├── IMPLEMENTATION_PLAN.md
├── PROMPT_plan.md
├── PROMPT_build.md
└── AGENTS.md
```

If implementation is promoted out of `sketches/`, the old sketch path must either be replaced in place or removed in the same change. Do not leave two competing wrapper entrypoints behind.

## Features

### F1. Worker Task Intake and Path Normalization

**Goal**

Turn one OpenClaw task object into one fully resolved bounded wrapper task.

**One-time vs. ongoing**

Ongoing protocol for every wrapper run.

**Procedure**

1. Accept one `WorkerTask` object.
2. Validate required fields against `worker-task.schema.json`.
3. Resolve `cwd` to an absolute path.
4. Resolve relative `inputs`, `writeArtifacts.handoff`, `writeArtifacts.result`, and `resumeFrom` against `cwd`.
5. For the prototype, reject any resolved artifact path outside `cwd` as a contract violation.
6. Create the wrapper staging directory if missing.
7. Persist the normalized task JSON under `<cwd>/.openclaw-fabric/tasks/<taskId>.task.json`.

**Edge cases**

- required field missing
- relative path resolves outside `cwd`
- input file missing at launch time
- rerun reuses an existing `taskId`

**Delegation safety**

Delegatable to a build agent.

Guardrails:

- the agent must read the existing schema files before changing validation logic
- fixture tests must cover missing fields and path normalization
- no agent may relax `blocked` vs `failed` semantics to simplify code paths

**Success criteria**

- ✅ Immediate, ⚙️ Mechanical: invalid `WorkerTask` objects are rejected before OMO launch.
- ✅ Immediate, ⚙️ Mechanical: relative paths resolve deterministically against `cwd`.
- ✅ Immediate, ⚙️ Mechanical: artifact paths outside `cwd` are rejected.
- 📏 Trailing, ⚙️ Mechanical: the next 10 fixture runs preserve stable normalized paths for the same input task.
- ⚙️ Immediate, 👁️ Process: a reviewer can open the staged task JSON and understand the full bounded task without reading chat history.

### F2. Prompt Rendering and Artifact Bootstrap

**Goal**

Give OMO one bounded prompt and one explicit artifact contract.

**One-time vs. ongoing**

Ongoing protocol for every wrapper run.

**Procedure**

1. Render a prompt that includes:
   - task ID
   - working directory
   - goal
   - declared inputs
   - required artifact paths
   - stop condition
   - verification expectations
   - exact status rules for `succeeded`, `blocked`, and `failed`
   - exact result JSON contract
   - required sections for the markdown handoff
2. Write the prompt to `<cwd>/.openclaw-fabric/tasks/<taskId>.prompt.md`.
3. Ensure the parent directories for handoff and result artifacts exist.
4. Export environment variables that point OMO at the staged task file and artifact paths.

**Edge cases**

- `verify` list empty
- handoff directory missing
- result directory missing
- artifact parent directory not writable

**Delegation safety**

Delegatable to a build agent.

Guardrails:

- the agent must snapshot-test prompt rendering
- the agent must not remove the explicit status rules from the prompt
- the agent must not replace declared artifact paths with implicit defaults

**Success criteria**

- ✅ Immediate, ⚙️ Mechanical: rendered prompt contains the declared handoff path, result path, stop condition, and three status definitions.
- ✅ Immediate, ⚙️ Mechanical: wrapper creates parent directories for both artifacts before OMO launch.
- ✅ Immediate, ⚙️ Mechanical: environment variable names are written exactly as the wrapper contract expects.
- 📏 Trailing, ⚙️ Mechanical: prompt snapshot tests stay stable across the next 5 wrapper edits unless the contract intentionally changes.
- 👁️ Immediate, Process: a reviewer can determine task scope from the prompt alone.

### F3. OMO Invocation and Optional Resume Mapping

**Goal**

Execute one bounded task through OMO with optional session resume.

**One-time vs. ongoing**

Ongoing protocol for every wrapper run.

**Procedure**

1. Read `<cwd>/.openclaw-fabric/omo-session-map.json` if it exists.
2. Look up an existing `omoSessionId` by `taskId`.
3. Compose the prototype command:
   - `bunx oh-my-opencode run --json --directory <cwd> <prompt>`
   - add `--session-id <omoSessionId>` only when a mapping exists for the same `taskId`
4. Launch OMO with the bounded prompt, resolved cwd, exported environment variables, and optional timeout.
5. Capture `exitCode`, `stdout`, and `stderr` for diagnostics only.
6. If a parseable session ID is exposed, update the session map with `updatedAt`.

**Edge cases**

- OMO binary unavailable
- timeout expires
- stored session ID is stale or invalid
- OMO exits non-zero but still writes artifacts

**Delegation safety**

Mostly delegatable.

Guardrails:

- the agent must verify real CLI flags before finalizing invocation logic
- the agent must not claim session resume works without evidence from either tests or a real run
- stdout may support diagnostics, but it must not become the primary result channel

**Success criteria**

- ✅ Immediate, ⚙️ Mechanical: `--session-id` is passed only when a mapping exists for the same `taskId`.
- ✅ Immediate, ⚙️ Mechanical: session map updates only after a parseable session ID is detected.
- ✅ Immediate, ⚙️ Mechanical: timeout and process-launch failures return control to the wrapper rather than hanging indefinitely.
- 📏 Trailing, 👁️ Process: the next 3 interrupted prototype runs can resume from the same `taskId` without inventing hidden workflow state.
- 👁️ Immediate, Process: a reviewer can reconstruct the launched command and cwd from wrapper logs or staged artifacts.

### F4. Result Loading, Validation, and Status Preservation

**Goal**

Convert OMO completion into one contract-valid `WorkerResult` without collapsing status meanings.

**One-time vs. ongoing**

Ongoing protocol for every wrapper run.

**Procedure**

1. Read the declared result artifact path after OMO returns.
2. Parse the JSON.
3. Validate it against `worker-result.schema.json`.
4. Verify that `taskId` matches the original task.
5. Verify that `artifacts.handoff` and `artifacts.result` match the declared artifact paths.
6. Return valid `succeeded`, `blocked`, or `failed` results unchanged.
7. If the artifact is missing, malformed, or contract-invalid, write a fallback `failed` result artifact.
8. Preserve `resumeFrom` when present.
9. Treat stdout and stderr as diagnostics only.

**Edge cases**

- OMO exits `0` but writes no result artifact
- result JSON malformed
- result `taskId` mismatches the original task
- handoff exists but result artifact is missing
- worker reports `blocked` with an empty summary

**Delegation safety**

Delegatable to a build agent.

Guardrails:

- the agent must test `blocked` and `failed` as separate fixtures
- the agent must not infer success from exit code alone
- the agent must write the fallback result artifact when contract validation fails

**Success criteria**

- ✅ Immediate, ⚙️ Mechanical: valid `blocked` results pass through unchanged.
- ✅ Immediate, ⚙️ Mechanical: missing or invalid result artifacts produce a fallback `failed` result JSON.
- ✅ Immediate, ⚙️ Mechanical: result validation checks original `taskId` and artifact paths.
- 📏 Trailing, ⚙️ Mechanical: over the next 10 test fixtures, `blocked` and `failed` never collapse into the same branch.
- 👁️ Immediate, Process: a reviewer can determine failure cause from `errors` without reading raw stdout.

### F5. Contract Fixtures and First Live Validation

**Goal**

Prove the prototype with automated fixtures and one real OMO run.

**One-time vs. ongoing**

One-time initial proof, then ongoing smoke validation after contract changes.

**Procedure**

1. Add fixture inputs for:
   - valid succeeded result
   - valid blocked result
   - valid failed result
   - missing result artifact
   - malformed result JSON
   - task path normalization
   - artifact path escape rejection
   - resume map hit and miss
2. Add tests for prompt rendering, schema validation, fallback result writing, and session map updates.
3. Add a boundary check that the wrapper implementation does not import Sable internals or encode worker lifecycle fields into any provider-facing layer.
4. Prepare a clean validation sandbox for the live run. The sandbox must not contain a nested `.git` directory inside `projects/openclaw-fabric`, and its git diff must be intentionally scoped to this project.
5. Run one real OMO task against a toy workspace that writes both artifacts.
6. Save the evidence of that run under a durable project path.
7. Record the real command, produced artifacts, observed resume behavior, and any mismatch between expected and actual CLI semantics in a durable validation note.
8. If live OMO semantics disagree with the sketch, update the spec before broadening scope.

**Edge cases**

- fixture suite passes but real OMO flag semantics differ
- real OMO run writes unexpected JSON shape
- real OMO run cannot expose a parseable session ID
- live validation is attempted from a dirty parent repo or nested project repo

**Delegation safety**

Partially delegatable.

Guardrails:

- fixture creation is delegatable
- a real validation run requires evidence files, not claimed success
- any disagreement between live behavior and the sketch must be written down before prototype promotion

**Success criteria**

- ✅ Immediate, ⚙️ Mechanical: fixture suite covers `succeeded`, `blocked`, and `failed` plus malformed and missing artifact cases.
- ✅ Immediate, ⚙️ Mechanical: all example artifacts validate against the JSON Schemas.
- ✅ Immediate, ⚙️ Mechanical: a boundary check proves the wrapper does not import Sable internals or depend on worker-specific semantics below the worker boundary.
- ✅ Immediate, ⚙️ Mechanical: live validation refuses a nested project repo and documents the clean sandbox used for the attempt.
- ✅ Immediate, 👁️ Process: one real OMO run produces both required artifacts and a durable validation note.
- 📏 Trailing, 👁️ Process: the next 3 contract edits rerun the smoke validation before the wrapper is declared production-ready.

## Implementation Sequence

### F1. Worker Task Intake and Path Normalization
- Depends on: none
- Estimated effort: 1 Ralph iteration
- Parallelization: none, this establishes the base contract

### F2. Prompt Rendering and Artifact Bootstrap
- Depends on: F1
- Estimated effort: 1 Ralph iteration
- Parallelization: may partially overlap with fixture authoring, but land after F1

### F3. OMO Invocation and Optional Resume Mapping
- Depends on: F1, F2
- Estimated effort: 1 to 2 Ralph iterations
- Parallelization: session-map tests can parallelize with command-runner implementation

### F4. Result Loading, Validation, and Status Preservation
- Depends on: F1, F2, F3
- Estimated effort: 1 Ralph iteration
- Parallelization: result-fixture authoring can parallelize with implementation

### F5. Contract Fixtures and First Live Validation
- Depends on: F1, F2, F3, F4
- Estimated effort: 1 to 2 Ralph iterations
- Parallelization: fixture suite and live validation prep can run in parallel, but final proof depends on both

This sequence keeps the prototype inside a small Ralph build cap:

- expected minimum: 5 iterations
- expected upper bound: 7 iterations

## Ralph Build Guardrails for This Spec

These guardrails apply when Ralph executes this spec.

1. Study before writing. Before creating or editing code, study:
   - `projects/openclaw-fabric/RFC-0001-layer-boundaries.md`
   - `projects/openclaw-fabric/ARCHITECTURE_AND_CONTRACT.md`
   - `projects/openclaw-fabric/schemas/worker-task.schema.json`
   - `projects/openclaw-fabric/schemas/worker-result.schema.json`
   - `projects/openclaw-fabric/sketches/openclaw-omo-wrapper.ts`
2. Promote existing assets before creating new ones. Prefer extending `sketches/openclaw-omo-wrapper.ts` or replacing it in place. Do not create `*-v2` or parallel wrapper files unless the current file is proven unusable and the reason is written in the plan.
3. One task per iteration. A BUILD agent must implement exactly one feature or subtask, update the plan, commit, and exit.
4. Plan updates are append-only in spirit. Mark progress, add discoveries, add blockers, but do not rewrite the remaining roadmap or silently remove tasks.
5. If live OMO behavior disagrees with the assumed CLI contract, write evidence and mark the task `blocked`. Do not invent compatibility from memory or plausible-looking stdout.

These guardrails specifically harden against F002, F012, F013, and F014.

## Feature Tracker

| ID | Feature | Status | Depends On |
|---|---|---|---|
| F1 | Worker task intake and path normalization | ❌ | none |
| F2 | Prompt rendering and artifact bootstrap | ❌ | F1 |
| F3 | OMO invocation and optional resume mapping | ❌ | F1, F2 |
| F4 | Result loading, validation, and status preservation | ❌ | F1, F2, F3 |
| F5 | Contract fixtures and first live validation | ❌ | F1, F2, F3, F4 |

## Success Criteria, Spec Level

- ⚙️ Immediate: the prototype accepts one `WorkerTask`, launches one OMO run, and returns one contract-valid `WorkerResult`.
- ⚙️ Immediate: the wrapper preserves all three statuses, `succeeded`, `blocked`, and `failed`, as distinct code paths.
- ⚙️ Immediate: OpenClaw can resume bounded work from artifact paths and stable task IDs without hidden chat memory.
- ⚙️ Immediate: Sable remains untouched by worker lifecycle semantics.
- 📏 Trailing: the next 5 wrapper changes continue to pass the fixture suite without reintroducing stdout-only result handling.
- 👁️ Process: a reviewer can trace ownership cleanly, OpenClaw owns workflow, OMO owns bounded execution, Sable owns provider mediation, without finding responsibility bleed.

## Anti-Patterns

Do **not** do the following:

- Do not let OMO decide follow-up tasks, retries, or escalation, because that moves workflow ownership out of OpenClaw.
- Do not encode `taskId`, `blocked`, `resumeFrom`, or worker lifecycle semantics into Sable, because Sable must remain generic.
- Do not rely on stdout scraping as the primary result contract, because durable artifacts are the real state boundary.
- Do not collapse `blocked` into `failed`, because missing input and execution failure are operationally different.
- Do not require hidden session history to resume, because the contract is artifact-first.
- Do not create parallel wrapper implementations when the sketch and schemas already exist, because that invites duplicate implementation drift.
- Do not let Ralph complete multiple features in one iteration or rewrite the whole plan, because that breaks the fresh-context and shared-state model.
- Do not run live validation from a dirty parent repo or from a nested project repo, because git scope and artifact ownership become ambiguous.
- Do not start with OMC or OMX for the first prototype, because that widens scope before the default lane is proven.

## Remaining Risks

- OMO live CLI semantics, especially `--json` and session resume behavior, are still assumed from the current sketch and need proof.
- The prototype path restriction to stay under `cwd` is a deliberate hardening rule and may need adjustment if a real OpenClaw use case requires controlled external artifact paths.
- The project still needs one durable example directory or validation note location once the first live run is executed.
- The harness used to run Ralph can itself violate the intended boundary if it silently switches into OMC-style mission orchestration. That risk must be treated as a harness issue, not evidence against the wrapper contract.
