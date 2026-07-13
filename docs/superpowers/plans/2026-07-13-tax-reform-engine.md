# TrueReturn Tax Reform Engine (Phase 0 + Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract TrueReturn's calculations into a pure, node-testable `engine.js` and build the 2026–27 tax-reform modules (regime router, NG quarantine, dual-era CGT, new-build optimizer, sale-timing comparison) per `specs/truereturn-tax-engine-requirements.md`.

**Architecture:** `engine.js` is a classic browser script (top-level `function`/`const` declarations, loaded before the inline script in `index.html`) with a `module.exports` guard so node tests can `require()` it. All new reform logic is pure functions taking plain-object inputs — no DOM access anywhere in the file. UI wiring of the new modules is Phase 2 (separate plan); this plan only changes `index.html` where existing pure code moves out of it.

**Tech Stack:** Vanilla JS, no build system, no npm. Tests run with `node tests/unit.js` and `node tests/engine.test.js` using the repo's existing micro-harness pattern.

**Tracking:** GitHub issue #2. Work happens on a feature branch/worktree (create via superpowers:using-git-worktrees at execution start). Never push without explicit user instruction.

---

## Domain primer (read before Task 3)

Two 2026–27 reforms, independently grandfathered:

1. **Negative gearing (NG) quarantine** — keyed to **contract date**. Contracts on/before Budget night (12 May 2026) keep full deductibility forever; new builds are exempt too. Everyone else: rental losses in income years starting on/after 1 July 2027 stop reducing salary tax and instead accumulate in a nominal-dollar pool that can only offset residential rental profits or residential capital gains at sale. AU income years run 1 July–30 June.
2. **CGT dual-era** — keyed to **time**, applies to all holders. Assets held at 30 June 2027 are deemed sold/reacquired at market value. On an actual sale on/after 1 July 2027: the pre-2027 gain component gets the old 50% discount; the post-2027 component gets CPI indexation of the cost base instead of a discount, taxed at `max(marginalRate, 30%)`. New builds/affordable housing may instead choose whole-gain old treatment (best-of).

Ordering rule for offsets (spec §5.7 + §4.5): capital losses and the quarantine pool apply against the **pre-component gross gain first, then the post-component**, before discount/indexation percentages are applied.

Deliberate deviations from current live behaviour (approved, recorded in issue #2):
- The **new** old-regime module (`calcOldRegimeCGT`, Task 5) includes selling costs in the cost base (CGT element 2) per spec test T1. The current inline code does **not** (it only nets selling costs off proceeds), so the legacy extraction (`legacySaleOutcome`, Task 2) preserves the current math bit-identically and the two coexist until Phase 2 rewires the UI.
- Current `calcDepreciation` output is treated as the Div 43 capital-works estimate (it models building depreciation only), so cumulative `calcDepreciation` = "Div 43 claimed".

Numeric conventions: dates are ISO `'YYYY-MM-DD'` strings (lexicographic comparison is safe). `yearFrac` is anniversary-aware so exact anniversaries give whole years (spec test T2 requires exactly `1.025²`). Spec T3/T4 expected values were hand-derived with rounded year fractions (e.g. "4.08"); our exact day counts give slightly different figures (derived below per test) — the spec explicitly calls its T3 figures "directional" and makes the invariants the hard requirement. Do not tune the engine to reproduce the spec's rounding.

---

## File structure

- **Create `engine.js`** (repo root, next to `index.html`) — all pure calculation code: moved legacy functions + constants, date/CPI helpers, regime router, quarantine module, dual-era CGT, optimizer, comparison engine. One file: it is the single deployable unit the static site loads, and the domain logic is one coherent responsibility (tax math).
- **Create `tests/harness.js`** — the shared `test`/`approxEqual`/`summary` micro-harness (extracted from `tests/unit.js`).
- **Create `tests/engine.test.js`** — all tests for `engine.js` (golden legacy tests + reform tests T1–T6).
- **Modify `index.html`** — add `<script src="engine.js">`, delete the moved declarations, replace the three inline CGT blocks with `legacySaleOutcome()` calls. No behaviour change.
- **Modify `tests/unit.js`** — `require` the engine and harness instead of copy-pasting functions.

---

### Task 1: Extract engine.js scaffold and de-duplicate tests

**Files:**
- Create: `engine.js`
- Create: `tests/harness.js`
- Modify: `index.html` (script tag ~line 22; delete declarations at ~3532–3544, ~3785–3792, ~3794–3869, ~3871–3876)
- Modify: `tests/unit.js`

- [ ] **Step 1: Run the existing suite to capture the baseline**

Run: `node tests/unit.js`
Expected: `N passed, 0 failed` (note N; it must not drop).

- [ ] **Step 2: Create `engine.js` with the moved code**

Create `engine.js`. Copy the following four declarations **verbatim, character-for-character** out of `index.html` (do not reformat; goldens and diff review depend on it):
- `const stateDefaults = { ... };` (index.html ~3533–3542)
- `const BUILDING_PEST = 600;` and `const LOAN_ESTABLISHMENT = 800;` (~3543–3544)
- `function formatCurrency(amount) { ... }` (~3785–3792)
- `function calcStampDuty(state, price) { ... }` (~3794–3869, the whole switch)
- `function calcDepreciation(ageBracket, purchasePrice) { ... }` (~3871–3876)

File shape:

```js
// engine.js — TrueReturn pure calculation engine.
// Loaded by index.html as a classic script (declarations land in the global
// lexical scope) and require()'d by node tests via the module.exports guard.
// No DOM access in this file.

// ── Legacy pure functions (moved verbatim from index.html) ──────────────
<the five moved declarations, verbatim>

// ── Node export guard ────────────────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    stateDefaults, BUILDING_PEST, LOAN_ESTABLISHMENT,
    formatCurrency, calcStampDuty, calcDepreciation,
  };
}
```

Every later task appends new functions above the guard and adds them to the export list.

- [ ] **Step 3: Wire `index.html` to the engine and delete the moved code**

In `index.html`:
1. Directly **before** the `<script>` at line ~3482 (the main inline script), insert:
   ```html
   <script src="engine.js"></script>
   ```
   (Not `defer` — the inline script depends on it, and the project rule "stateDefaults must be defined before calculate()" is preserved because engine.js executes first.)
2. Delete the five moved declarations from the inline script (the exact blocks copied in Step 2). Leave `SIMPLE_MODE_DEFAULTS`, `SIMPLE_MODE_TAX`, `window.TrueReturn`, and everything else untouched.

- [ ] **Step 4: Create `tests/harness.js`**

```js
// tests/harness.js — shared micro test harness.
const assert = require('assert');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

function approxEqual(actual, expected, tolerance) {
  const tol = tolerance !== undefined ? tolerance : 0.01;
  assert(
    Math.abs(actual - expected) <= tol,
    `Expected ~${expected} but got ${actual} (tolerance ${tol})`
  );
}

function summary() {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

module.exports = { assert, test, approxEqual, summary };
```

- [ ] **Step 5: De-duplicate `tests/unit.js`**

At the top of `tests/unit.js`, replace the `const assert = require('assert');`, the copy-pasted `formatCurrency` and `calcStampDuty` definitions, and the `let passed/failed`, `function test`, `function approxEqual` block with:

```js
const { assert, test, approxEqual, summary } = require('./harness.js');
const { formatCurrency, calcStampDuty, calcDepreciation, stateDefaults } = require('../engine.js');
```

At the bottom, replace the summary block (`console.log(\`\n${passed} passed...\`)` + `process.exit`) with:

```js
summary();
```

Leave `calcCashFlowPositiveYear` (defined only in the test file — it mirrors an inline loop, nothing moves) and all test bodies untouched.

- [ ] **Step 6: Verify the suite still passes with the same count**

Run: `node tests/unit.js`
Expected: same `N passed, 0 failed` as Step 1.

- [ ] **Step 7: Verify the page still boots**

Run: `grep -c 'src="engine.js"' index.html && ! grep -q 'const stateDefaults' index.html && node -e "require('./engine.js'); console.log('engine loads')"`
Expected: `1`, then `engine loads` (script tag present, moved declaration gone, engine parses in node). Full browser verification happens at the smoke-tester pipeline stage.

- [ ] **Step 8: Commit**

```bash
git add engine.js tests/harness.js tests/unit.js index.html
git commit -m "refactor: extract pure calculation functions into engine.js

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Golden-file regression tests + legacy sale-outcome extraction

Pins the current CGT/sale math (spec §6) before any reform code exists, then consolidates the three duplicated inline blocks into one engine function.

**Files:**
- Modify: `engine.js`
- Create: `tests/engine.test.js`
- Modify: `index.html` (three inline CGT sites: ~4697–4705, ~4913–4919, ~5022–5034)

- [ ] **Step 1: Write the failing golden tests**

Create `tests/engine.test.js`:

```js
// tests/engine.test.js — tests for the TrueReturn calculation engine.
const { assert, test, approxEqual, summary } = require('./harness.js');
const E = require('../engine.js');

// ── Golden regression: legacySaleOutcome (spec §6) ──────────────────────
// Pins the CURRENT live math bit-identically. Selling costs are NOT in the
// cost base here (that is the pre-existing behaviour); the spec-correct
// treatment lives in calcOldRegimeCGT (Task 5). Do not "fix" these numbers.
console.log('\nlegacySaleOutcome (golden regression)');

test('G1: mid-age property, 10yr hold, 5% growth', () => {
  const r = E.legacySaleOutcome({
    purchasePrice: 600000, stampDuty: 20000, conveyancing: 900,
    buildingPest: 600, cumulativeDepr: 56250,
    futureValue: 600000 * Math.pow(1.05, 10),
    remainingLoan: 480000, marginalTaxRate: 0.39,
  });
  approxEqual(r.salesCosts, 29320.10);
  approxEqual(r.netProceeds, 468016.67);
  approxEqual(r.costBase, 565250, 0.001);
  approxEqual(r.capitalGain, 412086.78);
  approxEqual(r.cgt, 80356.92);
  approxEqual(r.trueCashReturn, 387659.75);
});

test('G2: negative gain pays no CGT', () => {
  const r = E.legacySaleOutcome({
    purchasePrice: 600000, stampDuty: 20000, conveyancing: 900,
    buildingPest: 600, cumulativeDepr: 0,
    futureValue: 500000, remainingLoan: 400000, marginalTaxRate: 0.39,
  });
  approxEqual(r.cgt, 0, 0.001);
  approxEqual(r.trueCashReturn, 85000, 0.001);
});

test('G3: St Leonards scenario (spec §6) under current engine math', () => {
  // NSW, $519k purchase, 5 whole years at engine granularity, sold $660k.
  // Stamp duty from current NSW bands: 9390 + (519000-313000)*0.045 = 18660.
  // Depreciation 'older': 519000*0.75*0.0075 = 2919.375/yr × 5 = 14596.875.
  // Note: current engine hardcodes 3% selling costs (19800), not §6's ~13.8k.
  const r = E.legacySaleOutcome({
    purchasePrice: 519000, stampDuty: 18660, conveyancing: 1800,
    buildingPest: 600, cumulativeDepr: 14596.875,
    futureValue: 660000, remainingLoan: 415200, marginalTaxRate: 0.37,
  });
  approxEqual(r.salesCosts, 19800, 0.001);
  approxEqual(r.netProceeds, 225000, 0.001);
  approxEqual(r.costBase, 525463.125, 0.001);
  approxEqual(r.cgt, 24889.32);
  approxEqual(r.trueCashReturn, 200110.68);
});

summary();
```

- [ ] **Step 2: Run to verify failure**

Run: `node tests/engine.test.js`
Expected: FAIL — `E.legacySaleOutcome is not a function`.

- [ ] **Step 3: Implement `legacySaleOutcome` in `engine.js`**

Append above the export guard (and add `legacySaleOutcome` to the exports):

```js
// ── Legacy sale outcome ──────────────────────────────────────────────────
// Bit-identical consolidation of the three inline CGT blocks that lived in
// index.html (projections, calcScenarioProfit, compare table). Preserves
// current live behaviour, including selling costs NOT being in the cost
// base. Spec-correct old-regime law lives in calcOldRegimeCGT.
function legacySaleOutcome({ purchasePrice, stampDuty, conveyancing,
                             buildingPest, cumulativeDepr, futureValue,
                             remainingLoan, marginalTaxRate }) {
  const salesCosts = futureValue * 0.03;
  const netProceeds = futureValue - salesCosts - remainingLoan;
  const costBase = Math.max(0, purchasePrice + stampDuty + conveyancing + buildingPest - cumulativeDepr);
  const capitalGain = futureValue - costBase;
  const cgt = capitalGain > 0 ? capitalGain * 0.5 * marginalTaxRate : 0;
  return { salesCosts, netProceeds, costBase, capitalGain, cgt,
           trueCashReturn: netProceeds - cgt };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node tests/engine.test.js`
Expected: 3 passed, 0 failed.

- [ ] **Step 5: Replace the three inline sites in `index.html`**

Site 1 — projections block (~4696–4705). Replace:

```js
        // Cash Out Position
        const salePrice = futureValue;
        const salesCosts = salePrice * 0.03;
        const netProceeds = salePrice - salesCosts - remainingLoan;
        const cumulativeDepr = annualDepreciation * years;
        const costBase = Math.max(0, purchasePrice + stampDuty + conveyancing + BUILDING_PEST - cumulativeDepr);
        const capitalGain = salePrice - costBase;
        const discountedGain = capitalGain > 0 ? capitalGain * 0.50 : 0;
        const cgt = discountedGain > 0 ? discountedGain * marginalTaxRate : 0;
        const trueCashReturn = netProceeds - cgt;
```

with:

```js
        // Cash Out Position
        const salePrice = futureValue;
        const { salesCosts, netProceeds, cgt, trueCashReturn } = legacySaleOutcome({
          purchasePrice, stampDuty, conveyancing, buildingPest: BUILDING_PEST,
          cumulativeDepr: annualDepreciation * years,
          futureValue, remainingLoan, marginalTaxRate,
        });
```

Site 2 — `calcScenarioProfit` (~4912–4919). Replace:

```js
      const futureValue = purchasePrice * Math.pow(1 + growthRate, years);
      const salesCosts = futureValue * 0.03;
      const netProceeds = futureValue - salesCosts - remainingLoan;
      const cumulativeDepr = annualDepreciation * years;
      const costBase = Math.max(0, purchasePrice + stampDuty + conveyancing + BUILDING_PEST - cumulativeDepr);
      const capitalGain = futureValue - costBase;
      const cgt = capitalGain > 0 ? capitalGain * 0.5 * marginalTaxRate : 0;
      const trueCashReturn = netProceeds - cgt;
```

with:

```js
      const futureValue = purchasePrice * Math.pow(1 + growthRate, years);
      const { trueCashReturn } = legacySaleOutcome({
        purchasePrice, stampDuty, conveyancing, buildingPest: BUILDING_PEST,
        cumulativeDepr: annualDepreciation * years,
        futureValue, remainingLoan, marginalTaxRate,
      });
```

Site 3 — compare-table loop (~5022–5034). Replace:

```js
            const salePrice = futureValue;
            const salesCosts = salePrice * 0.03;
            const netProceeds = salePrice - salesCosts - remainingLoan;
            const cumulativeDepr = annDepr * y;
            const mtr = document.body.dataset.mode === 'simple'
              ? parseFloat(SIMPLE_MODE_TAX)
              : (ev('marginalTaxRate') || 0.37);
            const costBase = Math.max(0, purchasePrice + stampDuty + conveyancing + BUILDING_PEST - cumulativeDepr);
            const capitalGain = salePrice - costBase;
            const discountedGain = capitalGain > 0 ? capitalGain * 0.50 : 0;
            const cgt = discountedGain > 0 ? discountedGain * mtr : 0;
            const trueCashReturn = netProceeds - cgt;
```

with:

```js
            const mtr = document.body.dataset.mode === 'simple'
              ? parseFloat(SIMPLE_MODE_TAX)
              : (ev('marginalTaxRate') || 0.37);
            const { trueCashReturn } = legacySaleOutcome({
              purchasePrice, stampDuty, conveyancing, buildingPest: BUILDING_PEST,
              cumulativeDepr: annDepr * y,
              futureValue, remainingLoan, marginalTaxRate: mtr,
            });
```

(Check each site's surrounding code for later uses of the deleted locals — e.g. site 1 writes `salesCosts`/`netProceeds` to the DOM, which the destructuring preserves. If a site uses a variable not in the destructure, add it to the destructure rather than recomputing.)

- [ ] **Step 6: Run both suites**

Run: `node tests/unit.js && node tests/engine.test.js`
Expected: both green, unit.js count unchanged.

- [ ] **Step 7: Commit**

```bash
git add engine.js tests/engine.test.js index.html
git commit -m "refactor: consolidate inline CGT math into legacySaleOutcome with golden regression tests

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Date, income-year, and CPI-indexation helpers

**Files:**
- Modify: `engine.js`
- Modify: `tests/engine.test.js`

- [ ] **Step 1: Write the failing tests** (insert before `summary()`; all later tasks do the same)

```js
// ── Date & indexation helpers ────────────────────────────────────────────
console.log('\ndate & indexation helpers');

test('daysBetween counts calendar days', () => {
  assert.strictEqual(E.daysBetween('2027-01-01', '2027-06-01'), 151);
});

test('yearFrac is exact on anniversaries', () => {
  assert.strictEqual(E.yearFrac('2027-07-01', '2029-07-01'), 2);
});

test('yearFrac: whole years plus remainder days/365.25', () => {
  approxEqual(E.yearFrac('2027-07-01', '2031-08-01'), 4 + 31 / 365.25, 1e-9);
  approxEqual(E.yearFrac('2027-07-01', '2032-10-01'), 5 + 92 / 365.25, 1e-9);
});

test('yearFrac is 0 for reversed or equal dates', () => {
  assert.strictEqual(E.yearFrac('2029-07-01', '2027-07-01'), 0);
});

test('cpiFactor compounds', () => {
  approxEqual(E.cpiFactor(0.025, 2), 1.050625, 1e-9);
});

test('fyStartYear maps dates to AU income years', () => {
  assert.strictEqual(E.fyStartYear('2027-06-30'), 2026);
  assert.strictEqual(E.fyStartYear('2027-07-01'), 2027);
});

test('reform boundary constants', () => {
  assert.strictEqual(E.BUDGET_NIGHT_ISO, '2026-05-12');
  assert.strictEqual(E.BOUNDARY_ISO, '2027-07-01');
  assert.strictEqual(E.DEEMED_DATE_ISO, '2027-06-30');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node tests/engine.test.js` — Expected: new tests FAIL (`E.daysBetween is not a function`).

- [ ] **Step 3: Implement in `engine.js`** (append above the guard; add all new names to exports)

```js
// ── 2026–27 reform: date & indexation helpers ───────────────────────────
// Dates are ISO 'YYYY-MM-DD' strings throughout (lexicographic comparison
// is chronologically correct for that format).
// Budget night is 7:30pm AEST 12 May 2026; inputs are date-only, so a
// contract dated exactly 2026-05-12 is treated as grandfathered (the UI
// surfaces the straddle/evening caveat).
const BUDGET_NIGHT_ISO = '2026-05-12';
const BOUNDARY_ISO = '2027-07-01';
const DEEMED_DATE_ISO = '2027-06-30';

function isoToUTC(iso) { return new Date(iso + 'T00:00:00Z'); }

function daysBetween(isoFrom, isoTo) {
  return Math.round((isoToUTC(isoTo) - isoToUTC(isoFrom)) / 86400000);
}

// Anniversary-aware year fraction: whole years between anniversaries plus
// remaining days / 365.25, so exact anniversaries give exact integers
// (spec T2 requires indexation of exactly 1.025^2 for a 2-year hold).
function yearFrac(isoFrom, isoTo) {
  const from = isoToUTC(isoFrom), to = isoToUTC(isoTo);
  if (to <= from) return 0;
  let years = to.getUTCFullYear() - from.getUTCFullYear();
  let anniv = new Date(Date.UTC(from.getUTCFullYear() + years, from.getUTCMonth(), from.getUTCDate()));
  if (anniv > to) {
    years -= 1;
    anniv = new Date(Date.UTC(from.getUTCFullYear() + years, from.getUTCMonth(), from.getUTCDate()));
  }
  return years + (to - anniv) / 86400000 / 365.25;
}

function cpiFactor(rate, years) { return Math.pow(1 + rate, years); }

// AU income year: 1 July–30 June. Returns the calendar year the FY starts in.
function fyStartYear(iso) {
  const d = isoToUTC(iso);
  return d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}
```

- [ ] **Step 4: Run to verify pass** — `node tests/engine.test.js`, all green.

- [ ] **Step 5: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat: date, income-year and CPI indexation helpers for reform engine

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Regime router (spec §3)

**Files:**
- Modify: `engine.js`
- Modify: `tests/engine.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// ── Regime router (spec §3) ──────────────────────────────────────────────
console.log('\nrouteRegimes');

test('pre-Budget-night established, sold pre-boundary: FULL / OLD', () => {
  assert.deepStrictEqual(
    E.routeRegimes({ contractDate: '2020-07-01', dwellingType: 'established', saleDate: '2026-03-01' }),
    { ng: 'FULL', cgt: 'OLD' });
});

test('grandfathered NG but dual-era CGT (the key mixed case)', () => {
  assert.deepStrictEqual(
    E.routeRegimes({ contractDate: '2020-07-01', dwellingType: 'established', saleDate: '2029-07-01' }),
    { ng: 'FULL', cgt: 'DUAL_ERA' });
});

test('post-Budget-night established: quarantine + dual-era', () => {
  assert.deepStrictEqual(
    E.routeRegimes({ contractDate: '2026-08-01', dwellingType: 'established', saleDate: '2031-08-01' }),
    { ng: 'QUARANTINE_FROM_2027', cgt: 'DUAL_ERA' });
});

test('new build: NG exempt, best-of CGT', () => {
  assert.deepStrictEqual(
    E.routeRegimes({ contractDate: '2026-10-01', dwellingType: 'newBuild', saleDate: '2032-10-01' }),
    { ng: 'FULL', cgt: 'BEST_OF' });
});

test('affordable housing: best-of CGT but NOT NG-exempt', () => {
  assert.deepStrictEqual(
    E.routeRegimes({ contractDate: '2026-10-01', dwellingType: 'affordableHousing', saleDate: '2032-10-01' }),
    { ng: 'QUARANTINE_FROM_2027', cgt: 'BEST_OF' });
});

test('Budget-night boundary: 12 May grandfathered, 13 May not', () => {
  assert.strictEqual(E.routeRegimes({ contractDate: '2026-05-12', dwellingType: 'established', saleDate: '2030-01-01' }).ng, 'FULL');
  assert.strictEqual(E.routeRegimes({ contractDate: '2026-05-13', dwellingType: 'established', saleDate: '2030-01-01' }).ng, 'QUARANTINE_FROM_2027');
});

test('sale boundary: 30 June 2027 OLD, 1 July 2027 DUAL_ERA', () => {
  assert.strictEqual(E.routeRegimes({ contractDate: '2026-08-01', dwellingType: 'established', saleDate: '2027-06-30' }).cgt, 'OLD');
  assert.strictEqual(E.routeRegimes({ contractDate: '2026-08-01', dwellingType: 'established', saleDate: '2027-07-01' }).cgt, 'DUAL_ERA');
});

test('no sale date routes CGT to OLD (no CGT event yet)', () => {
  assert.strictEqual(E.routeRegimes({ contractDate: '2026-08-01', dwellingType: 'established' }).cgt, 'OLD');
});
```

- [ ] **Step 2: Run to verify failure** — `E.routeRegimes is not a function`.

- [ ] **Step 3: Implement**

```js
// ── Regime router (spec §3) ──────────────────────────────────────────────
// Two independent grandfathering dimensions:
//   NG  — by contract date (Budget night) or new-build exemption.
//   CGT — by sale date relative to 1 July 2027; new builds / affordable
//         housing get a best-of choice instead of forced dual-era.
function routeRegimes({ contractDate, dwellingType, saleDate }) {
  const ng = (contractDate <= BUDGET_NIGHT_ISO || dwellingType === 'newBuild')
    ? 'FULL' : 'QUARANTINE_FROM_2027';
  let cgt;
  if (!saleDate || saleDate < BOUNDARY_ISO) {
    cgt = 'OLD';
  } else {
    cgt = (dwellingType === 'newBuild' || dwellingType === 'affordableHousing')
      ? 'BEST_OF' : 'DUAL_ERA';
  }
  return { ng, cgt };
}
```

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat: regime router for NG grandfathering and CGT era selection

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Spec-correct old-regime CGT + deemed-value interpolation (spec §5.2/§5.4/§6, test T1)

**Files:**
- Modify: `engine.js`
- Modify: `tests/engine.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// ── Old-regime CGT, spec-correct (T1) ────────────────────────────────────
console.log('\ncalcOldRegimeCGT');

test('T1: selling costs in cost base, Div 43 reduces it, 50% discount', () => {
  const r = E.calcOldRegimeCGT({
    salePrice: 660000, sellingCosts: 14000, acquisitionCosts: 520000,
    div43Claimed: 10000, marginalRate: 0.39,
  });
  approxEqual(r.costBase, 524000, 0.001);
  approxEqual(r.grossGain, 136000, 0.001);
  approxEqual(r.taxableGain, 68000, 0.001);
  approxEqual(r.tax, 26520, 0.001);
});

test('no gain, no tax', () => {
  const r = E.calcOldRegimeCGT({
    salePrice: 500000, sellingCosts: 10000, acquisitionCosts: 600000, marginalRate: 0.39,
  });
  assert.strictEqual(r.tax, 0);
});

test('held under 12 months: no discount', () => {
  const r = E.calcOldRegimeCGT({
    salePrice: 660000, sellingCosts: 14000, acquisitionCosts: 520000,
    div43Claimed: 10000, marginalRate: 0.39, heldOver12Months: false,
  });
  approxEqual(r.taxableGain, 136000, 0.001);
  approxEqual(r.tax, 53040, 0.001);
});

test('affordable housing 60% discount via discountPct', () => {
  const r = E.calcOldRegimeCGT({
    salePrice: 950000, sellingCosts: 20000, acquisitionCosts: 700000,
    marginalRate: 0.39, discountPct: 0.6,
  });
  approxEqual(r.taxableGain, 92000, 0.001);
  approxEqual(r.tax, 35880, 0.001);
});

test('quarantine pool offsets gross gain; excess is stranded (spec §4.5)', () => {
  const r = E.calcOldRegimeCGT({
    salePrice: 720000, sellingCosts: 0, acquisitionCosts: 700000,
    marginalRate: 0.39, quarantinePool: 49000,
  });
  approxEqual(r.poolUsed, 20000, 0.001);
  approxEqual(r.strandedPool, 29000, 0.001);
  assert.strictEqual(r.tax, 0);
  // anti-double-benefit (spec §4.4): pool must never enter the cost base
  approxEqual(r.costBase, 700000, 0.001);
});

// ── Deemed-value interpolation (spec §5.4) ───────────────────────────────
console.log('\ninterpolateDeemedValue');

test('linear interpolation by days between purchase and sale', () => {
  // 2020-07-01 → 2027-06-30 is 2555 days; → 2029-07-01 is 3287 days.
  const v = E.interpolateDeemedValue({
    purchasePrice: 600000, purchaseDate: '2020-07-01',
    salePrice: 900000, saleDate: '2029-07-01',
  });
  approxEqual(v, 600000 + 300000 * (2555 / 3287), 0.01);
});

test('clamps to sale price when purchase is after the deemed date', () => {
  const v = E.interpolateDeemedValue({
    purchasePrice: 700000, purchaseDate: '2028-01-01',
    salePrice: 900000, saleDate: '2030-01-01',
  });
  assert.strictEqual(v, 700000);
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

```js
// ── Offsets ordering (spec §5.7 + §4.5) ──────────────────────────────────
// Capital losses, then the quarantine pool, applied against gross gains —
// pre/discount component first, then post/indexed component. Losses and
// pool never offset a component that is already a loss.
function applyOffsets({ preGross, postGross, capitalLosses = 0, quarantinePool = 0 }) {
  let pre = preGross, post = postGross;
  let lossesUsed = 0, poolUsed = 0;
  for (const kind of ['losses', 'pool']) {
    let avail = kind === 'losses' ? capitalLosses : quarantinePool;
    const usePre = Math.min(Math.max(pre, 0), avail);
    pre -= usePre; avail -= usePre;
    const usePost = Math.min(Math.max(post, 0), avail);
    post -= usePost; avail -= usePost;
    if (kind === 'losses') lossesUsed = capitalLosses - avail;
    else poolUsed = quarantinePool - avail;
  }
  return {
    preAfter: pre, postAfter: post, lossesUsed, poolUsed,
    strandedPool: quarantinePool - poolUsed,
    capitalLossesRemaining: capitalLosses - lossesUsed,
  };
}

// ── Old-regime CGT, spec-correct (spec §5.2 / §6 / T1) ───────────────────
// Unlike legacySaleOutcome, selling costs are a cost-base element (element
// 2) and only Div 43 capital works reduce the cost base. Used for pre-2027
// sales, the BEST_OF Option A path, and the dual-era pre-component's rules.
function calcOldRegimeCGT({ salePrice, sellingCosts, acquisitionCosts,
                            div43Claimed = 0, capitalLosses = 0, quarantinePool = 0,
                            marginalRate, heldOver12Months = true, discountPct = 0.5 }) {
  const costBase = acquisitionCosts + sellingCosts - div43Claimed;
  const grossGain = salePrice - costBase;
  const o = applyOffsets({ preGross: grossGain, postGross: 0, capitalLosses, quarantinePool });
  const gainAfterOffsets = Math.max(0, o.preAfter);
  const taxableGain = heldOver12Months ? gainAfterOffsets * (1 - discountPct) : gainAfterOffsets;
  return {
    costBase, grossGain, gainAfterOffsets, taxableGain,
    tax: taxableGain * marginalRate,
    poolUsed: o.poolUsed, strandedPool: o.strandedPool,
    capitalLossesRemaining: o.capitalLossesRemaining,
  };
}

// ── Deemed-value default (spec §5.4) ─────────────────────────────────────
// Linear time interpolation between purchase price and sale price. Flagged
// as estimate-sensitive by callers; users can override with a real value.
function interpolateDeemedValue({ purchasePrice, purchaseDate, salePrice, saleDate }) {
  const total = daysBetween(purchaseDate, saleDate);
  const toDeemed = daysBetween(purchaseDate, DEEMED_DATE_ISO);
  if (total <= 0 || toDeemed <= 0) return purchasePrice;
  return purchasePrice + (salePrice - purchasePrice) * Math.min(1, toDeemed / total);
}
```

Note: `calcOldRegimeCGT` reuses `applyOffsets` with a zero post-component so pool/stranded semantics are identical in both regimes. `taxableGain * (1 - discountPct)` — careful: `discountPct` is the discount (0.5 ⇒ half taxable), so `0.6` for affordable housing leaves 40% taxable, matching the test.

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat: spec-correct old-regime CGT, offsets ordering, deemed-value interpolation

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Dual-era CGT module (spec §5, tests T2/T2b) + timeApportion placeholder (§5.5)

**Files:**
- Modify: `engine.js`
- Modify: `tests/engine.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// ── applyOffsets ordering (spec §5.7 / §4.5) ─────────────────────────────
console.log('\napplyOffsets');

test('pool hits pre gross first, then post', () => {
  const o = E.applyOffsets({ preGross: 10000, postGross: 46648, quarantinePool: 49000 });
  approxEqual(o.preAfter, 0, 0.001);
  approxEqual(o.postAfter, 7648, 0.001);
  approxEqual(o.poolUsed, 49000, 0.001);
  approxEqual(o.strandedPool, 0, 0.001);
});

test('pool never offsets a component in loss; excess strands', () => {
  const o = E.applyOffsets({ preGross: 10000, postGross: -83352, quarantinePool: 49000 });
  approxEqual(o.preAfter, 0, 0.001);
  approxEqual(o.postAfter, -83352, 0.001);
  approxEqual(o.poolUsed, 10000, 0.001);
  approxEqual(o.strandedPool, 39000, 0.001);
});

test('capital losses apply before the pool, same pre-then-post order', () => {
  const o = E.applyOffsets({ preGross: 100000, postGross: 50000, capitalLosses: 120000, quarantinePool: 10000 });
  approxEqual(o.preAfter, 0, 0.001);
  approxEqual(o.postAfter, 20000, 0.001);   // 120k losses: 100k pre + 20k post; pool: 10k post
  approxEqual(o.lossesUsed, 120000, 0.001);
  approxEqual(o.poolUsed, 10000, 0.001);
});

// ── Dual-era CGT (spec §5, T2/T2b) ───────────────────────────────────────
console.log('\ncalcDualEraCGT');

test('T2: grandfathered NG, dual-era CGT', () => {
  const r = E.calcDualEraCGT({
    deemedValue: 800000, oldCostBase: 600000,
    salePrice: 900000, saleDate: '2029-07-01', sellingCosts: 20000,
    cpiRate: 0.025, marginalRate: 0.39,
  });
  approxEqual(r.preGross, 200000, 0.001);
  approxEqual(r.taxOnPre, 39000, 0.001);
  approxEqual(r.indexedCostBase, 860500, 0.01);   // 800000×1.025² + 20000
  approxEqual(r.postGross, 39500, 0.01);
  approxEqual(r.taxOnPost, 15405, 0.01);
  approxEqual(r.totalCGT, 54405, 0.01);
  assert.strictEqual(r.minTaxBound, false);
});

test('T2b: 21% marginal rate — the 30% floor binds on the post-component', () => {
  const r = E.calcDualEraCGT({
    deemedValue: 800000, oldCostBase: 600000,
    salePrice: 900000, saleDate: '2029-07-01', sellingCosts: 20000,
    cpiRate: 0.025, marginalRate: 0.21,
  });
  approxEqual(r.taxOnPre, 21000, 0.001);
  approxEqual(r.taxOnPost, 11850, 0.01);          // 39500 × 30%
  assert.strictEqual(r.minTaxBound, true);
});

test('post-2027 expenditure indexed from date incurred; ownership costs never indexed', () => {
  const r = E.calcDualEraCGT({
    deemedValue: 800000, oldCostBase: 600000,
    salePrice: 900000, saleDate: '2029-07-01', sellingCosts: 20000,
    cpiRate: 0.025, marginalRate: 0.39,
    postExpenditures: [
      { amount: 10000, date: '2028-07-01' },                  // indexed 1 yr
      { amount: 5000, date: '2028-07-01', indexable: false }, // element 3
    ],
  });
  approxEqual(r.indexedCostBase, 860500 + 10000 * 1.025 + 5000, 0.01);
});

test('pre-component Div 43 reduces old cost base (spec §5.2)', () => {
  const r = E.calcDualEraCGT({
    deemedValue: 800000, oldCostBase: 600000, div43ClaimedPre: 10000,
    salePrice: 900000, saleDate: '2029-07-01', sellingCosts: 20000,
    cpiRate: 0.025, marginalRate: 0.39,
  });
  approxEqual(r.preGross, 210000, 0.001);
});

// ── timeApportion placeholder (spec §5.5 — PENDING law) ──────────────────
console.log('\ncalcTimeApportionedCGT');

test('whole-holding gain split by time; both eras taxed per their rules', () => {
  // 2020-07-01 → 2029-07-01 = 9 yrs; 7 pre-boundary, 2 post.
  const r = E.calcTimeApportionedCGT({
    acquisitionCosts: 600000, salePrice: 900000, sellingCosts: 20000,
    purchaseDate: '2020-07-01', saleDate: '2029-07-01', marginalRate: 0.39,
  });
  approxEqual(r.preShareGain, 280000 * 7 / 9, 0.01);
  approxEqual(r.taxOnPre, (280000 * 7 / 9) * 0.5 * 0.39, 0.01);
  approxEqual(r.taxOnPost, (280000 * 2 / 9) * 0.39, 0.01);
  assert.strictEqual(r.flags.apportionMethodPending, true);
});
```

- [ ] **Step 2: Run to verify failure** (the `applyOffsets` tests pass already — added here because this task is where multi-component ordering first matters; the dual-era and timeApportion tests fail).

- [ ] **Step 3: Implement**

```js
// ── Dual-era CGT (spec §5) ───────────────────────────────────────────────
// Pre-component: old law on the deemed 30 June 2027 value (50% discount).
// Post-component: CPI-indexed cost base from the deemed value, taxed at
// max(marginalRate, minTaxFloor) — the §5.6 simplification of the statutory
// minimum-tax gap calc. minTaxFloor excludes Medicare levy by default
// (unsettled in guidance; configurable). Div 43 claimed post-1 July 2027
// reduces element 1 before indexation (flagged ASSUMPTION in spec §5.3).
function calcDualEraCGT({ deemedValue, oldCostBase, div43ClaimedPre = 0,
                          salePrice, saleDate, sellingCosts,
                          postExpenditures = [], div43ClaimedPost = 0,
                          cpiRate = 0.025, marginalRate,
                          capitalLosses = 0, quarantinePool = 0,
                          minTaxFloor = 0.30, heldOver12MonthsAt2027 = true,
                          discountPct = 0.5, deemedValueIsEstimate = false }) {
  const preGross = deemedValue - (oldCostBase - div43ClaimedPre);

  const yrs = yearFrac(BOUNDARY_ISO, saleDate);
  const indexedElement1 = (deemedValue - div43ClaimedPost) * cpiFactor(cpiRate, yrs);
  const indexedExpenditure = postExpenditures.reduce((sum, e) =>
    sum + e.amount * (e.indexable === false ? 1 : cpiFactor(cpiRate, yearFrac(e.date, saleDate))), 0);
  const indexedCostBase = indexedElement1 + indexedExpenditure + sellingCosts;
  const postGross = salePrice - indexedCostBase;

  const o = applyOffsets({ preGross, postGross, capitalLosses, quarantinePool });

  const taxablePre = heldOver12MonthsAt2027
    ? Math.max(0, o.preAfter) * (1 - discountPct)
    : Math.max(0, o.preAfter);
  const taxOnPre = taxablePre * marginalRate;
  const postRate = Math.max(marginalRate, minTaxFloor);
  const taxOnPost = Math.max(0, o.postAfter) * postRate;

  return {
    preGross, preAfterOffsets: o.preAfter, taxablePre, taxOnPre,
    indexedCostBase, postGross, postAfterOffsets: o.postAfter,
    taxOnPost, totalCGT: taxOnPre + taxOnPost,
    minTaxBound: minTaxFloor > marginalRate && Math.max(0, o.postAfter) > 0,
    poolUsed: o.poolUsed, strandedPool: o.strandedPool,
    capitalLossesRemaining: o.capitalLossesRemaining,
    flags: { deemedValueIsEstimate, minTaxSimplified: true },
  };
}

// ── Time-apportionment alternative (spec §5.5 — method NOT yet legislated).
// Straight time-based split of the whole-of-holding gain, behind a flag.
// Placeholder only until the ministerial instrument is made.
function calcTimeApportionedCGT({ acquisitionCosts, salePrice, sellingCosts,
                                  purchaseDate, saleDate, div43Claimed = 0,
                                  marginalRate, minTaxFloor = 0.30, discountPct = 0.5 }) {
  const costBase = acquisitionCosts + sellingCosts - div43Claimed;
  const wholeGain = salePrice - costBase;
  const totalYears = yearFrac(purchaseDate, saleDate);
  const preYears = Math.min(yearFrac(purchaseDate, BOUNDARY_ISO), totalYears);
  const preShare = totalYears > 0 ? preYears / totalYears : 1;
  const preShareGain = wholeGain * preShare;
  const postShareGain = wholeGain - preShareGain;
  const taxOnPre = Math.max(0, preShareGain) * (1 - discountPct) * marginalRate;
  const taxOnPost = Math.max(0, postShareGain) * Math.max(marginalRate, minTaxFloor);
  return {
    wholeGain, preShareGain, postShareGain, taxOnPre, taxOnPost,
    totalCGT: taxOnPre + taxOnPost,
    flags: { apportionMethodPending: true },
  };
}
```

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat: dual-era CGT module with minimum tax and timeApportion placeholder

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: NG quarantine schedule (spec §4)

**Files:**
- Modify: `engine.js`
- Modify: `tests/engine.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// ── Quarantine schedule (spec §4) ────────────────────────────────────────
console.log('\nbuildQuarantineSchedule');

const t3Years = [
  { fyStartISO: '2026-07-01', netResult: -11000 },
  { fyStartISO: '2027-07-01', netResult: -12000 },
  { fyStartISO: '2028-07-01', netResult: -12000 },
  { fyStartISO: '2029-07-01', netResult: -12000 },
  { fyStartISO: '2030-07-01', netResult: -12000 },
  { fyStartISO: '2031-07-01', netResult: -1000 },
];

test('T3 (NG side): FY2026-27 deductible, later losses pooled, no refunds', () => {
  const r = E.buildQuarantineSchedule({
    annualResults: t3Years, ngRegime: 'QUARANTINE_FROM_2027', marginalRate: 0.39,
  });
  approxEqual(r.rows[0].refund, 4290, 0.001);          // 11000 × 39%
  assert.strictEqual(r.rows[0].quarantined, 0);
  for (const row of r.rows.slice(1)) {
    assert.strictEqual(row.refund, 0);
  }
  approxEqual(r.poolAtSale, 49000, 0.001);
  approxEqual(r.totalRefunds, 4290, 0.001);
});

test('grandfathered: every loss refunds at MTR, pool stays empty', () => {
  const r = E.buildQuarantineSchedule({
    annualResults: t3Years, ngRegime: 'FULL', marginalRate: 0.39,
  });
  approxEqual(r.totalRefunds, 60000 * 0.39, 0.001);
  assert.strictEqual(r.poolAtSale, 0);
});

test('rental profit years absorb the pool before being taxed (spec §4.3a)', () => {
  const r = E.buildQuarantineSchedule({
    annualResults: [
      { fyStartISO: '2027-07-01', netResult: -12000 },
      { fyStartISO: '2028-07-01', netResult: 5000 },
    ],
    ngRegime: 'QUARANTINE_FROM_2027', marginalRate: 0.39,
  });
  approxEqual(r.poolAtSale, 7000, 0.001);
  assert.strictEqual(r.rows[1].taxOnProfit, 0);        // 5000 fully absorbed
});

test('profit beyond the pool is taxed normally', () => {
  const r = E.buildQuarantineSchedule({
    annualResults: [
      { fyStartISO: '2027-07-01', netResult: -3000 },
      { fyStartISO: '2028-07-01', netResult: 5000 },
    ],
    ngRegime: 'QUARANTINE_FROM_2027', marginalRate: 0.39,
  });
  assert.strictEqual(r.poolAtSale, 0);
  approxEqual(r.rows[1].taxOnProfit, 2000 * 0.39, 0.001);
});

console.log('\nproRateAnnualResults');

test('pro-rates a constant annual amount across income years by days', () => {
  const rows = E.proRateAnnualResults('2027-01-01', '2027-06-01', -8000);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].fyStartISO, '2026-07-01');
  approxEqual(rows[0].netResult, -8000 * 151 / 365.25, 0.01);
});

test('spans multiple income years', () => {
  const rows = E.proRateAnnualResults('2027-01-01', '2030-06-01', -8000);
  assert.strictEqual(rows.length, 4);                   // FY26, 27, 28, 29
  assert.strictEqual(rows[1].fyStartISO, '2027-07-01');
  approxEqual(rows[1].netResult, -8000 * 366 / 365.25, 0.05);   // FY2027-28 incl. 29 Feb 2028
  // Day-count pro-rating (1247/365.25 yrs) differs from the anniversary
  // yearFrac (3.41342 yrs) by a few days' worth — allow that slack.
  const total = rows.reduce((s, r) => s + r.netResult, 0);
  approxEqual(total, -8000 * E.yearFrac('2027-01-01', '2030-06-01'), 10);
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

```js
// ── NG quarantine schedule (spec §4) ─────────────────────────────────────
// Losses in income years starting on/after 1 July 2027 (when quarantine
// applies) generate no refund and accrue to a nominal-dollar pool. Rental
// profit years absorb the pool before being taxed (§4.3a). The pool is
// consumed at sale via applyOffsets — never via the cost base (§4.4).
function buildQuarantineSchedule({ annualResults, ngRegime, marginalRate }) {
  let pool = 0, totalRefunds = 0, totalTaxOnProfit = 0;
  const rows = annualResults.map(r => {
    const inQuarantineEra = ngRegime === 'QUARANTINE_FROM_2027' && r.fyStartISO >= BOUNDARY_ISO;
    let refund = 0, quarantined = 0, taxOnProfit = 0;
    if (r.netResult < 0) {
      if (inQuarantineEra) {
        quarantined = -r.netResult;
        pool += quarantined;
      } else {
        refund = -r.netResult * marginalRate;
      }
    } else if (r.netResult > 0) {
      const absorbed = Math.min(pool, r.netResult);
      pool -= absorbed;
      taxOnProfit = (r.netResult - absorbed) * marginalRate;
    }
    totalRefunds += refund;
    totalTaxOnProfit += taxOnProfit;
    return { ...r, refund, quarantined, taxOnProfit };
  });
  return { rows, poolAtSale: pool, totalRefunds, totalTaxOnProfit };
}

// Splits a constant annual net rental amount across AU income years between
// two dates, pro-rated by days (day count / 365.25 per year of amount).
function proRateAnnualResults(isoFrom, isoTo, annualAmount) {
  const rows = [];
  let fy = fyStartYear(isoFrom);
  const lastFy = fyStartYear(isoTo);
  while (fy <= lastFy) {
    const fyStart = fy + '-07-01';
    const fyEnd = (fy + 1) + '-07-01';
    const from = isoFrom > fyStart ? isoFrom : fyStart;
    const to = isoTo < fyEnd ? isoTo : fyEnd;
    const days = daysBetween(from, to);
    if (days > 0) {
      rows.push({ fyStartISO: fyStart, netResult: annualAmount * days / 365.25 });
    }
    fy += 1;
  }
  return rows;
}
```

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat: NG quarantine schedule with pool accrual, absorption and pro-rating

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Integration tests T3/T5 + new-build optimizer (spec §7b, test T4)

**Files:**
- Modify: `engine.js`
- Modify: `tests/engine.test.js`

- [ ] **Step 1: Write the failing tests**

Expected values below are hand-derived with exact day counts (spec's T3 figures used a rounded 4.08-year fraction; ours is 31/365.25 ⇒ 4.084873…, giving post-component tax ≈ $2,983 vs the spec's directional $3,063 — the invariants are the hard requirement, per spec §8/T3):

```js
// ── T3/T5: quarantine ↔ dual-era integration ─────────────────────────────
console.log('\nT3/T5 integration');

test('T3: pool built during holding is consumed at sale, pre-first', () => {
  const route = E.routeRegimes({ contractDate: '2026-08-01', dwellingType: 'established', saleDate: '2031-08-01' });
  assert.deepStrictEqual(route, { ng: 'QUARANTINE_FROM_2027', cgt: 'DUAL_ERA' });

  const sched = E.buildQuarantineSchedule({
    annualResults: t3Years, ngRegime: route.ng, marginalRate: 0.39,
  });
  approxEqual(sched.poolAtSale, 49000, 0.001);

  const r = E.calcDualEraCGT({
    deemedValue: 710000, oldCostBase: 700000,
    salePrice: 850000, saleDate: '2031-08-01', sellingCosts: 18000,
    cpiRate: 0.025, marginalRate: 0.39, quarantinePool: sched.poolAtSale,
  });
  // pre gross 10000 → pool → 0; post gross 46648 → minus 39000 → 7648 @ 39%
  approxEqual(r.preAfterOffsets, 0, 0.001);
  approxEqual(r.taxOnPre, 0, 0.001);
  approxEqual(r.postGross, 46648.05, 5);
  approxEqual(r.taxOnPost, 2982.74, 5);
  approxEqual(r.strandedPool, 0, 0.001);
  // spec §4.4 anti-double-benefit invariant: cost base unchanged by the pool
  const noPool = E.calcDualEraCGT({
    deemedValue: 710000, oldCostBase: 700000,
    salePrice: 850000, saleDate: '2031-08-01', sellingCosts: 18000,
    cpiRate: 0.025, marginalRate: 0.39, quarantinePool: 0,
  });
  assert.strictEqual(r.indexedCostBase, noPool.indexedCostBase);
});

test('T5: stranded pool is reported, never lost silently, never refunds salary tax', () => {
  const sched = E.buildQuarantineSchedule({
    annualResults: t3Years, ngRegime: 'QUARANTINE_FROM_2027', marginalRate: 0.39,
  });
  const r = E.calcDualEraCGT({
    deemedValue: 710000, oldCostBase: 700000,
    salePrice: 720000, saleDate: '2031-08-01', sellingCosts: 18000,
    cpiRate: 0.025, marginalRate: 0.39, quarantinePool: sched.poolAtSale,
  });
  approxEqual(r.poolUsed, 10000, 0.001);      // pre gross only; post is a loss
  approxEqual(r.strandedPool, 39000, 0.001);
  assert.strictEqual(r.taxOnPre, 0);
  assert.strictEqual(r.taxOnPost, 0);
  approxEqual(sched.totalRefunds, 4290, 0.001);   // only the pre-era FY refunded
});

// ── New-build optimizer (spec §7b, T4) ───────────────────────────────────
console.log('\ncalcNewBuildOptimizer');

test('T4: Option A (whole-gain discount) beats Option B and is chosen', () => {
  const r = E.calcNewBuildOptimizer({
    acquisitionCosts: 700000, salePrice: 950000, saleDate: '2032-10-01',
    sellingCosts: 20000, deemedValue: 715000, cpiRate: 0.025, marginalRate: 0.39,
  });
  approxEqual(r.optionA.tax, 44850, 0.01);
  approxEqual(r.optionB.totalCGT, 48163.70, 20);   // exact-day derivation; spec's rounded ≈48334
  assert.strictEqual(r.winner, 'A');
});

test('affordable housing uses the 60% discount in Option A', () => {
  const r = E.calcNewBuildOptimizer({
    acquisitionCosts: 700000, salePrice: 950000, saleDate: '2032-10-01',
    sellingCosts: 20000, deemedValue: 715000, cpiRate: 0.025, marginalRate: 0.39,
    discountPct: 0.6,
  });
  approxEqual(r.optionA.tax, 35880, 0.01);
  assert.strictEqual(r.winner, 'A');
});
```

- [ ] **Step 2: Run to verify failure** (T3/T5 pass already if Tasks 5–7 are correct — they exercise existing functions; `calcNewBuildOptimizer` fails).

- [ ] **Step 3: Implement**

```js
// ── New-build / affordable-housing optimizer (spec §7b) ──────────────────
// At disposal the taxpayer chooses: (A) whole-gain old treatment — deemed
// sale/reacquisition and minimum tax do not apply at all — or (B) the
// dual-era regime. Engine computes both and reports the cheaper. Engine
// capability only; no dedicated UI in v1.
function calcNewBuildOptimizer({ acquisitionCosts, salePrice, saleDate,
                                 sellingCosts, deemedValue,
                                 div43ClaimedPre = 0, div43ClaimedPost = 0,
                                 cpiRate = 0.025, marginalRate,
                                 capitalLosses = 0, quarantinePool = 0,
                                 minTaxFloor = 0.30, discountPct = 0.5 }) {
  const optionA = calcOldRegimeCGT({
    salePrice, sellingCosts, acquisitionCosts,
    div43Claimed: div43ClaimedPre + div43ClaimedPost,
    capitalLosses, quarantinePool, marginalRate, discountPct,
  });
  const optionB = calcDualEraCGT({
    deemedValue, oldCostBase: acquisitionCosts, div43ClaimedPre,
    salePrice, saleDate, sellingCosts, div43ClaimedPost,
    cpiRate, marginalRate, capitalLosses, quarantinePool,
    minTaxFloor, discountPct,
  });
  return {
    optionA, optionB,
    winner: optionA.tax <= optionB.totalCGT ? 'A' : 'B',
    flags: { newBuildDefinitionPending: true },
  };
}
```

- [ ] **Step 4: Run to verify pass.**

- [ ] **Step 5: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat: quarantine/dual-era integration tests and new-build optimizer

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Sale-timing comparison engine — the hero feature (spec §7, test T6)

**Files:**
- Modify: `engine.js`
- Modify: `tests/engine.test.js`

- [ ] **Step 1: Write the failing tests**

Hand-derived T6 values (growth 4%, MTR 39%, selling costs 2%, valuation $780k at 2027-01-01, loanBalance 0): scenario 1 sells 2027-06-01 at $792,750 → old-regime CGT $34,495, wealth ≈ $740,383. Scenario 2 sells 2030-06-01 at $891,734, deemed value (growth-projected) $795,223 → dual-era CGT $45,590, wealth ≈ $811,652. Same-sale old-law CGT $53,410 ⇒ regime tax delta ≈ −$7,820 (the new regime is *cheaper* here — high deemed base plus indexation).

```js
// ── Comparison mode (spec §7, T6) ────────────────────────────────────────
console.log('\ncompareSaleTiming');

const t6Inputs = {
  contractDate: '2020-07-01', dwellingType: 'established',
  acquisitionCosts: 600000,
  valuationDate: '2027-01-01', currentValueEstimate: 780000,
  growthAssumption: 0.04, marginalRate: 0.39, sellingCostsPct: 0.02,
  annualNetRental: -8000, loanBalance: 0, cpiRate: 0.025,
  saleDate1: '2027-06-01', saleDate2: '2030-06-01',
};

test('T6a: scenario 1 uses the old regime on the whole gain', () => {
  const r = E.compareSaleTiming(t6Inputs);
  assert.strictEqual(r.scenario1.cgtRegime, 'OLD');
  approxEqual(r.scenario1.salePrice, 792750.35, 5);
  approxEqual(r.scenario1.cgt, 34494.59, 5);
  approxEqual(r.scenario1.totalWealth, 740383, 60);
});

test('T6b: scenario 2 splits at the deemed value; post taxed at max(39%,30%)', () => {
  const r = E.compareSaleTiming(t6Inputs);
  assert.strictEqual(r.scenario2.cgtRegime, 'DUAL_ERA');
  approxEqual(r.scenario2.salePrice, 891734.4, 5);
  approxEqual(r.scenario2.deemedValue, 795222.9, 5);
  assert.strictEqual(r.scenario2.detail.minTaxBound, false);   // 39% > 30%
  approxEqual(r.scenario2.cgt, 45589.9, 10);
  approxEqual(r.scenario2.totalWealth, 811652, 60);
});

test('T6c: a breakeven growth rate exists and is reported', () => {
  const r = E.compareSaleTiming(t6Inputs);
  assert.ok(r.breakevenGrowth !== null);
  assert.ok(r.breakevenGrowth > 0 && r.breakevenGrowth < 0.04,
    `breakeven ${r.breakevenGrowth} should sit below the 4% assumption`);
  // at the breakeven rate the two scenarios' wealth converges
  const at = E.compareSaleTiming({ ...t6Inputs, growthAssumption: r.breakevenGrowth });
  approxEqual(at.scenario1.totalWealth, at.scenario2.totalWealth, 50);
});

test('T6d: grandfathered NG keeps refunding in both scenarios', () => {
  const r = E.compareSaleTiming(t6Inputs);
  assert.ok(r.scenario1.holding.ngRefunds > 0);
  assert.ok(r.scenario2.holding.ngRefunds > 0);
  assert.strictEqual(r.scenario2.holding.poolAtSale, 0);
});

test('tax delta isolates the regime change at constant growth', () => {
  const r = E.compareSaleTiming(t6Inputs);
  approxEqual(r.taxDelta, -7820.5, 30);   // dual-era minus old-law on the SAME sale
});

test('sensitivity: ±10% deemed value moves scenario 2, higher deemed → higher wealth', () => {
  const r = E.compareSaleTiming(t6Inputs);
  assert.ok(r.sensitivity.high.totalWealth > r.sensitivity.low.totalWealth);
  assert.ok(r.sensitivity.low.totalWealth < r.scenario2.totalWealth);
});

test('quarantined property: pool accrues in scenario 2 and hits the gain at sale', () => {
  const r = E.compareSaleTiming({
    ...t6Inputs, contractDate: '2026-08-01',
  });
  // Only the FY2026-27 slice (1 Jan → 30 Jun 2027, 181 days) still refunds;
  // every income year starting on/after 1 July 2027 quarantines instead.
  approxEqual(r.scenario2.holding.ngRefunds, 8000 * (181 / 365.25) * 0.39, 5);
  assert.ok(r.scenario2.holding.poolAtSale > 0);
  assert.ok(r.scenario2.detail.poolUsed + r.scenario2.detail.strandedPool
            === r.scenario2.holding.poolAtSale);
});

test('framing flags are attached (never-sell rule, spec §7)', () => {
  const r = E.compareSaleTiming(t6Inputs);
  assert.strictEqual(r.flags.taxComponentOnly, true);
  assert.strictEqual(r.scenario2.flags.deemedValueIsEstimate, true);
});

test('no breakeven in range reports null, not a nonsense number', () => {
  // A $300k/yr rental loss over the 3 extra holding years (~-$549k after
  // NG relief) dwarfs any extra growth achievable at ≤15% p.a. (~+$430k
  // gross at the 15% cap), so selling early wins at every rate in range.
  const r = E.compareSaleTiming({ ...t6Inputs, annualNetRental: -300000 });
  assert.strictEqual(r.breakevenGrowth, null);
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

```js
// ── Sale-timing comparison (spec §7 — HERO FEATURE) ──────────────────────
// Runs the same holding under a pre-boundary and a post-boundary sale and
// returns both after-tax outcomes, the regime-only tax delta, the breakeven
// growth rate, and ±10% deemed-value sensitivity. Outputs model the TAX
// COMPONENT of a sale-timing decision only (flags.taxComponentOnly) — the
// engine must never emit "you should sell" semantics; that constraint is
// enforced in UI copy but flagged from here.
function runSaleScenario(inputs, saleDate, deemedValueOverride) {
  const { contractDate, dwellingType, acquisitionCosts, valuationDate,
          currentValueEstimate, growthAssumption, marginalRate,
          sellingCostsPct, annualNetRental, loanBalance, cpiRate,
          capitalLosses = 0, div43Claimed = 0 } = inputs;

  const route = routeRegimes({ contractDate, dwellingType, saleDate });
  const growthYears = yearFrac(valuationDate, saleDate);
  const salePrice = currentValueEstimate * Math.pow(1 + growthAssumption, growthYears);
  const sellingCosts = salePrice * sellingCostsPct;

  // Holding cash flows valuation → sale, with NG treatment per routing.
  const annualResults = proRateAnnualResults(valuationDate, saleDate, annualNetRental);
  const sched = buildQuarantineSchedule({ annualResults, ngRegime: route.ng, marginalRate });
  const preTaxCashflow = annualResults.reduce((s, r) => s + r.netResult, 0);
  const holding = {
    preTaxCashflow,
    ngRefunds: sched.totalRefunds,
    taxOnProfits: sched.totalTaxOnProfit,
    poolAtSale: sched.poolAtSale,
    netCashflow: preTaxCashflow + sched.totalRefunds - sched.totalTaxOnProfit,
  };

  // CGT per regime. Comparison mode projects the deemed value with the same
  // growth assumption that drives the sale price (consistent model), rather
  // than §5.4's purchase↔sale linear interpolation (used when only purchase
  // and sale prices are known).
  let cgt, detail, deemedValue = null, flags = {};
  if (route.cgt === 'OLD') {
    detail = calcOldRegimeCGT({
      salePrice, sellingCosts, acquisitionCosts, div43Claimed,
      capitalLosses, quarantinePool: sched.poolAtSale, marginalRate,
    });
    cgt = detail.tax;
  } else {
    deemedValue = deemedValueOverride !== undefined
      ? deemedValueOverride
      : currentValueEstimate * Math.pow(1 + growthAssumption, yearFrac(valuationDate, DEEMED_DATE_ISO));
    flags.deemedValueIsEstimate = deemedValueOverride === undefined;
    const dual = calcDualEraCGT({
      deemedValue, oldCostBase: acquisitionCosts, div43ClaimedPre: div43Claimed,
      salePrice, saleDate, sellingCosts, cpiRate, marginalRate,
      capitalLosses, quarantinePool: sched.poolAtSale,
      deemedValueIsEstimate: flags.deemedValueIsEstimate === true,
    });
    if (route.cgt === 'BEST_OF') {
      const opt = calcNewBuildOptimizer({
        acquisitionCosts, salePrice, saleDate, sellingCosts, deemedValue,
        div43ClaimedPre: div43Claimed, cpiRate, marginalRate,
        capitalLosses, quarantinePool: sched.poolAtSale,
        discountPct: dwellingType === 'affordableHousing' ? 0.6 : 0.5,
      });
      detail = opt;
      cgt = opt.winner === 'A' ? opt.optionA.tax : opt.optionB.totalCGT;
      flags.newBuildDefinitionPending = true;
    } else {
      detail = dual;
      cgt = dual.totalCGT;
    }
  }

  const netProceeds = salePrice - sellingCosts - cgt - loanBalance;
  return {
    saleDate, cgtRegime: route.cgt, ngRegime: route.ng,
    salePrice, sellingCosts, cgt, deemedValue, detail, holding,
    netProceeds,
    totalWealth: netProceeds + holding.netCashflow,
    flags,
  };
}

function compareSaleTiming(inputs) {
  const s1 = runSaleScenario(inputs, inputs.saleDate1);
  const s2 = runSaleScenario(inputs, inputs.saleDate2);

  // Regime-only tax delta: scenario 2's sale re-priced under old law,
  // holding growth constant (spec §7 output 2).
  const s2OldLaw = calcOldRegimeCGT({
    salePrice: s2.salePrice, sellingCosts: s2.sellingCosts,
    acquisitionCosts: inputs.acquisitionCosts,
    div43Claimed: inputs.div43Claimed || 0,
    capitalLosses: inputs.capitalLosses || 0,
    quarantinePool: s2.holding.poolAtSale,
    marginalRate: inputs.marginalRate,
  });
  const taxDelta = s2.cgt - s2OldLaw.tax;

  // Breakeven growth (spec §7 output 3): rate where holding past the
  // boundary equals selling before it, on total wealth. Bisection over
  // 0–15%; null when no crossing exists in range.
  const wealthGap = g => {
    const t = { ...inputs, growthAssumption: g };
    return runSaleScenario(t, inputs.saleDate2).totalWealth
         - runSaleScenario(t, inputs.saleDate1).totalWealth;
  };
  let breakevenGrowth = null;
  let lo = 0, hi = 0.15, fLo = wealthGap(lo), fHi = wealthGap(hi);
  if (fLo === 0) breakevenGrowth = 0;
  else if (fLo * fHi < 0) {
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      const fMid = wealthGap(mid);
      if (fLo * fMid <= 0) { hi = mid; fHi = fMid; } else { lo = mid; fLo = fMid; }
    }
    breakevenGrowth = (lo + hi) / 2;
  }

  // Deemed-value sensitivity (spec §7 output 4): scenario 2 at ±10%.
  const base = s2.deemedValue;
  const sensitivity = base === null ? null : {
    low: runSaleScenario(inputs, inputs.saleDate2, base * 0.9),
    high: runSaleScenario(inputs, inputs.saleDate2, base * 1.1),
  };

  return {
    scenario1: s1, scenario2: s2, taxDelta, breakevenGrowth, sensitivity,
    flags: { taxComponentOnly: true },
  };
}
```

- [ ] **Step 4: Run to verify pass** — `node tests/engine.test.js`. If a hand-derived T6 value misses its tolerance, re-derive by hand from the engine's own helpers (`yearFrac`, `cpiFactor`) before touching either side; the spec forbids adjusting expectations to fit output.

- [ ] **Step 5: Run the full suite**

Run: `node tests/unit.js && node tests/engine.test.js`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat: sale-timing comparison engine with breakeven solver and sensitivity

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Disclaimers manifest and final verification

**Files:**
- Modify: `engine.js`
- Modify: `tests/engine.test.js`

- [ ] **Step 1: Write the failing test**

```js
// ── Disclaimers (spec §10) ───────────────────────────────────────────────
console.log('\nDISCLAIMERS');

test('engine exposes the §10 disclaimers for UI consumption', () => {
  const keys = Object.keys(E.DISCLAIMERS);
  for (const k of ['generalInfo', 'minTaxSimplified', 'newBuildPending',
                   'deemedValueEstimate', 'apportionPending', 'cpiAssumption']) {
    assert.ok(keys.includes(k), `missing disclaimer: ${k}`);
    assert.ok(E.DISCLAIMERS[k].length > 20, `disclaimer ${k} too short to be real copy`);
  }
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

```js
// ── Required disclaimers (spec §10) — single source for Phase 2 UI ───────
const DISCLAIMERS = {
  generalInfo: 'General information only, not tax or financial advice. Models the Treasury Laws Amendment (Tax Reform No. 1) Act 2026.',
  minTaxSimplified: 'Simplified minimum-tax calculation; interactions with your other income and deductions can change this.',
  newBuildPending: 'The legal definition of a new residential dwelling is still pending a ministerial instrument.',
  deemedValueEstimate: 'The 30 June 2027 value is an estimate; your actual outcome depends on the real market value at that date.',
  apportionPending: 'The official apportioning method has not yet been legislated; the time-based split shown is a placeholder.',
  cpiAssumption: 'Future cost-base indexation uses a projected CPI assumption, not actual CPI.',
};
```

- [ ] **Step 4: Run the full suite one final time**

Run: `node tests/unit.js && node tests/engine.test.js`
Expected: all green. Also verify the export list contains every public name added across Tasks 2–10:
`legacySaleOutcome, BUDGET_NIGHT_ISO, BOUNDARY_ISO, DEEMED_DATE_ISO, daysBetween, yearFrac, cpiFactor, fyStartYear, routeRegimes, applyOffsets, calcOldRegimeCGT, interpolateDeemedValue, calcDualEraCGT, calcTimeApportionedCGT, buildQuarantineSchedule, proRateAnnualResults, calcNewBuildOptimizer, compareSaleTiming, DISCLAIMERS` (plus the six legacy names from Task 1).

- [ ] **Step 5: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat: engine-level disclaimers manifest per spec §10

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## After the plan

Pipeline stages (not plan tasks): code-reviewer → github-liaison → smoke-tester → github-liaison. ui-reviewer is **skipped for this plan if** the only `index.html` changes are the mechanical extractions in Tasks 1–2 (no visual change). Phase 2 (UI plan) starts after this plan merges; it wires `compareSaleTiming` into the new landing view and `routeRegimes`/`calcDualEraCGT` into the existing calculator per `specs/truereturn-ui-requirements.md`.

Out of scope here (per spec §9): trusts, part-year residency, income-support exemptions, the statutory whole-return minimum-tax gap calc, pre-1985 assets, apportioning method beyond the flagged placeholder.
