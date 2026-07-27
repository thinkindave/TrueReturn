# TrueReturn — Claude Code Workflow

## Project overview
Single-file HTML/CSS/JS property investment calculator. All code lives in `index.html`. No build system, no npm, no framework.

## Mandatory change pipeline

This project follows the global pipeline in `~/.claude/CLAUDE.md`. Work is tracked in GitHub Issues via the **github-liaison** agent (labels: `status:todo` → `status:in-dev` → `status:in-review` → `status:po-review`).

**New features** run the full pipeline. **Bugs and small tasks** skip brainstorming and writing-plans and start at implementation.

```
Request received
      ↓
 github-liaison        — find/create tracking issue (status:todo)
      ↓
 [NEW FEATURES ONLY]
 superpowers:brainstorming      — Design Proposal
 github-liaison        — post Design Proposal as issue comment
 User approval         — approve design or give feedback
      ↓ (if approved)
 superpowers:writing-plans      — Implementation Plan
 github-liaison        — post plan summary, move to status:in-dev
      ↓
 [ALL TASKS]
 superpowers:subagent-driven-development  — execute plan task by task (TDD: failing test first)
      ↓
 code-reviewer         — audit quality & project standards
 github-liaison        — post review (move to status:in-review)
      ↓   (if NEEDS WORK → back to status:in-dev → fix → re-review)
 smoke-tester          — unit tests + structural checks
 github-liaison        — post smoke results
      ↓   (if FAIL → back to status:in-dev → fix → re-run from smoke-tester)
 ui-reviewer           — visual review (SKIP if no HTML/CSS changed)
 github-liaison        — post UI review
      ↓   (if NEEDS WORK → back to status:in-dev → fix → re-run from smoke-tester)
 github-liaison        — move to status:po-review, post final summary
 Browser gate          — tell user: "Ready to test. Let me know when confirmed."
 User approval         — confirms (or describes a bug)
      ↓ (if confirmed)
 superpowers:finishing-a-development-branch  — local merge (Option 1), clean up worktree
 github-liaison        — close issue with final summary
      ↓ (if bug found)
 github-liaison        — move back to status:in-dev; return to implementation
```

### Rules
- **Never commit or push without explicit user instruction.** Browser confirmation authorises a *local* merge only; pushing to a remote needs a separate explicit instruction.
- **Design Proposal must be explicitly approved** by the user before writing-plans or touching code.
- **code-reviewer BLOCKER** findings block smoke-tester. **smoke-tester FAIL** blocks ui-reviewer. **ui-reviewer BLOCKER** blocks PO Review.
- WARNING and NOTE findings are recorded in the issue but do not block the pipeline.
- **github-liaison runs after every stage** — the issue thread should be a complete history. Never skip it.
- **TDD is mandatory**: implementer subagents write a failing test before implementation code.

### Final summary to user
After all agents pass, present:
1. What changed (plain language, 2–4 bullet points)
2. Agent verdicts (one line each: APPROVED / PASS / any warnings)
3. Ask for explicit approval before closing the task

## Architecture quick-reference

- **Single file**: `index.html` — all HTML, CSS, JS in one file
- **Property inputs**: `data-field="fieldName"` — never `id=` on row inputs
- **Property results**: `data-result="key"` — written via `setResult()`
- **Breakdown/Projections**: fixed `id=` attributes, written via `getElementById()`
- **Critical rule**: `const stateDefaults` must be defined BEFORE any call to `calculate()` or `initPropertySelection()`
- **Event delegation**: all listeners on `.property-rows` are delegated from the container
- **Tests**: `tests/unit.js` — run with `node tests/unit.js`

## Agents reference

| Agent | File | Role |
|---|---|---|
| github-liaison | `~/.claude/agents/github-liaison.md` (global) | Creates/updates the tracking issue, posts stage comments, moves status labels |
| code-reviewer | `.claude/agents/code-reviewer.md` | Audits code quality |
| smoke-tester | `.claude/agents/smoke-tester.md` | Runs structural checks and unit tests |
| ui-reviewer | `.claude/agents/ui-reviewer.md` | Reviews visual correctness |

Design and implementation are handled by superpowers skills (`brainstorming`, `writing-plans`, `subagent-driven-development`, `finishing-a-development-branch`), not project agents. The Trello-era agents (`code-writer.md`, `ui-designer.md`, `unit-test-writer.md`) remain in `.claude/agents/` for reference but are superseded by those skills.
