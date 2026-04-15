## Build & Run

Succinct rules for how to BUILD the project:

- build-loop entrypoint: `./loop.sh`
- First run sequence:
  - `./loop.sh plan 5`
  - review `IMPLEMENTATION_PLAN.md`
  - then `./loop.sh 5`
- Scope is strictly the first `OpenClaw -> OMO` bounded worker wrapper prototype.
- Do not widen scope to OMC, OMX, or a Sable redesign.
- Prefer promoting `sketches/openclaw-omo-wrapper.ts` over creating parallel wrapper files.
- If live OMO CLI behavior disagrees with assumptions, write it down and mark blocked. Do not fake compatibility.

## Validation

Run these after implementation:

- `bash scripts/validate.sh`

## Notes

- `specs/openclaw-omo-bounded-worker-wrapper.md` is the implementation-driving prototype spec.
- `RFC-0001-layer-boundaries.md` is canonical for layer ownership and invariants.
- `ARCHITECTURE_AND_CONTRACT.md` is explanatory support, not a competing spec.
- `schemas/worker-task.schema.json` and `schemas/worker-result.schema.json` are canonical for exact contract shape.
- Keep `succeeded`, `blocked`, and `failed` distinct everywhere.
