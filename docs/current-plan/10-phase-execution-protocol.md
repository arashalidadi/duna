# 10 Phase Execution Protocol

## 1. Decision-maker workflow

1. Decision-maker selects the next phase or task from `09-final-implementation-roadmap.md`.
2. Decision-maker writes a precise English implementation prompt.
3. A Hermes/OpenCode execution session performs the code, schema, migration, and test work.
4. The execution session writes an implementation log into `docs/current-plan/implementation-log/`.
5. Decision-maker reads the log.
6. Decision-maker validates completion against acceptance criteria.
7. Decision-maker updates `11-implementation-state.md`.
8. Decision-maker writes the next prompt.

## 2. Implementation log structure

Each executed task gets a file in `docs/current-plan/implementation-log/`.

Log file name pattern: `YYYY-MM-DD-task-slug.md`.

Log contents:
- Task ID.
- Phase.
- Objective.
- Prompt reference.
- Files changed.
- Database changes.
- Migrations.
- Tests.
- Validation steps.
- Unresolved issues.
- Known deviations.
- Final status.

## 3. Completion rules

- A task is complete only when its log records evidence for each acceptance criterion.
- If a criterion is not met, the task is not complete and the log must say so.
- The decision-maker does not need to manually copy results back; the log is the source.

### 3.1 Mandatory UI/runtime acceptance gate (user-visible phases)

At the end of each completed implementation phase/sub-phase whose work has a user-visible
frontend/UI component, a real runtime/UI verification is REQUIRED before the decision-maker
approves the phase as COMPLETE and moves to the next task. This gate is an ADDITIONAL final
acceptance checkpoint; it does not replace tests, typecheck, lint, migration verification,
API checks, repository inspection, or implementation-log review — all of those remain
mandatory independently.

Where applicable, the verification confirms:

- the application actually starts and the relevant page is reachable;
- the new feature is visible in the intended navigation/location;
- the main user workflow for the completed task works in the UI;
- create/edit/list/detail/filter or other relevant interactions work as applicable;
- no obvious runtime, rendering, console, API-integration, permission, or form-validation
  errors affect the completed feature;
- the UI behavior matches the authoritative plan and acceptance criteria.

Rules:

- A user-visible phase must NOT be marked COMPLETE until both the technical verification
  AND the UI/runtime verification are satisfied.
- If UI verification is genuinely not applicable to a task (e.g. pure backend/schema work),
  the decision-maker explicitly records "UI verification: NOT APPLICABLE" with the reason,
  rather than inventing a check.
- If UI verification reveals a problem, classify it (bug / deviation / acceptance-criterion
  failure), then either instruct the execution session to fix it (RESUME_HERMES) or return
  a BLOCKER / NEEDS_BUSINESS_DECISION state per the existing workflow.
- The outcome of the UI verification (pass/fail/NA + evidence) is recorded in the
  implementation log and in `11-implementation-state.md`.

## 4. Safety rules

- Read-only inspection before risky changes.
- Backup before risky repair.
- No destructive commands without authorization.
- No blind migration push.
- No invented historical data.
- Migration review before application.
- Post-migration verification.
- Rollback awareness.

## 5. Authority during execution

- The execution session follows the prompt and the locked technical decisions.
- If a conflict with locked decisions is found, the session records it and stops for decision-maker review.
- If a conflict with employer evidence is found, the session records it and stops for decision-maker review.

## 6. Communication boundary

- The decision-maker communicates by writing the next prompt and reading logs.
- The execution session communicates by writing logs and asking only when blocked.
- Neither side invents business rules.
