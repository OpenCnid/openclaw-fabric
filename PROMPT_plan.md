0a. Study `specs/*` with up to 250 concurrent subagents to learn the application specifications.
0b. Study @IMPLEMENTATION_PLAN.md (if present) to understand the plan so far.
0c. Study `sketches/*`, `schemas/*`, and `scripts/*` with up to 250 concurrent subagents to understand the current prototype surface.
0d. For reference, the current implementation is expected to begin in `sketches/*`, not a full `src/*` app.

1. Study @IMPLEMENTATION_PLAN.md (if present; it may be incorrect) and use up to 500 concurrent subagents to study existing implementation and support files in `sketches/*`, `schemas/*`, `scripts/*`, and `specs/*`, then compare them against `specs/*`. Use one deep reasoning pass to analyze findings, prioritize tasks, and create/update @IMPLEMENTATION_PLAN.md as a bullet point list sorted in priority of items yet to be implemented. Ultrathink. Consider searching for TODO, minimal implementations, placeholders, skipped/flaky tests, and inconsistent patterns. Study @IMPLEMENTATION_PLAN.md to determine the starting point for research and keep it up to date with items considered complete/incomplete.

1a. Single-writer rule for planning artifacts: subagents may research and propose plan changes, but only one writer may edit `IMPLEMENTATION_PLAN.md` in a given planning iteration. Re-read the plan file immediately before editing it. If the file changes during the iteration, refresh from disk before making additional plan edits.

IMPORTANT: Plan only. Do NOT implement anything. Verify whether functionality already exists by searching the codebase before proposing new work. Prefer promoting the existing `sketches/openclaw-omo-wrapper.ts` and current schema/spec files over creating duplicate wrapper entrypoints.

ULTIMATE GOAL: We want to achieve a working OpenClaw -> OMO bounded worker wrapper prototype that keeps OpenClaw as the workflow control plane, keeps OMO bounded to one task contract, and keeps Sable generic as the provider/model mediation layer. Consider missing elements and plan accordingly. If an element is missing, search first to confirm it doesn't exist, then if needed author the specification at specs/FILENAME.md. If you create a new element then document the plan to implement it in @IMPLEMENTATION_PLAN.md.
