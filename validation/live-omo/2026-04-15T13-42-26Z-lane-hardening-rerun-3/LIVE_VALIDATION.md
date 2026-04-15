# Live OMO Validation

This note is the durable F5 evidence record for one live validation attempt.

- Status: failed
- Started: 2026-04-15T13:42:26.343Z
- Completed: 2026-04-15T13:42:58.998Z
- Clean sandbox: /home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-084226-lane-hardened3
- Evidence directory: /home/molt/clawd/projects/openclaw-fabric/validation/live-omo/2026-04-15T13-42-26Z-lane-hardening-rerun-3

## Command

```text
bunx oh-my-opencode run --json -a sisyphus --directory /home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-084226-lane-hardened3 'You are executing one bounded worker task for OpenClaw.
Do not decide follow-up workflow. Only complete the assigned task and write the declared artifacts.

Task ID: live-omo-validation
Working directory: /home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-084226-lane-hardened3

Goal:
Read inputs/source.txt. Write artifacts/live-handoff.md with what was done, what remains unresolved, and verification performed. Write artifacts/live-result.json matching the declared WorkerResult contract with status succeeded if both artifacts are written.

Inputs:
- /home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-084226-lane-hardened3/inputs/source.txt

Required artifacts:
- Human handoff markdown: /home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-084226-lane-hardened3/artifacts/live-handoff.md
- Machine result json: /home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-084226-lane-hardened3/artifacts/live-result.json

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
    "handoff": "/home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-084226-lane-hardened3/artifacts/live-handoff.md",
    "result": "/home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-084226-lane-hardened3/artifacts/live-result.json"
  },
  "nextStep": "optional",
  "resumeFrom": "/home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-084226-lane-hardened3/artifacts/live-handoff.md",
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

- Handoff: /home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-084226-lane-hardened3/artifacts/live-handoff.md (missing)
- Result: /home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-084226-lane-hardened3/artifacts/live-result.json (present)
- Copied task artifact: /home/molt/clawd/projects/openclaw-fabric/validation/live-omo/2026-04-15T13-42-26Z-lane-hardening-rerun-3/live-omo-validation-repair.invocation.json
- Copied task artifact: /home/molt/clawd/projects/openclaw-fabric/validation/live-omo/2026-04-15T13-42-26Z-lane-hardening-rerun-3/live-omo-validation-repair.prompt.md
- Copied task artifact: /home/molt/clawd/projects/openclaw-fabric/validation/live-omo/2026-04-15T13-42-26Z-lane-hardening-rerun-3/live-omo-validation-repair.task.json
- Copied task artifact: /home/molt/clawd/projects/openclaw-fabric/validation/live-omo/2026-04-15T13-42-26Z-lane-hardening-rerun-3/live-omo-validation.invocation.json
- Copied task artifact: /home/molt/clawd/projects/openclaw-fabric/validation/live-omo/2026-04-15T13-42-26Z-lane-hardening-rerun-3/live-omo-validation.prompt.md
- Copied task artifact: /home/molt/clawd/projects/openclaw-fabric/validation/live-omo/2026-04-15T13-42-26Z-lane-hardening-rerun-3/live-omo-validation.task.json
- Copied result: /home/molt/clawd/projects/openclaw-fabric/validation/live-omo/2026-04-15T13-42-26Z-lane-hardening-rerun-3/live-result.json
- Copied session map: /home/molt/clawd/projects/openclaw-fabric/validation/live-omo/2026-04-15T13-42-26Z-lane-hardening-rerun-3/omo-session-map.json

## Observed Status Behavior

Wrapper returned failed: OMO finished without writing the required result artifact.

## Observed Resume Behavior

Session map content was observed in /home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-084226-lane-hardened3/.openclaw-fabric/omo-session-map.json.
The invocation did not use an existing resume session.

## Repair / Fallback Attempt

- Classification: empty_turn_or_noncompliant_completion
- Initial session id: ses_26e9eeaffffeTWyQHOolx1gJGR
- Transcript snippet: live-omo-validation.transcript-snippet.txt
- Repair agent: general
- Repair model: openclawraw/openclaw/codex-gpt-54
- Missing artifacts before repair: handoff
- Repair session id: ses_26e9eac19ffedy4uR9UGbPF3BC
- Repair transcript snippet: live-omo-validation-repair.transcript-snippet.txt
- Missing artifacts after repair: handoff
- Repair outcome: artifacts still missing

## CLI Mismatch Or Blocker

- Declared handoff artifact was not produced.
- Worker result status was failed; expected succeeded for the toy live task.

