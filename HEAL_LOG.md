# HEAL_LOG

Records of self-heal attempts and outcomes.

## 2026-04-14 - validate root git false positive

- Failure: `bash scripts/validate.sh` exited 1 with `Nested git repo detected in projects/openclaw-fabric/.git`.
- Diagnosis: the validator checked `./.git`, but this workspace is itself the repo root; only descendant `.git` directories are nested project repos.
- Fix: changed `scripts/validate.sh` to ignore `./.git` and reject only child `.git` directories.
- Verification: `bash scripts/validate.sh` passed.

## 2026-04-14 - provider boundary fixture case sensitivity

- Failure: `bash scripts/validate.sh` exited 1 with `Provider boundary fixture failed to reject worker lifecycle semantics.`
- Diagnosis: the negative fixture used `leakedTaskId`, while the boundary grep matched lowercase lifecycle terms such as `taskId`.
- Fix: made the provider-boundary grep case-insensitive so lifecycle variants in provider-facing files are rejected.
- Verification: `bash scripts/validate.sh` passed.

## 2026-04-14 - live validation runner syntax error

- Failure: `bash scripts/validate.sh` exited 1 before fixture tests with `SyntaxError: missing ) after argument list` in `scripts/live-omo-validation.mjs`.
- Diagnosis: three evidence-copy path entries closed template strings with `"` instead of `` ` ``, so Node could not parse the new script.
- Fix: corrected the malformed template-string delimiters in the copy list.
- Verification: `node --check scripts/live-omo-validation.mjs` and `bash scripts/validate.sh` passed.
