# OMO Agent Selection Handoff — 2026-04-15

## What we are building

We are building an **OpenClaw -> OMO bounded-worker wrapper**.

Intended boundary:
- **OpenClaw** owns workflow and orchestration.
- **OMO / oh-my-openagent** is the bounded worker lane.
- **Sable** is only the provider/model routing layer.

The local wrapper/prototype and fixture harness are already in decent shape. The current blocker is in **live OMO invocation**, before we can prove the full worker path end-to-end.

## Current local config

### `~/.config/opencode/oh-my-openagent.json`
Relevant current shape:
- `default_run_agent = "Sisyphus"`
- `default_session_agent = "Prometheus"`
- `agents.sisyphus.model = "openclaw/sable-opus-46"`
- `agents.hephaestus.model = "openclaw/codex-gpt-54"`
- `agents.prometheus.model = "openclaw/sable-opus-46"`

Important nuance from upstream `configuration.md`:
- `agents.{...}` uses **lowercase/internal config keys** like `sisyphus`, `hephaestus`, `prometheus`
- agent selection / defaults appear to use **display names** like `Sisyphus`, `Hephaestus`, `Prometheus`

### `~/.config/opencode/opencode.json`
Relevant current shape:
- plugin enabled for OMO / oh-my-openagent
- custom provider `openclaw` via `@ai-sdk/openai-compatible`
- provider points at the local OpenClaw gateway (`http://127.0.0.1:18789/v1`)
- model aliases currently used:
  - `openclaw/sable-opus-46`
  - `openclaw/codex-gpt-54`

Secrets intentionally omitted from this handoff.

## What we already fixed locally

### 1. Missing binaries
Installed the missing runtime pieces:
- `bun`
- `bunx`
- `oh-my-opencode`
- `opencode`

### 2. Local wrapper bug with explicit agent args
When we first forced explicit `-a ...` selection, we accidentally replaced the full arg list and dropped the final prompt/message.

That produced this failure:
- `error: missing required argument 'message'`

This was a **real local wrapper bug** and has been fixed.

Evidence:
- `/home/molt/clawd/.tmp/openclaw-fabric-live-validation-explicit-2026-04-15-014756/validation/live-omo/2026-04-15T06-47-56-439Z/live-omo-validation.invocation.json`

## Exact failing commands

The validator records exact invocations in `live-omo-validation.invocation.json`.

### A. Failing default-selection invocation
Recorded at:
- `/home/molt/clawd/.tmp/openclaw-fabric-live-validation-2026-04-14-212138/validation/live-omo/2026-04-15T02-21-39-100Z/live-omo-validation.invocation.json`

Equivalent command shape:
```bash
bunx oh-my-opencode run --json --directory <sandbox> "<OpenClaw bounded-worker prompt>"
```

Observed failure:
```text
[session.error] Agent not found: "Sisyphus - Ultraworker". Available agents: Sisyphus - Ultraworker, Metis - Plan Consultant, Momus - Plan Critic, Sisyphus-Junior, explore, general, librarian, multimodal-looker, ... Hephaestus - Deep Agent, Prometheus - Plan Builder, Atlas - Plan Executor
```

### B. Failing explicit lowercase key
Recorded at:
- `/home/molt/clawd/.tmp/openclaw-fabric-live-validation-explicit-2026-04-15-015351/validation/live-omo/2026-04-15T06-53-51-841Z/live-omo-validation.invocation.json`

Exact arg shape:
```bash
bunx oh-my-opencode run --json -a sisyphus --directory <sandbox> "<OpenClaw bounded-worker prompt>"
```

Observed failure:
```text
[session.error] Agent not found: "Sisyphus - Ultraworker". Available agents: Sisyphus - Ultraworker, ... Hephaestus - Deep Agent, Prometheus - Plan Builder, Atlas - Plan Executor
```

### C. Failing explicit display name
Recorded at:
- `/home/molt/clawd/.tmp/openclaw-fabric-live-validation-display-2026-04-15-040933/validation/live-omo/2026-04-15T09-09-33-269Z/live-omo-validation.invocation.json`

Exact arg shape:
```bash
bunx oh-my-opencode run --json -a Sisyphus --directory <sandbox> "<OpenClaw bounded-worker prompt>"
```

Observed failure:
```text
[session.error] Agent not found: "Sisyphus - Ultraworker". Available agents: Sisyphus - Ultraworker, ... Hephaestus - Deep Agent, Prometheus - Plan Builder, Atlas - Plan Executor
```

### D. Failing explicit full display name
Recorded at:
- `/home/molt/clawd/.tmp/openclaw-fabric-live-validation-explicit-name-2026-04-15-015451/validation/live-omo/2026-04-15T06-54-51-664Z/live-omo-validation.invocation.json`

Exact arg shape:
```bash
bunx oh-my-opencode run --json -a "Sisyphus - Ultraworker" --directory <sandbox> "<OpenClaw bounded-worker prompt>"
```

Observed failure:
```text
[session.error] Agent not found: "Sisyphus - Ultraworker". Available agents: Sisyphus - Ultraworker, ... Hephaestus - Deep Agent, Prometheus - Plan Builder, Atlas - Plan Executor
```

### E. Failing explicit hidden-char-prefixed display name
Recorded at:
- `/home/molt/clawd/.tmp/openclaw-fabric-live-validation-zwsp-2026-04-15-041307/validation/live-omo/2026-04-15T09-13-07-428Z/live-omo-validation.invocation.json`

Exact arg shape:
```bash
bunx oh-my-opencode run --json -a $'\u200bSisyphus - Ultraworker' --directory <sandbox> "<OpenClaw bounded-worker prompt>"
```

Observed failure:
```text
[session.error] Agent not found: "Sisyphus - Ultraworker". Available agents: Sisyphus - Ultraworker, ... Hephaestus - Deep Agent, Prometheus - Plan Builder, Atlas - Plan Executor
```

## Important correction

Earlier exploration briefly suggested the hidden-zero-width variant might get farther.

After re-checking the recorded validator evidence, we do **not** currently have a confirmed successful live-validation command for this path.

The best verified statement is:
- multiple agent selector variants all fail in the recorded live validator with the **same** contradiction:
  - `Agent not found: "Sisyphus - Ultraworker"`
  - while `Sisyphus - Ultraworker` is listed as available

## Why this currently looks upstream of our wrapper

The wrapper is now passing:
- the prompt/message
- the sandbox directory
- explicit `-a ...` agent selectors

The failure still occurs at **agent resolution time** inside the OMO / plugin runtime.

That makes the current blocker look like one of these:
1. agent selector normalization bug
2. display-name vs internal-name mismatch inside OMO / plugin runtime
3. hidden / decorated agent-name mismatch in available-agent registration vs lookup

## Why Sable probably is not the blocker right now

Current failures happen before meaningful model/provider execution.

Signals:
- the error is about **agent lookup**, not provider auth or model routing
- the process already starts an OMO session/server, then dies on agent resolution
- changing only the agent selector changes the observed behavior, while provider routing stays constant

So:
- **Sable may matter later**, once an agent is actually selected and work begins
- **Sable does not look like the cause of the current `Agent not found` failure**

## About the model-metadata suggestion from another Ultraworkers user

Suggestion received: explicit model capability metadata in opencode config, for example a `claude-opus-4-6` entry with fields like:
- `id`
- `name`
- `family`
- `attachment`
- `reasoning`
- `temperature`
- `tool_call`
- `limit.context`
- `limit.output`
- `modalities`

Assessment:
- this is **plausibly relevant later** for model compatibility / capability detection
- it does **not** currently look like the first blocker, because our current failure is still at **agent resolution**, before the run gets far enough to meaningfully test provider/model execution

## Current best read

We did have some local mistakes earlier:
- wrong default selector names in config (`sisyphus` vs `Sisyphus`)
- one wrapper bug that dropped the message when explicit args were injected

Those are now corrected.

The remaining failure still looks **upstream of the wrapper contract**, specifically in OMO / oh-my-openagent agent resolution.

## Best next moves

### Option 1: upstream repro issue (recommended)
Open an upstream repro with:
- current config shape
- the exact failing commands above
- the contradiction between `Agent not found` and the listed available agent name

### Option 2: raw opencode-agent workaround
Try validating the wrapper against raw opencode agents such as:
- `general`
- `plan`
- `build`

That would let the OpenClaw wrapper lane keep moving while the named-agent issue is diagnosed upstream.

### Option 3: test model metadata after agent lookup is solved
If agent resolution is fixed but model execution still fails, then the user suggestion about full model metadata is a strong next experiment.

## Durable files worth checking

Project note:
- `projects/openclaw-fabric/validation/live-omo/agent-selection-handoff-2026-04-15.md`

Representative evidence:
- `/home/molt/clawd/.tmp/openclaw-fabric-live-validation-2026-04-14-212138/validation/live-omo/2026-04-15T02-21-39-100Z/live-omo-validation.invocation.json`
- `/home/molt/clawd/.tmp/openclaw-fabric-live-validation-explicit-2026-04-15-015351/validation/live-omo/2026-04-15T06-53-51-841Z/live-omo-validation.invocation.json`
- `/home/molt/clawd/.tmp/openclaw-fabric-live-validation-display-2026-04-15-040933/validation/live-omo/2026-04-15T09-09-33-269Z/live-omo-validation.invocation.json`
- `/home/molt/clawd/.tmp/openclaw-fabric-live-validation-explicit-name-2026-04-15-015451/validation/live-omo/2026-04-15T06-54-51-664Z/live-omo-validation.invocation.json`
- `/home/molt/clawd/.tmp/openclaw-fabric-live-validation-zwsp-2026-04-15-041307/validation/live-omo/2026-04-15T09-13-07-428Z/live-omo-validation.invocation.json`
- wrapper bug evidence: `/home/molt/clawd/.tmp/openclaw-fabric-live-validation-explicit-2026-04-15-014756/validation/live-omo/2026-04-15T06-47-56-439Z/live-omo-validation.invocation.json`
