# Draft upstream issue — `oh-my-opencode run` rejects listed core agents

## Summary
`oh-my-opencode run` reports core agents like `Sisyphus - Ultraworker` and `Hephaestus - Deep Agent` as **not found**, even while the same error message lists them as available.

In the same environment, raw interactive `opencode` can select those same core agents and get past agent selection. That suggests the bug is specific to the `oh-my-opencode run` path, not general agent registration.

## Environment
- `oh-my-opencode v3.17.2`
- `opencode 1.4.4` from CLI check
- interactive TUI showed `1.4.6`
- plugin enabled via `oh-my-openagent@latest`
- provider: custom `openclaw` via `@ai-sdk/openai-compatible`

## Repro
Project dir used for repro:
- `/home/molt/clawd/.tmp/omo-agent-discrim-KVZ2a8`

### Repro 1 — fresh `oh-my-opencode run`
```bash
oh-my-opencode run --json --port 43121 --directory /home/molt/clawd/.tmp/omo-agent-discrim-KVZ2a8 "Reply with exactly OK"
```

Observed:
```text
[session.error] Agent not found: "Sisyphus - Ultraworker". Available agents: Sisyphus - Ultraworker, ... Hephaestus - Deep Agent, Prometheus - Plan Builder, Atlas - Plan Executor
```

### Repro 2 — attach `oh-my-opencode run` to existing OpenCode server
```bash
oh-my-opencode run --json --attach http://127.0.0.1:43114 --agent Hephaestus --directory /home/molt/clawd/.tmp/omo-agent-discrim-KVZ2a8 "Reply with exactly OK and nothing else."
```

Observed:
```text
[session.error] Agent not found: "Hephaestus - Deep Agent". Available agents: Sisyphus - Ultraworker, ... Hephaestus - Deep Agent, Prometheus - Plan Builder, Atlas - Plan Executor
```

## Important discriminator
Using raw interactive `opencode` against the same directory/server state:
- default Sisyphus agent displayed correctly in the TUI
- Hephaestus could be selected via `Tab`
- sending a prompt did **not** fail on agent lookup
- instead it failed later on model validation

Observed interactive failure:
```text
Invalid `model`. Use `openclaw` or `openclaw/<agentId>`.
```

That means:
- the server/plugin can register and select the core agents
- the contradiction appears specifically when `oh-my-opencode run` invokes them

## Expected
If `oh-my-opencode run` lists `Sisyphus - Ultraworker` or `Hephaestus - Deep Agent` as available, passing `Sisyphus`, `Hephaestus`, or their display names should resolve to those agents instead of failing with `Agent not found`.

## Actual
`oh-my-opencode run` normalizes to the decorated core display name, then reports that same listed agent as not found.

## Working theory
There may be a mismatch in the `run` path between:
- agent enumeration/list display
- normalized runtime agent name passed into prompt/session invocation

This looks narrower than a general registration bug because interactive `opencode` gets past selection in the same environment.
