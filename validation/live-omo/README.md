# Live OMO Validation Evidence

This directory is the durable project path for F5 live OMO validation evidence.

Run the live path from a clean worktree:

```sh
node scripts/live-omo-validation.mjs
```

The runner creates a clean toy sandbox, rejects nested `.git` directories, launches the wrapper through the real OMO command, copies the staged task/prompt/invocation and produced artifacts, and writes `LIVE_VALIDATION.md`.

Why this exists: fixture tests prove the wrapper contract mechanically, but F5 requires a real OMO run before the prototype can claim live CLI compatibility for `run --json`, `--session-id`, and session discovery.
