---
name: workflow-orchestration
description: Orchestrates development workflow with plan-first execution, subagent use, verification before done, and lessons capture. Use for non-trivial tasks, multi-step work, bug fixes, or when the user expects planned execution and proof of correctness.
---

# Workflow Orchestration

Apply this skill for any non-trivial task: 3+ steps, architectural decisions, or verification-heavy work. For simple, obvious fixes, follow only Core Principles; skip full orchestration.

## Workflow Orchestration

### 1. Plan Mode Default

- **When**: Non-trivial tasks (3+ steps or architectural decisions). Include verification in the plan, not only building.
- **Action**: Write a detailed spec/plan upfront to reduce ambiguity.
- **If it goes sideways**: STOP and re-plan. Do not push forward without a revised plan.

### 2. Subagent Strategy

- Use subagents liberally to keep the main context clean.
- Offload: research, exploration, parallel analysis.
- For hard problems: throw more compute at it via subagents.
- One task per subagent; keep delegation focused.

### 3. Self-Improvement Loop

- After **any** user correction: update `tasks/lessons.md` with a concrete pattern.
- Write rules that prevent the same mistake; iterate until mistake rate drops.
- At session start for this project: review `tasks/lessons.md` when relevant.

### 4. Verification Before Done

- Never mark a task complete without **proving it works**.
- When relevant: diff behavior between `main` and current changes.
- Ask: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness.

### 5. Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: commit to implementing the elegant solution with current knowledge.
- Skip for simple, obvious fixes to avoid over-engineering.
- Challenge your own work before presenting it.

### 6. Autonomous Bug Fixing

- On bug report: fix it. Do not ask for hand-holding.
- Use logs, errors, and failing tests to resolve.
- Aim for zero context switching from the user.
- Fix failing CI tests without being told how.

---

## Task Management

Use the repo task files for planned work:

1. **Plan first**: Write plan to `tasks/todo.md` with checkable items.
2. **Verify plan**: Check in before starting implementation.
3. **Track progress**: Mark items complete as you go.
4. **Explain changes**: High-level summary at each step.
5. **Document results**: Add review section to `tasks/todo.md`.
6. **Capture lessons**: Update `tasks/lessons.md` after user corrections.

---

## Core Principles

- **Simplicity first**: Make every change as simple as possible. Impact minimal code.
- **No laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal impact**: Only touch what’s necessary. Avoid introducing bugs.
