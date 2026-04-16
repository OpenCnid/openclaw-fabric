## Summary

Describe the change in 2–5 bullets:

- Problem:
- Why it matters:
- What changed:
- What did NOT change (scope boundary):

## Change Type

- [ ] Boundary/design docs
- [ ] Validation / evidence
- [ ] Wrapper sketch / implementation
- [ ] Schema / contract
- [ ] CI / repo workflow
- [ ] Chore

## Boundary Check

Confirm the PR still respects the core lane boundaries:

- [ ] OpenClaw still owns workflow, routing, retries, and follow-up decisions
- [ ] OMO still executes one bounded task at a time
- [ ] Sable/provider code still stays generic and free of worker lifecycle semantics
- [ ] No new OMC/OMX/generalized multi-lane abstraction was introduced without explicit need

## Validation / Evidence

- Validation run:
  - [ ] `bash scripts/validate.sh`
  - [ ] Not run (explain why)
- Live evidence updated?
  - [ ] Yes
  - [ ] No
- If yes, evidence path:

## User-visible / Behavior Changes

If none, write `None`.

## Risks and Mitigations

- Risk:
  - Mitigation:

## Follow-up

- Smallest next step:
- Explicitly out of scope:
