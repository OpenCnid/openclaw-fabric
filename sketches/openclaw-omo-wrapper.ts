import { promises as fs } from "node:fs"
import path from "node:path"
import { spawn } from "node:child_process"

export type WorkerStatus = "succeeded" | "blocked" | "failed"

export interface WorkerTask {
  taskId: string
  cwd: string
  goal: string
  inputs: string[]
  writeArtifacts: {
    handoff: string
    result: string
  }
  stopCondition: string
  verify?: string[]
  resumeFrom?: string
  metadata?: Record<string, unknown>
}

export interface WorkerResult {
  taskId: string
  status: WorkerStatus
  summary: string
  artifacts: {
    handoff: string
    result: string
  }
  nextStep?: string
  resumeFrom?: string
  errors?: string[]
  verification?: string[]
}

export interface OmoWrapperOptions {
  command?: string
  args?: string[]
  extraArgs?: string[]
  env?: NodeJS.ProcessEnv
  taskStoreDir?: string
  sessionMapPath?: string
  timeoutMs?: number
}

interface SessionMap {
  [taskId: string]: {
    omoSessionId: string
    updatedAt: string
  }
}

interface InvocationLog {
  taskId: string
  phase: "started" | "completed" | "failed"
  cwd: string
  command: string
  args: string[]
  taskFile: string
  promptFile: string
  sessionMap: string
  resumeSessionId: string | null
  timeoutMs: number | null
  workerEnvNames: string[]
  startedAt: string
  completedAt?: string
  exitCode?: number
  stdout?: string
  stderr?: string
  error?: string
}

const DEFAULT_COMMAND = "bunx"
const DEFAULT_ARGS = ["oh-my-opencode", "run", "--json"]
const WORKER_TASK_KEYS = [
  "taskId",
  "cwd",
  "goal",
  "inputs",
  "writeArtifacts",
  "stopCondition",
  "verify",
  "resumeFrom",
  "metadata",
]
const WRITE_ARTIFACT_KEYS = ["handoff", "result"]
const WORKER_RESULT_KEYS = [
  "taskId",
  "status",
  "summary",
  "artifacts",
  "nextStep",
  "resumeFrom",
  "errors",
  "verification",
]

export async function runOmoTask(
  task: WorkerTask,
  options: OmoWrapperOptions = {},
): Promise<WorkerResult> {
  assertTask(task)

  const normalizedTask = normalizeTaskPaths(task)
  const cwd = normalizedTask.cwd
  const taskStoreDir = path.resolve(options.taskStoreDir ?? path.join(cwd, ".openclaw-fabric", "tasks"))
  const sessionMapPath = path.resolve(
    options.sessionMapPath ?? path.join(cwd, ".openclaw-fabric", "omo-session-map.json"),
  )

  await fs.mkdir(taskStoreDir, { recursive: true })
  await ensureArtifactDirs(normalizedTask)
  await assertInputsExist(normalizedTask)

  const taskFilePath = path.join(taskStoreDir, `${normalizedTask.taskId}.task.json`)
  const promptFilePath = path.join(taskStoreDir, `${normalizedTask.taskId}.prompt.md`)
  const invocationFilePath = path.join(taskStoreDir, `${normalizedTask.taskId}.invocation.json`)
  const prompt = renderOmoTaskPrompt(normalizedTask)

  await fs.writeFile(taskFilePath, `${JSON.stringify(normalizedTask, null, 2)}\n`, "utf8")
  await fs.writeFile(promptFilePath, prompt, "utf8")

  const sessionMap = await readJson<SessionMap>(sessionMapPath, {})
  const resumeSessionId = sessionMap[normalizedTask.taskId]?.omoSessionId

  const command = options.command ?? DEFAULT_COMMAND
  const args = options.args
    ? [...options.args]
    : [
        ...DEFAULT_ARGS,
        ...(options.extraArgs ?? []),
        "--directory",
        cwd,
        ...(resumeSessionId ? ["--session-id", resumeSessionId] : []),
        prompt,
      ]
  const workerEnv = {
    ...process.env,
    ...options.env,
    OPENCLAW_WORKER_TASK_FILE: taskFilePath,
    OPENCLAW_WORKER_PROMPT_FILE: promptFilePath,
    OPENCLAW_WORKER_TASK_ID: normalizedTask.taskId,
    OPENCLAW_WORKER_HANDOFF_FILE: normalizedTask.writeArtifacts.handoff,
    OPENCLAW_WORKER_RESULT_FILE: normalizedTask.writeArtifacts.result,
    OPENCLAW_WORKER_STOP_CONDITION: normalizedTask.stopCondition,
    OPENCLAW_WORKER_RESUME_FROM: normalizedTask.resumeFrom ?? "",
  }
  const invocationLog: InvocationLog = {
    taskId: normalizedTask.taskId,
    phase: "started",
    cwd,
    command,
    args,
    taskFile: taskFilePath,
    promptFile: promptFilePath,
    sessionMap: sessionMapPath,
    resumeSessionId: resumeSessionId ?? null,
    timeoutMs: options.timeoutMs ?? null,
    workerEnvNames: Object.keys(workerEnv).filter((key) => key.startsWith("OPENCLAW_WORKER_")).sort(),
    startedAt: new Date().toISOString(),
  }
  await writeInvocationLog(invocationFilePath, invocationLog)

  let execResult: { exitCode: number; stdout: string; stderr: string }
  try {
    execResult = await runCommand(command, args, {
      cwd,
      env: workerEnv,
      timeoutMs: options.timeoutMs,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await writeInvocationLog(invocationFilePath, {
      ...invocationLog,
      phase: "failed",
      completedAt: new Date().toISOString(),
      error: message,
    })
    const failedResult: WorkerResult = {
      taskId: normalizedTask.taskId,
      status: "failed",
      summary: "OMO wrapper failed before a valid worker result was written.",
      artifacts: {
        handoff: normalizedTask.writeArtifacts.handoff,
        result: normalizedTask.writeArtifacts.result,
      },
      resumeFrom: normalizedTask.resumeFrom,
      errors: [message],
    }
    await persistWrapperFailureResult(failedResult)
    return failedResult
  }
  await writeInvocationLog(invocationFilePath, {
    ...invocationLog,
    phase: "completed",
    completedAt: new Date().toISOString(),
    exitCode: execResult.exitCode,
    stdout: execResult.stdout,
    stderr: execResult.stderr,
  })

  const discoveredSessionId = maybeExtractSessionId(execResult.stdout)
  if (discoveredSessionId) {
    sessionMap[normalizedTask.taskId] = {
      omoSessionId: discoveredSessionId,
      updatedAt: new Date().toISOString(),
    }
    await fs.mkdir(path.dirname(sessionMapPath), { recursive: true })
    await fs.writeFile(sessionMapPath, `${JSON.stringify(sessionMap, null, 2)}\n`, "utf8")
  }

  const loadedResult = await loadWorkerResult(normalizedTask)
  if (loadedResult.result) return loadedResult.result

  const failedResult: WorkerResult = {
    taskId: normalizedTask.taskId,
    status: "failed",
    summary: "OMO finished without writing the required result artifact.",
    artifacts: {
      handoff: normalizedTask.writeArtifacts.handoff,
      result: normalizedTask.writeArtifacts.result,
    },
    resumeFrom: normalizedTask.resumeFrom,
    errors: compact([
      loadedResult.error,
      execResult.exitCode === 0 ? undefined : `OMO exited with code ${execResult.exitCode}`,
      execResult.stderr.trim() || undefined,
    ]),
  }
  await persistWrapperFailureResult(failedResult)
  return failedResult
}

export function renderOmoTaskPrompt(task: WorkerTask): string {
  const verifyLines = (task.verify ?? []).map((item) => `- ${item}`).join("\n")
  const inputLines = task.inputs.map((item) => `- ${item}`).join("\n")

  return [
    "You are executing one bounded worker task for OpenClaw.",
    "Do not decide follow-up workflow. Only complete the assigned task and write the declared artifacts.",
    "",
    `Task ID: ${task.taskId}`,
    `Working directory: ${task.cwd}`,
    "",
    "Goal:",
    task.goal,
    "",
    "Inputs:",
    inputLines || "- (none)",
    "",
    "Required artifacts:",
    `- Human handoff markdown: ${task.writeArtifacts.handoff}`,
    `- Machine result json: ${task.writeArtifacts.result}`,
    "",
    "Stop condition:",
    task.stopCondition,
    "",
    "Verification expectations:",
    verifyLines || "- (none)",
    "",
    "Status rules:",
    "- succeeded: stop condition met and required artifacts written",
    "- blocked: missing input, credential, clarification, or dependency",
    "- failed: crash, contract violation, or verification failure",
    "",
    "Result JSON contract:",
    JSON.stringify(
      {
        taskId: task.taskId,
        status: "succeeded | blocked | failed",
        summary: "short plain summary",
        artifacts: {
          handoff: task.writeArtifacts.handoff,
          result: task.writeArtifacts.result,
        },
        nextStep: "optional",
        resumeFrom: task.resumeFrom ?? task.writeArtifacts.handoff,
        errors: [],
        verification: task.verify ?? [],
      },
      null,
      2,
    ),
    "",
    "Handoff markdown must include:",
    "- what you were asked to do",
    "- what you actually did",
    "- what remains unresolved",
    "- smallest next step",
    "- verification performed",
    "",
    "If you cannot proceed, still write both artifacts and set status to blocked or failed.",
  ].join("\n")
}

async function loadWorkerResult(task: WorkerTask): Promise<{ result: WorkerResult | null; error?: string }> {
  try {
    const raw = await fs.readFile(task.writeArtifacts.result, "utf8")
    const parsed = JSON.parse(raw) as WorkerResult
    assertResult(parsed, task)
    await assertDeclaredHandoffExists(task)
    return { result: parsed }
  } catch (error) {
    return {
      result: null,
      error: `Result artifact validation failed: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

async function ensureArtifactDirs(task: WorkerTask): Promise<void> {
  await fs.mkdir(path.dirname(task.writeArtifacts.handoff), { recursive: true })
  await fs.mkdir(path.dirname(task.writeArtifacts.result), { recursive: true })
}

async function assertInputsExist(task: WorkerTask): Promise<void> {
  for (const input of task.inputs) {
    try {
      await fs.access(input)
    } catch {
      throw new Error(`task.inputs entry does not exist: ${input}`)
    }
  }
}

async function assertDeclaredHandoffExists(task: WorkerTask): Promise<void> {
  try {
    await fs.access(task.writeArtifacts.handoff)
  } catch {
    throw new Error(`declared handoff artifact is missing: ${task.writeArtifacts.handoff}`)
  }
}

async function persistWrapperFailureResult(result: WorkerResult): Promise<void> {
  await fs.mkdir(path.dirname(result.artifacts.result), { recursive: true })
  await fs.writeFile(result.artifacts.result, `${JSON.stringify(result, null, 2)}\n`, "utf8")
}

async function writeInvocationLog(filePath: string, log: InvocationLog): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(log, null, 2)}\n`, "utf8")
}

function normalizeTaskPaths(task: WorkerTask): WorkerTask {
  const cwd = path.resolve(task.cwd)
  const resolveWithinCwd = (value: string): string => (
    path.isAbsolute(value) ? value : path.join(cwd, value)
  )
  const handoff = resolveWithinCwd(task.writeArtifacts.handoff)
  const result = resolveWithinCwd(task.writeArtifacts.result)

  assertPathInsideCwd(cwd, handoff, "task.writeArtifacts.handoff")
  assertPathInsideCwd(cwd, result, "task.writeArtifacts.result")

  return {
    ...task,
    cwd,
    inputs: task.inputs.map(resolveWithinCwd),
    verify: task.verify ?? [],
    writeArtifacts: {
      handoff,
      result,
    },
    resumeFrom: task.resumeFrom ? resolveWithinCwd(task.resumeFrom) : undefined,
  }
}

function assertPathInsideCwd(cwd: string, filePath: string, label: string): void {
  const relativePath = path.relative(cwd, filePath)
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`${label} must resolve inside task.cwd`)
  }
}

function assertTask(task: WorkerTask): void {
  assertPlainObject(task, "task")
  assertOnlyKeys(task, WORKER_TASK_KEYS, "task")
  assertNonEmptyString(task.taskId, "task.taskId")
  assertNonEmptyString(task.cwd, "task.cwd")
  assertNonEmptyString(task.goal, "task.goal")
  assertStringArray(task.inputs, "task.inputs", true)
  assertNonEmptyString(task.stopCondition, "task.stopCondition")
  assertPlainObject(task.writeArtifacts, "task.writeArtifacts")
  assertOnlyKeys(task.writeArtifacts, WRITE_ARTIFACT_KEYS, "task.writeArtifacts")
  assertNonEmptyString(task.writeArtifacts.handoff, "task.writeArtifacts.handoff")
  assertNonEmptyString(task.writeArtifacts.result, "task.writeArtifacts.result")
  if (task.verify !== undefined) assertStringArray(task.verify, "task.verify", true)
  if (task.resumeFrom !== undefined) assertString(task.resumeFrom, "task.resumeFrom")
  if (task.metadata !== undefined) assertPlainObject(task.metadata, "task.metadata")
}

function assertResult(result: WorkerResult, task: WorkerTask): void {
  assertPlainObject(result, "result")
  assertOnlyKeys(result, WORKER_RESULT_KEYS, "result")
  assertNonEmptyString(result.taskId, "result.taskId")
  if (result.taskId !== task.taskId) throw new Error("result.taskId mismatch")
  if (!["succeeded", "blocked", "failed"].includes(result.status)) {
    throw new Error("result.status is invalid")
  }
  assertNonEmptyString(result.summary, "result.summary")
  assertPlainObject(result.artifacts, "result.artifacts")
  assertOnlyKeys(result.artifacts, WRITE_ARTIFACT_KEYS, "result.artifacts")
  assertNonEmptyString(result.artifacts.handoff, "result.artifacts.handoff")
  assertNonEmptyString(result.artifacts.result, "result.artifacts.result")
  if (result.artifacts.handoff !== task.writeArtifacts.handoff) {
    throw new Error("result.artifacts.handoff mismatch")
  }
  if (result.artifacts.result !== task.writeArtifacts.result) {
    throw new Error("result.artifacts.result mismatch")
  }
  if (result.nextStep !== undefined) assertString(result.nextStep, "result.nextStep")
  if (result.resumeFrom !== undefined) assertString(result.resumeFrom, "result.resumeFrom")
  if (result.errors !== undefined) assertStringArray(result.errors, "result.errors", false)
  if (result.verification !== undefined) assertStringArray(result.verification, "result.verification", false)
}

function assertPlainObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
}

function assertOnlyKeys(value: Record<string, unknown>, allowedKeys: string[], label: string): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) throw new Error(`${label}.${key} is not allowed`)
  }
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  assertString(value, label)
  if (value.length === 0) throw new Error(`${label} must not be empty`)
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`)
}

function assertStringArray(value: unknown, label: string, requireNonEmptyItems: boolean): asserts value is string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  for (const [index, item] of value.entries()) {
    if (requireNonEmptyItems) {
      assertNonEmptyString(item, `${label}[${index}]`)
    } else {
      assertString(item, `${label}[${index}]`)
    }
  }
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8")
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function runCommand(
  command: string,
  args: string[],
  options: {
    cwd: string
    env: NodeJS.ProcessEnv
    timeoutMs?: number
  },
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""
    let killedForTimeout = false

    const timer = options.timeoutMs
      ? setTimeout(() => {
          killedForTimeout = true
          child.kill("SIGTERM")
        }, options.timeoutMs)
      : null

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk)
    })

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk)
    })

    child.on("error", reject)
    child.on("close", (code) => {
      if (timer) clearTimeout(timer)
      if (killedForTimeout) {
        reject(new Error(`OMO command timed out after ${options.timeoutMs}ms`))
        return
      }

      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      })
    })
  })
}

function maybeExtractSessionId(stdout: string): string | null {
  const match = stdout.match(/"sessionId"\s*:\s*"([^"]+)"/)
  return match?.[1] ?? null
}

function compact<T>(values: Array<T | undefined>): T[] {
  return values.filter((value): value is T => value !== undefined)
}
