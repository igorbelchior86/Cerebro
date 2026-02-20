---
name: workflow-orchestrator
description: >
  Apply structured workflow orchestration to any non-trivial task. Enforces plan-first
  execution, subagent delegation, self-improvement loops, and verification-before-done.
  Use when the user has a complex task (3+ steps), a bug to fix, or a project to build.
---

# Workflow Orchestrator Skill

This skill enforces a disciplined engineering workflow for tackling non-trivial tasks.
It prevents ad-hoc, sloppy, or incomplete execution by following structured protocols.

---

## When to Apply This Skill

Activate this skill when the task:
- Requires **3 or more steps** or involves architectural decisions
- Is a **bug fix** (requires root-cause analysis)
- Is a **new feature** or project
- Has **ambiguous requirements** that need clarification upfront
- Is any task where the user says "plan first", "don't rush", or "think carefully"

For simple, obvious, single-step tasks — skip the overhead and just do it.

---

## Core Principles

| Principle | Rule |
|-----------|------|
| **Simplicity First** | Make every change as minimal as possible. Touch only what's necessary. |
| **No Laziness** | Find root causes. No temporary fixes. Senior developer standards. |
| **Minimal Impact** | Changes should avoid side effects. Don't introduce new bugs. |
| **Elegant Solutions** | For non-trivial changes, pause and ask: "Is there a more elegant way?" |

---

## Phase 1: Plan Mode

**Always enter Plan Mode before implementing any non-trivial task.**

### Steps

1. **Write the plan** to `tasks/todo.md` with checkable items:
   ```markdown
   # Task: [short description]

   ## Plan
   - [ ] Step 1: ...
   - [ ] Step 2: ...
   - [ ] Step 3: ...

   ## Open Questions
   - ...

   ## Review
   (fill in after completion)
   ```

2. **Write detailed specs upfront** — reduce ambiguity before writing a single line of code.

3. **Check in with the user** before starting implementation if the plan has significant assumptions.

4. **If something goes sideways during execution**, STOP immediately. Don't keep pushing. Re-enter Plan Mode and update `tasks/todo.md`.

### Plan Mode Triggers

Use Plan Mode for:
- Initial task setup
- Verification steps (not just building)
- Recovering from errors or unexpected behavior
- Any architectural decision

---

## Phase 2: Subagent Strategy

**Use subagents liberally to keep the main context clean.**

### When to Spawn Subagents

| Scenario | Action |
|----------|--------|
| Research or exploration | Offload to a subagent |
| Parallel analysis | Spawn multiple subagents simultaneously |
| Complex sub-problems | One task per subagent |
| Large file analysis | Subagent to prevent context overflow |

### Subagent Rules

- **One task per subagent** — focused execution, clean context
- **Spawn parallel subagents** for independent work in the same turn
- **For very complex problems**: throw more compute at it via multiple subagents
- **Always include** relevant context and the reference files the subagent needs

### Subagent Prompt Template

```
You are a [role] subagent. Your task:

[description]

Input files/context:
- [file or data]

Your output should be:
- [expected output]

Do not ask for clarification. Complete the task autonomously.
```

---

## Phase 3: Self-Improvement Loop

**After ANY correction from the user, capture the lesson.**

### Lesson Capture Protocol

1. After a user correction, immediately update `tasks/lessons.md`:
   ```markdown
   ## Lesson: [date]
   **Mistake**: [what went wrong]
   **Root cause**: [why it happened]
   **Rule**: [a specific rule to prevent recurrence]
   **Pattern**: [code/behavior pattern to watch for]
   ```

2. At the start of each session, **review `tasks/lessons.md`** for patterns relevant to the current project.

3. **Ruthlessly iterate** on these lessons until the mistake rate drops.

### Common Lesson Categories

- Incorrect assumptions about file structure
- Missing edge cases in logic
- Over-engineering simple solutions
- Failing to verify before declaring done
- Unclear requirements causing rework

---

## Phase 4: Task Tracking

**Track progress explicitly throughout execution.**

### Task Lifecycle

```
pending → planning → implementing → reviewing → verifying → completed
```

### todo.md Format

```markdown
# Task: [name]
**Status**: implementing
**Started**: [timestamp]

## Plan
- [x] Step 1: Analyze existing code ✓
- [ ] Step 2: Implement fix
- [ ] Step 3: Verify behavior

## Progress Notes
- Step 1 complete: found issue in auth.py line 42

## Review
(filled after completion)
- What worked:
- What was tricky:
- Time taken:
```

### Update Rules

- Mark items `[x]` as they complete
- Add progress notes inline
- Fill the Review section before marking done
- Never skip the Review section

---

## Phase 5: Verification Before Done

**Never mark a task complete without proving it works.**

### Verification Checklist

Before declaring any task complete:

```
[ ] Run tests / check logs / demonstrate correctness
[ ] Diff behavior: expected vs actual
[ ] Ask: "Would a staff engineer approve this?"
[ ] If a fix felt hacky: implement the elegant solution instead
[ ] Fill in the Review section of tasks/todo.md
```

### Bug Fix Verification Protocol

For bugs specifically:
1. **Reproduce** the bug before fixing
2. **Fix** the root cause (not a workaround)
3. **Verify** the bug no longer reproduces
4. **Check** for regressions in related behavior
5. **Document** the fix in `tasks/todo.md` Review section

### Feature Verification Protocol

For new features:
1. Test the **happy path**
2. Test **edge cases**
3. Test **error handling**
4. Confirm the implementation matches the spec from Phase 1

---

## Phase 6: Elegance Check

**For non-trivial changes, pause before submitting.**

Ask yourself:
- "Is there a more elegant way?"
- "If I knew everything I know now, would I design it differently?"
- "Am I adding complexity, or reducing it?"

If a fix feels hacky:
> "Knowing everything I know now, implement the elegant solution."

**Skip this for simple, obvious fixes.** Don't over-engineer.

---

## Autonomous Bug Fixing

When given a bug report:

1. **Don't ask for hand-holding.** Just fix it.
2. **Read the logs/errors/failing tests** — point at them explicitly
3. **Find the root cause** before touching code
4. **Fix it completely** — not a patch
5. **Verify the fix** before reporting back
6. Zero context-switching required from the user

---

## Output Format

When presenting results to the user:

```markdown
## ✅ Task Complete: [name]

**What I did**: [1-2 sentence summary]

**Changes**:
- `file.py`: [what changed and why]
- `tests/test_file.py`: [what changed and why]

**Verified**: [how you confirmed it works]

**Notes**: [anything worth knowing about the approach]
```

---

## File Structure Convention

```
tasks/
├── todo.md        # Current task plan + progress
└── lessons.md     # Running list of learned lessons
```

Always create these files at the start of any non-trivial task.

---

## Summary

```
ANY non-trivial task → Plan Mode → tasks/todo.md
↓
Spawn subagents for parallel/heavy work
↓
Track progress, mark items complete
↓
Verify before done (run tests, check behavior)
↓
Elegance check (is there a better way?)
↓
Fill Review section → Report to user
↓
If corrected → update tasks/lessons.md
```
