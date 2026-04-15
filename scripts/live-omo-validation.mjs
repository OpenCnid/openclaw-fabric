#!/usr/bin/env node
import { spawn } from "node:child_process"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { runOmoTask } from "../sketches/openclaw-omo-wrapper.ts"

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(SCRIPT_DIR, "..")
const TASK_ID = "live-omo-validation"
const REPAIR_TASK_ID = `${TASK_ID}-repair`
const DEFAULT_TIMEOUT_MS = 120000
const DEFAULT_REPAIR_AGENT = process.env.OPENCLAW_OMO_REPAIR_AGENT ?? "general"
const DEFAULT_REPAIR_MODEL =
  process.env.OPENCLAW_OMO_REPAIR_MODEL ?? "openclawraw/openclaw/codex-gpt-54"

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }
  if (options.selfTest) {
    await runSelfTest()
    return
  }

  await assertCleanGitRoot(ROOT)

  const evidenceDir = path.resolve(
    ROOT,
    options.evidenceDir ?? path.join("validation", "live-omo", newRunId()),
  )
  const sandboxDir = options.sandbox
    ? path.resolve(ROOT, options.sandbox)
    : path.join(evidenceDir, "sandbox")
  const command = options.command ?? "bunx"
  const agent = options.agent ?? process.env.OPENCLAW_OMO_AGENT ?? "sisyphus"
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const startedAt = new Date().toISOString()

  await fs.mkdir(evidenceDir, { recursive: true })
  await prepareSandbox(sandboxDir)
  await assertCleanValidationSandbox(sandboxDir)

  const commandPath = await findExecutable(command)
  const opencodePath = await findExecutable("opencode")
  if (!commandPath) {
    await writeValidationNote({
      evidenceDir,
      sandboxDir,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "blocked",
      commandLine: expectedCommandLine(command, agent, sandboxDir, options.model),
      result: null,
      invocation: null,
      sessionMap: null,
      mismatches: [`OMO command is not available on PATH: ${command}`],
      copiedArtifacts: [],
      repairAttempt: null,
    })
    console.error(`OMO command is not available on PATH: ${command}`)
    process.exitCode = 2
    return
  }

  const task = await writeToyTask(sandboxDir)
  const initialResult = await runOmoTask(task, {
    command,
    extraArgs: buildOmoArgs(agent, options.model),
    timeoutMs,
  })
  let result = initialResult
  let invocation = await readJsonIfExists(
    path.join(sandboxDir, ".openclaw-fabric", "tasks", `${TASK_ID}.invocation.json`),
  )
  let sessionMap = await readJsonIfExists(
    path.join(sandboxDir, ".openclaw-fabric", "omo-session-map.json"),
  )
  let artifactState = await inspectArtifactState(sandboxDir)
  let repairAttempt = null

  const noncompliantClassification = classifyNoncompliantCompletion({ invocation, artifactState })
  if (noncompliantClassification) {
    const initialSessionId = sessionMap?.[TASK_ID]?.omoSessionId ?? null
    const transcriptCapture = initialSessionId && opencodePath
      ? await captureSessionTranscript({
          opencodePath,
          sessionId: initialSessionId,
          evidenceDir,
          label: TASK_ID,
        })
      : null

    repairAttempt = {
      classification: noncompliantClassification,
      initialSessionId,
      transcriptSnippetPath: transcriptCapture?.fileName ?? null,
      repairAgent: options.repairAgent ?? DEFAULT_REPAIR_AGENT,
      repairModel: options.repairModel ?? DEFAULT_REPAIR_MODEL,
      initialExitCode: result.exitCode,
      missingArtifacts: listMissingArtifacts(artifactState),
    }

    const repairTask = buildRepairTask({
      task,
      classification: noncompliantClassification,
      priorSessionId: initialSessionId,
      transcriptSnippet: transcriptCapture?.snippet ?? null,
      artifactState,
    })

    result = await runOmoTask(repairTask, {
      command,
      extraArgs: buildOmoArgs(repairAttempt.repairAgent, repairAttempt.repairModel),
      timeoutMs,
    })

    invocation = await readJsonIfExists(
      path.join(sandboxDir, ".openclaw-fabric", "tasks", `${TASK_ID}.invocation.json`),
    )
    sessionMap = await readJsonIfExists(
      path.join(sandboxDir, ".openclaw-fabric", "omo-session-map.json"),
    )
    artifactState = await inspectArtifactState(sandboxDir)

    const repairSessionId = sessionMap?.[REPAIR_TASK_ID]?.omoSessionId ?? null
    const repairTranscriptCapture = repairSessionId && opencodePath
      ? await captureSessionTranscript({
          opencodePath,
          sessionId: repairSessionId,
          evidenceDir,
          label: REPAIR_TASK_ID,
        })
      : null

    repairAttempt.repairSessionId = repairSessionId
    repairAttempt.repairTranscriptSnippetPath = repairTranscriptCapture?.fileName ?? null
    repairAttempt.finalExitCode = result.exitCode
    repairAttempt.finalMissingArtifacts = listMissingArtifacts(artifactState)
    repairAttempt.repaired = repairAttempt.finalMissingArtifacts.length === 0
  }

  const copiedArtifacts = await copyEvidenceArtifacts(sandboxDir, evidenceDir)
  const commandLine = invocation
    ? formatCommandLine(invocation.command, invocation.args)
    : expectedCommandLine(command, agent, sandboxDir, options.model)
  const mismatches = buildMismatches(result, artifactState)

  await writeValidationNote({
    evidenceDir,
    sandboxDir,
    startedAt,
    completedAt: new Date().toISOString(),
    status: mismatches.length === 0 ? "succeeded" : "failed",
    commandLine,
    result,
    invocation,
    sessionMap,
    mismatches,
    copiedArtifacts,
    repairAttempt,
  })

  process.exitCode = mismatches.length === 0 ? 0 : 1
}

function parseArgs(argv) {
  const options = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--help" || arg === "-h") {
      options.help = true
    } else if (arg === "--self-test") {
      options.selfTest = true
    } else if (arg === "--evidence-dir") {
      options.evidenceDir = requireValue(argv, index, arg)
      index += 1
    } else if (arg === "--sandbox") {
      options.sandbox = requireValue(argv, index, arg)
      index += 1
    } else if (arg === "--command") {
      options.command = requireValue(argv, index, arg)
      index += 1
    } else if (arg === "--agent") {
      options.agent = requireValue(argv, index, arg)
      index += 1
    } else if (arg === "--model") {
      options.model = requireValue(argv, index, arg)
      index += 1
    } else if (arg === "--repair-agent") {
      options.repairAgent = requireValue(argv, index, arg)
      index += 1
    } else if (arg === "--repair-model") {
      options.repairModel = requireValue(argv, index, arg)
      index += 1
    } else if (arg === "--timeout-ms") {
      const value = Number(requireValue(argv, index, arg))
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error("--timeout-ms must be a positive integer")
      }
      options.timeoutMs = value
      index += 1
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return options
}

function requireValue(argv, index, arg) {
  const value = argv[index + 1]
  if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`)
  return value
}

function printHelp() {
  console.log(`Usage: node scripts/live-omo-validation.mjs [options]

Runs the F5 live OMO validation path and writes durable evidence.

Options:
  --evidence-dir <path>  Evidence directory, default validation/live-omo/<timestamp>
  --sandbox <path>       Toy workspace, default <evidence-dir>/sandbox
  --command <name>       OMO launcher command, default bunx
  --agent <name>         Explicit OMO agent, default sisyphus
  --model <id>           Explicit model override for the initial run
  --repair-agent <name>  Repair/fallback agent, default ${DEFAULT_REPAIR_AGENT}
  --repair-model <id>    Repair/fallback model, default ${DEFAULT_REPAIR_MODEL}
  --timeout-ms <ms>      Worker timeout, default ${DEFAULT_TIMEOUT_MS}
  --self-test            Test validation-path safeguards without launching OMO
`)
}

function buildOmoArgs(agent, model) {
  const args = ["-a", agent]
  if (model) args.push("--model", model)
  return args
}

function classifyNoncompliantCompletion({ invocation, artifactState }) {
  if (invocation?.exitCode !== 0) return null
  const missingArtifacts = listMissingArtifacts(artifactState)
  if (missingArtifacts.length === 0) return null
  return "empty_turn_or_noncompliant_completion"
}

function listMissingArtifacts(artifactState) {
  const missing = []
  if (!artifactState.handoffExists) missing.push("handoff")
  if (!artifactState.resultExists) missing.push("result")
  return missing
}

function buildRepairTask({ task, classification, priorSessionId, transcriptSnippet, artifactState }) {
  const snippet = transcriptSnippet?.trim()
  const transcriptHint = snippet
    ? `A transcript snippet was captured for evidence. Use the filesystem state as the source of truth, not the prior chat text.`
    : null

  const missingArtifacts = listMissingArtifacts(artifactState)
  const repairGoals = [
    `Repair attempt for ${task.taskId}.`,
    `Classification: ${classification}.`,
    priorSessionId ? `Previous OMO session id: ${priorSessionId}.` : "Previous OMO session id: unavailable.",
    transcriptHint,
    `Current artifact state: handoff is ${artifactState.handoffExists ? "present" : "missing"}; result is ${artifactState.resultExists ? "present" : "missing"}.`,
    missingArtifacts.length > 0
      ? `Missing artifacts to repair: ${missingArtifacts.join(", ")}.`
      : "No artifacts are missing, but the previous completion was classified as noncompliant.",
    "Repair rules:",
    `- Inspect ${task.writeArtifacts.result} first if it exists.`,
    `- If ${task.writeArtifacts.handoff} is missing, write only that missing handoff based on the actual files and existing result.`,
    `- If ${task.writeArtifacts.result} is missing or invalid, rewrite it to match the declared contract after repairing artifacts.`,
    "- Do not redo the whole task if the needed information is already present on disk.",
    "- Prefer artifact repair over narrative explanation.",
    "Original task goal:",
    task.goal,
  ].filter(Boolean)

  return {
    ...task,
    taskId: REPAIR_TASK_ID,
    resumeFrom: priorSessionId ?? undefined,
    goal: repairGoals.join("\n"),
  }
}

async function captureSessionTranscript({ opencodePath, sessionId, evidenceDir, label }) {
  const escapedSessionId = sessionId.replace(/'/g, "''")
  const query = [
    "select data from message",
    `where session_id='${escapedSessionId}'`,
    "order by time_created limit 6;",
    "select data from part",
    `where session_id='${escapedSessionId}'`,
    "order by time_created limit 12;",
  ].join(" ")

  const dbResult = await runProcess(opencodePath, ["db", query], { cwd: ROOT })
  const snippet = [
    `session_id=${sessionId}`,
    `exit_code=${dbResult.exitCode}`,
    "stdout:",
    dbResult.stdout.trim() || "<empty>",
    "stderr:",
    dbResult.stderr.trim() || "<empty>",
  ].join("\n")

  const fileName = `${label}.transcript-snippet.txt`
  await fs.writeFile(path.join(evidenceDir, fileName), `${snippet}\n`)
  return { fileName, snippet }
}

async function assertCleanGitRoot(root) {
  const status = await runProcess("git", ["status", "--short"], { cwd: root })
  if (status.exitCode !== 0) {
    throw new Error(`Unable to inspect git status before live validation:\n${status.stderr || status.stdout}`)
  }
  if (status.stdout.trim()) {
    throw new Error("Live OMO validation requires a clean git worktree before evidence is created.")
  }
}

async function prepareSandbox(sandboxDir) {
  await fs.mkdir(path.join(sandboxDir, "inputs"), { recursive: true })
  await fs.writeFile(
    path.join(sandboxDir, "inputs", "source.txt"),
    "Live OMO validation input. Write the declared handoff and result artifacts.\n",
    "utf8",
  )
}

async function assertCleanValidationSandbox(sandboxDir) {
  const nestedGit = await findNestedGit(sandboxDir)
  if (nestedGit) {
    throw new Error(`Live validation sandbox contains nested git repo: ${nestedGit}`)
  }
}

async function findNestedGit(rootDir) {
  const rootGit = path.join(rootDir, ".git")
  return findFirst(rootDir, async (entryPath, entry) => {
    if (!entry.isDirectory() || entry.name !== ".git") return false
    return path.resolve(entryPath) !== path.resolve(rootGit)
  })
}

async function findFirst(dir, predicate) {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return null
  }

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name)
    if (await predicate(entryPath, entry)) return entryPath
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".openclaw-fabric") {
      const found = await findFirst(entryPath, predicate)
      if (found) return found
    }
  }
  return null
}

async function writeToyTask(sandboxDir) {
  return {
    taskId: TASK_ID,
    cwd: sandboxDir,
    goal: [
      "Read inputs/source.txt.",
      "Write artifacts/live-handoff.md with what was done, what remains unresolved, and verification performed.",
      "Write artifacts/live-result.json matching the declared WorkerResult contract with status succeeded if both artifacts are written.",
    ].join(" "),
    inputs: ["inputs/source.txt"],
    writeArtifacts: {
      handoff: "artifacts/live-handoff.md",
      result: "artifacts/live-result.json",
    },
    stopCondition: "Both declared artifacts exist and the result JSON validates.",
    verify: [
      "handoff artifact exists",
      "result artifact conforms to worker-result.schema.json shape",
    ],
  }
}

async function copyEvidenceArtifacts(sandboxDir, evidenceDir) {
  const copied = []
  const taskDir = path.join(sandboxDir, ".openclaw-fabric", "tasks")
  if (await pathExists(taskDir)) {
    const taskEntries = await fs.readdir(taskDir, { withFileTypes: true })
    for (const entry of taskEntries) {
      if (!entry.isFile()) continue
      const source = path.join(taskDir, entry.name)
      const destination = path.join(evidenceDir, entry.name)
      await fs.copyFile(source, destination)
      copied.push({ label: "task artifact", source, destination })
    }
  }

  const copies = [
    ["handoff", path.join(sandboxDir, "artifacts", "live-handoff.md"), "live-handoff.md"],
    ["result", path.join(sandboxDir, "artifacts", "live-result.json"), "live-result.json"],
    ["session map", path.join(sandboxDir, ".openclaw-fabric", "omo-session-map.json"), "omo-session-map.json"],
  ]
  for (const [label, source, name] of copies) {
    const destination = path.join(evidenceDir, name)
    if (await pathExists(source)) {
      await fs.copyFile(source, destination)
      copied.push({ label, source, destination })
    }
  }
  return copied
}

async function inspectArtifactState(sandboxDir) {
  return {
    handoffExists: await pathExists(path.join(sandboxDir, "artifacts", "live-handoff.md")),
    resultExists: await pathExists(path.join(sandboxDir, "artifacts", "live-result.json")),
  }
}

function buildMismatches(result, artifactState) {
  const mismatches = []
  if (!artifactState.handoffExists) mismatches.push("Declared handoff artifact was not produced.")
  if (!artifactState.resultExists) mismatches.push("Declared result artifact was not produced.")
  if (result.status !== "succeeded") {
    mismatches.push(`Worker result status was ${result.status}; expected succeeded for the toy live task.`)
  }
  return mismatches
}

async function writeValidationNote({
  evidenceDir,
  sandboxDir,
  startedAt,
  completedAt,
  status,
  commandLine,
  result,
  invocation,
  sessionMap,
  mismatches,
  copiedArtifacts,
  repairAttempt,
}) {
  const artifactState = await inspectArtifactState(sandboxDir)
  const lines = [
    "# Live OMO Validation",
    "",
    "This note is the durable F5 evidence record for one live validation attempt.",
    "",
    `- Status: ${status}`,
    `- Started: ${startedAt}`,
    `- Completed: ${completedAt}`,
    `- Clean sandbox: ${sandboxDir}`,
    `- Evidence directory: ${evidenceDir}`,
    "",
    "## Command",
    "",
    "```text",
    commandLine,
    "```",
    "",
    "Full argv is preserved in the invocation JSON when OMO launches.",
    "",
    "## Produced Artifacts",
    "",
    `- Handoff: ${path.join(sandboxDir, "artifacts", "live-handoff.md")} (${artifactState.handoffExists ? "present" : "missing"})`,
    `- Result: ${path.join(sandboxDir, "artifacts", "live-result.json")} (${artifactState.resultExists ? "present" : "missing"})`,
    ...copiedArtifacts.map((artifact) => `- Copied ${artifact.label}: ${artifact.destination}`),
    "",
    "## Observed Status Behavior",
    "",
    result
      ? `Wrapper returned ${result.status}: ${result.summary}`
      : "OMO was not launched, so no WorkerResult was observed.",
    "",
    "## Observed Resume Behavior",
    "",
    sessionMap
      ? `Session map content was observed in ${path.join(sandboxDir, ".openclaw-fabric", "omo-session-map.json")}.`
      : "No parseable session map was produced during this attempt.",
    invocation?.resumeSessionId
      ? `The invocation used resume session ${invocation.resumeSessionId}.`
      : "The invocation did not use an existing resume session.",
    "",
    ...(repairAttempt
      ? [
          "## Repair / Fallback Attempt",
          "",
          `- Classification: ${repairAttempt.classification}`,
          `- Initial session id: ${repairAttempt.initialSessionId ?? "unknown"}`,
          `- Transcript snippet: ${repairAttempt.transcriptSnippetPath ?? "not captured"}`,
          `- Repair agent: ${repairAttempt.repairAgent}`,
          `- Repair model: ${repairAttempt.repairModel ?? "default"}`,
          `- Missing artifacts before repair: ${(repairAttempt.missingArtifacts ?? []).join(", ") || "none"}`,
          `- Repair session id: ${repairAttempt.repairSessionId ?? "unknown"}`,
          `- Repair transcript snippet: ${repairAttempt.repairTranscriptSnippetPath ?? "not captured"}`,
          `- Missing artifacts after repair: ${(repairAttempt.finalMissingArtifacts ?? []).join(", ") || "none"}`,
          `- Repair outcome: ${repairAttempt.repaired ? "artifacts produced" : "artifacts still missing"}`,
          "",
        ]
      : []),
    "## CLI Mismatch Or Blocker",
    "",
    mismatches.length > 0
      ? mismatches.map((item) => `- ${item}`).join("\n")
      : "- None observed.",
    "",
  ]
  await fs.writeFile(path.join(evidenceDir, "LIVE_VALIDATION.md"), `${lines.join("\n")}\n`, "utf8")
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"))
  } catch {
    return null
  }
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function findExecutable(command) {
  if (command.includes(path.sep)) return (await pathExists(command)) ? command : null
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue
    const candidate = path.join(dir, command)
    if (await pathExists(candidate)) return candidate
  }
  return null
}

function expectedCommandLine(command, agent, sandboxDir, model) {
  const args = ["run", "-a", agent, "--json"]
  if (model) args.push("--model", model)
  args.push("--directory", sandboxDir, "<bounded prompt argument>")
  return formatCommandLine(command, args)
}

function formatCommandLine(command, args) {
  return [command, ...args].map(shellQuote).join(" ")
}

function shellQuote(value) {
  if (/^[A-Za-z0-9_/:=.,@%+-]+$/.test(value)) return value
  return `'${String(value).replace(/'/g, "'\\''")}'`
}

function newRunId() {
  return new Date().toISOString().replace(/[:.]/g, "-")
}

function runProcess(command, args, options) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk)
    })
    child.on("error", (error) => {
      resolve({ exitCode: 1, stdout, stderr: error.message })
    })
    child.on("close", (code) => {
      resolve({ exitCode: code ?? 1, stdout, stderr })
    })
  })
}

async function runSelfTest() {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-live-validation-"))
  try {
    const goodSandbox = path.join(fixture, "good")
    await fs.mkdir(path.join(goodSandbox, ".git"), { recursive: true })
    await assertCleanValidationSandbox(goodSandbox)

    const nestedSandbox = path.join(fixture, "nested")
    await fs.mkdir(path.join(nestedSandbox, "child", ".git"), { recursive: true })
    let rejectedNestedGit = false
    try {
      await assertCleanValidationSandbox(nestedSandbox)
    } catch (error) {
      rejectedNestedGit = /nested git repo/.test(String(error.message))
    }
    if (!rejectedNestedGit) throw new Error("self-test failed to reject nested git sandbox")

    const evidenceDir = path.join(fixture, "evidence")
    await fs.mkdir(evidenceDir, { recursive: true })
    await prepareSandbox(goodSandbox)
    await writeValidationNote({
      evidenceDir,
      sandboxDir: goodSandbox,
      startedAt: "2026-04-14T00:00:00.000Z",
      completedAt: "2026-04-14T00:00:01.000Z",
      status: "blocked",
      commandLine: expectedCommandLine("bunx", "sisyphus", goodSandbox),
      result: null,
      invocation: null,
      sessionMap: null,
      mismatches: ["OMO command is not available on PATH: bunx"],
      copiedArtifacts: [],
    })
    const note = await fs.readFile(path.join(evidenceDir, "LIVE_VALIDATION.md"), "utf8")
    if (!note.includes("Clean sandbox:")) throw new Error("self-test note omitted clean sandbox")
    if (!note.includes("OMO command is not available on PATH: bunx")) {
      throw new Error("self-test note omitted command blocker")
    }
  } finally {
    await fs.rm(fixture, { recursive: true, force: true })
  }
  console.log("live OMO validation self-test OK")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
