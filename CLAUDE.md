# TrueReturn — Claude Code Workflow

## Project overview
Single-file HTML/CSS/JS property investment calculator. All code lives in `index.html`. No build system, no npm, no framework.

## Mandatory change pipeline

Every requested change **must** pass through all applicable agents in order before being presented to the user for approval. Do not skip steps or combine them.

**Feature cards** (labelled "feature" in Trello) run the extended pipeline below. All other cards skip the ui-designer steps.

```
Request received
      ↓
 trello-liaison     — creates card in To Do (if new) or confirms existing card
      ↓
 [FEATURE CARDS ONLY]
 ui-designer        — reviews requirements, produces Design Proposal
 trello-liaison     — posts Design Proposal comment
 User approval      — approves design or provides feedback
      ↓ (if approved)
 ui-designer        — produces Implementation Spec for code-writer
 trello-liaison     — posts Implementation Spec comment, moves card to In Development
      ↓
 [ALL CARDS]
 code-writer        — implements the change (guided by Implementation Spec for features)
 trello-liaison     — moves card to In Development, posts summary comment
      ↓
 unit-test-writer   — writes/updates tests for any new pure functions
 trello-liaison     — posts test summary comment
      ↓
 code-reviewer      — audits for correctness, standards, efficiency
 trello-liaison     — posts full review report comment
      ↓   (if NEEDS WORK → trello-liaison moves back to In Development → code-writer)
 trello-liaison     — moves card to In Review
      ↓
 smoke-tester       — runs structural checks and unit tests
 trello-liaison     — posts smoke test results comment
      ↓   (if FAIL → trello-liaison moves back to In Development → code-writer)
 ui-reviewer        — reviews visual changes (skip if no HTML/CSS changed)
 trello-liaison     — posts UI review comment
      ↓   (if NEEDS WORK → trello-liaison moves back to In Development → code-writer)
 trello-liaison     — moves card to PO Review, posts final summary
 User approval      — user reviews in Trello and approves or provides feedback
```

### Rules
- **Never commit or push** without explicit user instruction.
- **ui-designer Design Proposal** must be explicitly approved by the user before the Implementation Spec is written or any code is touched.
- **code-reviewer BLOCKER** findings must be resolved before proceeding to smoke-tester.
- **smoke-tester FAIL** must be resolved before proceeding to ui-reviewer.
- **ui-reviewer BLOCKER** findings must be resolved before moving to PO Review.
- WARNING and NOTE findings from any agent should be included in Trello comments but do not block the pipeline.
- If any agent sends work back to code-writer, run the full pipeline again from code-writer forward.
- The trello-liaison always runs after each agent — never skip it.

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
| trello-liaison | `.claude/agents/trello-liaison.md` | Creates/moves cards, posts comments |
| ui-designer | `.claude/agents/ui-designer.md` | Design proposal + implementation spec (feature cards only) |
| code-writer | `.claude/agents/code-writer.md` | Implements changes |
| unit-test-writer | `.claude/agents/unit-test-writer.md` | Writes unit tests |
| code-reviewer | `.claude/agents/code-reviewer.md` | Audits code quality |
| smoke-tester | `.claude/agents/smoke-tester.md` | Runs structural checks |
| ui-reviewer | `.claude/agents/ui-reviewer.md` | Reviews visual correctness |
