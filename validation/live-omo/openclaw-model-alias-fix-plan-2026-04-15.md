# Local fix plan — OpenClaw model alias / provider error

## Problem
Raw interactive `opencode` can select core agents, but prompt execution fails with:

```text
Invalid `model`. Use `openclaw` or `openclaw/<agentId>`.
```

This happened even after switching the OMO config to a GPT-5.4-only profile, so the failure is not specific to `sable-opus-46`.

## Current local provider config
From `~/.config/opencode/opencode.json`:
- provider id: `openclaw`
- plugin provider implementation: `@ai-sdk/openai-compatible`
- configured model aliases:
  - `openclaw/sable-opus-46`
  - `openclaw/codex-gpt-54`

## Best current read
OpenCode is likely validating model ids for this provider more strictly than expected and wants either:
- bare provider id: `openclaw`, or
- provider-native model ids in the form `openclaw/<agentId>`

That would explain why both:
- `openclaw/sable-opus-46`
- `openclaw/codex-gpt-54`

still fail with the same model validation error.

## New evidence from local investigation

### Model metadata patch did not help
We tested richer `provider.models` entries in `~/.config/opencode/opencode.json` with explicit fields like:
- `id`
- `name`
- `family`
- `attachment`
- `reasoning`
- `temperature`
- `tool_call`
- `limit`
- `modalities`

Result:
- interactive `opencode` still failed with the same runtime error
- `oh-my-opencode run` still failed the same way too

So the random-user metadata fix does **not** solve this local setup.

### OpenCode advertises accepted `openclaw` model ids
Direct local command:
```bash
opencode models openclaw
```
reported:
- `openclaw/codex-gpt-54`
- `openclaw/sable-opus-46`

### Exact accepted strings still fail at runtime
We explicitly passed those exact strings through `oh-my-opencode run`:

```bash
oh-my-opencode run --json --port 43150 --agent general --model openclaw/codex-gpt-54 --directory <sandbox> "Reply with exactly OK and nothing else."
oh-my-opencode run --json --port 43151 --agent plan --model openclaw/sable-opus-46 --directory <sandbox> "Reply with exactly OK and nothing else."
```

Observed in both cases:
```text
[session.error] Invalid `model`. Use `openclaw` or `openclaw/<agentId>`.
```

This is important because it means the issue is **not** simply "we used the wrong model string". OpenCode is listing model ids that its runtime path still rejects.

## Recommended next steps

### 1. Inspect provider model validation in local OpenCode source/binary
Find the exact code path that validates custom provider model ids for `@ai-sdk/openai-compatible` providers.

Updated questions to answer:
- Why does `opencode models openclaw` list ids that `prompt` / `run` still reject?
- Is the runtime validating against a different registry than `opencode models` uses?
- Does runtime expect a provider-native upstream id instead of the listed alias id?

### 2. Test raw OpenCode prompt path with explicit model ids
Use raw OpenCode, not just OMO, to test whether:
- `openclaw/codex-gpt-54`
- `openclaw/sable-opus-46`

fail in the same way when passed directly into the OpenCode prompt/session path.

### 3. Treat this as a likely OpenCode runtime/model-validation mismatch until disproven
Current evidence now supports a stronger claim:
- model listing path says these ids are valid
- runtime execution path rejects those same ids

So this may be a runtime validation mismatch, not merely a local alias typo.

## Separation from the agent bug
This model-id problem is separate from the `oh-my-opencode run` core-agent mismatch.

Evidence:
- interactive `opencode` gets past agent selection and then fails on model validation
- `oh-my-opencode run` fails earlier, at core-agent lookup

So both issues need to be tracked independently.
