#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

cleanup_dirs=()
cleanup() {
  if [ "${#cleanup_dirs[@]}" -gt 0 ]; then
    rm -rf "${cleanup_dirs[@]}"
  fi
}
trap cleanup EXIT

required_files=(
  "RFC-0001-layer-boundaries.md"
  "ARCHITECTURE_AND_CONTRACT.md"
  "specs/openclaw-omo-bounded-worker-wrapper.md"
  "schemas/worker-task.schema.json"
  "schemas/worker-result.schema.json"
  "sketches/openclaw-omo-wrapper.ts"
  "scripts/contract-fixtures.mjs"
  "scripts/live-omo-validation.mjs"
  "validation/live-omo/README.md"
  "PROMPT_plan.md"
  "PROMPT_build.md"
  "loop.sh"
)

for file in "${required_files[@]}"; do
  if [ ! -f "$file" ]; then
    echo "Missing required file: $file" >&2
    exit 1
  fi
done

find_nested_git() {
  find "$1" -path "$1/.git" -prune -o -name .git -type d -print -quit
}

nested_git="$(find_nested_git .)"
if [ -n "$nested_git" ]; then
  echo "Nested git repo detected at ${nested_git#./}. This project should use the workspace root repo." >&2
  exit 1
fi

git_fixture="$(mktemp -d)"
cleanup_dirs+=("$git_fixture")
mkdir -p "$git_fixture/.git"
if [ -n "$(find_nested_git "$git_fixture")" ]; then
  echo "Nested git detection rejected the validation root .git directory." >&2
  exit 1
fi
mkdir -p "$git_fixture/child/.git"
if [ -z "$(find_nested_git "$git_fixture")" ]; then
  echo "Nested git detection failed to reject a child .git directory." >&2
  exit 1
fi

node - <<'NODE'
const fs = require('node:fs')
const taskSchema = JSON.parse(fs.readFileSync('schemas/worker-task.schema.json', 'utf8'))
const resultSchema = JSON.parse(fs.readFileSync('schemas/worker-result.schema.json', 'utf8'))

const exampleTask = {
  taskId: 'example-task',
  cwd: '/tmp/openclaw-example',
  goal: 'Write the declared handoff and result artifacts.',
  inputs: ['inputs/source.txt'],
  writeArtifacts: {
    handoff: 'artifacts/handoff.md',
    result: 'artifacts/result.json',
  },
  stopCondition: 'Both declared artifacts exist and validate.',
  verify: ['result schema validates'],
  resumeFrom: 'artifacts/handoff.md',
}

const resultBase = {
  taskId: 'example-task',
  summary: 'Example result for schema validation.',
  artifacts: {
    handoff: 'artifacts/handoff.md',
    result: 'artifacts/result.json',
  },
  resumeFrom: 'artifacts/handoff.md',
  errors: [],
  verification: ['result schema validates'],
}

validate(exampleTask, taskSchema, 'example WorkerTask')
for (const status of ['succeeded', 'blocked', 'failed']) {
  validate({ ...resultBase, status }, resultSchema, `example WorkerResult ${status}`)
}
assertRejects({ ...exampleTask, unexpected: true }, taskSchema, /unexpected is not allowed/)
assertRejects({ ...resultBase, status: 'done' }, resultSchema, /status must be one of/)
assertRejects({ ...resultBase, status: 'blocked', artifacts: { handoff: 'artifacts/handoff.md' } }, resultSchema, /artifacts.result is required/)

function validate(value, schema, label) {
  const errors = []
  validateValue(value, schema, label, errors)
  if (errors.length > 0) {
    throw new Error(`Schema validation failed:\n${errors.join('\n')}`)
  }
}

function assertRejects(value, schema, expected) {
  const errors = []
  validateValue(value, schema, 'negative example', errors)
  const message = errors.join('\n')
  if (!expected.test(message)) {
    throw new Error(`Expected schema rejection matching ${expected}, got:\n${message || '(no errors)'}`)
  }
}

function validateValue(value, schema, path, errors) {
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`${path} must be an object`)
      return
    }

    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${path}.${key} is required`)
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!schema.properties || !(key in schema.properties)) {
          errors.push(`${path}.${key} is not allowed`)
        }
      }
    }

    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      if (key in value) validateValue(value[key], childSchema, `${path}.${key}`, errors)
    }
    return
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      errors.push(`${path} must be an array`)
      return
    }
    value.forEach((item, index) => validateValue(item, schema.items ?? {}, `${path}[${index}]`, errors))
    return
  }

  if (schema.type === 'string') {
    if (typeof value !== 'string') {
      errors.push(`${path} must be a string`)
      return
    }
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${path} must be at least ${schema.minLength} character(s)`)
    }
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`${path} must be one of: ${schema.enum.join(', ')}`)
    }
  }
}
NODE

grep -q "OpenClaw owns workflow" specs/openclaw-omo-bounded-worker-wrapper.md || {
  echo "Spec is missing the OpenClaw workflow boundary." >&2
  exit 1
}

grep -q "OMO executes one bounded task" specs/openclaw-omo-bounded-worker-wrapper.md || {
  echo "Spec is missing the bounded OMO worker rule." >&2
  exit 1
}

grep -q "Sable mediates models" specs/openclaw-omo-bounded-worker-wrapper.md || {
  echo "Spec is missing the Sable generic mediation rule." >&2
  exit 1
}

if grep -RIniE '^[[:space:]]*import .*sable|^[[:space:]]*const .*require\(.*sable' sketches src 2>/dev/null; then
  echo "Wrapper layer appears to import Sable internals directly. Keep Sable below the worker boundary." >&2
  exit 1
fi

provider_paths=()
for path in sable providers src/sable src/providers src/provider; do
  if [ -e "$path" ]; then
    provider_paths+=("$path")
  fi
done

check_provider_boundary() {
  local hits

  hits="$(
    find "$@" \
      \( -path '*/.git' -o -path '*/node_modules' -o -path '*/.openclaw-fabric' \) -prune -o \
      -type f \( -path '*/sable/*' -o -path '*/provider/*' -o -path '*/providers/*' -o -iname '*sable*' -o -iname '*provider*' -o -iname '*model*' \) \
      -print0 |
      xargs -0 grep -IniE 'taskId|blocked|resumeFrom|retry|follow-up|follow up|WorkerTask|WorkerResult' 2>/dev/null || true
  )"

  if [ -n "$hits" ]; then
    printf '%s\n' "$hits"
    return 1
  fi
}

if [ "${#provider_paths[@]}" -gt 0 ] && ! check_provider_boundary "${provider_paths[@]}"; then
  echo "Provider-facing layer contains worker lifecycle semantics. Keep Sable/provider code generic." >&2
  exit 1
fi

boundary_fixture="$(mktemp -d)"
cleanup_dirs+=("$boundary_fixture")
mkdir -p "$boundary_fixture/src/providers"
printf 'export const modelName = "fixture"\n' > "$boundary_fixture/src/providers/generic-provider.ts"
check_provider_boundary "$boundary_fixture" >/dev/null || {
  echo "Provider boundary fixture rejected generic provider code." >&2
  exit 1
}
printf 'export const leakedTaskId = "fixture"\n' > "$boundary_fixture/src/providers/leaky-provider.ts"
if check_provider_boundary "$boundary_fixture" >/dev/null 2>&1; then
  echo "Provider boundary fixture failed to reject worker lifecycle semantics." >&2
  exit 1
fi

node scripts/live-omo-validation.mjs --self-test
node --test scripts/contract-fixtures.mjs

echo "openclaw-fabric validation OK"
