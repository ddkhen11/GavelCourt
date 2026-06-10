---
description: Run the verification gates for a given build phase (usage /phase-check 2)
argument-hint: "<phase number>"
---

Run the verification gates for **Phase $ARGUMENTS** as defined in `docs/BUILD_PLAN.md`.

1. Read the Phase $ARGUMENTS tasks and their `_gate:_` criteria from `docs/BUILD_PLAN.md`.
2. For each task, execute its gate (run the test, the grpcurl call, the import check, etc.).
3. Report a per-task PASS/FAIL table with the actual command output for any failure.
4. If a gate is a 🚦 human gate, do not attempt it yourself — state that it needs a human run and how to do it.
5. Do not mark anything `[x]` — just report status so the human can decide.
