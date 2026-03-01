______________________________________________________________________

## name: working-context description: Track active tasks and discovered issues per-branch, defer non-critical fixes without losing them

# Skill: Working Context Management

Persistent working context across conversations using `.copilot-tasks.md`.

______________________________________________________________________

## ⚠️ CRITICAL — This Gets Overlooked Every Time

### You MUST read `.copilot-tasks.md` at conversation start

Not optional. Not "when relevant." **Every single conversation.** Use `read_file`. Then acknowledge what you found:

- "Continuing: <active task>" if work in progress
- "You have N discovered issues" if deferred items exist
- "Ready for new work" if no active task

If the Active Task has a "Next step", verify it's still needed: "Last session, next step was X. Still needed?"

### Failure tracking does NOT persist in your memory

You will forget patterns after a few prompts. That is why the Failure Tracking table exists. **The table is the memory, not you.** When a failure occurs:

1. **Log to the table FIRST** — before fixing, before retrying, before anything
1. Then address the issue

If you fix first and log later, you will forget to log. This has happened repeatedly. The sequence is: recognize → log → fix.

### Staleness checks on read

When reading the file, also check:

| Condition                            | Action                                             |
| ------------------------------------ | -------------------------------------------------- |
| Failure Tracking count ≥ 3           | Promote to permanent docs NOW                      |
| Failure Tracking Last seen > 14 days | Offer to prune                                     |
| Discovered Issues > 5                | "You have N deferred issues. Prioritize or prune?" |
| Completed (Recent) > 5               | "Clean up completed tasks?"                        |
| General Backlog > 10                 | "Backlog is growing. Review?"                      |

______________________________________________________________________

## Activation Context

- **Starting a new conversation** (ALWAYS)
- Detecting an issue while working on something else
- Developer says "add to TODO", "fix later", "note that"
- Developer asks "what was I working on?" or "what issues?"
- Switching branches, completing tasks, conversation reset

______________________________________________________________________

## File Format

**File:** `.copilot-tasks.md` (repo root, gitignored, local only, never commit)

```markdown
# Copilot Working Context

## General
Items not tied to a specific branch:
- [ ] Feature idea or future work

### Discovered Issues
- [ ] `path/to/file.py:123` - issue found during other work

### Completed (Recent)
- [x] 2026-01-28: Completed task description

## Failure Tracking
| Pattern | Count | Last seen | Context | Fix when promoted |
| ------- | ----- | --------- | ------- | ----------------- |

---

## Branch: feature/some-feature

### Active Task
What you're currently working on

- Next step: Specific next action

### Deferred (Post-Merge)
- [ ] Issue deferred from PR review

### Completed
- [x] Step that was finished
```

**Key rules:**

- General section for backlog + discovered issues not tied to a branch
- Branch sections for branch-specific work only
- No "Current Branch" header — you know what branch you're on from git

______________________________________________________________________

## Updating Tasks

### Starting work

Set Active Task with description and first next step.

### Completing a step

Update "Next step" to the next action.

### Completing a task

Move to "Completed (Recent)" with date, set Active Task to "None — ready for new work". After 3+ completed items accumulate, offer cleanup.

______________________________________________________________________

## Discovering Issues During Work

1. **Assess**: Does it block the current Active Task?
1. **If blocking**: Explain why, ask before switching
1. **If non-blocking**: Ask — "I noticed X. Add to TODO or fix now?"
1. **Always ask** — never auto-switch without confirmation
1. Add to branch section or General > Discovered Issues as appropriate

______________________________________________________________________

## Branch Switching

1. Save current branch context (Active Task + new Discovered Issues)
1. Load context for new branch
1. Mention active task and issue count on the new branch

______________________________________________________________________

## PR Review Deferrals

When a review issue is valid but out of scope:

1. **In the PR**: Comment explaining deferral
1. **In `.copilot-tasks.md`**: Add to branch's `### Deferred (Post-Merge)`
1. **Do NOT resolve** unaddressed review threads

### After merge

1. Move deferred items to `## General > ### Discovered Issues` with `[from PR #N]` prefix
1. Remove the branch section

______________________________________________________________________

## Failure Tracking

### When to log

- A command/approach failed due to a pattern (not a typo)
- **User corrects you** for a behavioral pattern — highest-signal failure

### Logging sequence (NON-NEGOTIABLE)

1. Recognize failure
1. **Log to table NOW** — update `.copilot-tasks.md`
1. THEN fix/retry

### Before logging

Check if pattern is already documented in `*.instructions.md` or relevant skill. If found, don't duplicate — it's already promoted.

### Table format

```markdown
| Pattern | Count | Last seen | Context | Fix when promoted |
| ------- | ----- | --------- | ------- | ----------------- |
| shell-escaping | 2 | 2026-02-02 | PowerShell quotes | Use --body-file |
```

One row per pattern. Increment count on recurrence. Update Last seen.

### Promotion (count = 3)

1. Document fix in appropriate file (`*.instructions.md`, skill, or `copilot-references.md`)
1. Remove row from table
1. Announce: "Promoted [pattern] to [destination] after 3 occurrences"

### Pruning

User-triggered only ("prune failures" / "reset failure tracking"):

- **Prune**: Remove rows older than 7 days
- **Reset**: Clear all rows

______________________________________________________________________

## Conversation Reset & Context Window

Before summarization, ensure `.copilot-tasks.md` has:

- Current Active Task and next step
- All Discovered Issues
- Updated Failure Tracking

The file persists — context is not lost.

### Minimize context window usage

`.copilot-tasks.md` is read at conversation start, consuming context window space. Keep it lean:

- **Completed items**: Prune after acknowledging (keep last 3-5 max)
- **Branch sections**: Delete after merge — stale branches waste tokens every conversation
- **Failure Tracking**: Promote at count 3, prune stale rows — don't let the table grow unbounded
- **Discovered Issues**: If >5, prompt user to prioritize or prune

The file should rarely exceed ~100 lines. If it does, it needs cleanup before adding more.

______________________________________________________________________

## Multi-repo work

When working across multiple repositories (e.g., skane-trails-checker, meal-planner):

- Each repo has its own `.copilot-tasks.md`
- Copilot does not have cross-repo visibility of task files
- If developer mentions work affecting another repo, note it with a repo prefix:
  ```markdown
  - [ ] [meal-planner] Sync copilot-instructions changes
  ```
- These serve as reminders to address when switching to that repo

______________________________________________________________________

## File Management

- **Create immediately** when this skill activates and file doesn't exist — don't ask
- **Ensure `.gitignore`** includes `.copilot-tasks.md`
- **Clean up** branch sections for deleted branches when user asks
