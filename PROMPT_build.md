0a. Study `specs/*` with up to 500 concurrent subagents to learn the application specifications.
0b. Study @IMPLEMENTATION_PLAN.md.
0c. For reference, the current prototype surface is in `sketches/*`, `schemas/*`, and `scripts/*`.
0d. Study @HEAL_LOG.md (if present). Note files modified by recent fixes (last 10 entries). If your planned work touches these files, read the heal log entries first to avoid re-introducing fixed bugs. Add affected test cases to your verification checklist.
0e. If @IMPLEMENTATION_PLAN.md already exists and the repository is clean at iteration start, do not spend the iteration on broad rediscovery. Use the plan as the starting point and move directly to the highest-priority unchecked item after a brief targeted read of only the files needed for that item.

1. Your task is to implement functionality per the specifications using concurrent subagents. Follow @IMPLEMENTATION_PLAN.md and choose the most important item to address. Before making changes, search the codebase in `sketches/*`, `schemas/*`, `scripts/*`, and `specs/*` to verify what already exists. You may use up to 500 concurrent subagents for searches/reads and only 1 subagent for build/tests. Use deeper reasoning when complex debugging or architectural decisions are needed.
1a. Single-writer rule for code changes: subagents may research, inspect, or propose edits, but exactly one writer may modify a given file in an iteration. If multiple files must change, serialize writes file-by-file. Do not let multiple writers patch the same file from independent reads.
1b. Refresh-before-patch rule: immediately before editing any file, re-read that file from disk. After every successful edit to a file, re-read it again before generating another patch for that same file. Do not queue multiple stale patches against a file whose contents have already changed.
1c. If an edit or patch verification fails, stop issuing more edits for that file, refresh the file from disk, recompute the change from current contents, then continue. Do not proceed to validation or commit with an unexamined partial-edit state.
1d. Plan-file ownership rule: only the main thread may modify `IMPLEMENTATION_PLAN.md`. Subagents may propose plan notes in their output, but they must never patch the plan directly.
1e. Finalize-after-tests rule: after validation passes, the main thread must re-read `IMPLEMENTATION_PLAN.md` from disk immediately before updating it. Apply one minimal plan update that marks the completed item and records any blocker. If the plan patch fails, refresh the plan and retry once before abandoning the iteration. Do not skip commit merely because an earlier plan patch used stale context.
1f. Iteration exit contract: an iteration is complete only if it ends with exactly one new commit. If work was implemented, commit that bounded change. If no safe implementation can be completed, make one minimal blocked/no-change plan update and commit that blocked state. Green tests with no commit are an incomplete iteration, not success.
1g. Action floor: if the repository is clean at iteration start and the chosen task remains valid after targeted reading, you must either (a) edit at least one project file in service of that task, or (b) commit a blocked-state update explaining exactly why no safe edit could be made. Pure study/research with no edit and no commit is failure.
2. After implementing functionality or resolving problems, run the tests for that unit of code that was improved. If functionality is missing then it's your job to add it as per the application specifications. Ultrathink.
3. When you discover issues, immediately update @IMPLEMENTATION_PLAN.md with your findings using a subagent. When resolved, update and remove the item.
4. When the tests pass, update @IMPLEMENTATION_PLAN.md, then `git add -A` then `git commit` with a message describing the changes.
4a. Before ending the iteration, verify that the repository now contains exactly one new commit created by this iteration. If commit creation fails or no commit exists yet, the iteration is incomplete and must not be treated as success.

5. If tests or build FAIL: enter the self-heal cycle. DO NOT exit the iteration immediately.
   5a. Capture diagnostic context: error output (stdout+stderr), exit code, `git diff HEAD`, and run each context hook from AGENTS.md `## Self-Heal Configuration`. Validate each hook produced non-empty output (F001 defense).
   5b. Check failure catalog for a known pattern match: first project-local (`failures/index.json`), then global (path from AGENTS.md `global-catalog-path`). Match on error category + message substring.
   5c. If match found with documented fix procedure: apply it. If no match: diagnose from evidence using an Opus subagent. Require cited evidence for every claim in the diagnosis — no "it seems like" or "probably."
   5d. Classify severity: **auto** (deterministic fix, high confidence) / **assisted** (clear diagnosis but ambiguous fix — note for human) / **human** (cannot determine root cause or fix requires domain knowledge — escalate). If confidence is low, override auto → assisted.
   5e. For auto: apply fix using 1 subagent, then YOU re-run the failing test (the fixing subagent MUST NOT verify its own work). Check for heal recursion: if this is the 2nd+ heal cycle and it touches the same files as a prior cycle, STOP and escalate.
   5f. If fix works: append to @HEAL_LOG.md (append-only, never edit existing entries), update failure catalog if new pattern, continue to step 4 (commit). Note self-healed failures in the commit message.
   5g. If fix fails: increment retry counter. If retries remaining (max from AGENTS.md `retry-budget`, default 3) and cost ceiling not exceeded: loop back to 5c with updated context including what was tried. If budget exhausted or cost exceeded: append to @HEAL_LOG.md, write escalation to @ESCALATIONS.md (all 6 fields: summary, tier, context, attempts, hypothesis, suggested action), mark task "blocked: pending human input" in @IMPLEMENTATION_PLAN.md, pick a different task or exit.
   5h. Self-heal MUST NOT modify test expectations to make tests pass (F020 defense). If diagnosis says the test is wrong, classify as "assisted."
   Self-heal canonical reference: specs/self-heal.md (or skill reference). This prompt section is a compressed derivative — the spec wins on any conflict.

99999. Important: When authoring documentation, capture the why — tests and implementation importance.
999999. Important: Single sources of truth, no migrations/adapters. If tests unrelated to your work fail, resolve them as part of the increment.
9999999. Do not create git tags or push changes unless the human explicitly asks.
99999999. You may add extra logging if required to debug issues.
999999999. Keep @IMPLEMENTATION_PLAN.md current with learnings using a subagent — future work depends on this to avoid duplicating efforts. Update especially after finishing your turn.
9999999999. When you learn something new about how to run the application, update @AGENTS.md using a subagent but keep it brief. For example if you run commands multiple times before learning the correct command then that file should be updated.
99999999999. For any bugs you notice, resolve them or document them in @IMPLEMENTATION_PLAN.md using a subagent even if it is unrelated to the current piece of work.
999999999999. Implement functionality completely. Placeholders and stubs waste efforts and time redoing the same work.
9999999999999. When @IMPLEMENTATION_PLAN.md becomes large periodically clean out the items that are completed from the file using a subagent.
99999999999999. If you find inconsistencies in the specs/* then use an Opus 4.5 subagent with 'ultrathink' requested to update the specs.
999999999999999. IMPORTANT: Keep @AGENTS.md operational only — status updates and progress notes belong in `IMPLEMENTATION_PLAN.md`. A bloated AGENTS.md pollutes every future loop's context.
