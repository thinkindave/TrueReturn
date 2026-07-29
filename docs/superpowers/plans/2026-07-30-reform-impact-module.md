# 2027 Reform Impact Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a contextual module to all three projection period cards stating what the 2026–27 reform does to the **total tax** on the user's own modelled property — the same sale priced under the old rules beside the new ones.

**Architecture:** One new pure function `calcReformImpact()` in `engine.js` composes three already-tested engine pieces (`calcReformSale` for the new-rules side, `calcOldRegimeCGT` with `quarantinePool: 0` for the old-rules side, and the caller's `buildQuarantineSchedule` rows for the refund sums). `index.html` gains one `.proj-line` per period card plus a collapsible two-column table, populated inside the existing per-period loop where `saleArgs` and `quarantineSched` are already in scope. No existing figure on any card changes.

**Tech Stack:** Vanilla HTML/CSS/JS. No build system, no npm, no framework. Node's built-in `assert` via `tests/harness.js`. Served as static files.

**Design doc:** `docs/superpowers/specs/2026-07-30-reform-impact-module.md` (committed, `db497be`)

**Branch:** `feature/reform-impact-module`

---

## Background the engineer needs

**The two files.** `engine.js` is pure calculation and must never touch the DOM — the Node test suites `require()` it with no DOM present. `index.html` holds all markup, CSS and DOM JavaScript. Never put arithmetic in `index.html` that could live in `engine.js`.

**How `engine.js` is loaded twice.** It is a classic `<script>` in the browser (so top-level `function` declarations become globals that `index.html` can call directly) and `require()`d in Node via a `module.exports` guard at the foot of the file. Any new function must be added to that export list or the tests cannot see it.

**Running the tests.**

```bash
node .claude/smoke-test.js
```

That is the pipeline entry point: it runs `tests/unit.js` and `tests/engine.test.js` in separate child processes, plus 13 structural checks against `index.html`. For quick iteration on one suite:

```bash
node tests/engine.test.js
```

**The test harness.** `tests/harness.js` exports `test(name, fn)`, `assert`, `approxEqual(actual, expected, tolerance)` (default tolerance 0.01) and `summary()`. `summary()` must stay the last line of the suite. Tests are plain functions that throw.

**The `minTests` ratchet.** `.claude/smoke-test.js` asserts each suite runs at least N tests, so a suite that silently stops running its tests fails the check. `tests/engine.test.js` currently runs 117 and the ratchet is set to 116. This plan adds 8 tests; Task 6 raises the ratchet.

**Verifying in the browser.** Screenshots come back blank for this page — do not attempt visual verification and do not claim it. Verify with `javascript_tool` DOM reads instead. The preview config is `.claude/launch.json` (port 8480, serves the repo root). **Clear `localStorage.removeItem('truereturn_state')` and reload before reading any figure**, or you will read a stale saved property instead of the default one. The browser also caches `engine.js`: after editing it run `fetch('/engine.js',{cache:'reload'})` and then navigate, or you will debug a phantom bug against stale code.

**The reference figures.** All expected values below were measured on the shipped build with `truereturn_state` cleared, cross-checked against the rendered `#proj5CGT` / `#projLifeCGT`. The default property is $650,000, 20% deposit, $550/wk rent, 6% growth, QLD, mid-age, MTR 0.37.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `engine.js` | Modify — add `calcReformImpact()` near `calcLeverageLine` (~line 941–1012), add to `module.exports` (~line 1013) | The whole old-vs-new total-tax calculation. Pure, DOM-free. |
| `tests/engine.test.js` | Modify — append before `summary()` | 8 tests covering sign inversion, all three periods, new-build suppression, the negative arm, refund symmetry, and `split` shape |
| `index.html` | Modify — CSS ~line 584, markup at 3 sites (3280, 3427, 3577), toggle wiring in `initProjectionSections()` ~line 3959, render logic in the per-period loop ~line 5101 | Markup, styling, expander wiring, rendering. No arithmetic. |
| `.claude/smoke-test.js` | Modify — `minTests` ~line 23, new structural check before the Result block ~line 360 | Ratchet bump plus a guard that the module reads engine output rather than recomputing |

---

## Task 1: `calcReformImpact()` in the engine

**Files:**
- Modify: `engine.js` (insert after `calcLeverageLine`, before the `module.exports` guard at line 1013)
- Modify: `engine.js:1013-1030` (export list)
- Test: `tests/engine.test.js` (append immediately before the final `summary();` line)

- [ ] **Step 1: Write the first failing test**

Append to `tests/engine.test.js`, immediately **before** the final `summary();`:

```js
// ── calcReformImpact (UI spec §3a v3.1, issue #17) ──────────────────────
// Reference figures measured on the shipped build with truereturn_state
// cleared and cross-checked against the rendered #proj5CGT / #projLifeCGT.
// Default property: $650,000, 20% deposit, $550/wk, 6% growth, QLD, mid-age,
// MTR 0.37. Do not "correct" these numbers without re-measuring in-app.
console.log('\ncalcReformImpact (2027 reform impact module)');

// Shared builder for the default property's per-period sale arguments.
function reformImpactFixture(years, salePrice, pool, overrides) {
  const base = {
    contractDate: '2026-07-30',
    dwellingType: 'established',
    saleDate: E.addYearsISO('2026-07-30', years),
    salePrice: salePrice,
    sellingCostsPct: 0.03,
    acquisitionCosts: 673775,
    div43Claimed: 0,
    div43ClaimedPost: 0,
    deemedValue: 650000 * Math.pow(1.06, E.yearFrac('2026-07-30', E.DEEMED_DATE_ISO)),
    quarantinePool: pool,
    marginalRate: 0.37,
    remainingLoan: 0,
  };
  return Object.assign(base, overrides || {});
}

test('the CGT-only delta is negative at 5 years — the trap this module avoids', () => {
  const saleArgs = reformImpactFixture(5, 869846.63, 62779.64);
  const r = E.calcReformImpact({ saleArgs, quarantineRows: [], years: 5, marginalRate: 0.37 });
  // New-rules CGT is LOWER than old-rules CGT: the pool offsets a still-small
  // gain by more than the lost 50% discount costs. Shipping this figure alone
  // would claim the reform SAVED the investor money.
  assert(r.newCGT < r.oldCGT, 'precondition: new-rules CGT is lower at 5 years');
  approxEqual(r.newCGT - r.oldCGT, -12057, 5);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
node tests/engine.test.js
```

Expected: `✗ the CGT-only delta is negative at 5 years — the trap this module avoids: E.calcReformImpact is not a function`

- [ ] **Step 3: Write the implementation**

Insert into `engine.js` immediately **before** the `if (typeof module !== 'undefined' && module.exports) {` guard at line 1013:

```js
// ── 2027 reform impact (UI spec §3a v3.1, issue #17) ─────────────────────
// The user's own modelled sale priced under both rulebooks: identical sale
// date, growth and holding costs, only the tax law differs.
//
// Measures TOTAL TAX over the hold, not CGT alone. UI spec §3a originally
// specified the CGT-only regime delta; measured on the shipped build that
// delta is NEGATIVE at 5 years (-$12,057) and positive at 15 (+$67,703) on
// the same property, because the quarantine pool offsets a still-small gain
// by more than the lost 50% discount costs. It only reads as a saving
// because the foregone negative-gearing refunds sit outside the number —
// the same failure §4 documents for the pool shown alone. Netting the
// refunds back in gives the correct sign at every period.
//
// Deliberately NOT a net-outcome comparison: the caller's cumulative cash
// flow is pre-tax on both sides and has never counted refunds, so there is
// no shipped figure a "net outcome" row could agree with.
function calcReformImpact({ saleArgs, quarantineRows = [], years, marginalRate }) {
  const newOutcome = calcReformSale(saleArgs);

  // Old-rules side: 50% discount on the whole gain, no pool, and the full
  // pre+post Div 43 sum reducing a single cost base (there is no era split
  // under the old law) — matching calcReformSale's own OLD branch.
  const sellingCosts = saleArgs.salePrice *
    (saleArgs.sellingCostsPct === undefined ? 0.03 : saleArgs.sellingCostsPct);
  const oldDetail = calcOldRegimeCGT({
    salePrice: saleArgs.salePrice,
    sellingCosts,
    acquisitionCosts: saleArgs.acquisitionCosts,
    div43Claimed: (saleArgs.div43Claimed || 0) + (saleArgs.div43ClaimedPost || 0),
    capitalLosses: saleArgs.capitalLosses || 0,
    quarantinePool: 0,
    marginalRate,
    heldOver12Months: yearFrac(saleArgs.contractDate, saleArgs.saleDate) >= 1,
  });

  // Refunds along the way. Quarantine applies only to income years starting
  // on/after 1 July 2027, so pre-boundary loss years are deductible under
  // BOTH rulebooks and cancel out of the delta — but they are still shown,
  // so the new-rules refund column is not falsely zero.
  let preBoundaryRefunds = 0;
  let quarantinedRefunds = 0;
  for (let i = 0; i < years && i < quarantineRows.length; i++) {
    const row = quarantineRows[i];
    if (row.quarantined > 0) {
      quarantinedRefunds += row.quarantined * marginalRate;
    } else if (row.fyStartISO < BOUNDARY_ISO && row.netResult < 0) {
      preBoundaryRefunds += (-row.netResult) * marginalRate;
    }
  }
  const newRefunds = preBoundaryRefunds;
  const oldRefunds = preBoundaryRefunds + quarantinedRefunds;

  const newTotalTax = newOutcome.cgt - newRefunds;
  const oldTotalTax = oldDetail.tax - oldRefunds;
  const delta = newTotalTax - oldTotalTax;

  // The dual-era split, for the new-rules column only — the old law has no
  // era split. BEST_OF Option A IS the old-law calculation, so it has no
  // split either; only a winning Option B carries one.
  let split = null;
  if (newOutcome.regime === 'DUAL_ERA') {
    split = { taxOnPre: newOutcome.detail.taxOnPre, taxOnPost: newOutcome.detail.taxOnPost };
  } else if (newOutcome.regime === 'BEST_OF' && newOutcome.detail.winner === 'B') {
    split = {
      taxOnPre: newOutcome.detail.optionB.taxOnPre,
      taxOnPost: newOutcome.detail.optionB.taxOnPost,
    };
  }

  return {
    // Sub-dollar deltas are suppressed on the arithmetic, never on
    // dwellingType — the rule follows the numbers so it stays correct if the
    // winning CGT option ever changes. New builds land at exactly 0.
    show: Math.abs(delta) >= 1,
    delta,
    oldCGT: oldDetail.tax,
    newCGT: newOutcome.cgt,
    oldRefunds,
    newRefunds,
    oldTotalTax,
    newTotalTax,
    split,
    pooledAtSale: saleArgs.quarantinePool || 0,
  };
}
```

- [ ] **Step 4: Add it to the export list**

In `engine.js`, change the line reading `    calcLeverageLine,` to:

```js
    calcLeverageLine, calcReformImpact,
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
node tests/engine.test.js
```

Expected: `✓ the CGT-only delta is negative at 5 years — the trap this module avoids`, and `118 passed, 0 failed`.

- [ ] **Step 6: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat: calcReformImpact measures total tax under both rulebooks (#17)"
```

---

## Task 2: Engine tests for the remaining cases

**Files:**
- Test: `tests/engine.test.js` (append before the final `summary();`)

- [ ] **Step 1: Write the failing tests**

Append immediately **before** the final `summary();`:

```js
test('total-tax delta is positive at all three periods — sign is corrected', () => {
  // Refund rows for the default property: FY2026-27 starts pre-boundary and
  // is deductible under both rulebooks; every later loss year is quarantined
  // under the new rules only.
  const rows = [
    { fyStartISO: '2026-07-01', netResult: -20592, quarantined: 0 },
    { fyStartISO: '2027-07-01', netResult: -19500, quarantined: 19500 },
    { fyStartISO: '2028-07-01', netResult: -18200, quarantined: 18200 },
    { fyStartISO: '2029-07-01', netResult: -16800, quarantined: 16800 },
    { fyStartISO: '2030-07-01', netResult: -8280, quarantined: 8280 },
  ];
  const periods = [[5, 869846.63, 62779.64], [10, 1164051.00, 87190.03], [15, 1557762.83, 31958.21]];
  periods.forEach(([years, price, pool]) => {
    const r = E.calcReformImpact({
      saleArgs: reformImpactFixture(years, price, pool),
      quarantineRows: rows, years: years, marginalRate: 0.37,
    });
    assert(r.delta > 0, years + 'yr: the reform must cost, not save, once refunds are counted');
    assert.strictEqual(r.show, true, years + 'yr must show the module');
    // Pre-boundary refunds are identical on both sides, so they cancel: the
    // delta is (newCGT - oldCGT) + quarantined refunds foregone.
    approxEqual(r.delta, (r.newCGT - r.oldCGT) + (r.oldRefunds - r.newRefunds), 0.01);
  });
  // The 5-year case is the one that inverts on a CGT-only reading — assert
  // the correction explicitly rather than leaving it implied by the loop.
  const r5 = E.calcReformImpact({
    saleArgs: reformImpactFixture(5, 869846.63, 62779.64),
    quarantineRows: rows, years: 5, marginalRate: 0.37,
  });
  assert(r5.newCGT - r5.oldCGT < 0 && r5.delta > 0,
    'at 5 years the CGT-only delta is negative but the total-tax delta is positive');
});

test('pre-boundary refunds are identical under both rulebooks', () => {
  const rows = [
    { fyStartISO: '2026-07-01', netResult: -20592, quarantined: 0 },
    { fyStartISO: '2027-07-01', netResult: -19500, quarantined: 19500 },
  ];
  const r = E.calcReformImpact({
    saleArgs: reformImpactFixture(5, 869846.63, 62779.64),
    quarantineRows: rows, years: 5, marginalRate: 0.37,
  });
  // 20592 * 0.37 = 7619.04 — deductible under both rulebooks.
  approxEqual(r.newRefunds, 7619.04, 0.5);
  // The old rules additionally refund the quarantined year: + 19500 * 0.37.
  approxEqual(r.oldRefunds, 7619.04 + 7215, 0.5);
  assert(r.oldRefunds > r.newRefunds, 'old rules must refund strictly more');
});

test('new refunds are never zero merely because quarantine applies', () => {
  const rows = [{ fyStartISO: '2026-07-01', netResult: -20592, quarantined: 0 }];
  const r = E.calcReformImpact({
    saleArgs: reformImpactFixture(15, 1557762.83, 31958.21),
    quarantineRows: rows, years: 15, marginalRate: 0.37,
  });
  assert(r.newRefunds > 0, 'losses before 1 July 2027 stay deductible under the new rules');
});

test('new build: delta is exactly zero and the module hides itself', () => {
  // New builds keep full negative gearing (no quarantine, so no rows and no
  // pool) and may elect the 50% discount on the whole gain — which IS the
  // old-rules calculation. The reform genuinely does nothing to them.
  [[5, 869846.63], [10, 1164051.00], [15, 1557762.83]].forEach(([years, price]) => {
    const saleArgs = reformImpactFixture(years, price, 0, { dwellingType: 'newBuild' });
    const r = E.calcReformImpact({ saleArgs, quarantineRows: [], years, marginalRate: 0.37 });
    approxEqual(r.delta, 0, 0.01);
    assert.strictEqual(r.show, false, years + 'yr new build must hide the module');
  });
});

test('sub-dollar deltas are suppressed on the arithmetic, not on dwellingType', () => {
  const saleArgs = reformImpactFixture(15, 1557762.83, 31958.21);
  const r = E.calcReformImpact({ saleArgs, quarantineRows: [], years: 15, marginalRate: 0.37 });
  // An established property with a real delta must NOT be suppressed.
  assert.strictEqual(r.show, true, 'established with a real delta must show');
  assert.strictEqual(saleArgs.dwellingType, 'established', 'gate is arithmetic, not type');
});

test('the negative arm is reachable — low growth leaves the property better off', () => {
  // 3% growth over 15 years: the indexed post-2027 cost base outruns the
  // gain, so the reform genuinely reduces the tax. Measured in-app: -$15,354.
  const salePrice = 650000 * Math.pow(1.03, 15);
  const saleArgs = reformImpactFixture(15, salePrice, 31958.21, {
    deemedValue: 650000 * Math.pow(1.03, E.yearFrac('2026-07-30', E.DEEMED_DATE_ISO)),
  });
  const r = E.calcReformImpact({ saleArgs, quarantineRows: [], years: 15, marginalRate: 0.37 });
  assert(r.delta < 0, 'a low-growth hold must be able to produce a negative delta');
  assert.strictEqual(r.show, true, 'a negative delta still shows — it is not suppressed');
});

test('split is null on an OLD-route sale and populated on DUAL_ERA', () => {
  // A sale before 1 July 2027 routes OLD: single era, so no split to show.
  const oldRoute = reformImpactFixture(0, 650000, 0, { saleDate: '2027-01-30' });
  const rOld = E.calcReformImpact({
    saleArgs: oldRoute, quarantineRows: [], years: 0, marginalRate: 0.37,
  });
  assert.strictEqual(rOld.split, null, 'OLD route has no era split');

  const rDual = E.calcReformImpact({
    saleArgs: reformImpactFixture(15, 1557762.83, 31958.21),
    quarantineRows: [], years: 15, marginalRate: 0.37,
  });
  assert(rDual.split !== null, 'DUAL_ERA must carry a split');
  approxEqual(rDual.split.taxOnPre + rDual.split.taxOnPost, rDual.newCGT, 0.01);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
node tests/engine.test.js
```

Expected: several failures. If any test passes immediately, read it and confirm it is genuinely asserting something — a test that cannot fail is worthless.

- [ ] **Step 3: Fix only what the tests reveal**

`calcReformImpact` from Task 1 should satisfy all of these. If a test fails, the fix belongs in `engine.js`, never in the expected figures — those were measured in the running app. If a figure genuinely cannot be reproduced, **stop and report it** rather than adjusting the assertion.

- [ ] **Step 4: Run to verify they pass**

```bash
node tests/engine.test.js
```

Expected: `125 passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add tests/engine.test.js
git commit -m "test: cover sign inversion, new-build suppression and the negative arm (#17)"
```

---

## Task 3: Markup and styling

**Files:**
- Modify: `index.html` (CSS after line 584, `.benchmark-line strong.negative`)
- Modify: `index.html:3280`, `index.html:3427`, `index.html:3577` (three markup sites)

- [ ] **Step 1: Add the CSS**

In `index.html`, immediately **after** the line `.benchmark-line strong.negative { color: var(--negative); }` (line 584) and **before** `.benchmark-note {`:

```css
    /* 2027 reform impact module — all three projection cards
       (UI spec §3a v3.1, issue #17). Framing rules are binding: neither
       column is ranked, so no winner/loser colour may be added here. The
       only colour is TrueReturn's standard negative convention on figures
       that are genuinely negative. */
    .reform-impact {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      line-height: 1.5;
      margin: 0.5rem 0 0.375rem;
    }
    .reform-impact strong {
      color: var(--text-primary);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .reform-impact-toggle {
      background: none;
      border: none;
      padding: 0;
      margin-left: 0.25rem;
      font: inherit;
      color: var(--accent);
      text-decoration: underline;
      cursor: pointer;
    }
    .reform-impact-detail {
      margin-top: 0.5rem;
      overflow-x: auto;
    }
    .reform-impact-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.75rem;
      font-variant-numeric: tabular-nums;
    }
    .reform-impact-table th,
    .reform-impact-table td {
      padding: 0.25rem 0.5rem 0.25rem 0;
      text-align: right;
      font-weight: 400;
      white-space: nowrap;
    }
    .reform-impact-table th:first-child,
    .reform-impact-table td:first-child {
      text-align: left;
      white-space: normal;
    }
    .reform-impact-table thead th {
      color: var(--text-secondary);
      border-bottom: 1px solid var(--border);
    }
    .reform-impact-table .reform-sub td:first-child {
      padding-left: 0.75rem;
      color: var(--text-secondary);
    }
    .reform-impact-table .reform-total td {
      border-top: 1px solid var(--border);
      font-weight: 600;
      color: var(--text-primary);
    }
    .reform-impact-note {
      margin: 0.375rem 0 0;
      font-size: 0.75rem;
      color: var(--text-secondary);
      line-height: 1.5;
    }
```

- [ ] **Step 2: Add the markup to the 5-year card**

In `index.html`, insert immediately **after** the closing `</div>` of the `proj5Benchmark` block (the block opening at line 3280) and **before** `<div class="period-body">`:

```html
          <div class="proj-line reform-impact" id="proj5ReformImpact" hidden>
            <span id="proj5ReformImpactText"></span>
            <button type="button" class="reform-impact-toggle" id="proj5ReformImpactToggle" aria-expanded="false" aria-controls="proj5ReformImpactDetail">see how</button>
            <div class="reform-impact-detail" id="proj5ReformImpactDetail" hidden>
              <table class="reform-impact-table">
                <thead>
                  <tr><th scope="col">The same sale, two rulebooks</th><th scope="col">Old rules</th><th scope="col">New rules</th></tr>
                </thead>
                <tbody>
                  <tr><td>Capital gains tax at sale</td><td id="proj5ReformOldCgt">-</td><td id="proj5ReformNewCgt">-</td></tr>
                  <tr class="reform-sub" id="proj5ReformSplitPre" hidden><td>gain to 30 Jun 2027 (50% discount)</td><td>&mdash;</td><td id="proj5ReformNewPre">-</td></tr>
                  <tr class="reform-sub" id="proj5ReformSplitPost" hidden><td>gain after 30 Jun 2027 (indexed)</td><td>&mdash;</td><td id="proj5ReformNewPost">-</td></tr>
                  <tr><td>Negative-gearing refunds along the way</td><td id="proj5ReformOldRefunds">-</td><td id="proj5ReformNewRefunds">-</td></tr>
                  <tr class="reform-total"><td id="proj5ReformTotalLabel">Total tax</td><td id="proj5ReformOldTotal">-</td><td id="proj5ReformNewTotal">-</td></tr>
                </tbody>
              </table>
              <p class="reform-impact-note" id="proj5ReformPoolNote" hidden></p>
            </div>
          </div>
```

- [ ] **Step 3: Add the markup to the 10-year card**

Insert the identical block after the `proj10Benchmark` block (opening at line 3427), with every `proj5` prefix replaced by `proj10`:

```html
          <div class="proj-line reform-impact" id="proj10ReformImpact" hidden>
            <span id="proj10ReformImpactText"></span>
            <button type="button" class="reform-impact-toggle" id="proj10ReformImpactToggle" aria-expanded="false" aria-controls="proj10ReformImpactDetail">see how</button>
            <div class="reform-impact-detail" id="proj10ReformImpactDetail" hidden>
              <table class="reform-impact-table">
                <thead>
                  <tr><th scope="col">The same sale, two rulebooks</th><th scope="col">Old rules</th><th scope="col">New rules</th></tr>
                </thead>
                <tbody>
                  <tr><td>Capital gains tax at sale</td><td id="proj10ReformOldCgt">-</td><td id="proj10ReformNewCgt">-</td></tr>
                  <tr class="reform-sub" id="proj10ReformSplitPre" hidden><td>gain to 30 Jun 2027 (50% discount)</td><td>&mdash;</td><td id="proj10ReformNewPre">-</td></tr>
                  <tr class="reform-sub" id="proj10ReformSplitPost" hidden><td>gain after 30 Jun 2027 (indexed)</td><td>&mdash;</td><td id="proj10ReformNewPost">-</td></tr>
                  <tr><td>Negative-gearing refunds along the way</td><td id="proj10ReformOldRefunds">-</td><td id="proj10ReformNewRefunds">-</td></tr>
                  <tr class="reform-total"><td id="proj10ReformTotalLabel">Total tax</td><td id="proj10ReformOldTotal">-</td><td id="proj10ReformNewTotal">-</td></tr>
                </tbody>
              </table>
              <p class="reform-impact-note" id="proj10ReformPoolNote" hidden></p>
            </div>
          </div>
```

- [ ] **Step 4: Add the markup to the 15-year card**

Insert after the `projLifeBenchmark` block (opening at line 3577), with the `projLife` prefix:

```html
          <div class="proj-line reform-impact" id="projLifeReformImpact" hidden>
            <span id="projLifeReformImpactText"></span>
            <button type="button" class="reform-impact-toggle" id="projLifeReformImpactToggle" aria-expanded="false" aria-controls="projLifeReformImpactDetail">see how</button>
            <div class="reform-impact-detail" id="projLifeReformImpactDetail" hidden>
              <table class="reform-impact-table">
                <thead>
                  <tr><th scope="col">The same sale, two rulebooks</th><th scope="col">Old rules</th><th scope="col">New rules</th></tr>
                </thead>
                <tbody>
                  <tr><td>Capital gains tax at sale</td><td id="projLifeReformOldCgt">-</td><td id="projLifeReformNewCgt">-</td></tr>
                  <tr class="reform-sub" id="projLifeReformSplitPre" hidden><td>gain to 30 Jun 2027 (50% discount)</td><td>&mdash;</td><td id="projLifeReformNewPre">-</td></tr>
                  <tr class="reform-sub" id="projLifeReformSplitPost" hidden><td>gain after 30 Jun 2027 (indexed)</td><td>&mdash;</td><td id="projLifeReformNewPost">-</td></tr>
                  <tr><td>Negative-gearing refunds along the way</td><td id="projLifeReformOldRefunds">-</td><td id="projLifeReformNewRefunds">-</td></tr>
                  <tr class="reform-total"><td id="projLifeReformTotalLabel">Total tax</td><td id="projLifeReformOldTotal">-</td><td id="projLifeReformNewTotal">-</td></tr>
                </tbody>
              </table>
              <p class="reform-impact-note" id="projLifeReformPoolNote" hidden></p>
            </div>
          </div>
```

- [ ] **Step 5: Verify the page still parses**

```bash
node .claude/smoke-test.js
```

Expected: `Result: PASS (13 passed, 0 failed)`. The markup is inert at this point — every block is `hidden` and nothing populates it yet.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: reform impact module markup and styling on all three cards (#17)"
```

---

## Task 4: Wire the expander

**Files:**
- Modify: `index.html:3959-3969` (`initProjectionSections`)

- [ ] **Step 1: Add the toggle loop**

In `index.html`, inside `initProjectionSections()`, immediately **after** the closing `});` of the `.proj-section-header` loop (line 3969) and **before** the `document.querySelectorAll('.period-header')` loop:

```js
      // Reform impact "see how" expander (UI spec §3a v3.1, issue #17).
      // Bound once at init like the section headers above — these three
      // blocks are static markup, never recreated, so no delegation needed.
      document.querySelectorAll('.reform-impact-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
          const detail = document.getElementById(toggle.getAttribute('aria-controls'));
          if (!detail) return;
          const expanded = toggle.getAttribute('aria-expanded') === 'true';
          toggle.setAttribute('aria-expanded', String(!expanded));
          detail.hidden = expanded;
          toggle.textContent = expanded ? 'see how' : 'hide';
        });
      });
```

- [ ] **Step 2: Verify it parses**

```bash
node .claude/smoke-test.js
```

Expected: `Result: PASS (13 passed, 0 failed)`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: wire the reform impact see-how expander (#17)"
```

---

## Task 5: Render the module

**Files:**
- Modify: `index.html` (per-period loop, immediately after the sensitivity-band block that ends at line 5101)

- [ ] **Step 1: Add the render block**

In `index.html`, insert immediately **after** the sensitivity-band `if (saleOutcome.regime !== 'OLD') { ... } else if (sensEl) { ... }` block (ending line 5101) and **before** the `// ── New-build CGT treatment line` comment:

```js
        // ── 2027 reform impact module (UI spec §3a v3.1, issue #17) ──
        // Reads engine output only. saleArgs and quarantineSched are already
        // in scope and identical to the ones the shipped figures came from,
        // so the module can never disagree with the card above it.
        const reformEl = document.getElementById(`${prefix}ReformImpact`);
        if (reformEl) {
          const impact = calcReformImpact({
            saleArgs,
            quarantineRows: quarantineSched.rows,
            years,
            marginalRate: marginalTaxRate,
          });
          if (!impact.show) {
            // Blank on hide so a later throw can never leave stale figures
            // on screen — same discipline as the sensitivity band above.
            reformEl.hidden = true;
            document.getElementById(`${prefix}ReformImpactText`).textContent = '';
          } else {
            // Verb swaps on sign; no colour, no ranking, neither side above
            // the other. The delta is NOT monotonic in growth (it dips near
            // 4% and climbs after), so no "the longer you hold, the worse it
            // gets" phrasing may be introduced here.
            const verb = impact.delta >= 0 ? 'add' : 'reduce';
            const amount = formatCurrency(Math.abs(impact.delta));
            const period = years + (years === 1 ? ' year' : ' years');
            document.getElementById(`${prefix}ReformImpactText`).innerHTML =
              impact.delta >= 0
                ? `The 2027 tax changes <strong>add ${amount}</strong> to the tax on this property over ${period}.`
                : `The 2027 tax changes <strong>reduce</strong> the tax on this property by <strong>${amount}</strong> over ${period}.`;

            document.getElementById(`${prefix}ReformOldCgt`).textContent = formatCurrency(impact.oldCGT);
            document.getElementById(`${prefix}ReformNewCgt`).textContent = formatCurrency(impact.newCGT);

            // Sub-rows are TAX, not gain, and appear on the new-rules side
            // only — the old law has no era split.
            const preRow = document.getElementById(`${prefix}ReformSplitPre`);
            const postRow = document.getElementById(`${prefix}ReformSplitPost`);
            if (impact.split) {
              document.getElementById(`${prefix}ReformNewPre`).textContent = formatCurrency(impact.split.taxOnPre);
              document.getElementById(`${prefix}ReformNewPost`).textContent = formatCurrency(impact.split.taxOnPost);
              preRow.hidden = false;
              postRow.hidden = false;
            } else {
              preRow.hidden = true;
              postRow.hidden = true;
            }

            // Refunds are money received, so they render as negatives against
            // the tax bill.
            document.getElementById(`${prefix}ReformOldRefunds`).textContent = '-' + formatCurrency(impact.oldRefunds);
            document.getElementById(`${prefix}ReformNewRefunds`).textContent = '-' + formatCurrency(impact.newRefunds);

            document.getElementById(`${prefix}ReformTotalLabel`).textContent = `Total tax over ${period}`;
            document.getElementById(`${prefix}ReformOldTotal`).textContent = formatCurrency(impact.oldTotalTax);
            document.getElementById(`${prefix}ReformNewTotal`).textContent = formatCurrency(impact.newTotalTax);

            // The pool's value is already inside the new-rules CGT figure —
            // saying so is what stops the table double-counting it (§4's
            // reconciliation discipline applied here).
            const poolNoteEl = document.getElementById(`${prefix}ReformPoolNote`);
            if (impact.pooledAtSale > 0) {
              poolNoteEl.textContent = 'The ' + formatCurrency(impact.pooledAtSale) +
                ' still pooled at sale is already used up in the tax line above.';
              poolNoteEl.hidden = false;
            } else {
              poolNoteEl.textContent = '';
              poolNoteEl.hidden = true;
            }

            reformEl.hidden = false;
          }
        }
```

- [ ] **Step 2: Verify the structural checks still pass**

```bash
node .claude/smoke-test.js
```

Expected: `Result: PASS (13 passed, 0 failed)`.

- [ ] **Step 3: Verify in the browser**

Start the preview, then **clear saved state and reload before reading anything**:

```bash
node -e "console.log('preview: .claude/launch.json, name truereturn, port 8480')"
```

Open the preview by name (`truereturn`), then run via `javascript_tool`:

```js
localStorage.removeItem('truereturn_state'); location.reload();
```

After the reload, read the rendered values:

```js
(function(){const out={};
['proj5','proj10','projLife'].forEach(function(p){
  out[p]={
    hidden: document.getElementById(p+'ReformImpact').hidden,
    text: document.getElementById(p+'ReformImpactText').textContent,
    oldTotal: document.getElementById(p+'ReformOldTotal').textContent,
    newTotal: document.getElementById(p+'ReformNewTotal').textContent,
    oldCgt: document.getElementById(p+'ReformOldCgt').textContent,
    newCgt: document.getElementById(p+'ReformNewCgt').textContent,
  };});
return JSON.stringify(out,null,1);})()
```

Expected, on the default property:

| | 5yr | 10yr | 15yr |
|---|---|---|---|
| sentence | add $11,171 | add $37,174 | add $100,235 |
| old CGT | $37,082 | $95,514 | $171,802 |
| new CGT | $25,025 | $100,155 | $239,505 |
| old total | $6,235 | $55,362 | $131,651 |
| new total | $17,406 | $92,536 | $231,886 |

Figures within a few dollars are fine (rounding). A **sign** difference or a difference of thousands is a real failure — stop and investigate rather than editing the expectation.

Then confirm the CGT figures already on the cards did not move:

```js
JSON.stringify({p5:document.getElementById('proj5CGT').textContent, p10:document.getElementById('proj10CGT').textContent, life:document.getElementById('projLifeCGT').textContent})
```

Expected: `≈ $25,025`, `≈ $100,155`, `≈ $239,505` — unchanged from before this task.

Check the console is clean:

```js
JSON.stringify({errors: 0})
```

Use `read_console_messages` with `onlyErrors: true`; expected: no logs.

- [ ] **Step 4: Verify the new-build suppression in the browser**

Set the property age to a new build and confirm all three modules hide:

```js
(function(){const e=document.querySelector('[data-field="propertyAge"]');
e.value='newBuild'; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true}));
return JSON.stringify(['proj5','proj10','projLife'].map(function(p){return p+':'+document.getElementById(p+'ReformImpact').hidden;}));})()
```

Expected: `["proj5:true","proj10:true","projLife:true"]`.

Reset it afterwards:

```js
(function(){const e=document.querySelector('[data-field="propertyAge"]');
e.value='mid'; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return 'reset';})()
```

- [ ] **Step 5: Verify the expander works**

```js
(function(){const t=document.getElementById('projLifeReformImpactToggle');
const before=document.getElementById('projLifeReformImpactDetail').hidden;
t.click();
const after=document.getElementById('projLifeReformImpactDetail').hidden;
const label=t.textContent; t.click();
return JSON.stringify({before:before, after:after, label:label, aria:t.getAttribute('aria-expanded')});})()
```

Expected: `before: true`, `after: false`, `label: "hide"`.

Do **not** take a screenshot and do **not** claim visual or responsive verification — screenshots come back blank for this page and the preview pane misreports width.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: render the 2027 reform impact module on all three cards (#17)"
```

---

## Task 6: Structural guard and ratchet

**Files:**
- Modify: `.claude/smoke-test.js:23` (`minTests`)
- Modify: `.claude/smoke-test.js` (new check before the `// Result` block at line ~360)

- [ ] **Step 1: Raise the ratchet**

Change line 23 from:

```js
  { label: 'tests/engine.test.js', file: path.join(TESTS_DIR, 'engine.test.js'), minTests: 116 }
```

to:

```js
  { label: 'tests/engine.test.js', file: path.join(TESTS_DIR, 'engine.test.js'), minTests: 124 }
```

- [ ] **Step 2: Add the structural check**

Insert immediately **before** the `// Result` comment near line 360:

```js
(function checkReformImpactUsesEngineOutput() {
  // The module must read calcReformImpact's output, not recompute a delta in
  // the DOM layer. A literal subtraction of two cgt figures in index.html is
  // exactly the CGT-only delta this feature exists to avoid shipping — it is
  // negative at 5 years and positive at 15 on the same property.
  const wired = /calcReformImpact\(\{[\s\S]{0,200}\bsaleArgs\s*[,}]/.test(html);
  if (!wired) {
    fail('calcReformImpact is not being passed the existing saleArgs — the module may be building its own sale');
    return;
  }
  const recomputes = /ReformImpactText[\s\S]{0,600}?\bcgt\s*-\s*\w*[Oo]ld\w*[Cc]gt\b/.test(html);
  if (recomputes) {
    fail('the reform impact sentence appears to recompute a CGT-only delta in index.html');
    return;
  }
  ok('Reform impact module reads calcReformImpact output, not a recomputed CGT delta');
})();
```

- [ ] **Step 3: Run the full smoke test**

```bash
node .claude/smoke-test.js
```

Expected: `Result: PASS (14 passed, 0 failed)`, with `tests/engine.test.js` reporting 125 tests.

- [ ] **Step 4: Commit**

```bash
git add .claude/smoke-test.js
git commit -m "test: guard the reform impact module against a recomputed CGT delta (#17)"
```

---

## Task 7: Update the UI spec

**Files:**
- Modify: `specs/truereturn-ui-requirements.md:65-80` (§3a)

- [ ] **Step 1: Rewrite §3a**

Replace the whole of §3a (from the heading `## 3a. The 2027 reform impact module (v2.2)` through the "Negative results render honestly" paragraph ending line 80) with:

```markdown
## 3a. The 2027 reform impact module (v3.1 — implemented, issue #17)

**Trigger:** shown only when the modelled outcome actually differs under the reform. Implemented as `|totalTaxDelta| >= $1`, gated on the arithmetic and never on `dwellingType` — the same rule §3 v2.6 adopted for the degenerate sensitivity band, for the same reason: it stays correct if the winning CGT option changes. New builds measure exactly $0 at all three periods (they keep full negative gearing and may elect the 50% discount on the whole gain, which *is* the old-rules calculation) and hide themselves with no special case.

**What it measures (v3.1 correction — this changed).** v2.2 specified the collapsed sentence lead with the **CGT-only** regime delta (tax spec §7 output 2). Measured on the shipped build — default property, established, MTR 0.37 — that delta is **negative at 5 years**: −$12,057 at 5yr, +$4,641 at 10yr, +$67,703 at 15yr. Shipped as specified, the 5-year card would have claimed the reform **saved** the investor $12,057 while the 15-year card of the same property said it cost them $67,703.

The cause is structural, not arithmetic: the quarantine pool ($62,780 at 5 years) offsets a still-small gain by more than the lost 50% discount costs. It reads as a saving only because the foregone negative-gearing refunds sit outside the number — precisely the failure §4 already documents for the pool shown in isolation.

The module therefore measures **total tax over the holding period** under each rulebook:

```
totalTax = CGT at sale − negative-gearing refunds received along the way
```

Giving +$11,171 / +$37,174 / +$100,235 at 5/10/15 years — correct sign at every period.

**Refunds are not zero under the new rules.** Quarantine applies only to income years starting on/after 1 July 2027, so ~11 months of losses stay deductible under both rulebooks ($7,619 on the default property, identical on both sides). The new-rules refund column must never be rendered as a flat zero.

**Not a net-outcome comparison.** The period card's cumulative cash flow is pre-tax on both sides and has never counted refunds, so no shipped figure a "net outcome" row could agree with exists. Staying in tax space is what stops the module contradicting the profit figures already on the card.

**Collapsed state (default) — one factual sentence, verb swapping on sign:**
> "The 2027 tax changes **add $11,171** to the tax on this property over 5 years." — with an expand affordance ("see how").
> "The 2027 tax changes **reduce** the tax on this property by **$15,354** over 15 years."

The negative arm is measured, not hypothetical: 3% growth over 15 years indexes the post-2027 cost base past the gain. The delta is also **not monotonic in growth** — it dips near 4% and climbs steeply after — so no "the longer you hold, the worse it gets" copy may appear anywhere in the module.

**Expanded detail — the same sale, two rulebooks.** Two-column table, nothing ranked, nothing selectable, no colour judgment. Rows: CGT at sale; the dual-era split as **tax** (not gain) on the new-rules side only; negative-gearing refunds along the way, rendered as negatives; total tax. Below it, when a pool exists at sale, one note stating the pooled figure is already used up in the tax line above.

**Two deviations from v2.2, both deliberate:**
- **No separate quarantine-treatment row.** It would double-count: the quarantine difference *is* the refunds row, and the pool's value at sale *is* already inside the new-rules CGT figure. Carried as the note instead — §4's reconciliation discipline applied here.
- **No duplicate deemed-value sensitivity band.** §3 requires the band be visible wherever a dual-era figure is shown; it already is, two lines above on the same card. Visible, not duplicated.

- **No sale-timing dimension (unchanged from v2.2):** no counterfactual sale date, no pre-2027 scenario, no breakeven rate — anywhere in the product. `compareSaleTiming` and the breakeven solver remain engine capabilities only (tested, unused by UI), like the new-build optimizer.

**Framing rules (in addition to §5):** no question-mark titles, no imperative verbs in the module ("sell", "hold", "act"), no side ranked above the other, no colour judgment. The module explains what the Act does to this property; the reader draws their own conclusion.

**Negative results render honestly:** when a scenario's result goes negative, the net figure renders as a real negative (e.g. "−$36.5k") with no colour alarm beyond TrueReturn's standard negative convention — never blanked, clamped, or shown as $0 (tax spec §13). Honest, not editorialised.
```

- [ ] **Step 2: Bump the spec version header**

`specs/truereturn-ui-requirements.md` line 3 is a single very long paragraph beginning `**Version:** 3.0 — FINAL.` followed by a reverse-chronological changelog. Do not rewrite it. Change only the opening, from:

```
**Version:** 3.0 — FINAL. **v3.0 change (issue #14, 2026-07-29):**
```

to:

```
**Version:** 3.1 — FINAL. **v3.1 change (issue #17, 2026-07-30):** the 2027 reform impact module (§3a) is **implemented**, and what it measures is **corrected**. v2.2 specified the collapsed sentence lead with the CGT-only regime delta; measured on the shipped build that delta is **negative at 5 years** (−$12,057) and positive at 15 (+$67,703) on the same property, so the two period cards would have contradicted each other — the reform reading as a saving on one and a cost on the other. The module therefore measures **total tax over the hold** (CGT at sale less negative-gearing refunds received): +$11,171 / +$37,174 / +$100,235 at 5/10/15 years. Two further deviations from v2.2, both deliberate: no separate quarantine-treatment row (it double-counts — the quarantine difference *is* the refunds row and the pool's value is already inside the new-rules CGT figure), and no duplicate deemed-value sensitivity band (already visible two lines above on the same card). The negative arm is measured, not hypothetical (3% growth, 15 years, −$15,354), and the delta is **not monotonic in growth**, so no "the longer you hold, the worse it gets" copy is permitted anywhere in the module. **v3.0 change (issue #14, 2026-07-29):**
```

- [ ] **Step 3: Run the full smoke test**

```bash
node .claude/smoke-test.js
```

Expected: `Result: PASS (14 passed, 0 failed)`.

- [ ] **Step 4: Commit**

```bash
git add specs/truereturn-ui-requirements.md
git commit -m "docs: UI spec to v3.1 -- reform impact module measures total tax (#17)"
```

---

## Definition of done

- [ ] `node .claude/smoke-test.js` reports `PASS (14 passed, 0 failed)` with 125 engine tests
- [ ] All three cards show the module on the default property, with the measured figures from Task 5 Step 3
- [ ] A new build hides all three modules
- [ ] The `see how` expander opens and closes, and `aria-expanded` tracks it
- [ ] `#proj5CGT`, `#proj10CGT` and `#projLifeCGT` are unchanged from before this branch
- [ ] No console errors
- [ ] No screenshot-based or responsive claim appears anywhere in the reporting
