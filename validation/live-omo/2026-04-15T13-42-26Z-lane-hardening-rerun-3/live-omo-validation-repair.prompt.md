You are executing one bounded worker task for OpenClaw.
Do not decide follow-up workflow. Only complete the assigned task and write the declared artifacts.

Task ID: live-omo-validation-repair
Working directory: /home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-084226-lane-hardened3

Goal:
Repair attempt for live-omo-validation.
Classification: empty_turn_or_noncompliant_completion.
Previous OMO session id: ses_26e9eeaffffeTWyQHOolx1gJGR.
The previous run completed without writing all required artifacts.
Do not summarize the missing work. Actually write the required artifacts now.
Transcript snippet from the prior session:
```text
session_id=ses_26e9eeaffffeTWyQHOolx1gJGR
exit_code=0
stdout:
data
{"role":"user","time":{"created":1776260552213},"tools":{"question":false},"agent":"​Sisyphus - Ultraworker","model":{"providerID":"openclawraw","modelID":"openclaw/sable-opus-46"},"summary":{"diffs":[]}}
{"parentID":"msg_d91611615001quDdl2y6RPuc6A","role":"assistant","mode":"​Sisyphus - Ultraworker","agent":"​Sisyphus - Ultraworker","path":{"cwd":"/home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-084226-lane-hardened3","root":"/home/molt/clawd"},"cost":0,"tokens":{"input":0,"output":0,"reasoning":0,"cache":{"write":0,"read":0}},"modelID":"openclaw/sable-opus-46","providerID":"openclawraw","time":{"created":1776260552281,"completed":1776260557396},"finish":"other"}
stderr:
<empty>
```

Original task goal:
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
  "taskId": "live-omo-validation-repair",
  "status": "succeeded | blocked | failed",
  "summary": "short plain summary",
  "artifacts": {
    "handoff": "/home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-084226-lane-hardened3/artifacts/live-handoff.md",
    "result": "/home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-084226-lane-hardened3/artifacts/live-result.json"
  },
  "nextStep": "optional",
  "resumeFrom": "/home/molt/clawd/.tmp/openclaw-fabric-live-sandbox-20260415-084226-lane-hardened3/ses_26e9eeaffffeTWyQHOolx1gJGR",
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

If you cannot proceed, still write both artifacts and set status to blocked or failed.