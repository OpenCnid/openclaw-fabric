import test from "node:test"
import assert from "node:assert/strict"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"

import { renderOmoTaskPrompt, runOmoTask } from "../sketches/openclaw-omo-wrapper.ts"

const STUB_SOURCE = `#!/usr/bin/env node
import { promises as fs } from "node:fs"
import path from "node:path"

const argsFile = process.env.OPENCLAW_STUB_ARGS_FILE
const mode = process.env.OPENCLAW_STUB_MODE ?? "valid"
const status = process.env.OPENCLAW_STUB_STATUS ?? "succeeded"
const handoffFile = process.env.OPENCLAW_WORKER_HANDOFF_FILE
const resultFile = process.env.OPENCLAW_WORKER_RESULT_FILE
const handoffDirReady = handoffFile ? await pathExists(path.dirname(handoffFile)) : false
const resultDirReady = resultFile ? await pathExists(path.dirname(resultFile)) : false
if (argsFile) {
  await fs.mkdir(path.dirname(argsFile), { recursive: true })
  await fs.appendFile(argsFile, JSON.stringify({
    args: process.argv.slice(2),
    cwd: process.cwd(),
    taskFile: process.env.OPENCLAW_WORKER_TASK_FILE,
    promptFile: process.env.OPENCLAW_WORKER_PROMPT_FILE,
    taskId: process.env.OPENCLAW_WORKER_TASK_ID,
    handoffFile: process.env.OPENCLAW_WORKER_HANDOFF_FILE,
    resultFile: process.env.OPENCLAW_WORKER_RESULT_FILE,
    stopCondition: process.env.OPENCLAW_WORKER_STOP_CONDITION,
    resumeFrom: process.env.OPENCLAW_WORKER_RESUME_FROM,
    envNames: Object.keys(process.env).filter((key) => key.startsWith("OPENCLAW_WORKER_")).sort(),
    handoffDirReady,
    resultDirReady,
    stubSessionId: process.env.OPENCLAW_STUB_SESSION_ID
  }) + "\\n", "utf8")
}

if (mode === "assert-artifact-dirs" && (!handoffDirReady || !resultDirReady)) {
  console.error("artifact parent directories were not ready before worker launch")
  process.exit(2)
}

if (handoffFile && mode !== "missing-handoff") {
  await fs.mkdir(path.dirname(handoffFile), { recursive: true })
  await fs.writeFile(handoffFile, "# Fixture handoff\\n\\nThe bounded worker wrote a handoff.\\n", "utf8")
}

if (mode === "missing-result") {
  if (process.env.OPENCLAW_STUB_SESSION_ID) {
    console.log(JSON.stringify({ sessionId: process.env.OPENCLAW_STUB_SESSION_ID }))
  }
  process.exit(0)
}

if (mode === "malformed-result") {
  await fs.mkdir(path.dirname(resultFile), { recursive: true })
  await fs.writeFile(resultFile, "{not valid json", "utf8")
  process.exit(0)
}

const result = {
  taskId: process.env.OPENCLAW_WORKER_TASK_ID,
  status,
  summary: status + " fixture summary",
  artifacts: {
    handoff: handoffFile,
    result: resultFile
  },
  resumeFrom: process.env.OPENCLAW_WORKER_RESUME_FROM || handoffFile,
  errors: status === "failed" ? ["fixture failure"] : [],
  verification: ["fixture verification"]
}

if (mode === "extra-result-property") {
  result.unexpected = true
}

if (mode === "invalid-next-step") {
  result.nextStep = 42
}

if (mode === "invalid-resume-from") {
  result.resumeFrom = 42
}

if (mode === "invalid-errors") {
  result.errors = [42]
}

if (mode === "invalid-verification") {
  result.verification = [42]
}

await fs.mkdir(path.dirname(resultFile), { recursive: true })
await fs.writeFile(resultFile, JSON.stringify(result, null, 2) + "\\n", "utf8")

if (process.env.OPENCLAW_STUB_SESSION_ID) {
  console.log(JSON.stringify({ sessionId: process.env.OPENCLAW_STUB_SESSION_ID }))
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}
`

test("rendered prompt matches the bounded worker contract snapshot", () => {
  const task = baseTask("/tmp/openclaw-contract-prompt")
  const prompt = renderOmoTaskPrompt(task)

  assert.equal(prompt, `You are executing one bounded worker task for OpenClaw.
Do not decide follow-up workflow. Only complete the assigned task and write the declared artifacts.

Task ID: fixture-task
Working directory: /tmp/openclaw-contract-prompt

Goal:
Exercise the bounded worker wrapper contract.

Inputs:
- inputs/source.txt

Required artifacts:
- Human handoff markdown: artifacts/handoff.md
- Machine result json: artifacts/result.json

Stop condition:
Write both declared artifacts

Verification expectations:
- fixture verification

Status rules:
- succeeded: stop condition met and required artifacts written
- blocked: missing input, credential, clarification, or dependency
- failed: crash, contract violation, or verification failure

Result JSON contract:
{
  "taskId": "fixture-task",
  "status": "succeeded | blocked | failed",
  "summary": "short plain summary",
  "artifacts": {
    "handoff": "artifacts/handoff.md",
    "result": "artifacts/result.json"
  },
  "nextStep": "optional",
  "resumeFrom": "artifacts/handoff.md",
  "errors": [],
  "verification": [
    "fixture verification"
  ]
}

Handoff markdown must include:
- what you were asked to do
- what you actually did
- what remains unresolved
- smallest next step
- verification performed

If you cannot proceed, still write both artifacts and set status to blocked or failed.`)
})

test("artifact bootstrap writes prompt, creates artifact dirs, and exports exact worker env names", async (t) => {
  const fixture = await createFixture(t, "artifact-bootstrap")
  const task = await writeBaseInput(fixture.cwd, {
    taskId: "artifact-bootstrap",
    writeArtifacts: {
      handoff: "nested/handoff/output.md",
      result: "nested/result/output.json",
    },
  })

  await runOmoTask(task, {
    command: fixture.stubCommand,
    env: {
      OPENCLAW_STUB_ARGS_FILE: fixture.argsFile,
      OPENCLAW_STUB_MODE: "assert-artifact-dirs",
    },
  })

  const captured = await readLastArgs(fixture.argsFile)
  const promptFile = path.join(fixture.cwd, ".openclaw-fabric", "tasks", "artifact-bootstrap.prompt.md")
  const stagedPrompt = await fs.readFile(promptFile, "utf8")

  assert.equal(stagedPrompt, renderOmoTaskPrompt({
    ...task,
    cwd: fixture.cwd,
    inputs: [path.join(fixture.cwd, "inputs", "source.txt")],
    writeArtifacts: {
      handoff: path.join(fixture.cwd, task.writeArtifacts.handoff),
      result: path.join(fixture.cwd, task.writeArtifacts.result),
    },
  }))
  assert.equal(captured.promptFile, promptFile)
  assert.equal(captured.handoffDirReady, true)
  assert.equal(captured.resultDirReady, true)
  assert.deepEqual(captured.envNames, [
    "OPENCLAW_WORKER_HANDOFF_FILE",
    "OPENCLAW_WORKER_PROMPT_FILE",
    "OPENCLAW_WORKER_RESULT_FILE",
    "OPENCLAW_WORKER_RESUME_FROM",
    "OPENCLAW_WORKER_STOP_CONDITION",
    "OPENCLAW_WORKER_TASK_FILE",
    "OPENCLAW_WORKER_TASK_ID",
  ])
})

test("valid worker results preserve succeeded, blocked, and failed statuses", async (t) => {
  for (const status of ["succeeded", "blocked", "failed"]) {
    await t.test(status, async () => {
      const fixture = await createFixture(t, `status-${status}`)
      const task = await writeBaseInput(fixture.cwd, {
        taskId: `task-${status}`,
        writeArtifacts: {
          handoff: `artifacts/${status}.handoff.md`,
          result: `artifacts/${status}.result.json`,
        },
      })

      const result = await runOmoTask(task, {
        command: fixture.stubCommand,
        env: {
          OPENCLAW_STUB_ARGS_FILE: fixture.argsFile,
          OPENCLAW_STUB_STATUS: status,
        },
      })

      assert.equal(result.status, status)
      assert.equal(result.taskId, task.taskId)
      assert.equal(result.artifacts.handoff, path.join(fixture.cwd, task.writeArtifacts.handoff))
      assert.equal(result.artifacts.result, path.join(fixture.cwd, task.writeArtifacts.result))

      const stagedTask = JSON.parse(
        await fs.readFile(path.join(fixture.cwd, ".openclaw-fabric", "tasks", `${task.taskId}.task.json`), "utf8"),
      )
      assert.equal(stagedTask.cwd, fixture.cwd)
      assert.deepEqual(stagedTask.inputs, [path.join(fixture.cwd, "inputs", "source.txt")])
      assert.equal(stagedTask.writeArtifacts.handoff, path.join(fixture.cwd, task.writeArtifacts.handoff))
      assert.equal(stagedTask.writeArtifacts.result, path.join(fixture.cwd, task.writeArtifacts.result))
    })
  }
})

test("missing result artifact writes a fallback failed result", async (t) => {
  const fixture = await createFixture(t, "missing-result")
  const task = await writeBaseInput(fixture.cwd, { taskId: "missing-result" })

  const result = await runOmoTask(task, {
    command: fixture.stubCommand,
    env: {
      OPENCLAW_STUB_ARGS_FILE: fixture.argsFile,
      OPENCLAW_STUB_MODE: "missing-result",
    },
  })

  assert.equal(result.status, "failed")
  assert.equal(result.summary, "OMO finished without writing the required result artifact.")

  const persisted = JSON.parse(
    await fs.readFile(path.join(fixture.cwd, task.writeArtifacts.result), "utf8"),
  )
  assert.equal(persisted.status, "failed")
  assert.equal(persisted.taskId, task.taskId)
})

test("malformed result artifact writes a fallback failed result", async (t) => {
  const fixture = await createFixture(t, "malformed-result")
  const task = await writeBaseInput(fixture.cwd, { taskId: "malformed-result" })

  const result = await runOmoTask(task, {
    command: fixture.stubCommand,
    env: {
      OPENCLAW_STUB_ARGS_FILE: fixture.argsFile,
      OPENCLAW_STUB_MODE: "malformed-result",
    },
  })

  assert.equal(result.status, "failed")
  assert.equal(result.summary, "OMO finished without writing the required result artifact.")

  const persisted = JSON.parse(
    await fs.readFile(path.join(fixture.cwd, task.writeArtifacts.result), "utf8"),
  )
  assert.equal(persisted.status, "failed")
})

test("missing handoff artifact writes a fallback failed result with validation detail", async (t) => {
  const fixture = await createFixture(t, "missing-handoff")
  const task = await writeBaseInput(fixture.cwd, { taskId: "missing-handoff" })

  const result = await runOmoTask(task, {
    command: fixture.stubCommand,
    env: {
      OPENCLAW_STUB_ARGS_FILE: fixture.argsFile,
      OPENCLAW_STUB_MODE: "missing-handoff",
    },
  })

  assert.equal(result.status, "failed")
  assert.match(result.errors.join("\n"), /declared handoff artifact is missing:/)
  await assert.rejects(fs.access(path.join(fixture.cwd, task.writeArtifacts.handoff)))

  const persisted = JSON.parse(
    await fs.readFile(path.join(fixture.cwd, task.writeArtifacts.result), "utf8"),
  )
  assert.equal(persisted.status, "failed")
  assert.match(persisted.errors.join("\n"), /declared handoff artifact is missing:/)
})

test("invalid optional result fields write fallback failed results with validation detail", async (t) => {
  const cases = [
    {
      mode: "invalid-next-step",
      error: /result.nextStep must be a string/,
    },
    {
      mode: "invalid-resume-from",
      error: /result.resumeFrom must be a string/,
    },
    {
      mode: "invalid-errors",
      error: /result.errors\[0\] must be a string/,
    },
    {
      mode: "invalid-verification",
      error: /result.verification\[0\] must be a string/,
    },
  ]

  for (const { mode, error } of cases) {
    await t.test(mode, async () => {
      const fixture = await createFixture(t, mode)
      const task = await writeBaseInput(fixture.cwd, { taskId: mode })

      const result = await runOmoTask(task, {
        command: fixture.stubCommand,
        env: {
          OPENCLAW_STUB_ARGS_FILE: fixture.argsFile,
          OPENCLAW_STUB_MODE: mode,
        },
      })

      assert.equal(result.status, "failed")
      assert.match(result.errors.join("\n"), error)
    })
  }
})

test("session map miss and hit shape OMO command arguments", async (t) => {
  const fixture = await createFixture(t, "session-map")
  const task = await writeBaseInput(fixture.cwd, { taskId: "resume-task" })

  await runOmoTask(task, {
    command: fixture.stubCommand,
    env: {
      OPENCLAW_STUB_ARGS_FILE: fixture.argsFile,
    },
  })

  const firstRunArgs = await readLastArgs(fixture.argsFile)
  const firstInvocation = await readInvocation(fixture.cwd, "resume-task")
  assert.equal(firstRunArgs.cwd, fixture.cwd)
  assert.deepEqual(firstRunArgs.args.slice(0, 4), ["oh-my-opencode", "run", "--json", "--directory"])
  assert.equal(firstRunArgs.args[4], fixture.cwd)
  assert.match(firstRunArgs.args.at(-1), /You are executing one bounded worker task for OpenClaw/)
  assert.equal(firstRunArgs.taskFile, path.join(fixture.cwd, ".openclaw-fabric", "tasks", "resume-task.task.json"))
  assert.equal(firstRunArgs.promptFile, path.join(fixture.cwd, ".openclaw-fabric", "tasks", "resume-task.prompt.md"))
  assert.equal(firstRunArgs.taskId, task.taskId)
  assert.equal(firstRunArgs.handoffFile, path.join(fixture.cwd, task.writeArtifacts.handoff))
  assert.equal(firstRunArgs.resultFile, path.join(fixture.cwd, task.writeArtifacts.result))
  assert.equal(firstRunArgs.stopCondition, task.stopCondition)
  assert.equal(firstRunArgs.resumeFrom, "")
  assert.ok(!firstRunArgs.args.includes("--session-id"))
  assert.equal(firstInvocation.phase, "completed")
  assert.equal(firstInvocation.cwd, fixture.cwd)
  assert.equal(firstInvocation.command, fixture.stubCommand)
  assert.deepEqual(firstInvocation.args, firstRunArgs.args)
  assert.equal(firstInvocation.taskFile, firstRunArgs.taskFile)
  assert.equal(firstInvocation.promptFile, firstRunArgs.promptFile)
  assert.equal(firstInvocation.sessionMap, path.join(fixture.cwd, ".openclaw-fabric", "omo-session-map.json"))
  assert.equal(firstInvocation.resumeSessionId, null)
  assert.equal(firstInvocation.timeoutMs, null)
  assert.equal(firstInvocation.exitCode, 0)
  assert.equal(firstInvocation.stderr, "")
  assert.deepEqual(firstInvocation.workerEnvNames, [
    "OPENCLAW_WORKER_HANDOFF_FILE",
    "OPENCLAW_WORKER_PROMPT_FILE",
    "OPENCLAW_WORKER_RESULT_FILE",
    "OPENCLAW_WORKER_RESUME_FROM",
    "OPENCLAW_WORKER_STOP_CONDITION",
    "OPENCLAW_WORKER_TASK_FILE",
    "OPENCLAW_WORKER_TASK_ID",
  ])

  await fs.mkdir(path.join(fixture.cwd, ".openclaw-fabric"), { recursive: true })
  await fs.writeFile(
    path.join(fixture.cwd, ".openclaw-fabric", "omo-session-map.json"),
    JSON.stringify({
      "resume-task": {
        omoSessionId: "existing-session",
        updatedAt: "2026-04-14T00:00:00.000Z",
      },
    }, null, 2) + "\n",
    "utf8",
  )

  await runOmoTask(task, {
    command: fixture.stubCommand,
    env: {
      OPENCLAW_STUB_ARGS_FILE: fixture.argsFile,
      OPENCLAW_STUB_SESSION_ID: "session-after-second-run",
    },
  })

  const secondRunArgs = await readLastArgs(fixture.argsFile)
  const secondInvocation = await readInvocation(fixture.cwd, "resume-task")
  assert.deepEqual(
    secondRunArgs.args.slice(secondRunArgs.args.indexOf("--session-id"), secondRunArgs.args.indexOf("--session-id") + 2),
    ["--session-id", "existing-session"],
  )
  assert.equal(secondInvocation.resumeSessionId, "existing-session")
  assert.deepEqual(secondInvocation.args, secondRunArgs.args)

  const sessionMap = JSON.parse(
    await fs.readFile(path.join(fixture.cwd, ".openclaw-fabric", "omo-session-map.json"), "utf8"),
  )
  assert.equal(sessionMap["resume-task"].omoSessionId, "session-after-second-run")
  assert.equal(typeof sessionMap["resume-task"].updatedAt, "string")
})

test("extraArgs insert an explicit agent without dropping the prompt", async (t) => {
  const fixture = await createFixture(t, "explicit-agent")
  const task = await writeBaseInput(fixture.cwd, { taskId: "explicit-agent" })

  await runOmoTask(task, {
    command: fixture.stubCommand,
    extraArgs: ["-a", "sisyphus"],
    env: {
      OPENCLAW_STUB_ARGS_FILE: fixture.argsFile,
    },
  })

  const invocation = await readLastArgs(fixture.argsFile)
  assert.deepEqual(invocation.args.slice(0, 6), ["oh-my-opencode", "run", "--json", "-a", "sisyphus", "--directory"])
  assert.equal(invocation.args[6], fixture.cwd)
  assert.match(invocation.args.at(-1), /You are executing one bounded worker task for OpenClaw/)
})

test("stdout session discovery updates the session map", async (t) => {
  const fixture = await createFixture(t, "session-discovery")
  const task = await writeBaseInput(fixture.cwd, { taskId: "session-discovery" })

  const shellStub = [
    'mkdir -p "$(dirname "$OPENCLAW_WORKER_HANDOFF_FILE")" "$(dirname "$OPENCLAW_WORKER_RESULT_FILE")"',
    'printf "# Fixture handoff\\n" > "$OPENCLAW_WORKER_HANDOFF_FILE"',
    'printf \'{"taskId":"%s","status":"succeeded","summary":"session fixture summary","artifacts":{"handoff":"%s","result":"%s"}}\\n\' "$OPENCLAW_WORKER_TASK_ID" "$OPENCLAW_WORKER_HANDOFF_FILE" "$OPENCLAW_WORKER_RESULT_FILE" > "$OPENCLAW_WORKER_RESULT_FILE"',
    'printf \'{"sessionId":"session-after-run"}\\n\'',
  ].join("; ")

  await runOmoTask(task, {
    command: "sh",
    args: ["-c", shellStub],
  })

  const sessionMap = JSON.parse(
    await fs.readFile(path.join(fixture.cwd, ".openclaw-fabric", "omo-session-map.json"), "utf8"),
  )
  assert.equal(sessionMap["session-discovery"].omoSessionId, "session-after-run")
  assert.equal(typeof sessionMap["session-discovery"].updatedAt, "string")
})

test("timeout returns a failed result and records failed invocation metadata", async (t) => {
  const fixture = await createFixture(t, "timeout")
  const task = await writeBaseInput(fixture.cwd, { taskId: "timeout-task" })

  const result = await runOmoTask(task, {
    command: process.execPath,
    args: ["-e", "setTimeout(() => {}, 1000)"],
    timeoutMs: 50,
  })

  assert.equal(result.status, "failed")
  assert.equal(result.summary, "OMO wrapper failed before a valid worker result was written.")
  assert.match(result.errors.join("\n"), /OMO command timed out after 50ms/)

  const invocation = await readInvocation(fixture.cwd, "timeout-task")
  assert.equal(invocation.phase, "failed")
  assert.equal(invocation.command, process.execPath)
  assert.deepEqual(invocation.args, ["-e", "setTimeout(() => {}, 1000)"])
  assert.equal(invocation.timeoutMs, 50)
  assert.match(invocation.error, /OMO command timed out after 50ms/)

  const persisted = JSON.parse(
    await fs.readFile(path.join(fixture.cwd, task.writeArtifacts.result), "utf8"),
  )
  assert.equal(persisted.status, "failed")
  assert.match(persisted.errors.join("\n"), /OMO command timed out after 50ms/)
})

test("artifact paths outside cwd are rejected before launch", async (t) => {
  const fixture = await createFixture(t, "artifact-escape")
  const task = await writeBaseInput(fixture.cwd, {
    taskId: "artifact-escape",
    writeArtifacts: {
      handoff: "../outside.handoff.md",
      result: "artifacts/result.json",
    },
  })

  await assert.rejects(
    () => runOmoTask(task, {
      command: fixture.stubCommand,
      env: {
        OPENCLAW_STUB_ARGS_FILE: fixture.argsFile,
      },
    }),
    /task.writeArtifacts.handoff must resolve inside task.cwd/,
  )

  await assert.rejects(fs.access(fixture.argsFile))
})

test("task validation rejects missing required fields and invalid schema types before launch", async (t) => {
  const fixture = await createFixture(t, "invalid-task-shape")

  const missingInputs = baseTask(fixture.cwd, { taskId: "missing-inputs" })
  delete missingInputs.inputs

  const cases = [
    {
      name: "missing inputs",
      task: missingInputs,
      error: /task.inputs must be an array/,
    },
    {
      name: "empty taskId",
      task: baseTask(fixture.cwd, { taskId: "" }),
      error: /task.taskId must not be empty/,
    },
    {
      name: "empty input item",
      task: baseTask(fixture.cwd, { taskId: "empty-input", inputs: [""] }),
      error: /task.inputs\[0\] must not be empty/,
    },
    {
      name: "invalid writeArtifacts",
      task: baseTask(fixture.cwd, { taskId: "invalid-artifacts", writeArtifacts: null }),
      error: /task.writeArtifacts must be an object/,
    },
    {
      name: "invalid verify item",
      task: baseTask(fixture.cwd, { taskId: "invalid-verify", verify: [""] }),
      error: /task.verify\[0\] must not be empty/,
    },
    {
      name: "invalid metadata",
      task: baseTask(fixture.cwd, { taskId: "invalid-metadata", metadata: [] }),
      error: /task.metadata must be an object/,
    },
  ]

  for (const { name, task, error } of cases) {
    await t.test(name, async () => {
      await assert.rejects(
        () => runOmoTask(task, {
          command: fixture.stubCommand,
          env: {
            OPENCLAW_STUB_ARGS_FILE: fixture.argsFile,
          },
        }),
        error,
      )
    })
  }

  await assert.rejects(fs.access(fixture.argsFile))
})

test("missing declared inputs are rejected before launch", async (t) => {
  const fixture = await createFixture(t, "missing-input")
  const task = baseTask(fixture.cwd, {
    taskId: "missing-input",
    inputs: ["inputs/missing.txt"],
  })

  await assert.rejects(
    () => runOmoTask(task, {
      command: fixture.stubCommand,
      env: {
        OPENCLAW_STUB_ARGS_FILE: fixture.argsFile,
      },
    }),
    /task.inputs entry does not exist:/,
  )

  await assert.rejects(fs.access(fixture.argsFile))
})

test("omitted verify defaults to an empty verification list in staged task and prompt", async (t) => {
  const fixture = await createFixture(t, "verify-default")
  const task = await writeBaseInput(fixture.cwd, {
    taskId: "verify-default",
    verify: undefined,
  })

  await runOmoTask(task, {
    command: fixture.stubCommand,
    env: {
      OPENCLAW_STUB_ARGS_FILE: fixture.argsFile,
    },
  })

  const taskFile = path.join(fixture.cwd, ".openclaw-fabric", "tasks", "verify-default.task.json")
  const promptFile = path.join(fixture.cwd, ".openclaw-fabric", "tasks", "verify-default.prompt.md")
  const stagedTask = JSON.parse(await fs.readFile(taskFile, "utf8"))
  const prompt = await fs.readFile(promptFile, "utf8")

  assert.deepEqual(stagedTask.verify, [])
  assert.match(prompt, /Verification expectations:\n- \(none\)/)
})

test("task and result validation reject additional properties", async (t) => {
  const fixture = await createFixture(t, "additional-properties")
  const task = await writeBaseInput(fixture.cwd, { taskId: "additional-properties" })

  await assert.rejects(
    () => runOmoTask({ ...task, unexpected: true }, { command: fixture.stubCommand }),
    /task.unexpected is not allowed/,
  )

  const result = await runOmoTask(task, {
    command: fixture.stubCommand,
    env: {
      OPENCLAW_STUB_ARGS_FILE: fixture.argsFile,
      OPENCLAW_STUB_MODE: "extra-result-property",
    },
  })

  assert.equal(result.status, "failed")
  assert.match(result.errors.join("\n"), /result.unexpected is not allowed/)
})

async function createFixture(t, name) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), `openclaw-${name}-`))
  t.after(() => fs.rm(cwd, { recursive: true, force: true }))

  const stubCommand = path.join(cwd, "omo-stub.mjs")
  const argsFile = path.join(cwd, "omo-args.jsonl")
  await fs.writeFile(stubCommand, STUB_SOURCE, "utf8")
  await fs.chmod(stubCommand, 0o755)

  return { cwd, stubCommand, argsFile }
}

async function writeBaseInput(cwd, overrides = {}) {
  await fs.mkdir(path.join(cwd, "inputs"), { recursive: true })
  await fs.writeFile(path.join(cwd, "inputs", "source.txt"), "fixture input\n", "utf8")
  return baseTask(cwd, overrides)
}

function baseTask(cwd, overrides = {}) {
  return {
    taskId: "fixture-task",
    cwd,
    goal: "Exercise the bounded worker wrapper contract.",
    inputs: ["inputs/source.txt"],
    writeArtifacts: {
      handoff: "artifacts/handoff.md",
      result: "artifacts/result.json",
    },
    stopCondition: "Write both declared artifacts",
    verify: ["fixture verification"],
    ...overrides,
  }
}

async function readLastArgs(argsFile) {
  const lines = (await fs.readFile(argsFile, "utf8")).trim().split("\n")
  return JSON.parse(lines.at(-1))
}

async function readInvocation(cwd, taskId) {
  return JSON.parse(
    await fs.readFile(path.join(cwd, ".openclaw-fabric", "tasks", `${taskId}.invocation.json`), "utf8"),
  )
}
