# OpenClaw Fabric

OpenClaw Fabric is a boundary-design and validation repo for how OpenClaw should delegate bounded work through OMO, keep orchestration in OpenClaw, and keep provider/model mediation in Sable.

This repo is intentionally focused on one narrow lane:
- **OpenClaw** owns workflow, routing, retries, and follow-up decisions
- **OMO** executes one bounded worker task at a time
- **Sable** stays a generic provider/model control plane, not a task orchestrator

## What is here

- `RFC-0001-layer-boundaries.md` - boundary rules for OpenClaw, OMO, and Sable
- `ARCHITECTURE_AND_CONTRACT.md` - working contract for the bounded worker lane
- `specs/openclaw-omo-bounded-worker-wrapper.md` - wrapper behavior spec
- `schemas/worker-task.schema.json` - task contract
- `schemas/worker-result.schema.json` - result contract
- `sketches/openclaw-omo-wrapper.ts` - current implementation sketch
- `scripts/contract-fixtures.mjs` - contract fixture harness
- `scripts/live-omo-validation.mjs` - durable live validation runner
- `validation/live-omo/` - accumulated live evidence bundles

## Current status

This repo has:
- a sketched `OpenClaw -> OMO` wrapper path
- schema and fixture coverage for the worker contract
- durable live-validation evidence, including successful and failed runs

This repo does **not** yet have:
- a production wrapper implementation in OpenClaw
- a finalized decision on session mapping/resume semantics
- locked live CLI compatibility beyond the evidence currently captured here

## Local validation

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

Evidence lands under `validation/live-omo/<timestamp-run-id>/` and should include the prompt, task, invocation, session map, produced artifacts, and `LIVE_VALIDATION.md`.

## PR workflow

Pull requests in this repo should:
- keep scope narrow
- preserve the OpenClaw/OMO/Sable boundary rules
- include validation or evidence updates when behavior changes
- avoid inventing new lanes or abstractions before this one is proven

The default CI path for PRs is `bash scripts/validate.sh`.

## Related repos / context

- OpenClaw upstream: https://github.com/openclaw/openclaw
- This repo: https://github.com/OpenCnid/openclaw-fabric
