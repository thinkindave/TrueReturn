# ROE Leverage Line Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one always-visible line to the 15-year projection card explaining the gap between the assumed property growth rate and the return on the user's own cash, naming leverage as the cause.

**Architecture:** A new *additive* pure function `calcLeverageLine` in `engine.js` decides whether the line shows and returns its three figures. It **receives** the already-computed `annualisedReturn` rather than recomputing it, so the shipped "Annual Cash Return" figure cannot move. `index.html` renders the result into static markup via `textContent` only — no `innerHTML`, no new calculation in the view layer.

**Tech Stack:** Vanilla JS (no build step), `engine.js` CommonJS-and-browser dual export, `tests/unit.js` with the `tests/harness.js` micro-harness, `.claude/smoke-test.js` for structural checks.

**Spec:** `docs/superpowers/specs/2026-07-28-roe-leverage-line.md`. Tracking: issue #14.

**Deviation from spec §4, deliberate:** the spec said "no `engine.js` change". That is amended here to *one additive function*. Reason: `tests/unit.js` can only reach `engine.js` exports, so keeping the logic inline in `index.html` would make it untestable and break the project's mandatory-TDD rule. The amendment preserves the spec's actual risk constraint — nothing existing in `engine.js` is touched, and the shipped ROE computation at `index.html:5051` is not modified.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `engine.js` | Modify (~20 lines + 1 export) | `calcLeverageLine` — pure decision + figures. No existing function touched. |
| `tests/unit.js` | Modify (append section) | 8 unit tests for `calcLeverageLine`. |
| `index.html` | Modify (3 sites) | CSS rule, static markup in the 15-year card, render call in the projection loop. |
| `.claude/smoke-test.js` | Modify (2 sites) | Required-ID entry + a structural guard that ROE is not recomputed. |
| `specs/truereturn-ui-requirements.md` | Modify (§9, version header) | Bump to v2.7, rewrite §9 to match what ships. |

---

## Task 1: `calcLeverageLine` pure function

**Files:**
- Modify: `engine.js` (add function before the `module.exports` block at line 826; add to exports)
- Test: `tests/unit.js` (append new section at end of file, before the final `summary()` call)

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit.js`, immediately **before** the final `summary();` line. Also add `calcLeverageLine` to the `require('../engine.js')` destructure at the top of the file (line 6).

```js
// ---------------------------------------------------------------------------
// calcLeverageLine tests (UI spec §9 v2.7, issue #14)
// ---------------------------------------------------------------------------

console.log('\ncalcLeverageLine');

test('asset growth is the expectedGrowth input, not a derived figure', () => {
  const r = calcLeverageLine({
    purchasePrice: 520000, totalUpfront: 104000,
    expectedGrowth: 0.06, annualisedReturn: 11.7,
  });
  assert.strictEqual(r.show, true);
  approxEqual(r.assetGrowthPct, 6.0, 0.0001);
});

test('leverage multiple is 5.0x for 520k on 104k', () => {
  const r = calcLeverageLine({
    purchasePrice: 520000, totalUpfront: 104000,
    expectedGrowth: 0.06, annualisedReturn: 11.7,
  });
  approxEqual(r.leverageMultiple, 5.0, 0.001);
});

test('passes the supplied cash return through untouched', () => {
  const r = calcLeverageLine({
    purchasePrice: 520000, totalUpfront: 104000,
    expectedGrowth: 0.06, annualisedReturn: 11.7,
  });
  assert.strictEqual(r.cashReturnPct, 11.7);
});

test('declining property: both figures negative, cash falls further', () => {
  const r = calcLeverageLine({
    purchasePrice: 520000, totalUpfront: 104000,
    expectedGrowth: -0.016, annualisedReturn: -21.6,
  });
  assert.strictEqual(r.show, true);
  assert(r.assetGrowthPct < 0, 'asset growth should be negative');
  assert(r.cashReturnPct < r.assetGrowthPct, 'cash return should fall further than the asset');
});

test('zero growth still shows, with a negative cash return', () => {
  const r = calcLeverageLine({
    purchasePrice: 520000, totalUpfront: 104000,
    expectedGrowth: 0, annualisedReturn: -7.5,
  });
  assert.strictEqual(r.show, true);
  approxEqual(r.assetGrowthPct, 0, 0.0001);
  assert(r.cashReturnPct < 0);
});

test('hides when there is no leverage to explain (cash purchase)', () => {
  const r = calcLeverageLine({
    purchasePrice: 520000, totalUpfront: 545000,
    expectedGrowth: 0.06, annualisedReturn: 4.2,
  });
  assert.strictEqual(r.show, false);
});

test('hides when totalUpfront is zero or negative', () => {
  assert.strictEqual(calcLeverageLine({
    purchasePrice: 520000, totalUpfront: 0,
    expectedGrowth: 0.06, annualisedReturn: 11.7,
  }).show, false);
});

test('hides when purchasePrice is zero', () => {
  assert.strictEqual(calcLeverageLine({
    purchasePrice: 0, totalUpfront: 104000,
    expectedGrowth: 0.06, annualisedReturn: 11.7,
  }).show, false);
});
```

Update the require line at `tests/unit.js:6` to:

```js
const { formatCurrency, calcStampDuty, calcDepreciation, stateDefaults, calcLeverageLine } = require('../engine.js');
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node /Users/thinkindave/Claude/TrueReturn/tests/unit.js`
Expected: FAIL — 8 failures reading `calcLeverageLine is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Add to `engine.js` immediately before the `if (typeof module !== 'undefined' ...)` export block (currently line ~825):

```js
// ── Leverage line (UI spec §9 v2.7, issue #14) ───────────────────────────
// Presentation helper for the 15-year projection line. It does NOT compute
// return on cash — it RECEIVES the figure index.html already renders as
// "Annual Cash Return", so that shipped number cannot move (see the spec's
// principalRepaid warning). assetGrowthPct is the user's own expectedGrowth
// input: futureValue is purchasePrice * (1+expectedGrowth)^years, so the
// annualised asset growth is identically that input — deriving it would be a
// no-op round trip.
// Hidden when there is no leverage gap to explain: a cash purchase has
// totalUpfront >= purchasePrice, giving a multiple at or below 1.
function calcLeverageLine({ purchasePrice, totalUpfront, expectedGrowth,
                            annualisedReturn }) {
  if (!(purchasePrice > 0) || !(totalUpfront > 0)) return { show: false };
  const leverageMultiple = purchasePrice / totalUpfront;
  if (leverageMultiple < 1.05) return { show: false };
  return {
    show: true,
    assetGrowthPct: expectedGrowth * 100,
    cashReturnPct: annualisedReturn,
    leverageMultiple,
  };
}
```

Add `calcLeverageLine,` to the `module.exports` object (after `calcEquityReturns,` on line 837) and, if the file has a browser-global export block, to that too — check the tail of `engine.js` and match whatever pattern `calcEquityReturns` uses.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node /Users/thinkindave/Claude/TrueReturn/tests/unit.js`
Expected: PASS — all 8 new tests green, and the pre-existing count (199) unchanged.

- [ ] **Step 5: Commit**

```bash
git add engine.js tests/unit.js
git commit -m "feat: calcLeverageLine pure function with tests (#14)"
```

---

## Task 2: Markup and styling for the line

**Files:**
- Modify: `index.html` — CSS near the `.sensitivity-band` rule; markup in the 15-year card after `<div class="period-headlines">…</div>` and **before** `<div class="proj-line sensitivity-band" id="projLifeSensitivity" hidden></div>` (currently line ~3485)

- [ ] **Step 1: Add the CSS rule**

Insert immediately after the existing `.sensitivity-band { … }` rule:

```css
    .leverage-line {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      line-height: 1.5;
      margin: 0.5rem 0 0.375rem;
    }
    .leverage-line strong {
      color: var(--text-primary);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .leverage-line strong.negative { color: var(--negative); }
```

Spec §6 requires negative figures to use the app's existing negative convention. `--negative` is the same token the headline values use, so a falling property renders its two figures in the standard red without any new colour being introduced.

- [ ] **Step 2: Add the markup**

In the **15-year period only** (the block containing `projLifeHeadlineReturnOnCash`), insert between the closing `</div>` of `.period-headlines` and the `projLifeSensitivity` div:

```html
          <div class="proj-line leverage-line" id="projLifeLeverage" hidden>
            At the <strong id="projLifeLeverageGrowth"></strong> a year growth you assumed, your cash <span id="projLifeLeverageVerb"></span> <strong id="projLifeLeverageRoe"></strong> — the difference is leverage (~<strong id="projLifeLeverageMult"></strong> here).&nbsp;<span class="help-tip" data-tip="Your deposit and costs bought a much larger asset, so the property's growth lands on your smaller cash stake. Leverage multiplies gains and losses equally.">?</span>
          </div>
```

Every dynamic value has its own element, so the render step uses `textContent` exclusively — no `innerHTML`. The `.help-tip` needs no extra attributes: `initTipA11y()` (`index.html:5885`) adds `tabindex`, `role` and `aria-label` from `data-tip` automatically and idempotently, which is the #12 keyboard-reachable pattern.

**Do not add this markup to the 5-year or 10-year cards.** PO decision, 2026-07-28: leverage is fixed at purchase and identical across periods, so repeating it three times per property reads as padding.

- [ ] **Step 3: Verify the file still parses**

Run: `node /Users/thinkindave/Claude/TrueReturn/.claude/smoke-test.js`
Expected: JS syntax check passes; unit tests pass. (The new IDs are not yet required by the script, so no ID failure yet.)

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: leverage line markup and styling on the 15-year card (#14)"
```

---

## Task 3: Wire the line into the projection loop

**Files:**
- Modify: `index.html` — inside the `[{years: 5, …}, {years: 10, …}, {years: 15, prefix: 'projLife'}].forEach(…)` loop that begins at line ~4822, after the headline-strip writes that end at line ~5100

- [ ] **Step 1: Add the render block**

Immediately after the `hReturnOnCashEl` block (ends line ~5100) and before the closing `});` of the `forEach`, insert:

```js
        // Leverage line — 15-year period only (UI spec §9 v2.7, issue #14).
        // annualisedReturn is passed in, never recomputed, so the shipped
        // "Annual Cash Return" figure cannot move.
        const leverageEl = document.getElementById(`${prefix}Leverage`);
        if (leverageEl) {
          const lev = calcLeverageLine({
            purchasePrice, totalUpfront, expectedGrowth, annualisedReturn,
          });
          leverageEl.hidden = !lev.show;
          if (lev.show) {
            const growthEl = document.getElementById(`${prefix}LeverageGrowth`);
            growthEl.textContent = lev.assetGrowthPct.toFixed(1) + '%';
            growthEl.className = lev.assetGrowthPct < 0 ? 'negative' : '';

            document.getElementById(`${prefix}LeverageVerb`).textContent =
              lev.cashReturnPct >= 0 ? 'returned' : 'fell';

            const roeEl = document.getElementById(`${prefix}LeverageRoe`);
            roeEl.textContent = Math.abs(lev.cashReturnPct).toFixed(1) + '%';
            roeEl.className = lev.cashReturnPct < 0 ? 'negative' : '';

            document.getElementById(`${prefix}LeverageMult`).textContent =
              lev.leverageMultiple.toFixed(1) + '×';
          }
        }
```

The `getElementById` guard means the loop runs unchanged for the 5- and 10-year prefixes, where no such element exists.

`Math.abs` on the cash return pairs with the verb: a −21.6% return renders as "your cash **fell** 21.6%", never "fell −21.6%". The growth figure keeps its sign, so a negative assumption renders "At the −1.6% a year growth you assumed".

- [ ] **Step 2: Confirm all four inputs are in scope**

`purchasePrice`, `totalUpfront` (`index.html:4570`) and `expectedGrowth` are declared in the enclosing function above the loop; `annualisedReturn` is declared inside the loop at line ~5051. Verify by reading the surrounding function — if any is shadowed or out of scope, stop and report rather than re-deriving the value.

- [ ] **Step 3: Verify in the browser**

Open `index.html`, expand the **15 Year** period on the default property. Check, in order:

1. The line reads "At the 6.0% a year growth you assumed, your cash returned X.X% — the difference is leverage (~5.0× here)."
2. Set Expected Growth to `-2`: reads "At the −2.0% a year growth you assumed, your cash fell XX.X% …", with **both figures in the standard negative red**.
3. Set Deposit to `100`%: the line disappears entirely.
4. Narrow the viewport to ~375px: the line wraps to multiple lines and stays inside the card, with the headline strip still stacking as before.
5. Tab to the `?` tip: it takes focus, shows a visible focus ring, and reveals the tooltip. Escape dismisses it.
6. Confirm the 5-year and 10-year cards have **no** leverage line.

- [ ] **Step 4: Run the full check**

Run: `node /Users/thinkindave/Claude/TrueReturn/.claude/smoke-test.js`
Expected: all checks pass, unit tests green.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: render the leverage line on the 15-year projection (#14)"
```

---

## Task 4: Structural guards

**Files:**
- Modify: `.claude/smoke-test.js` — `requiredIds` array (line 42) and a new check appended after the existing checks

- [ ] **Step 1: Add the ID to the required list**

Append to the `requiredIds` array, after the CGT-treatment group:

```js
  // Leverage line (UI spec §9 v2.7, issue #14)
  'projLifeLeverage'
```

- [ ] **Step 2: Add the no-recompute regression guard**

Append as a new numbered check, following the style of the existing checks in the file:

```js
// 7. The leverage line must not recompute return on cash (issue #14).
// The shipped "Annual Cash Return" is computed inline; calcLeverageLine
// receives it. If someone later switches this to engine.calcEquityReturns,
// the displayed figure moves for every existing user — that change must be
// made deliberately under golden-file tests, not as a side effect.
if (!html.includes('const roeBase = totalUpfront > 0 ? 1 + totalProfit / totalUpfront : 0;')) {
  fail('Inline ROE computation changed — Annual Cash Return may have moved');
} else if (!/calcLeverageLine\(\{[\s\S]{0,200}annualisedReturn/.test(html)) {
  fail('calcLeverageLine is not being passed the existing annualisedReturn');
} else {
  ok('Leverage line consumes the shipped ROE rather than recomputing it');
}
```

- [ ] **Step 3: Run and confirm the guard passes**

Run: `node /Users/thinkindave/Claude/TrueReturn/.claude/smoke-test.js`
Expected: PASS, including the two new checks.

- [ ] **Step 4: Prove the guard actually catches the regression**

Temporarily change `annualisedReturn` to `0` in the `calcLeverageLine({…})` call in `index.html`, re-run the script, and confirm it FAILS with "not being passed the existing annualisedReturn". Then revert the edit and confirm it passes again. A guard that has never been seen to fail is not a guard.

- [ ] **Step 5: Commit**

```bash
git add .claude/smoke-test.js
git commit -m "test: structural guards for the leverage line (#14)"
```

---

## Task 5: Spec amendment to v2.7

**Files:**
- Modify: `specs/truereturn-ui-requirements.md` — version header and §9

- [ ] **Step 1: Rewrite §9**

Replace everything from the `## 9. Return-on-your-cash block (leverage / ROE display)` heading down to (but **not** including) the "**Benchmark output**" blockquote with the following. Keep the benchmark paragraph and its trailing "Rules:" line exactly as they are — see Step 2.

```markdown
## 9. Leverage line (v2.7)

**Supersedes the v2.6 "Return-on-your-cash block."** That block specified a `roeSimple` headline, an amplification pair in prose, and a collapsible IRR, on the whole-journey calculator and both comparison cards. Three things changed: the comparison cards were removed at v2.2; return on cash was found to be already shipping (the headline strip's **Annual Cash Return** cell is `roeSimple`, computed inline on the same base); and the asset growth rate turned out to be the user's own `expectedGrowth` input rather than a derived figure. What remained worth adding was the leverage multiple and the juxtaposition.

**One line, on the 15-year period only.** Always visible, between the headline strip and the sensitivity bands. Not repeated on the 5- and 10-year periods: leverage is fixed at purchase and identical across all three, so repeating it reads as padding (PO decision, 2026-07-28).

**Copy — one template, both directions:**

> At the **X.X%** a year growth you assumed, your cash {returned|fell} **Y.Y%** — the difference is leverage (~M× here).

"a year" appears once and governs both figures. Verb branches on the sign of the cash return only; the asset figure carries its own sign.

**The asset figure is an assumption, not a finding.** It is `expectedGrowth` as typed by the user, so the copy attributes it ("the growth you assumed") rather than reporting it ("the property grew"). Presenting an input back as a modelled discovery is precisely the self-deception this product exists to counter.

**Suppression** — hide the whole line when there is no leverage gap to explain:
- leverage multiple below 1.05 — the threshold is tied to the display precision: the multiple renders via `toFixed(1)`, so anything below 1.05 would print "~1.0× here" while the sentence claims a difference exists. A cash purchase sits below 1 (acquisition costs push `totalUpfront` above `purchasePrice`); the band between is reachable at roughly a 91–94% deposit. If the display precision ever changes, revisit this number.
- `expectedGrowth` or `annualisedReturn` non-finite — guards against the `NaN%` class of bug from issue #13, and against `engine.annualizedReturn`'s `null` return rendering as a silently wrong "0.0"
- non-positive `purchasePrice` or `totalUpfront`

Suppress on the arithmetic, never on a proxy input, so the rule stays correct if the inputs change (same discipline as v2.6's degenerate sensitivity band).

**Neutrality (tax spec §11).** No judgment language, no ranking, no colour beyond the standard negative convention on the two figures. The line must render unchanged when growth is weak or negative — that is when it carries the most information, and suppressing it would make the feature dishonest. Zero growth is a loss, not break-even, and the line says so without comment.

**IRR is not surfaced.** It remains an engine capability, tested and unused, alongside `compareSaleTiming` and the new-build optimizer.
```

Then update the document's version header from v2.6 to **v2.7**, matching however previous bumps were recorded in that file.

- [ ] **Step 2: Preserve the benchmark paragraph as deferred**

The "**Benchmark output**" blockquote and its "Rules:" line stay verbatim — the benchmark is the next slice and depends on these outputs. Prepend one line to it so its status is unambiguous:

```markdown
**Deferred, not dropped (v2.7).** The benchmark is the next slice; it consumes the leverage line's outputs (`roeSimple` supplies the property's X.X%, the leverage multiple supplies M×). Nothing below is implemented yet.
```

- [ ] **Step 3: Verify no other section contradicts the new §9**

Run: `grep -n "Return on your cash\|return on your cash\|amplification pair\|IRR" specs/truereturn-ui-requirements.md`
Expected: matches only inside §9's own supersession note and the deferred benchmark paragraph. Any other surviving promise of the old block must be fixed.

- [ ] **Step 4: Commit**

```bash
git add specs/truereturn-ui-requirements.md
git commit -m "docs: UI spec v2.7 — §9 becomes the leverage line (#14)"
```

---

## Notes for the implementer

- **Never commit or push without explicit user instruction** beyond the per-task commits above, which are pre-authorised by this plan. Do not push to any remote.
- The `smoke-tester` agent definition (`.claude/agents/smoke-tester.md`) cites a stale path, `/Users/thinkindave/TrueReturn/.claude/smoke-test.js`. The repository is at `/Users/thinkindave/Claude/TrueReturn`. The script resolves its own paths from `__dirname`, so running it from the correct location works; only the agent's documented command is wrong. Out of scope here — flag it, do not fix it in this branch.
- If any step's expected output does not match, stop and report rather than adapting the plan. In particular, if Task 1 Step 2 does **not** fail, `calcLeverageLine` already exists and something is wrong with the branch state.
