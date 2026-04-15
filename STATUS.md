---
project: OpenClaw Fabric
health: 🟢 Active
last_session: 2026-04-13
---

# OpenClaw Fabric — Status

## What It Is
OpenClaw Fabric is a boundary-design project for how OpenClaw should relate to OMO / OMC / OMX and Sable. It captures the architecture, the bounded worker contract, and the first concrete wrapper sketch for an OpenClaw -> OMO integration.

## Current State
- ✅ Project name selected: `openclaw-fabric`
- ✅ Project docs created under `projects/openclaw-fabric/`
- ✅ RFC-style boundary note written
- ✅ Diagram + contract note written
- ✅ Task and result JSON Schemas created
- ✅ First TypeScript implementation sketch for `OpenClaw -> OMO` wrapper created
- ✅ First Ralph-compatible wrapper spec written
- ⬜ No production wrapper implementation yet
- ⬜ No live OMO adapter validation against a real OpenClaw runtime yet

## Key Ideas
- OpenClaw is the workflow control plane.
- OMO is the default bounded execution lane.
- OMC and OMX are optional specialist lanes, not defaults.
- Sable is the provider/model control plane, not a task orchestrator.
- Durable artifacts beat stdout scraping and hidden session continuity.

## Next
- [ ] Decide whether the first live wrapper should target `bunx oh-my-opencode run --json` directly or a thinner local adapter binary
- [ ] Define artifact directory conventions for OpenClaw-owned worker tasks
- [ ] Decide whether OpenClaw should persist `taskId -> omoSessionId` mappings for resumable worker sessions
- [ ] Validate the task/result schema against one real OMO run
- [ ] Convert the sketch into an actual adapter package or OpenClaw runtime module if the contract holds up

## Blockers
- The wrapper contract is still a design sketch, not an exercised production path
- Real OMO output semantics and session resume behavior need live validation before implementation locks in

## Key Files
- `projects/openclaw-fabric/RFC-0001-layer-boundaries.md`
- `projects/openclaw-fabric/ARCHITECTURE_AND_CONTRACT.md`
- `projects/openclaw-fabric/specs/openclaw-omo-bounded-worker-wrapper.md`
- `projects/openclaw-fabric/schemas/worker-task.schema.json`
- `projects/openclaw-fabric/schemas/worker-result.schema.json`
- `projects/openclaw-fabric/sketches/openclaw-omo-wrapper.ts`
