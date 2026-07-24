# Quarantined Losses Redesign Implementation Plan (issue #6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the heavy bespoke quarantine module with the annual **cost** shown on the tax-benefit line and the **recovery** shown as one row per period in the projections grid, per `docs/superpowers/specs/2026-07-24-quarantined-losses-redesign.md`.

**Architecture:** Presentation-only change inside `index.html`. The engine is untouched — all figures come from existing calls (`quarantinePoolAtYear`, `calcReformSale`, `saleOutcome.detail.strandedPool`). Work is additive first (note → row → stranded note), then the old module is deleted, so nothing is broken mid-plan.

**Tech Stack:** Vanilla JS single-file app, no build. Tests: `node <abs>/tests/unit.js`, `node <abs>/tests/engine.test.js`, `node <abs>/.claude/smoke-test.js`.

**Tracking:** GitHub issue #6, branch `feature/reform-ui-wiring` (worktree `/Users/thinkindave/Claude/TrueReturn/.claude/worktrees/reform-ui-wiring`). Never push.

---

## COMMAND STYLE — MANDATORY

**Never change directory.** Not `cd X && cmd`, not `cd X` + newline + cmd, not a standalone `cd` — the shell cwd does NOT persist between Bash calls, and any directory change before git triggers a permission prompt for the user. Use:

- git → `git -C /Users/thinkindave/Claude/TrueReturn/.claude/worktrees/reform-ui-wiring <subcommand>`
- tests → absolute paths:
  - `node /Users/thinkindave/Claude/TrueReturn/.claude/worktrees/reform-ui-wiring/tests/unit.js`
  - `node /Users/thinkindave/Claude/TrueReturn/.claude/worktrees/reform-ui-wiring/tests/engine.test.js`
  - `node /Users/thinkindave/Claude/TrueReturn/.claude/worktrees/reform-ui-wiring/.claude/smoke-test.js`
- reading → the Read tool, or `grep <pattern> <absolute-path>`

Never pipe an allowlisted command through `tail`/`head` (breaks allowlist matching).

**Screenshots return black frames in this environment.** Verify via `javascript_tool` / `get_page_text` DOM reads. Preview: `preview_start` name `truereturn-worktree`, port 8471 (it dies periodically — restart if navigation fails).

---

## Domain primer

Under the 2026–27 reform, an **established** property's rental losses in income years starting on/after 1 July 2027 no longer reduce salary tax. They accumulate in a **quarantine pool** that offsets the capital gain at sale. New builds are exempt (no pool). Because the UI always supplies `contractDate = today`, every established property quarantines.

Three states the tax-benefit line must express, all already computed correctly:

| Snapshot year | Value | Meaning |
|---|---|---|
| 1 (FY2026-27) | real figure, e.g. $7,619/yr | Quarantine hasn't started |
| 2–5 | `$0/yr` | Quarantined — this is the cost |
| ~10 | negative, e.g. −$272/yr | Property turned profitable; tax payable |

**The non-negotiable constraint (spec §3):** the pool row is only honest because the cost sits on the tax-benefit line. Shown alone, the pool makes the reform look like a *benefit* (quarantine lowers CGT). If Task 1's note is ever removed, the Task 2 row must be removed with it.

## Key code anchors (verified 2026-07-24; line numbers drift as you edit — locate by the quoted code)

- Tax-benefit section: `index.html:3097` `<div class="proj-section proj-section--tax">`, header button `:3098`, `#resTaxBenefit` at `:3103`, `.proj-section-body` at `:3108`.
- Tax-benefit JS + existing quarantine snapshot override: `index.html:4793–4820`.
- Quarantine module markup: `index.html:3161–3220` (`#quarantineSection`).
- Quarantine module JS: `index.html:5111–5220` (starts `const quarantineSectionEl = ...`).
- Projections loop: builds `saleArgs` at `index.html:4908`, `saleOutcome` at `:4919`, per-period `prefix` (`proj5`/`proj10`/`projLife`) and `years` (5/10/15).
- Per-period Sale section CGT line: `index.html:3329–3333` (`proj5CGT`), and the equivalent blocks for `proj10` and `projLife`. The new row goes **immediately after** the CGT `.line-item` in each of the three columns.
- `quarantinePoolAtYear(y)` defined at `index.html:4679` (in `calculate()` scope).
- `ngQuarantined` boolean is in scope in `calculate()`.

---

## File structure

- **Modify `index.html`** — all six tasks. No new files; this is a presentation change to a single-file app.
- **Modify `.claude/smoke-test.js`** — required-ids list: add the new ids, drop the deleted ones.

No engine or test-file changes are required by the design; Task 6 adds structural gates only.

---

### Task 1: Move the cost note onto the tax-benefit line

**Files:**
- Modify: `index.html` (markup after `:3107`; JS at `:4799–4820`)

- [ ] **Step 1: Add the note element**

In the tax-benefit section, insert a sibling **between** the `</button>` that closes `.proj-section-header` and the `<div class="proj-section-body" hidden>` — so it is visible without expanding the section. This mirrors how `#resQuarantineNet` was placed:

```html
        <p class="section-note" id="resTaxBenefitNote" hidden></p>
```

- [ ] **Step 2: Rewire the JS to write to it**

Replace the block at `index.html:4799–4820` (currently writing to `quarantineNoteEl` / `#resQuarantineNote`) with:

```js
      // ── NG quarantine — snapshot override (spec §4a / redesign §2.1) ──
      // If this snapshot year falls in the quarantine era and is a loss
      // year, the old refund no longer applies — show $0 and explain why,
      // ADJACENT to the figure. This note is the only place the annual cost
      // of quarantine is stated; the projections pool row is only honest
      // while it exists (redesign spec §3).
      const snQuarantineRow = quarantineSched.rows[snapshotYear - 1];
      const snIsQuarantinedLossYear = !!(ngQuarantined && snQuarantineRow
        && snQuarantineRow.fyStartISO >= BOUNDARY_ISO && snNetRentalPosition < 0);
      const tbNoteEl = document.getElementById('resTaxBenefitNote');
      if (snIsQuarantinedLossYear) {
        if (tbEl) {
          tbEl.textContent = formatCurrency(0) + '/yr';
          tbEl.className = 'proj-highlight-value';
        }
        if (tbNoteEl) {
          const snLoss = Math.abs(snNetRentalPosition);
          tbNoteEl.textContent = 'Quarantined: under the old rules this would have been about ' +
            formatCurrency(snLoss * marginalTaxRate) +
            ' back. It\'s added to your quarantined losses instead, claimable at sale.';
          tbNoteEl.hidden = false;
        }
      } else if (tbNoteEl) {
        tbNoteEl.textContent = '';
        tbNoteEl.hidden = true;
      }
```

Leave `#resQuarantineNote` and its element alone for now — Task 4 deletes the whole module. Verify no other code writes to `#resQuarantineNote` (`grep 'resQuarantineNote' <abs path>` should now show only the markup at `:3183`).

- [ ] **Step 3: Verify**

Run: `node /Users/thinkindave/Claude/TrueReturn/.claude/worktrees/reform-ui-wiring/.claude/smoke-test.js`
Expected: PASS (8/8).

Browser (DOM reads, clear localStorage): with Age/type = "Established, 10–20 years", step the snapshot-year selector:
- Year 1 → `#resTaxBenefit` shows a real figure, `#resTaxBenefitNote` is `hidden`.
- Year 3 → `#resTaxBenefit` is `$0/yr`, `#resTaxBenefitNote` visible reading "Quarantined: under the old rules this would have been about $X back. It's added to your quarantined losses instead, claimable at sale."
- Year 10 (profitable) → negative figure, note `hidden`.
Confirm the note is visible **without** expanding any section (check `offsetHeight > 0` while `.proj-section-body` remains `hidden`).

- [ ] **Step 4: Commit**

```bash
git -C /Users/thinkindave/Claude/TrueReturn/.claude/worktrees/reform-ui-wiring add -A
git -C /Users/thinkindave/Claude/TrueReturn/.claude/worktrees/reform-ui-wiring commit -m "feat: move the quarantine cost note onto the tax-benefit line (#6, redesign §2.1)"
```

---

### Task 2: Add the "Quarantined losses" row to each period column

**Files:**
- Modify: `index.html` (markup in three places, after each period's CGT `.line-item`; JS in the projections loop)

- [ ] **Step 1: Add the row markup to all three period columns**

Immediately after the CGT `.line-item` in the **proj5** Sale section (the block ending `<span class="line-value" id="proj5CGT">-</span></div>`), insert:

```html
              <div class="line-item" id="proj5QuarantinedRow" hidden>
                <span class="line-label">Quarantined Losses <span class="help-tip" id="proj5QuarantinedTip" data-tip="">?</span></span>
                <span class="line-value" id="proj5Quarantined">-</span>
              </div>
              <p class="section-note" id="proj5StrandedNote" hidden></p>
```

Repeat identically for **proj10** and **projLife**, replacing the `proj5` prefix in all four ids (`proj10QuarantinedRow`, `proj10QuarantinedTip`, `proj10Quarantined`, `proj10StrandedNote`; and `projLifeQuarantinedRow`, `projLifeQuarantinedTip`, `projLifeQuarantined`, `projLifeStrandedNote`).

- [ ] **Step 2: Populate them in the projections loop**

In the projections loop, immediately after `const { salesCosts, netProceeds, cgt, trueCashReturn } = saleOutcome;` (currently `index.html:4920`), insert:

```js
        // ── Quarantined losses (redesign §2.2) ──
        // The pool accumulated to this period's sale year. Already net of
        // absorption by profitable rental years, so no itemisation needed.
        // Shown only when quarantine actually applies and a pool exists —
        // gate on the arithmetic, not the dwelling type.
        const periodPool = quarantinePoolAtYear(years);
        const quarRowEl = document.getElementById(`${prefix}QuarantinedRow`);
        const quarValEl = document.getElementById(`${prefix}Quarantined`);
        const quarTipEl = document.getElementById(`${prefix}QuarantinedTip`);
        const showQuar = ngQuarantined && periodPool > 0;
        if (quarRowEl) quarRowEl.hidden = !showQuar;
        if (showQuar) {
          if (quarValEl) quarValEl.textContent = formatCurrency(periodPool);
          // Measure what the pool is actually worth at this sale, rather
          // than estimating: re-run the identical sale with no pool and
          // difference the CGT.
          const noPoolOutcome = calcReformSale(Object.assign({}, saleArgs, { quarantinePool: 0 }));
          const poolWorth = Math.max(0, noPoolOutcome.cgt - cgt);
          if (quarTipEl) {
            quarTipEl.setAttribute('data-tip',
              'Rental losses that no longer reduce your salary tax. They build up and offset your capital gain when you sell — worth roughly ' +
              formatCurrency(poolWorth) + ' in tax at your marginal rate.');
          }
        }
```

- [ ] **Step 3: Verify**

Run: `node /Users/thinkindave/Claude/TrueReturn/.claude/worktrees/reform-ui-wiring/.claude/smoke-test.js`
Expected: PASS (8/8).

Browser (DOM reads, clear localStorage per scenario):
- Age/type = "Established, 10–20 years": all three rows visible with a **rising** pool across 5 → 10 → 15 years. Report the three figures and the 15yr tip text.
- Age/type = "New build": all three rows `hidden` (new builds are NG-exempt, so `ngQuarantined` is false).
- Confirm the 15yr row value equals the figure the old module showed in its header (`$31,958` on the untouched default) — this is a like-for-like check that the row reads the same source.

- [ ] **Step 4: Commit**

```bash
git -C /Users/thinkindave/Claude/TrueReturn/.claude/worktrees/reform-ui-wiring add -A
git -C /Users/thinkindave/Claude/TrueReturn/.claude/worktrees/reform-ui-wiring commit -m "feat: quarantined-losses row per projection period with measured tax-value tip (#6, redesign §2.2)"
```

---

### Task 3: Per-period stranded-losses note

**Files:**
- Modify: `index.html` (JS in the projections loop, inside the `showQuar` branch added in Task 2)

- [ ] **Step 1: Populate the stranded note**

Inside the `if (showQuar) { ... }` block from Task 2, after the tip is set, append:

```js
          // Stranding is per-period (redesign §2.3): a property can strand at
          // 5 years and not at 15. Never silently absorb it.
          const strandedEl = document.getElementById(`${prefix}StrandedNote`);
          const strandedAmt = (saleOutcome.detail && saleOutcome.detail.strandedPool) || 0;
          if (strandedEl) {
            if (strandedAmt > 0) {
              strandedEl.textContent = formatCurrency(strandedAmt) +
                ' of these would never be recovered — the sale gain isn\'t large enough to absorb them.';
              strandedEl.hidden = false;
            } else {
              strandedEl.textContent = '';
              strandedEl.hidden = true;
            }
          }
```

Also add, in the `else` path where the row is hidden (i.e. when `showQuar` is false), a reset so a stale note can't survive a change of inputs. Immediately after `if (quarRowEl) quarRowEl.hidden = !showQuar;` add:

```js
        if (!showQuar) {
          const staleStranded = document.getElementById(`${prefix}StrandedNote`);
          if (staleStranded) { staleStranded.textContent = ''; staleStranded.hidden = true; }
        }
```

- [ ] **Step 2: Verify**

Browser (DOM reads): find a case where the gain cannot absorb the pool — set Age/type = "Established, 10–20 years" and the growth field (`[data-field="expectedGrowth"]`) to a low or negative value such as `-2`. At least one period should show a non-zero stranded note; report which periods and their amounts. Then set growth back to `6` and confirm every stranded note returns to `hidden` with empty text (proves the reset works).

Run all three suites (absolute paths). Expected: engine 116, unit 199, smoke 8/8.

- [ ] **Step 3: Commit**

```bash
git -C /Users/thinkindave/Claude/TrueReturn/.claude/worktrees/reform-ui-wiring add -A
git -C /Users/thinkindave/Claude/TrueReturn/.claude/worktrees/reform-ui-wiring commit -m "feat: per-period stranded-losses note beneath the quarantined row (#6, redesign §2.3)"
```

---

### Task 4: Delete the old quarantine module

**Files:**
- Modify: `index.html` (markup `:3161–3220`; JS `:5111–5220`; CSS)

- [ ] **Step 1: Delete the markup**

Remove the entire `<div class="proj-section" id="quarantineSection" hidden>` block and everything inside it — the header highlights (`#resRefundsForegoneHeader`, `#resQuarantinePool`), `#resQuarantineNet`, `#resQuarantineNote`, the reconciliation `.line-item`s (`#resRefundsForegone`, `#resRecoveredAlongWay`, `#resPoolBenefit`, `#resQuarantinePoolLine`), `#resStrandedRow`/`#resStrandedLosses`, `#resQuarantineResidual` and its label/tip/value spans, and the explainer bullets.

- [ ] **Step 2: Delete the JS**

Remove the whole block starting `const quarantineSectionEl = document.getElementById('quarantineSection');` through the end of the quarantine-module rendering (the block that sets pool, refunds-foregone, recovered-along-the-way, pool benefit, stranded, residual and the net headline). **Keep** everything the new UI depends on:
- `quarantinePoolAtYear` and `quarantineSched` (used by Tasks 1–3 and the sale args)
- `ngQuarantined`
- `saleOutcome15` / `saleArgs15` **only if** still referenced elsewhere — `grep 'saleArgs15\|saleOutcome15' <abs path>` and delete them too if the quarantine block was their only consumer.

- [ ] **Step 3: Delete the dead CSS**

`grep -n 'quarantine' <abs path>` and remove rules that now match nothing (e.g. any `#quarantineSection`-scoped rules).

**Do NOT delete `.section-note` or `.proj-section > .section-note`.** These are the shared note styles used by `#resTaxBenefitNote` (Task 1) and the per-period stranded notes (Task 3). They were deliberately renamed away from `.quarantine-note` during Task 1's review precisely so this sweep wouldn't claim them — if they go, both notes silently lose their styling with every test still green. After the sweep, assert they survive:

```
grep -c 'section-note' <abs index.html path>
```
Expected: **non-zero** (at minimum the CSS rules plus the four note elements). If it returns 0, you deleted too much — restore them.

- [ ] **Step 4: Verify nothing dangles**

Run each of these greps against the absolute index.html path; each must return **zero** matches:
`resQuarantinePool`, `resRefundsForegone`, `resRecoveredAlongWay`, `resPoolBenefit`, `resStrandedLosses`, `resQuarantineResidual`, `resQuarantineNet`, `resQuarantineNote`, `quarantineSection`

Then run all three suites. Expected: engine 116, unit 199, smoke 8/8 — **unless** `.claude/smoke-test.js` still lists deleted ids as required, in which case it will FAIL; Task 5 fixes the gates, so if it fails here for that reason, note it and proceed to Task 5 rather than reverting.

Browser: confirm no `#quarantineSection` in the DOM, the tax-benefit note and the three period rows all still render, and there is no leftover empty container or gap where the module was.

- [ ] **Step 5: Commit**

```bash
git -C /Users/thinkindave/Claude/TrueReturn/.claude/worktrees/reform-ui-wiring add -A
git -C /Users/thinkindave/Claude/TrueReturn/.claude/worktrees/reform-ui-wiring commit -m "refactor: delete the bespoke quarantine module, superseded by the tax-benefit note and pool row (#6, redesign §2.4)"
```

---

### Task 5: Update structural gates and fix the stale CGT help-tip

**Files:**
- Modify: `.claude/smoke-test.js` (required-ids list)
- Modify: `index.html` (CGT help-tip copy, three occurrences)

- [ ] **Step 1: Update the smoke gates**

In `.claude/smoke-test.js`'s required-ids list: **remove** `quarantineSection`, `resQuarantinePool`, `resRefundsForegone`, `resRecoveredAlongWay`, `resPoolBenefit` and any other now-deleted quarantine ids present. **Add** `resTaxBenefitNote`, `proj5Quarantined`, `proj10Quarantined`, `projLifeQuarantined`. Verify each added id actually exists in `index.html` before adding it.

- [ ] **Step 2: Fix the stale CGT help-tip**

The CGT line's tip currently reads `"Capital Gains Tax estimated at 50% discount × your selected marginal tax rate."` — wrong since the reform wiring landed: an established property gets **no** 50% discount on the pre-2027 component (it is never held 12 months at 30 June 2027 given `contractDate` is today) and the post-2027 component is CPI-indexed and taxed at `max(marginal rate, 30%)`.

Replace the `data-tip` on all three CGT lines (`proj5CGT`, `proj10CGT`, `projLifeCGT`) with:

```
Capital gains tax under the 2027 rules: the gain to 30 June 2027 is taxed at your marginal rate, and the gain after that is CPI-indexed and taxed at your marginal rate or 30%, whichever is higher. New builds may instead take the 50% discount on the whole gain.
```

- [ ] **Step 3: Carry the cost note into the exports**

The CSV and PDF exports scrape `#resTaxBenefit`'s text (`index.html:~4156` and `~4279`), so an exported report shows `$0/yr` with no explanation — and once Task 2's pool row exists, an export could show the pool's upside without the cost. That breaks spec §3's constraint in the exported artefact.

In the CSV export row list, immediately after the `['  Est. Tax Benefit', g('resTaxBenefit')]` entry, add:

```js
            ['  ', g('resTaxBenefitNote')],
```

and add the equivalent line to the PDF summary builder alongside its `taxBenefit` field, so the note travels with the figure. If the note is empty (non-quarantined years) the row renders blank, which is correct.

- [ ] **Step 4: Verify**

Run all three suites (absolute paths). Expected: engine 116, unit 199, smoke **8/8**.

Browser: read the CGT `data-tip` attribute directly on all three periods and confirm the new text. Trigger a CSV export and confirm the note text appears beneath the tax-benefit figure when a quarantined year is selected.

- [ ] **Step 5: Commit**

```bash
git -C /Users/thinkindave/Claude/TrueReturn/.claude/worktrees/reform-ui-wiring add -A
git -C /Users/thinkindave/Claude/TrueReturn/.claude/worktrees/reform-ui-wiring commit -m "test: update structural gates; fix stale CGT help-tip; carry the cost note into exports (#6)"
```

---

### Task 6: Full verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Suites**

Run all three (absolute paths). Expected: engine **116**, unit **199**, smoke **8/8**.

- [ ] **Step 2: Scenario walkthrough (DOM reads, clear localStorage between each)**

1. **Established, 10–20 years, default growth:** three period rows visible with a rising pool; tax-benefit note appears at snapshot year 3 and is visible without expanding anything; no `#quarantineSection`.
2. **Snapshot-year sweep** (1 / 3 / 10): real figure + no note → `$0/yr` + note → negative figure + no note.
3. **New build:** all three rows hidden; no stranded notes; tax-benefit line behaves normally (new builds keep full negative gearing, so the note never fires).
4. **Low/negative growth** (`expectedGrowth` = `-2`) on an established property: at least one stranded note appears with a non-zero figure. Reset to `6` and confirm all stranded notes clear.
5. **Multi-property:** add a second property, set it to New build, switch between rows, and confirm the rows/notes update per selected property with no stale values.

- [ ] **Step 3: Console + integrity**

`read_console_messages` with `onlyErrors: true` → no errors. Confirm no `NaN`, `undefined` or `$-` in the projections panel text.

- [ ] **Step 4: Report** the figures from each scenario for the reviewer, then hand off to the pipeline (code-reviewer → smoke-tester → ui-reviewer → github-liaison).

---

## Self-review notes (spec coverage)

- §2.1 tax-benefit cost note, all three year states, adjacent placement → **Task 1**
- §2.2 pool row per period, pool-not-tax-value, measured tip, visibility gated on arithmetic → **Task 2**
- §2.3 per-period stranded note, only when > 0, with stale-reset → **Task 3**
- §2.4 delete the module and its ids/CSS/JS, keep the engine and the retained calculations → **Task 4**
- §3 the non-negotiable constraint → recorded in the Domain primer and in Task 1's code comment
- §5 structural gates → **Task 5**; browser verification → **Task 6**
- Adjacent fix not in the spec: the stale CGT help-tip (found while locating anchors; it is misinformation one line above the new row) → **Task 5 Step 2**

**Deliberately NOT in this plan:** any engine change; the reform banner (#10); the minimum-tax footnote (#11); help-tip keyboard accessibility (#12).

## After the plan

Pipeline: code-reviewer → smoke-tester → **ui-reviewer (required — markup and CSS changed)** → github-liaison posts each stage to issue #6 → PO browser gate.
