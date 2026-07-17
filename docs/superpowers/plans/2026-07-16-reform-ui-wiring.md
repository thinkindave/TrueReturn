# Reform UI Wiring (Phase 2b-1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the 2026–27 reform engine into the live calculator: new property inputs (contract date, dwelling type, value today), reform-aware sale math replacing the legacy CGT path, NG-quarantine cash-flow treatment, the deemed-value chip + sensitivity band, and the reform disclaimer banner — per UI spec v2.1 (`specs/truereturn-ui-requirements.md`) §§1–5.

**Architecture:** All new math stays pure in `engine.js` (one new router wrapper `calcReformSale`, one date helper); `index.html` gains three `data-field` inputs on the property-row template, swaps its three `legacySaleOutcome` call sites for `calcReformSale`, and adds display modules following the existing `.proj-section` / `.highlight-item` patterns. `legacySaleOutcome` stays in engine.js (golden tests pin it) but the UI no longer calls it.

**Tech Stack:** Vanilla JS single-file app, no build. Tests: `node tests/engine.test.js`, `node tests/unit.js`, `node .claude/smoke-test.js`.

**Tracking:** GitHub issue #2. Work on a feature worktree (superpowers:using-git-worktrees at execution start). Never push.

**This is plan 1 of 3 for Phase 2b.** 2b-2 (Return-on-your-cash + benchmark) and 2b-3 (2027 impact module §3a) follow after this ships — they display numbers this plan makes correct.

---

## Domain primer

Two reforms, independently grandfathered (engine already implements all math — Phase 0/1/2a, all tested):

1. **NG quarantine** — keyed to contract date. Contracts on/before Budget night (12 May 2026), and new builds, keep deducting rental losses against salary forever. Everyone else: losses in income years starting on/after 1 July 2027 generate **no refund** and pool up; the pool offsets rental profits or the capital gain at sale (`buildQuarantineSchedule`, `applyOffsets` ordering).
2. **CGT dual-era** — keyed to sale date. Sales before 1 July 2027: old law (50% discount). On/after: pre-2027 gain component (vs the deemed 30 June 2027 value) gets the discount; post component gets CPI indexation and `max(MTR, 30%)` (`calcDualEraCGT`). New builds/affordable get best-of (`calcNewBuildOptimizer`).

**Approved live-behaviour change (record in the issue, don't "fix" back):** the legacy inline math (`legacySaleOutcome`) does NOT include selling costs in the CGT cost base; the spec-correct modules DO (element 2, spec §5.2/T1). Rewiring the UI to the reform path therefore changes CGT slightly for every property, including grandfathered ones. This was planned since Phase 1 (see `docs/superpowers/plans/2026-07-13-tax-reform-engine.md`, "Deliberate deviations").

**The live calculator has no dates.** Purchase is implicitly "today"; sales are the 5/10/15-year projection periods. This plan adds `contractDate` (default today) and derives each period's sale date as `today + N years`. UI spec v2.1 §2 Group 2 codifies this (no new sale-date input — update, not redesign).

**index.html structural facts** (verified 2026-07-16; line numbers drift as tasks land — treat as anchors, re-locate by the quoted code):

- Property-row template: `index.html:2718–2815` inside `.property-rows`. 12 `data-field`s; `advanced-only` class hides fields in simple mode. `marginalTaxRate` is a hidden per-row input (2803) mirrored from `#marginalTaxRateSelect` (2999).
- **Any new `data-field` must also be added to BOTH hardcoded field arrays**: `serializeState()` (~3779) and `deserializeState()` (~3793), plus `SIMPLE_MODE_DEFAULTS` (~3533).
- `calculate()` = ~4322–4744. Sale math via `legacySaleOutcome` at ~4592–4596 (inside the projection loop over `[{years:5,prefix:'proj5'},{years:10,prefix:'proj10'},{years:15,prefix:'projLife'}]`), and again in `calcScenarioProfit()` at ~4804 and ~4914. Results written via fixed `getElementById` ids (`${prefix}Value…${prefix}CGT…${prefix}TrueReturn` etc.).
- Collapsible pattern: `<button class="proj-section-header" aria-expanded="false">` + sibling `<div class="proj-section-body" hidden>`; auto-wired by `initProjectionSections()` (~3694–3712). New sections get behaviour for free.
- Event delegation only (`initPropertySelection()` ~3600–3656 on `.property-rows`); **no inline handlers** (smoke check 6).
- Structural gates in `.claude/smoke-test.js`: required ids (list at lines ~42–50), required `data-field`s (~61–65), script order, JS parseability, no inline handlers, CAGR write-site checks. Task 7 updates these.
- Disclaimers: static `.intro-disclaimer` (~2651) and `.projections-disclaimer` (~3460). `DISCLAIMERS` object exported by engine.js is not yet surfaced — this plan surfaces it.

Copy rules (UI spec §5/§6): sentence case, no judgment verbs, no decision-question framing, every jargon term gets a one-sentence `help-tip`.

---

## File structure

- **Modify `engine.js`** — add `addYearsISO` helper and `calcReformSale` (router wrapper returning the legacy-shaped `{salesCosts, netProceeds, cgt, trueCashReturn}` superset); add 12-month passthrough params to `calcNewBuildOptimizer` (closes the deferred review WARNING from issue #3); export new names.
- **Modify `tests/engine.test.js`** — tests for the helper, the wrapper (T1/T2 reroutes, BEST_OF passthrough, sub-12-month), and optimizer passthrough.
- **Modify `index.html`** — template-row inputs; serialize/deserialize/defaults; `calculate()` + `calcScenarioProfit()` rewiring; quarantine display; deemed chip + sensitivity band; banner.
- **Modify `tests/unit.js`** — keep the pure-twin copies in sync where inlined formulas change (the smoke test's note-tracked copies).
- **Modify `.claude/smoke-test.js`** — extend required ids and `data-field`s.

---

### Task 1: Engine — `addYearsISO` + `calcReformSale` + optimizer 12-month passthrough

**Files:**
- Modify: `engine.js` (helper next to the other date helpers after `fyStartYear`; `calcReformSale` after `calcNewBuildOptimizer`; two new params on `calcNewBuildOptimizer`)
- Test: `tests/engine.test.js` (append before `summary()`)

- [ ] **Step 1: Write the failing tests**

```js
// ── Reform-aware sale outcome for the UI (Phase 2b-1) ────────────────────
console.log('\ncalcReformSale (UI router wrapper)');

test('addYearsISO adds whole years', () => {
  assert.strictEqual(E.addYearsISO('2026-07-16', 5), '2031-07-16');
  assert.strictEqual(E.addYearsISO('2024-02-29', 1), '2025-03-01'); // UTC rollover, no crash
});

test('grandfathered pre-2027 sale reproduces spec T1 through the wrapper', () => {
  const r = E.calcReformSale({
    contractDate: '2020-12-01', dwellingType: 'established', saleDate: '2026-03-01',
    salePrice: 660000, sellingCostsPct: 14000 / 660000,
    acquisitionCosts: 520000, div43Claimed: 10000,
    marginalRate: 0.39, remainingLoan: 400000,
  });
  assert.strictEqual(r.regime, 'OLD');
  assert.strictEqual(r.ngRegime, 'FULL');
  approxEqual(r.salesCosts, 14000, 0.01);
  approxEqual(r.cgt, 26520, 0.01);                       // spec T1
  approxEqual(r.netProceeds, 660000 - 14000 - 400000, 0.01);
  approxEqual(r.trueCashReturn, r.netProceeds - r.cgt, 0.001);
});

test('post-2027 established sale routes dual-era and reproduces spec T2', () => {
  const r = E.calcReformSale({
    contractDate: '2020-07-01', dwellingType: 'established', saleDate: '2029-07-01',
    salePrice: 900000, sellingCostsPct: 20000 / 900000,
    acquisitionCosts: 600000, deemedValue: 800000, deemedValueIsEstimate: false,
    marginalRate: 0.39,
  });
  assert.strictEqual(r.regime, 'DUAL_ERA');
  approxEqual(r.cgt, 54405, 0.5);                        // spec T2
  assert.strictEqual(r.flags.deemedValueIsEstimate, false);
});

test('sub-12-month hold gets no discount through the wrapper (OLD)', () => {
  const r = E.calcReformSale({
    contractDate: '2026-08-01', dwellingType: 'established', saleDate: '2027-06-01',
    salePrice: 750000, sellingCostsPct: 0.02, acquisitionCosts: 700000,
    marginalRate: 0.39,
  });
  approxEqual(r.cgt, (750000 - 715000) * 0.39, 0.5);     // undiscounted
});

test('new build routes BEST_OF; 12-month flags pass through to both options', () => {
  // Contract Oct 2026 → under 12 months at 30 Jun 2027 AND at an Aug 2027 sale:
  // neither option may apply the 50% discount.
  const r = E.calcReformSale({
    contractDate: '2026-10-01', dwellingType: 'newBuild', saleDate: '2027-08-01',
    salePrice: 760000, sellingCostsPct: 0, acquisitionCosts: 700000,
    deemedValue: 745000, marginalRate: 0.39,
  });
  assert.strictEqual(r.regime, 'BEST_OF');
  assert.strictEqual(r.flags.newBuildDefinitionPending, true);
  // Option A undiscounted: gain 60,000 × 39% = 23,400 (not 11,700)
  approxEqual(r.detail.optionA.tax, 60000 * 0.39, 0.5);
  // Option B pre-component undiscounted: taxablePre equals the full pre gain
  approxEqual(r.detail.optionB.taxablePre,
              Math.max(0, r.detail.optionB.preAfterOffsets), 0.001);
});

test('quarantine pool passed to the wrapper reduces the gain at sale', () => {
  const base = { contractDate: '2026-08-01', dwellingType: 'established',
    saleDate: '2031-08-01', salePrice: 850000, sellingCostsPct: 18000 / 850000,
    acquisitionCosts: 700000, deemedValue: 710000, marginalRate: 0.39 };
  const withPool = E.calcReformSale({ ...base, quarantinePool: 49000 });
  const noPool = E.calcReformSale(base);
  assert(withPool.cgt < noPool.cgt, 'pool must reduce CGT at sale');
  assert.strictEqual(withPool.ngRegime, 'QUARANTINE_FROM_2027');
});
```

- [ ] **Step 2: Run to verify failure** — `node tests/engine.test.js`: FAIL with `E.addYearsISO is not a function`; 100 pre-existing pass.

- [ ] **Step 3: Implement**

(a) After `fyStartYear` in `engine.js`:

```js
// Adds whole calendar years to an ISO date (UTC-safe; Feb 29 rolls to Mar 1).
function addYearsISO(iso, years) {
  const d = isoToUTC(iso);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}
```

(b) `calcNewBuildOptimizer`: add `heldOver12Months = true, heldOver12MonthsAt2027 = true` to its destructured params; pass `heldOver12Months` into the `calcOldRegimeCGT` call (option A) and `heldOver12MonthsAt2027` into the `calcDualEraCGT` call (option B). No other change; existing tests keep passing on the defaults.

(c) After `calcNewBuildOptimizer`:

```js
// ── Reform-aware sale outcome for the UI (Phase 2b-1) ────────────────────
// Routes one sale through the 2026–27 regimes and returns the superset of
// the fields the UI consumed from legacySaleOutcome. Unlike the legacy
// math, selling costs are a cost-base element (spec §5.2/T1) — an approved
// change to live behaviour, recorded in issue #2. deemedValue is required
// whenever the sale routes DUAL_ERA or BEST_OF (caller projects it).
function calcReformSale({ contractDate, dwellingType = 'established', saleDate,
                          salePrice, sellingCostsPct = 0.03,
                          acquisitionCosts, div43Claimed = 0,
                          deemedValue = null, deemedValueIsEstimate = true,
                          quarantinePool = 0, capitalLosses = 0,
                          cpiRate = 0.025, marginalRate, remainingLoan = 0 }) {
  const route = routeRegimes({ contractDate, dwellingType, saleDate });
  const sellingCosts = salePrice * sellingCostsPct;
  const heldOver12Months = yearFrac(contractDate, saleDate) >= 1;
  const heldOver12MonthsAt2027 = yearFrac(contractDate, DEEMED_DATE_ISO) >= 1;

  let cgt, detail;
  const flags = {};
  if (route.cgt === 'OLD') {
    detail = calcOldRegimeCGT({
      salePrice, sellingCosts, acquisitionCosts, div43Claimed,
      capitalLosses, quarantinePool, marginalRate, heldOver12Months,
    });
    cgt = detail.tax;
  } else if (route.cgt === 'BEST_OF') {
    detail = calcNewBuildOptimizer({
      acquisitionCosts, salePrice, saleDate, sellingCosts, deemedValue,
      div43ClaimedPre: div43Claimed, cpiRate, marginalRate,
      capitalLosses, quarantinePool,
      discountPct: dwellingType === 'affordableHousing' ? 0.6 : 0.5,
      heldOver12Months, heldOver12MonthsAt2027,
    });
    cgt = detail.winner === 'A' ? detail.optionA.tax : detail.optionB.totalCGT;
    flags.newBuildDefinitionPending = true;
  } else {
    detail = calcDualEraCGT({
      deemedValue, oldCostBase: acquisitionCosts, div43ClaimedPre: div43Claimed,
      salePrice, saleDate, sellingCosts, cpiRate, marginalRate,
      capitalLosses, quarantinePool, heldOver12MonthsAt2027, deemedValueIsEstimate,
    });
    cgt = detail.totalCGT;
    flags.deemedValueIsEstimate = deemedValueIsEstimate;
  }

  const netProceeds = salePrice - sellingCosts - remainingLoan;
  return { regime: route.cgt, ngRegime: route.ng,
           salesCosts: sellingCosts, cgt, detail, netProceeds,
           trueCashReturn: netProceeds - cgt, flags };
}
```

(d) Exports: add `addYearsISO,` (with the date helpers) and `calcReformSale,` (after `calcNewBuildOptimizer,`).

- [ ] **Step 4: Run all suites** — `node tests/engine.test.js && node tests/unit.js`: all pass (106 + 199).

- [ ] **Step 5: Commit** — `git add engine.js tests/engine.test.js && git commit -m "feat: calcReformSale UI router wrapper, addYearsISO, optimizer 12-month passthrough"`

---

### Task 2: Property-row inputs — contract date, dwelling type, value today

**Files:**
- Modify: `index.html` — template row (~2718–2815), `SIMPLE_MODE_DEFAULTS` (~3533), `serializeState`/`deserializeState` field arrays (~3779/~3793), `addPropertyRow` default application

- [ ] **Step 1: Add the three columns to the template row**, after the `propertyAge` column (match sibling markup/classes exactly, `advanced-only` on all three):

```html
<div class="prop-col advanced-only">
  <div class="prop-col-label">Contract date <span class="help-tip" data-tip="Contract date, not settlement. Contracts signed before 7:30pm AEST 12 May 2026 keep full negative gearing even if settled later">?</span></div>
  <input type="date" data-field="contractDate">
</div>
<div class="prop-col advanced-only">
  <div class="prop-col-label">Dwelling type <span class="help-tip" data-tip="New build definition not yet finalised in law — pending a ministerial instrument">?</span></div>
  <select data-field="dwellingType">
    <option value="established" selected>Established</option>
    <option value="newBuild">New build (law pending)</option>
    <option value="affordableHousing">Affordable housing</option>
  </select>
</div>
<div class="prop-col advanced-only">
  <div class="prop-col-label">Value today <span class="help-tip" data-tip="Today's estimated market value — only needed when the contract date is in the past; blank uses the purchase price">?</span></div>
  <input type="number" data-field="currentValueEstimate" min="0" step="1000" placeholder="= purchase price">
</div>
```

- [ ] **Step 2: Register the fields everywhere the row machinery needs them**

1. `SIMPLE_MODE_DEFAULTS` — add `contractDate: ''` (empty = "today", resolved at calc time so saved states don't freeze a date), `dwellingType: 'established'`, `currentValueEstimate: ''`.
2. `serializeState()` field array (~3779): append `'contractDate','dwellingType','currentValueEstimate'`.
3. `deserializeState()` field array (~3793): same three names.
4. Verify the copy-row handler needs no change (it loops `select[data-field]` generically; date/number inputs clone by value).

- [ ] **Step 3: Structural verification** — `node .claude/smoke-test.js` passes (8/8 — new fields aren't asserted yet; Task 7 adds them); open the page mentally: no `calculate()` reads these yet, so behaviour is unchanged. Run `node tests/unit.js` (199).

- [ ] **Step 4: Commit** — `git add index.html && git commit -m "feat: contract date, dwelling type and value-today property inputs (UI spec §2 group 1)"`

---

### Task 3: Rewire sale math — `calculate()` and `calcScenarioProfit()` use `calcReformSale`

**Files:**
- Modify: `index.html` — top of `calculate()` (~4322), projection loop (~4592–4596), `calcScenarioProfit()` (~4804, ~4914)
- Modify: `tests/unit.js` — sync any pure-twin copy of the scenario-profit math (the smoke test's verbatim-copy checks)

- [ ] **Step 1: Read the current call sites** (all three `legacySaleOutcome(` occurrences in index.html) and note the exact variables in scope at each (purchasePrice, stampDuty, conveyancing, buildingPest, cumulativeDepr, futureValue, remainingLoan, marginalTaxRate).

- [ ] **Step 2: Add per-property reform context near the top of `calculate()`** (after the row's fields are read):

```js
      // ── 2026–27 reform context (UI spec v2.1) ──
      var TODAY_ISO = new Date().toISOString().slice(0, 10);
      var contractDateRaw = getField('contractDate');
      var contractDate = (contractDateRaw && contractDateRaw.value) || TODAY_ISO;
      var dwellingType = (getField('dwellingType') || {}).value || 'established';
      var cveField = getField('currentValueEstimate');
      var currentValue = (cveField && parseFloat(cveField.value)) || purchasePrice;
      var reformRoute = routeRegimes({ contractDate: contractDate,
        dwellingType: dwellingType, saleDate: addYearsISO(TODAY_ISO, 15) });
      // Deemed 30 June 2027 value: today's value projected at the property's
      // growth rate (estimate; user override arrives in Task 5).
      var deemedValue = currentValue *
        Math.pow(1 + expectedGrowth, yearFrac(TODAY_ISO, DEEMED_DATE_ISO));
```

(Adapt variable names to what `calculate()` actually uses for growth — the implementer must read the surrounding code first. `expectedGrowth` here means the decimal per-annum rate already parsed from the `expectedGrowth` field.)

- [ ] **Step 3: Replace the projection-loop `legacySaleOutcome` call.** For each period `p`, the sale date is `addYearsISO(TODAY_ISO, p.years)`. Replace the call at ~4592–4596 with:

```js
          var saleDateISO = addYearsISO(TODAY_ISO, p.years);
          var saleOutcome = calcReformSale({
            contractDate: contractDate, dwellingType: dwellingType,
            saleDate: saleDateISO, salePrice: futureValue,
            sellingCostsPct: 0.03,
            acquisitionCosts: purchasePrice + stampDuty + conveyancing + BUILDING_PEST,
            div43Claimed: cumulativeDepr,
            deemedValue: deemedValue,
            quarantinePool: quarantinePoolAtYear(p.years),  // Task 4; use 0 until then
            marginalRate: marginalTaxRate,
            remainingLoan: remainingLoan,
          });
```

and keep writing the same downstream ids from the same fields (`saleOutcome.salesCosts`, `.netProceeds`, `.cgt`, `.trueCashReturn`). Until Task 4 lands, pass `quarantinePool: 0` (leave a `// Task 4` comment). Note: `costBase`/`capitalGain` are no longer top-level fields; if the loop displays them, read from `saleOutcome.detail` (`costBase`/`grossGain` on OLD, `indexedCostBase`/`preGross`/`postGross` on dual-era) — check what `${p}` ids actually render and adapt.

- [ ] **Step 4: Same replacement in `calcScenarioProfit()`** (both call sites). This function re-reads the DOM; give it the same context lines (contract date, dwelling type, deemed value). If `tests/unit.js` carries a pure twin of this function's math, update the twin identically — the smoke test's checks 7–8 are regex-based on `annualisedReturn` write-sites, which don't change, but any verbatim-copied formula must stay in sync.

- [ ] **Step 5: Verify.** `node .claude/smoke-test.js` (8/8 — includes JS parseability and unit.js), `node tests/engine.test.js` (106), `node tests/unit.js` (199). Then load the app in the browser preview: default property (contract = today = post-Budget-night, established, 5-year sale = 2031 → DUAL_ERA) must render finite figures in all three periods; a contract date set to 2020-01-01 must show pre-2027-period figures matching the old-law shape. Fix anything broken before committing.

- [ ] **Step 6: Commit** — `git add index.html tests/unit.js && git commit -m "feat: route all sale outcomes through calcReformSale (dual-era invisible wiring)"`

---

### Task 4: Quarantine cash-flow treatment + pool tracker (UI spec §4)

**Files:**
- Modify: `index.html` — tax-benefit computation in `calculate()` (snapshot section ~4489–4517 and the projection loop's cumulative cash flow), new pool-tracker markup in `.results-card` (before line ~3048)

- [ ] **Step 1: Compute the quarantine schedule once per `calculate()`** using existing engine functions. After the reform-context block (Task 3 Step 2):

```js
      // NG quarantine (spec §4): losses in FYs starting on/after 1 Jul 2027
      // stop refunding and pool up. Rows are built per projection year with
      // the year's modelled net rental result (loss negative).
      var ngQuarantined = reformRoute.ng === 'QUARANTINE_FROM_2027';
      function fyStartISOForYear(n) {           // projection year n (1-based)
        return (fyStartYear(TODAY_ISO) + n) + '-07-01';
      }
```

Inside whatever per-year loop computes annual net rental results (or by reusing the year-N figures the projection loop already derives), build `annualRows = [{fyStartISO: fyStartISOForYear(n), netResult: netRentalYearN}, …]` for years 1..15, then:

```js
      var quarantineSched = buildQuarantineSchedule({
        annualResults: annualRows, ngRegime: reformRoute.ng,
        marginalRate: marginalTaxRate });
      function quarantinePoolAtYear(y) {
        var pool = 0;
        for (var i = 0; i < y && i < quarantineSched.rows.length; i++) {
          pool += quarantineSched.rows[i].quarantined;
          pool -= Math.min(pool, Math.max(0, quarantineSched.rows[i].netResult));
        }
        return pool;
      }
```

(If the loop structure makes a simple per-year `rows` array awkward, an acceptable simplification for constant net rental is `proRateAnnualResults(TODAY_ISO, addYearsISO(TODAY_ISO, 15), annualNetRental)` — but prefer the real per-year figures if they vary with rent growth. The implementer must check how `calculate()` models rent across years and use those numbers.)

Replace the Task 3 placeholder `quarantinePool: 0` with `quarantinePoolAtYear(p.years)`.

- [ ] **Step 2: Reframe the tax-benefit line for quarantined years (spec §4a).** Where the snapshot section writes `resTaxBenefit` (~4517): if `ngQuarantined` and the snapshot year's FY (`fyStartISOForYear(snapshotYear)`) is `>= BOUNDARY_ISO` and the year is a rental loss, write $0 as the benefit and set the note element (Step 3's `resQuarantineNote`) to:
`"Annual loss: " + formatCurrency(loss) + ". Under the old rules you'd have received ~" + formatCurrency(loss * marginalTaxRate) + " back each year. These losses are now quarantined — see below."`
Also make the projection loop's cumulative-cash-flow math use `quarantineSched.rows[i].refund` (0 in quarantined years) instead of the unconditional `loss × MTR` refund, so `${p}CashFlow`/`CumCashFlow` show the true full bleed.

- [ ] **Step 3: Pool tracker module (spec §4b — small, not a hero).** Add inside `.results-card` after the tax `.proj-section` (before ~3048), following the existing collapsible pattern:

```html
<div class="proj-section" id="quarantineSection" hidden>
  <button class="proj-section-header" aria-expanded="false">Quarantined losses <span class="help-tip" data-tip="Rental losses that no longer reduce your salary tax — they wait in a pool until this property (or another residential property) makes rental profits or a capital gain">?</span></button>
  <div class="proj-section-body" hidden>
    <p id="resQuarantineNote" class="quarantine-note"></p>
    <div class="proj-line"><span>Quarantined losses by sale (15 yr)</span><span id="resQuarantinePool">-</span></div>
    <ul class="quarantine-explainer">
      <li><strong>Less:</strong> at sale, each quarantined dollar offsets the gross gain — typically saving about half what the old annual refund would have.</li>
      <li><strong>Later:</strong> nothing back until you sell; the pool isn't indexed, so inflation erodes it while it waits.</li>
      <li><strong>Only maybe:</strong> if the sale gain is smaller than the pool, the remainder is stranded.</li>
    </ul>
    <div class="proj-line" id="resStrandedRow" hidden><span>Stranded losses (never recovered)</span><span id="resStrandedLosses">-</span></div>
  </div>
</div>
```

In `calculate()`: `document.getElementById('quarantineSection').hidden = !ngQuarantined;` — **never show quarantine UI to grandfathered users** (spec §4). Fill `resQuarantinePool` with `quarantinePoolAtYear(15)`; fill/unhide `resStrandedRow` from the 15-year `saleOutcome.detail.strandedPool` when > 0.

- [ ] **Step 4: Verify** — smoke 8/8, unit 199, engine 106; browser preview: post-Budget established property shows the section with a growing pool and $0 tax benefit in a 2028+ snapshot year; a 2020-contract property shows no quarantine UI anywhere.

- [ ] **Step 5: Commit** — `git add index.html && git commit -m "feat: quarantine cash-flow reframe and pool tracker (UI spec §4)"`

---

### Task 5: Deemed-value chip + sensitivity band + minimum-tax footnote (UI spec §2/§3)

**Files:**
- Modify: `index.html` — projections card (deemed chip above the grid, ~3050s; per-period sensitivity line), hidden `data-field` for the override, serialize/deserialize arrays

- [ ] **Step 1: Deemed-value chip.** Above `.projections-grid`, add:

```html
<div class="deemed-value-chip" id="deemedValueChip" hidden>
  <span>Estimated value at 30 June 2027: <strong id="deemedValueDisplay">-</strong>
    <span class="help-tip" data-tip="The 2027 tax change splits your gain at this date. This is our projection from today's value at your growth rate — edit it if you have a better estimate (e.g. a valuation)">?</span></span>
  <button type="button" class="chip-edit-btn" id="deemedValueEditBtn">edit</button>
  <span id="deemedValueEditWrap" hidden>
    <input type="number" id="deemedValueInput" min="0" step="1000">
    <button type="button" class="chip-edit-btn" id="deemedValueResetBtn">reset to estimate</button>
  </span>
</div>
```

Persist the override per property via a hidden `<input type="hidden" data-field="deemedValueOverride">` in the template row (add to both serialize/deserialize arrays and `SIMPLE_MODE_DEFAULTS: deemedValueOverride: ''`). Wire the three buttons with addEventListener in the init block (~5092+; **no inline handlers**): edit shows the input seeded with the current value; input `change` writes the hidden field and calls `calculate()`; reset clears it. In `calculate()`: `deemedValue = override || projectedEstimate`, `deemedValueIsEstimate = !override`; the chip is shown only when any period routes DUAL_ERA/BEST_OF.

- [ ] **Step 2: Sensitivity band (mandatory — spec §3).** For each period whose `saleOutcome.regime !== 'OLD'`, re-run `calcReformSale` at `deemedValue × 0.9` and `× 1.1` and write a one-line range under the period's TrueReturn:

```html
<div class="proj-line sensitivity-band" id="proj5Sensitivity" hidden></div>
```
(same for `proj10`/`projLife`), filled as:
`"If the 30 June 2027 value is 10% lower/higher: " + formatCurrency(lo.trueCashReturn) + " to " + formatCurrency(hi.trueCashReturn)`
and when the band width exceeds 15% of the period's `trueCashReturn` magnitude, append `" — this estimate matters a lot for your result; consider a real valuation in mid-2027."` The band must be visible whenever its period shows dual-era figures (not behind any toggle).

- [ ] **Step 3: Minimum-tax footnote.** When any shown period's `detail.minTaxBound` (or `detail.optionB.minTaxBound` on BEST_OF) is true, unhide a footnote element under the projections grid: `<p class="projections-disclaimer" id="minTaxFootnote" hidden>Simplified minimum-tax calculation; interactions with your other income and deductions can change this.</p>` — text sourced from `DISCLAIMERS.minTaxSimplified` at runtime (`document.getElementById('minTaxFootnote').textContent = DISCLAIMERS.minTaxSimplified;`).

- [ ] **Step 4: Verify** — suites green; browser preview: dual-era property shows chip + band; editing the chip changes figures and survives save/reload (serialize round-trip); pre-2027-only property (contract 2020, but all periods post-2027… use a 2020 contract — periods still post-2027 so chip shows; to see it hidden, confirm on a new-build BEST_OF vs OLD… simplest hidden case: none in 2026 — skip) — at minimum confirm chip hidden when no dual-era period exists in a constructed state, else confirm shown.

- [ ] **Step 5: Commit** — `git add index.html && git commit -m "feat: deemed-value chip with override, sensitivity band, minimum-tax footnote (UI spec §3)"`

---

### Task 6: Reform disclaimer banner (UI spec §5)

**Files:**
- Modify: `index.html` — banner markup after `.intro-disclaimer` (~2651), dismiss wiring in the init block, CSS alongside `.intro-disclaimer`'s rules

- [ ] **Step 1: Markup**

```html
<div class="reform-banner" id="reformBanner" hidden>
  <span id="reformBannerText"></span>
  <button type="button" id="reformBannerDismiss" aria-label="Dismiss">×</button>
</div>
```

- [ ] **Step 2: Wiring.** In `calculate()`: show the banner (unless dismissed this session) whenever the new engine is in play — any period routing `DUAL_ERA`/`BEST_OF`, or `ngQuarantined`. Text assembled from the engine's single source: `DISCLAIMERS.generalInfo + ' Some details (new-build definition, the official apportioning method) are still pending — flagged where they apply.'` Dismiss handler (addEventListener in init block): `sessionStorage.setItem('reformBannerDismissed','1')` and hide; reappears next session (spec: dismissible, reappears per session). Style it off the existing `.intro-disclaimer` rules with a visible border — sentence case, no alarm colours.

- [ ] **Step 3: Verify + commit** — suites green; preview shows the banner once, dismiss persists across a `calculate()` but not a new session. `git add index.html && git commit -m "feat: dismissible reform disclaimer banner (UI spec §5)"`

---

### Task 7: Structural test updates + full verification

**Files:**
- Modify: `.claude/smoke-test.js` — required ids and data-fields
- Test: everything

- [ ] **Step 1: Extend the smoke gates.** Add to the required-ids list: `quarantineSection, resQuarantinePool, deemedValueChip, proj5Sensitivity, proj10Sensitivity, projLifeSensitivity, minTaxFootnote, reformBanner`. Add to the required-data-fields list: `contractDate, dwellingType, currentValueEstimate, deemedValueOverride`. Run `node .claude/smoke-test.js` — now 8/8 with the stricter gates.

- [ ] **Step 2: Full suite + browser verification.** `node tests/engine.test.js && node tests/unit.js && node .claude/smoke-test.js`. Then in the browser preview run the four spec walkthroughs: (a) default new property → dual-era figures + banner + chip + bands; (b) contract 2020-01-01 → grandfathered: tax benefit intact, no quarantine UI, dual-era CGT still splits post-2027 sales; (c) contract 2026-08-01 established → quarantine section, $0 refunds in 2028+ snapshot years, pool feeding the sale; (d) new build → BEST_OF line per §1.4 (single results line, no dedicated UI). Screenshot the results panel for the PO.

- [ ] **Step 3: Commit** — `git add .claude/smoke-test.js && git commit -m "test: structural gates for reform UI elements"`

---

## Self-review notes

- Spec coverage (UI spec v2.1): §1.1 dual-era invisible (Task 3), §1.3 quarantine conditional (Task 4), §1.4 new-build single line (Task 3 routes BEST_OF; the one-line copy lands with the period CGT display), §2 Group 1 new inputs (Task 2) + deemed chip (Task 5), §3 sensitivity band + min-tax footnote (Task 5), §4 both elements (Task 4), §5 banner + framing rules (Task 6; no decision-question copy anywhere in this plan), §6 copy/help-tips (each new term carries a `data-tip`).
- Deliberately NOT here: §9 Return-on-your-cash + benchmark (plan 2b-2); §3a module (plan 2b-3); growth slider/chips (2b-2); reduced-motion (2b-3 polish).
- Line numbers are anchors, not gospel — every task tells the implementer to locate by quoted code and read the surrounding logic first; Task 3 Step 1 mandates reading all call sites before editing.
- The three UI-heavy tasks (3–5) each end with a browser-preview verification step because unit tests cannot see the DOM wiring; the harness's preview tools are the check.

## After the plan

Pipeline: subagent-driven-development → code-reviewer → smoke-tester → **ui-reviewer (required — HTML/CSS changed)** → github-liaison at every stage on issue #2 → PO browser gate.
