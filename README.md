# OpenClaw Fabric

> **A validation-first sandbox for the OpenClaw -> OMO bounded worker lane.**
>
> OpenClaw Fabric exists to prove one narrow idea well: OpenClaw should own workflow and orchestration, OMO should execute one bounded task at a time, and Sable should remain a generic provider/model control plane.

[Architecture & contract](./ARCHITECTURE_AND_CONTRACT.md) · [Boundary RFC](./RFC-0001-layer-boundaries.md) · [Live evidence](./validation/live-omo/README.md) · [Current status](./STATUS.md)

## At a glance

- **What this repo is:** boundary design, contract validation, and live evidence for the first `OpenClaw -> OMO` execution lane
- **What this repo is not:** a production runtime, a generalized multi-lane abstraction, or a provider-orchestration layer
- **Current posture:** experimental, evidence-driven, and intentionally narrow

## Core lane

- **OpenClaw** owns workflow, routing, retries, memory, and follow-up decisions
- **OMO** executes one bounded worker task at a time
- **Sable** mediates model/provider access and stays free of worker lifecycle semantics

If a change blurs those boundaries, it belongs under explicit review, not as incidental implementation drift.

## What is in this repo

- `ARCHITECTURE_AND_CONTRACT.md` - working contract for the bounded worker lane
- `RFC-0001-layer-boundaries.md` - boundary rules for OpenClaw, OMO, and Sable
- `specs/openclaw-omo-bounded-worker-wrapper.md` - wrapper behavior spec
- `schemas/worker-task.schema.json` - task contract
- `schemas/worker-result.schema.json` - result contract
- `sketches/openclaw-omo-wrapper.ts` - current implementation sketch
- `scripts/contract-fixtures.mjs` - contract fixture harness
- `scripts/live-omo-validation.mjs` - durable live validation runner
- `validation/live-omo/` - accumulated live evidence bundles

## Current state

This repo already has:
- a sketched `OpenClaw -> OMO` wrapper path
- schema and fixture coverage for the worker contract
- durable live-validation evidence, including successful and failed runs

This repo does **not** yet have:
- a production wrapper implementation in OpenClaw
- a finalized decision on session mapping/resume semantics
- broad claims about live CLI compatibility beyond the evidence captured here

## Validation

Run the repo validation from the repo root:

```bash
bash scripts/validate.sh
```

That validation checks:
- required files
- boundary constraints
- task/result schema expectations
- contract fixtures
- live validation runner self-test

## Live evidence flow

To run the durable live evidence path:

```bash
node scripts/live-omo-validation.mjs
```

Evidence lands under `validation/live-omo/<timestamp-run-id>/` and should include:
- the staged task
- the rendered prompt
- invocation metadata
- session map state
- produced artifacts
- `LIVE_VALIDATION.md`

## Pull request workflow

PRs in this repo should:
- keep scope narrow
- preserve the OpenClaw/OMO/Sable boundary rules
- update validation or evidence when behavior changes
- avoid introducing new lanes or abstractions before this one is proven

The default CI path for PRs is:

```bash
bash scripts/validate.sh
```

## Related repos

- OpenClaw upstream: https://github.com/openclaw/openclaw
- OpenClaw Fabric: https://github.com/OpenCnid/openclaw-fabric
