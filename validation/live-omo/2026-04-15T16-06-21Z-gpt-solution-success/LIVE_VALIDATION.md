# Live OMO Validation

This note is the durable F5 evidence record for one live validation attempt.

- Status: succeeded
- Started: 2026-04-15T16:06:21.157Z
- Completed: 2026-04-15T16:07:37.069Z
- Clean sandbox: /home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-110620-gpt-solution
- Evidence directory: /home/molt/clawd/projects/openclaw-fabric/validation/live-omo/2026-04-15T16-06-21Z-gpt-solution-success

## Command

```text
bunx oh-my-opencode run --json -a sisyphus --directory /home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-110620-gpt-solution 'You are executing one bounded worker task for OpenClaw.
Do not decide follow-up workflow. Only complete the assigned task and write the declared artifacts.

Task ID: live-omo-validation
Working directory: /home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-110620-gpt-solution

Goal:
Read inputs/source.txt. Write artifacts/live-handoff.md with what was done, what remains unresolved, and verification performed. Write artifacts/live-result.json matching the declared WorkerResult contract with status succeeded if both artifacts are written.

Inputs:
- /home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-110620-gpt-solution/inputs/source.txt

Required artifacts:
- Human handoff markdown: /home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-110620-gpt-solution/artifacts/live-handoff.md
- Machine result json: /home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-110620-gpt-solution/artifacts/live-result.json

Stop condition:
Both declared artifacts exist and the result JSON validates.

Verification expectations:
- handoff artifact exists
- result artifact conforms to worker-result.schema.json shape

Status rules:
- succeeded: stop condition met and required artifacts written
- blocked: missing input, credential, clarification, or dependency
- failed: crash, contract violation, or verification failure

Result JSON contract:
{
  "taskId": "live-omo-validation",
  "status": "succeeded | blocked | failed",
  "summary": "short plain summary",
  "artifacts": {
    "handoff": "/home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-110620-gpt-solution/artifacts/live-handoff.md",
    "result": "/home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-110620-gpt-solution/artifacts/live-result.json"
  },
  "nextStep": "optional",
  "resumeFrom": "/home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-110620-gpt-solution/artifacts/live-handoff.md",
  "errors": [],
  "verification": [
    "handoff artifact exists",
    "result artifact conforms to worker-result.schema.json shape"
  ]
}

Handoff markdown must include:
- what you were asked to do
- what you actually did
- what remains unresolved
- smallest next step
- verification performed

If you cannot proceed, still write both artifacts and set status to blocked or failed.'
```

Full argv is preserved in the invocation JSON when OMO launches.

## Produced Artifacts

- Handoff: /home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-110620-gpt-solution/artifacts/live-handoff.md (present)
- Result: /home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-110620-gpt-solution/artifacts/live-result.json (present)
- Copied task: /home/molt/clawd/projects/openclaw-fabric/validation/live-omo/2026-04-15T16-06-21Z-gpt-solution-success/live-omo-validation.task.json
- Copied prompt: /home/molt/clawd/projects/openclaw-fabric/validation/live-omo/2026-04-15T16-06-21Z-gpt-solution-success/live-omo-validation.prompt.md
- Copied invocation: /home/molt/clawd/projects/openclaw-fabric/validation/live-omo/2026-04-15T16-06-21Z-gpt-solution-success/live-omo-validation.invocation.json
- Copied handoff: /home/molt/clawd/projects/openclaw-fabric/validation/live-omo/2026-04-15T16-06-21Z-gpt-solution-success/live-handoff.md
- Copied result: /home/molt/clawd/projects/openclaw-fabric/validation/live-omo/2026-04-15T16-06-21Z-gpt-solution-success/live-result.json
- Copied session map: /home/molt/clawd/projects/openclaw-fabric/validation/live-omo/2026-04-15T16-06-21Z-gpt-solution-success/omo-session-map.json

## Observed Status Behavior

Wrapper returned succeeded. OMO wrote both declared artifacts and the worker result preserved succeeded status for the toy live task.

## Observed Resume Behavior

Session map content was observed in /home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-110620-gpt-solution/.openclaw-fabric/omo-session-map.json.
The invocation did not use an existing resume session.
A new session id was persisted for task `live-omo-validation`.

## CLI Match / Evidence

- Declared handoff artifact was produced.
- Declared result artifact was produced.
- Worker result status was succeeded as expected for the toy live task.
- Invocation stdout exposed a session id and success summary.
