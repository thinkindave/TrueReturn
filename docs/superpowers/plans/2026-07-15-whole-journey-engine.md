# Whole-Journey Engine Additions (Phase 2a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add return-on-equity/leverage outputs (tax spec §11), the opportunity-cost benchmark (§12), and negative/zero-growth handling (§13) to `engine.js`, per `specs/truereturn-tax-engine-requirements.md` v2.0.

**Architecture:** All additions are pure functions appended to `engine.js` (the single deployable unit; no DOM access), following the established pattern. Two new standalone calculators (`calcEquityReturns`, `calcBenchmark`) plus two small helpers (`annualizedReturn`, `irrFromCashflows`); `calcOldRegimeCGT`/`calcDualEraCGT` gain a `capitalLossRealized` output; `runSaleScenario` attaches optional `equity`/`benchmark` blocks so both comparison cards get them for free in Phase 2b.

**Tech Stack:** Vanilla JS, no build system, no npm. Tests: `node tests/engine.test.js` using `tests/harness.js` (`test`/`approxEqual`/`summary`).

**Tracking:** GitHub issue #3 (blocks the UI build in issue #2). Work on a feature branch/worktree (create via superpowers:using-git-worktrees at execution start). Never push without explicit user instruction.

---

## Domain primer

TrueReturn is a whole-journey real-return tool. The launch essay's arc: a property growing ~5% p.a. returned ~11.5% p.a. on the owner's cash **because of ~5× leverage** — and the honest test is whether that beat a boring index fund **after tax, on the same cash, over the same clock**. Phase 2a makes the engine report those numbers.

Key facts for anyone touching this code:

- **Existing helpers you must reuse** (all in `engine.js`): `yearFrac(isoFrom, isoTo)` — anniversary-aware year fraction; `BOUNDARY_ISO = '2027-07-01'`; `DEEMED_DATE_ISO = '2027-06-30'`; `calcOldRegimeCGT`, `calcDualEraCGT`, `applyOffsets`. Dates are ISO `'YYYY-MM-DD'` strings; lexicographic comparison is chronologically correct.
- **The benchmark is taxed through the same CGT regimes as the property** (spec §12.3): sale before 1 July 2027 → old regime (50% discount); on/after → dual-era (indexation + 30% floor), with the deemed 30 June 2027 value being the benchmark's own compounded value on that date. NG quarantine does NOT apply to the benchmark (not residential rental).
- **Neutrality constraint (spec, non-negotiable):** the engine emits numbers and flags only — no "winner", no judgment fields.
- **Spec T8's arithmetic is mis-rounded.** The spec asserts `104,000 × 1.09^5.1 ≈ $163,100`, but `1.09^5.1 = 1.5519` → **$161,421** (the spec's figure corresponds to ~5.22 years). Per spec §8's own instruction ("verify independently from the formulas and investigate any mismatch rather than adjusting expectations to fit") and the Phase 1 precedent (T3/T4 rounding), we assert the exact-formula values: benchmark ROE ≈ **7.48% p.a.**, not "~7.7%". The invariants the spec cares about hold: benchmark ROE is well below property ROE (~11.7%), both after-tax, same cash, same clock.
- **Spec §11 `netProfit` formula, generalized:** the spec defines `netProfit = netProceedsAfterTax − totalCashInvested` with `totalCashInvested = deposit + Σ(after-tax holding contributions)` — written for the essay's always-bleeding property. For properties with cash-positive years we add holding **inflows** to the profit side: `netProfit = netProceedsAfterTax + holdingInflows − totalCashInvested`. When every year bleeds (the essay case, and test T7) this reduces exactly to the spec formula.

Numeric conventions in cash-flow arrays: `{ date: 'YYYY-MM-DD', amount: Number }` with **negative = money out of the investor's pocket**, positive = money in.

---

## File structure

- **Modify `engine.js`** — append a new `── Whole-journey outputs (spec §§11–13)` section between `compareSaleTiming` and `DISCLAIMERS`; add `capitalLossRealized` to `calcOldRegimeCGT` and `calcDualEraCGT` returns; attach optional `equity`/`benchmark` blocks in `runSaleScenario`; add one disclaimer; extend `module.exports`.
- **Modify `tests/engine.test.js`** — append test sections: helpers, T7 equity, T8 + benchmark suite, §13 negative growth, integration.

No new files. (The codebase's deliberate pattern is one engine file + one engine test file.)

---

### Task 1: `annualizedReturn` and `irrFromCashflows` helpers

**Files:**
- Modify: `engine.js` (insert new section header + two functions immediately after `compareSaleTiming`, before the `DISCLAIMERS` block)
- Test: `tests/engine.test.js` (append before the final `summary()` call)

- [ ] **Step 1: Write the failing tests**

Append to `tests/engine.test.js` (before `summary()`):

```js
// ── Whole-journey helpers (spec §11) ─────────────────────────────────────
console.log('\nannualizedReturn & irrFromCashflows');

test('annualizedReturn: basic compounding', () => {
  // $100k → +$21k over 2 years = 10% p.a. (1.21 = 1.1^2)
  approxEqual(E.annualizedReturn(21000, 100000, 2), 0.10, 1e-9);
});

test('annualizedReturn: negative profit gives a real negative rate', () => {
  const r = E.annualizedReturn(-19000, 100000, 2);
  approxEqual(r, -0.10, 1e-9); // 0.81 = 0.9^2
});

test('annualizedReturn: loss of entire stake or more returns -1, never NaN', () => {
  assert.strictEqual(E.annualizedReturn(-100000, 100000, 5), -1);
  assert.strictEqual(E.annualizedReturn(-150000, 100000, 5), -1);
});

test('annualizedReturn: invalid inputs return null', () => {
  assert.strictEqual(E.annualizedReturn(1000, 0, 5), null);
  assert.strictEqual(E.annualizedReturn(1000, 100000, 0), null);
});

test('irrFromCashflows: single in/out reproduces the compound rate', () => {
  const irr = E.irrFromCashflows([
    { date: '2020-01-01', amount: -100000 },
    { date: '2022-01-01', amount: 121000 },
  ]);
  approxEqual(irr, 0.10, 1e-6);
});

test('irrFromCashflows: interim outflows lower the IRR below the naive rate', () => {
  // Same profit as roeSimple would see, but $10k fed in at year 1.
  const irr = E.irrFromCashflows([
    { date: '2020-01-01', amount: -100000 },
    { date: '2021-01-01', amount: -10000 },
    { date: '2025-01-01', amount: 160000 },
  ]);
  assert(irr !== null && irr > 0, 'IRR should solve');
  const naive = E.annualizedReturn(50000, 100000, 5);
  assert(irr < naive, `IRR ${irr} should be below naive ${naive}`);
});

test('irrFromCashflows: no sign change returns null', () => {
  assert.strictEqual(E.irrFromCashflows([
    { date: '2020-01-01', amount: -1000 },
    { date: '2021-01-01', amount: -2000 },
  ]), null);
  assert.strictEqual(E.irrFromCashflows([]), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tests/engine.test.js`
Expected: the new tests FAIL with `E.annualizedReturn is not a function` (and the pre-existing 55 still pass).

- [ ] **Step 3: Implement the helpers**

In `engine.js`, insert after the closing brace of `compareSaleTiming` (before the `DISCLAIMERS` section):

```js
// ── Whole-journey outputs (spec §§11–13) ─────────────────────────────────
// Return-on-equity, IRR, and the opportunity-cost benchmark. All outputs
// are neutral numbers — no judgment fields (spec neutrality constraint).

// Annualized return on cashInvested given total netProfit over `years`.
// A loss of the whole stake (or more) returns -1 (−100% p.a. floor) so
// callers never see NaN from a negative base with a fractional exponent.
function annualizedReturn(netProfit, cashInvested, years) {
  if (cashInvested <= 0 || years <= 0) return null;
  const ratio = 1 + netProfit / cashInvested;
  if (ratio <= 0) return -1;
  return Math.pow(ratio, 1 / years) - 1;
}

// IRR of dated cash flows [{date, amount}] (negative = out of pocket).
// Bisection on NPV over (−99.99%, 1000%); null when no root is bracketed
// (e.g. all flows the same sign).
function irrFromCashflows(flows) {
  if (!flows || flows.length === 0) return null;
  const t0 = flows.reduce((min, f) => (f.date < min ? f.date : min), flows[0].date);
  const npv = r => flows.reduce(
    (s, f) => s + f.amount / Math.pow(1 + r, yearFrac(t0, f.date)), 0);
  let lo = -0.9999, hi = 10;
  let fLo = npv(lo), fHi = npv(hi);
  if (!isFinite(fLo) || !isFinite(fHi) || fLo * fHi > 0) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (fLo * fMid <= 0) { hi = mid; } else { lo = mid; fLo = fMid; }
  }
  return (lo + hi) / 2;
}
```

Add `annualizedReturn, irrFromCashflows,` to `module.exports` (after the `compareSaleTiming` line).

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/engine.test.js`
Expected: all pass (55 pre-existing + 8 new).

- [ ] **Step 5: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat: annualizedReturn and IRR helpers for whole-journey outputs"
```

---

### Task 2: `calcEquityReturns` — return on equity / leverage (spec §11, test T7)

**Files:**
- Modify: `engine.js` (append after `irrFromCashflows`)
- Test: `tests/engine.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/engine.test.js`:

```js
// ── Return on equity (spec §11, test T7) ─────────────────────────────────
console.log('\ncalcEquityReturns (spec §11)');

// T7: purchase $520k (costs in-price), loan $416k → deposit $104k.
// Sold $660k, selling costs $14k, CGT $27k, payout $416k → net $203k.
// ~$20k after-tax contributions over the hold; ~5.1yr hold.
const t7 = {
  purchasePrice: 520000, purchaseCosts: 0, loanAmount: 416000,
  contractDate: '2020-12-01', saleDate: '2026-01-07', // yearFrac ≈ 5.1013
  netProceedsAfterTax: 203000, // 660000 − 14000 − 27000 − 416000
  salePrice: 660000,
  holdingCashflows: [
    { date: '2021-07-01', amount: -4000 },
    { date: '2022-07-01', amount: -4000 },
    { date: '2023-07-01', amount: -4000 },
    { date: '2024-07-01', amount: -4000 },
    { date: '2025-07-01', amount: -4000 },
  ],
};

test('T7: deposit, total cash and net profit', () => {
  const r = E.calcEquityReturns(t7);
  approxEqual(r.depositCashInvested, 104000, 0.001);
  approxEqual(r.totalCashInvested, 124000, 0.001);
  approxEqual(r.netProfit, 79000, 0.001);
});

test('T7: roeSimple ≈ 11.7% p.a. (reconciles to the essay\'s ~11.5%)', () => {
  const r = E.calcEquityReturns(t7);
  // (1 + 79000/104000)^(1/5.1013) − 1
  approxEqual(r.roeSimple, 0.1171, 0.001);
});

test('T7: IRR solves and is below roeSimple (prices the timing of the bleed)', () => {
  const r = E.calcEquityReturns(t7);
  assert(r.irr !== null && r.irr > 0, 'IRR should solve');
  assert(r.irr < r.roeSimple, `irr ${r.irr} should be < roeSimple ${r.roeSimple}`);
});

test('T7: leverage multiple ≈ 5× and asset growth ≈ 4.8% p.a.', () => {
  const r = E.calcEquityReturns(t7);
  approxEqual(r.leverageMultiple, 5.0, 0.001);
  // (660000/520000)^(1/5.1013) − 1 — the amplification pair's other half
  approxEqual(r.assetGrowthAnnual, 0.0478, 0.001);
});

test('§13: negative net profit yields a real negative ROE, never blanked', () => {
  const r = E.calcEquityReturns({
    ...t7, netProceedsAfterTax: 87000, // netProfit = 87000 − 124000 = −37000
  });
  approxEqual(r.netProfit, -37000, 0.001);
  assert(r.roeSimple < 0 && isFinite(r.roeSimple), 'ROE must be a real negative');
});

test('§13: loss beyond the whole stake floors at −1, never NaN', () => {
  const r = E.calcEquityReturns({ ...t7, netProceedsAfterTax: -20000 });
  assert.strictEqual(r.roeSimple, -1);
});

test('cash-positive holding years add to profit, not to cash invested', () => {
  const r = E.calcEquityReturns({
    ...t7,
    holdingCashflows: [
      { date: '2021-07-01', amount: -4000 },
      { date: '2022-07-01', amount: 3000 }, // a good year
    ],
  });
  approxEqual(r.totalCashInvested, 108000, 0.001); // deposit + 4000 only
  approxEqual(r.netProfit, 203000 + 3000 - 108000, 0.001);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tests/engine.test.js`
Expected: FAIL with `E.calcEquityReturns is not a function`.

- [ ] **Step 3: Implement `calcEquityReturns`**

Append to `engine.js` after `irrFromCashflows`:

```js
// ── Return on equity / leverage (spec §11) ───────────────────────────────
// The essay's pivotal outputs: what the investor's CASH returned, next to
// what the ASSET did — the gap is leverage, reported without judgment.
// holdingCashflows: dated after-tax flows (negative = money fed in).
// netProfit generalizes spec §11 to cash-positive years: inflows join the
// profit side; only outflows count as cash invested. With all-negative
// flows (the essay case, T7) this is exactly the spec formula.
function calcEquityReturns({ purchasePrice, purchaseCosts = 0, loanAmount,
                             contractDate, saleDate, netProceedsAfterTax,
                             holdingCashflows = [], salePrice = null }) {
  const depositCashInvested = purchasePrice + purchaseCosts - loanAmount;
  let contributions = 0, holdingInflows = 0;
  for (const f of holdingCashflows) {
    if (f.amount < 0) contributions -= f.amount;
    else holdingInflows += f.amount;
  }
  const totalCashInvested = depositCashInvested + contributions;
  const netProfit = netProceedsAfterTax + holdingInflows - totalCashInvested;
  const holdingYears = yearFrac(contractDate, saleDate);

  const roeSimple = annualizedReturn(netProfit, depositCashInvested, holdingYears);
  const irr = irrFromCashflows([
    { date: contractDate, amount: -depositCashInvested },
    ...holdingCashflows,
    { date: saleDate, amount: netProceedsAfterTax },
  ]);
  const leverageMultiple = depositCashInvested > 0
    ? purchasePrice / depositCashInvested : null;
  // Amplification pair (§11 #4): asset growth beside ROE, both % p.a.
  const assetGrowthAnnual = salePrice !== null
    ? annualizedReturn(salePrice - purchasePrice, purchasePrice, holdingYears)
    : null;

  return { depositCashInvested, totalCashInvested, netProfit, holdingYears,
           roeSimple, irr, leverageMultiple, assetGrowthAnnual };
}
```

Add `calcEquityReturns,` to `module.exports`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/engine.test.js`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat: calcEquityReturns — ROE, IRR, leverage multiple, amplification pair (spec §11, T7)"
```

---

### Task 3: `calcBenchmark` — opportunity-cost benchmark (spec §12, test T8)

**Files:**
- Modify: `engine.js` (append after `calcEquityReturns`)
- Test: `tests/engine.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/engine.test.js`:

```js
// ── Opportunity-cost benchmark (spec §12, test T8) ───────────────────────
console.log('\ncalcBenchmark (spec §12)');

test('T8: pre-2027 sale — old regime, exact-formula values', () => {
  // Spec T8's "≈$163,100" mis-rounds 1.09^5.1 (=1.5519 → $161,421); per
  // §8 we assert the formula, not the rounding. Invariant preserved:
  // benchmark ROE (~7.5%) well below property ROE (~11.7%), both after tax.
  const r = E.calcBenchmark({
    depositCashInvested: 104000,
    contractDate: '2020-12-01', saleDate: '2026-01-07',
    benchmarkReturn: 0.09, feeDrag: 0, marginalRate: 0.39,
  });
  assert.strictEqual(r.regime, 'OLD');
  approxEqual(r.valueAtSale, 161421, 5);
  approxEqual(r.cgt, 11197, 5);      // (161421−104000)×0.5×0.39
  approxEqual(r.netProfit, 46224, 10);
  approxEqual(r.benchmarkRoe, 0.0748, 0.001);
});

test('T8 invariant: benchmark ROE sits below the T7 property ROE', () => {
  const prop = E.calcEquityReturns(t7);
  const bench = E.calcBenchmark({
    depositCashInvested: 104000,
    contractDate: '2020-12-01', saleDate: '2026-01-07',
    benchmarkReturn: 0.09, feeDrag: 0, marginalRate: 0.39,
  });
  assert(bench.benchmarkRoe < prop.roeSimple,
    'unleveraged benchmark should trail the leveraged property here');
});

test('post-2027 sale routes through dual-era; 30% floor binds at low MTR', () => {
  const r = E.calcBenchmark({
    depositCashInvested: 100000,
    contractDate: '2024-07-01', saleDate: '2029-07-01',
    benchmarkReturn: 0.08, feeDrag: 0, marginalRate: 0.21, cpiRate: 0.025,
  });
  assert.strictEqual(r.regime, 'DUAL_ERA');
  // Deemed value = benchmark's own compounded value at 30 Jun 2027.
  approxEqual(r.cgtDetail.preGross,
    100000 * Math.pow(1.08, E.yearFrac('2024-07-01', '2027-06-30')) - 100000, 1);
  assert(r.cgtDetail.minTaxBound, '30% floor should bind at MTR 21%');
  assert(r.cgt > 0 && r.netProfit > 0);
});

test('dual-era CGT exceeds an old-law counterfactual when growth outruns CPI', () => {
  const inputs = {
    depositCashInvested: 100000,
    contractDate: '2024-07-01', saleDate: '2029-07-01',
    benchmarkReturn: 0.08, feeDrag: 0, marginalRate: 0.39, cpiRate: 0.025,
  };
  const r = E.calcBenchmark(inputs);
  const oldLaw = E.calcOldRegimeCGT({
    salePrice: r.valueAtSale, sellingCosts: 0,
    acquisitionCosts: 100000, marginalRate: 0.39,
  });
  assert(r.cgt > oldLaw.tax,
    'the 2027 change should raise the benchmark\'s tax too — the essay\'s "hits shares as well"');
});

test('DCA mode: contributions compound from their own dates', () => {
  // 50k at 2025-01-01 + 10k at 2026-01-01, sold 2027-01-01 at 10%, no drag:
  // value = 50000×1.1² + 10000×1.1 = 71,500.
  const r = E.calcBenchmark({
    depositCashInvested: 50000,
    contractDate: '2025-01-01', saleDate: '2027-01-01',
    benchmarkReturn: 0.10, feeDrag: 0, marginalRate: 0.39,
    contributions: [{ date: '2026-01-01', amount: 10000 }],
  });
  approxEqual(r.valueAtSale, 71500, 0.5);
  approxEqual(r.totalContributed, 60000, 0.001);
  // gain 11,500 → discounted 5,750 → CGT 2,242.50
  approxEqual(r.cgt, 2242.5, 0.5);
  approxEqual(r.netProfit, 9257.5, 1);
});

test('fee drag default 0.10% p.a. reduces the compounded value', () => {
  const base = { depositCashInvested: 100000,
    contractDate: '2020-01-01', saleDate: '2025-01-01',
    benchmarkReturn: 0.09, marginalRate: 0.39 };
  const withDrag = E.calcBenchmark(base);            // default feeDrag 0.001
  const noDrag = E.calcBenchmark({ ...base, feeDrag: 0 });
  assert(withDrag.valueAtSale < noDrag.valueAtSale);
  approxEqual(withDrag.valueAtSale, 100000 * Math.pow(1.089, 5), 1);
});

test('benchmark presets exist as config with the disclaimer flag', () => {
  for (const key of ['vas', 'vgs', 'hisa']) {
    const p = E.BENCHMARK_PRESETS[key];
    assert(p && typeof p.annualReturn === 'number' && p.label,
      `preset ${key} must be config with label + annualReturn`);
  }
  const r = E.calcBenchmark({
    depositCashInvested: 100000,
    contractDate: '2020-01-01', saleDate: '2025-01-01',
    benchmarkReturn: E.BENCHMARK_PRESETS.vas.annualReturn, marginalRate: 0.39,
  });
  assert.strictEqual(r.flags.historicalNotForecast, true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tests/engine.test.js`
Expected: FAIL with `E.calcBenchmark is not a function`.

- [ ] **Step 3: Implement `calcBenchmark` and `BENCHMARK_PRESETS`**

Append to `engine.js` after `calcEquityReturns`:

```js
// ── Opportunity-cost benchmark (spec §12) ────────────────────────────────
// An unleveraged benchmark on the same cash and the same clock as the
// property, taxed through the SAME CGT regimes (the 2027 change applies to
// all CGT assets): pre-boundary sale → old regime; on/after → dual-era,
// with the deemed 30 June 2027 value being the benchmark's own compounded
// value on that date. NG quarantine never applies (not residential rental).
// Assumes acquisition before 1 July 2027, like the dual-era property
// module; post-boundary acquisitions are out of scope for v1.
// Preset values are CONFIG — historical, before tax, not a forecast
// (figures as at July 2026; update from source when refreshed).
const BENCHMARK_PRESETS = {
  vas:  { label: 'VAS (Australian shares)',   annualReturn: 0.088 },
  vgs:  { label: 'VGS (international shares)', annualReturn: 0.115 },
  hisa: { label: 'High-interest savings',      annualReturn: 0.045 },
};

function calcBenchmark({ depositCashInvested, contractDate, saleDate,
                         benchmarkReturn, feeDrag = 0.001,
                         contributions = [], // [{date, amount>0}] DCA mode
                         marginalRate, cpiRate = 0.025, minTaxFloor = 0.30 }) {
  const netRate = benchmarkReturn - feeDrag;
  const grow = (amount, fromISO, toISO) =>
    amount * Math.pow(1 + netRate, yearFrac(fromISO, toISO));

  const valueAtSale = grow(depositCashInvested, contractDate, saleDate)
    + contributions.reduce((s, c) => s + grow(c.amount, c.date, saleDate), 0);
  const totalContributed = depositCashInvested
    + contributions.reduce((s, c) => s + c.amount, 0);

  let cgtDetail, cgt, regime;
  if (saleDate < BOUNDARY_ISO) {
    regime = 'OLD';
    cgtDetail = calcOldRegimeCGT({
      salePrice: valueAtSale, sellingCosts: 0,
      acquisitionCosts: totalContributed, marginalRate,
    });
    cgt = cgtDetail.tax;
  } else {
    regime = 'DUAL_ERA';
    const preContribs = contributions.filter(c => c.date < BOUNDARY_ISO);
    const postContribs = contributions.filter(c => c.date >= BOUNDARY_ISO);
    const deemedValue = grow(depositCashInvested, contractDate, DEEMED_DATE_ISO)
      + preContribs.reduce((s, c) => s + grow(c.amount, c.date, DEEMED_DATE_ISO), 0);
    cgtDetail = calcDualEraCGT({
      deemedValue,
      oldCostBase: depositCashInvested
        + preContribs.reduce((s, c) => s + c.amount, 0),
      salePrice: valueAtSale, saleDate, sellingCosts: 0,
      postExpenditures: postContribs.map(c => ({ date: c.date, amount: c.amount })),
      cpiRate, marginalRate, minTaxFloor,
    });
    cgt = cgtDetail.totalCGT;
  }

  const netProfit = valueAtSale - totalContributed - cgt;
  const holdingYears = yearFrac(contractDate, saleDate);
  return {
    valueAtSale, totalContributed, cgt, cgtDetail, netProfit, holdingYears,
    benchmarkRoe: annualizedReturn(netProfit, depositCashInvested, holdingYears),
    regime,
    flags: { historicalNotForecast: true, unleveraged: true },
  };
}
```

Add `calcBenchmark, BENCHMARK_PRESETS,` to `module.exports`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/engine.test.js`
Expected: all pass. If the T8 figures miss by more than tolerance, re-derive by hand from §12 before touching either side (spec §8 rule).

- [ ] **Step 5: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat: calcBenchmark — after-tax opportunity-cost benchmark through the regime router (spec §12, T8)"
```

---

### Task 4: Negative/zero growth handling and `capitalLossRealized` (spec §13)

**Files:**
- Modify: `engine.js` — `calcOldRegimeCGT` return (~line 221) and `calcDualEraCGT` return (~line 275)
- Test: `tests/engine.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/engine.test.js`:

```js
// ── Negative & zero growth (spec §13) ────────────────────────────────────
console.log('\nnegative & zero growth (spec §13)');

test('old regime: sale below cost base → CGT 0, loss recorded', () => {
  const r = E.calcOldRegimeCGT({
    salePrice: 686000, sellingCosts: 13720, acquisitionCosts: 720000,
    marginalRate: 0.39,
  });
  approxEqual(r.tax, 0, 0.001);
  approxEqual(r.capitalLossRealized, 47720, 0.001); // 733,720 − 686,000
});

test('dual-era: losses in both components → CGT 0, loss recorded, never clamped away', () => {
  const r = E.calcDualEraCGT({
    deemedValue: 672280, oldCostBase: 720000,
    salePrice: 645000, saleDate: '2029-07-01', sellingCosts: 12900,
    cpiRate: 0.025, marginalRate: 0.39,
  });
  approxEqual(r.totalCGT, 0, 0.001);
  assert(r.capitalLossRealized > 0, 'combined loss must be reported');
});

test('capitalLossRealized is 0 on a gain (no spurious losses)', () => {
  const r = E.calcOldRegimeCGT({
    salePrice: 660000, sellingCosts: 14000, acquisitionCosts: 520000,
    div43Claimed: 10000, marginalRate: 0.39,
  });
  approxEqual(r.tax, 26520, 0.01); // T1 regression guard
  approxEqual(r.capitalLossRealized, 0, 0.001);
});

test('runSaleScenario accepts negative growth: price falls, CGT 0, wealth can be negative', () => {
  const inputs = {
    contractDate: '2020-07-01', dwellingType: 'established',
    acquisitionCosts: 720000, valuationDate: '2025-07-01',
    currentValueEstimate: 700000, growthAssumption: -0.02,
    marginalRate: 0.39, sellingCostsPct: 0.02,
    annualNetRental: -8000, loanBalance: 640000, cpiRate: 0.025,
  };
  const r = E.runSaleScenario(inputs, '2026-07-01');
  approxEqual(r.salePrice, 686000, 0.5); // 700000 × 0.98
  approxEqual(r.cgt, 0, 0.001);
  assert(r.detail.capitalLossRealized > 0);
  assert(r.totalWealth < r.netProceeds, 'holding bleed must subtract');
  assert(isFinite(r.totalWealth), 'never blanked or NaN');
});

test('flat growth (0%) is a plain valid input', () => {
  const inputs = {
    contractDate: '2020-07-01', dwellingType: 'established',
    acquisitionCosts: 720000, valuationDate: '2025-07-01',
    currentValueEstimate: 700000, growthAssumption: 0,
    marginalRate: 0.39, sellingCostsPct: 0.02,
    annualNetRental: -8000, loanBalance: 640000, cpiRate: 0.025,
  };
  const r = E.runSaleScenario(inputs, '2026-07-01');
  approxEqual(r.salePrice, 700000, 0.5); // no clamp, no drift
});

test('compareSaleTiming survives negative growth end-to-end', () => {
  const out = E.compareSaleTiming({
    contractDate: '2026-08-01', dwellingType: 'established',
    acquisitionCosts: 720000, valuationDate: '2026-08-01',
    currentValueEstimate: 700000, growthAssumption: -0.03,
    marginalRate: 0.39, sellingCostsPct: 0.02,
    annualNetRental: -12000, loanBalance: 560000, cpiRate: 0.025,
    saleDate1: '2027-06-01', saleDate2: '2030-06-01',
  });
  assert(isFinite(out.scenario1.totalWealth) && isFinite(out.scenario2.totalWealth));
  assert(out.scenario2.totalWealth < out.scenario1.totalWealth,
    'falling market + quarantine bleed: holding longer ends worse here');
  // breakeven may legitimately be null (no crossing in 0–15%); must not throw
  assert(out.breakevenGrowth === null || isFinite(out.breakevenGrowth));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tests/engine.test.js`
Expected: FAIL on `capitalLossRealized` being `undefined` (the runSaleScenario negative-growth tests may already pass — that's fine; they pin §13 behaviour against regression).

- [ ] **Step 3: Add `capitalLossRealized` to both CGT modules**

In `calcOldRegimeCGT`, extend the return object:

```js
  return {
    costBase, grossGain, gainAfterOffsets, taxableGain,
    tax: taxableGain * marginalRate,
    capitalLossRealized: Math.max(0, -o.preAfter), // §13: losses are outputs, not silence
    poolUsed: o.poolUsed, strandedPool: o.strandedPool,
    capitalLossesRemaining: o.capitalLossesRemaining,
  };
```

In `calcDualEraCGT`, extend the return object:

```js
  return {
    preGross, preAfterOffsets: o.preAfter, taxablePre, taxOnPre,
    indexedCostBase, postGross, postAfterOffsets: o.postAfter,
    taxOnPost, totalCGT: taxOnPre + taxOnPost,
    capitalLossRealized: Math.max(0, -o.preAfter) + Math.max(0, -o.postAfter),
    minTaxBound: minTaxFloor > marginalRate && Math.max(0, o.postAfter) > 0,
    poolUsed: o.poolUsed, strandedPool: o.strandedPool,
    capitalLossesRemaining: o.capitalLossesRemaining,
    flags: { deemedValueIsEstimate, minTaxSimplified: true },
  };
```

- [ ] **Step 4: Run ALL tests (both files) to verify §13 plus zero regressions**

Run: `node tests/engine.test.js && node tests/unit.js`
Expected: all pass — the new fields are additive; no existing expectation changes.

- [ ] **Step 5: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat: capitalLossRealized output and negative/zero-growth coverage (spec §13)"
```

---

### Task 5: Wire `equity` and `benchmark` blocks into `runSaleScenario` + disclaimer + exports

**Files:**
- Modify: `engine.js` — `runSaleScenario` (insert before its `return`), `DISCLAIMERS`, `module.exports`
- Test: `tests/engine.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/engine.test.js`:

```js
// ── Whole-journey blocks on scenarios (spec §11 "every calculation") ─────
console.log('\nrunSaleScenario equity/benchmark integration');

const wholeJourneyInputs = {
  contractDate: '2020-07-01', dwellingType: 'established',
  acquisitionCosts: 620000, valuationDate: '2025-07-01',
  currentValueEstimate: 780000, growthAssumption: 0.04,
  marginalRate: 0.39, sellingCostsPct: 0.02,
  annualNetRental: -8000, loanBalance: 480000, cpiRate: 0.025,
  // Phase 2a additions:
  purchasePrice: 600000, purchaseCosts: 20000, loanAmount: 480000,
  benchmarkReturn: 0.09,
};

test('equity block appears when loanAmount is provided, on both scenario regimes', () => {
  for (const saleDate of ['2027-06-01', '2030-06-01']) {
    const r = E.runSaleScenario(wholeJourneyInputs, saleDate);
    assert(r.equity, `equity block missing for ${saleDate}`);
    approxEqual(r.equity.depositCashInvested, 140000, 0.001);
    assert(isFinite(r.equity.roeSimple));
    approxEqual(r.equity.leverageMultiple, 600000 / 140000, 0.001);
  }
});

test('benchmark block rides along and routes through the same regimes', () => {
  const pre = E.runSaleScenario(wholeJourneyInputs, '2027-06-01');
  const post = E.runSaleScenario(wholeJourneyInputs, '2030-06-01');
  assert.strictEqual(pre.benchmark.regime, 'OLD');
  assert.strictEqual(post.benchmark.regime, 'DUAL_ERA');
  assert(isFinite(pre.benchmark.benchmarkRoe) && isFinite(post.benchmark.benchmarkRoe));
});

test('no loanAmount → no equity/benchmark blocks (existing callers unaffected)', () => {
  const { purchasePrice, purchaseCosts, loanAmount, benchmarkReturn,
          ...legacy } = wholeJourneyInputs;
  const r = E.runSaleScenario(legacy, '2027-06-01');
  assert.strictEqual(r.equity, null);
  assert.strictEqual(r.benchmark, null);
});

test('dcaHoldingContributions feeds the bleed into the benchmark', () => {
  const dca = E.runSaleScenario(
    { ...wholeJourneyInputs, dcaHoldingContributions: true }, '2027-06-01');
  const lump = E.runSaleScenario(wholeJourneyInputs, '2027-06-01');
  assert(dca.benchmark.totalContributed > lump.benchmark.totalContributed);
});

test('comparison scenarios carry the blocks (spec §11: every calculation)', () => {
  const out = E.compareSaleTiming({
    ...wholeJourneyInputs, saleDate1: '2027-06-01', saleDate2: '2030-06-01',
  });
  assert(out.scenario1.equity && out.scenario2.equity);
  assert(out.scenario1.benchmark && out.scenario2.benchmark);
});

test('§10: benchmark disclaimer exists', () => {
  assert(typeof E.DISCLAIMERS.benchmarkHistorical === 'string'
    && E.DISCLAIMERS.benchmarkHistorical.length > 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tests/engine.test.js`
Expected: FAIL — `r.equity` is `undefined`, disclaimer missing.

- [ ] **Step 3: Implement the integration**

In `runSaleScenario`, extend the destructure at the top to pull the new inputs:

```js
  const { contractDate, dwellingType, acquisitionCosts, valuationDate,
          currentValueEstimate, growthAssumption, marginalRate,
          sellingCostsPct, annualNetRental, loanBalance, cpiRate,
          capitalLosses = 0, div43Claimed = 0,
          purchasePrice = null, purchaseCosts = 0, loanAmount = null,
          benchmarkReturn = null, benchmarkFeeDrag = 0.001,
          dcaHoldingContributions = false } = inputs;
```

Then insert immediately after `const netProceeds = ...` and before the `return`:

```js
  // Whole-journey blocks (spec §§11–12). Comparison-mode caveat: holding
  // flows are only modelled valuation→sale, so ROE/IRR here cover that
  // window; the pre-valuation history is identical across both scenarios
  // and cancels in the comparison. The whole-journey calculator (Phase 2b)
  // calls calcEquityReturns/calcBenchmark directly with full-journey flows.
  let equity = null, benchmark = null;
  if (loanAmount !== null && purchasePrice !== null) {
    const holdingCashflows = sched.rows.map(r => ({
      date: r.fyStartISO,
      amount: r.netResult + r.refund - r.taxOnProfit,
    }));
    equity = calcEquityReturns({
      purchasePrice, purchaseCosts, loanAmount,
      contractDate, saleDate, netProceedsAfterTax: netProceeds,
      holdingCashflows, salePrice,
    });
    if (benchmarkReturn !== null) {
      benchmark = calcBenchmark({
        depositCashInvested: equity.depositCashInvested,
        contractDate, saleDate, benchmarkReturn, feeDrag: benchmarkFeeDrag,
        contributions: dcaHoldingContributions
          ? holdingCashflows.filter(f => f.amount < 0)
              .map(f => ({ date: f.date, amount: -f.amount }))
          : [],
        marginalRate, cpiRate,
      });
    }
  }
```

And add `equity, benchmark,` to `runSaleScenario`'s return object (after `netProceeds,`).

Add to `DISCLAIMERS`:

```js
  benchmarkHistorical: 'Benchmark presets are historical, before-tax figures — not a forecast.',
```

Verify `module.exports` now includes all Phase 2a names: `annualizedReturn, irrFromCashflows, calcEquityReturns, calcBenchmark, BENCHMARK_PRESETS` (added in Tasks 1–3).

- [ ] **Step 4: Run the full suite**

Run: `node tests/engine.test.js && node tests/unit.js`
Expected: all pass, zero regressions (new inputs are optional; existing callers pass none of them).

- [ ] **Step 5: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat: equity and benchmark blocks on sale scenarios, benchmark disclaimer (spec §§11–12 integration)"
```

---

## Self-review notes (spec coverage)

- §11: roeSimple (T2a-2), IRR (T2a-1/2), leverage multiple (T2a-2), amplification pair (`assetGrowthAnnual` beside `roeSimple`, T2a-2) — Tasks 1–2. Neutral outputs only.
- §12: lump sum + DCA, feeDrag, same-regime taxation incl. deemed-value-of-itself and 30% floor, `historicalNotForecast` flag, presets as config — Task 3. "Hits shares as well" pinned by the old-law-counterfactual test.
- §13: no growth clamp (none exists; pinned by tests), capital-loss path with CGT 0 + `capitalLossRealized`, negative/flat growth through `runSaleScenario` and `compareSaleTiming` — Task 4.
- §2 new inputs: `loanAmount`, `benchmarkReturn`, `benchmarkPreset` (as `BENCHMARK_PRESETS` config; UI resolves preset→rate in Phase 2b), `dcaHoldingContributions` — Tasks 3, 5.
- §10: `benchmarkHistorical` disclaimer — Task 5.
- Known deliberate scope choices, documented in code comments: benchmark assumes pre-1-July-2027 acquisition (same as the dual-era property module); comparison-mode ROE covers the valuation→sale window; T8 asserted from exact formulas, not the spec's mis-rounded $163,100.

## After the plan

Pipeline: code-reviewer → smoke-tester (no ui-reviewer — engine-only, no HTML/CSS changes) → github-liaison posts each stage to issue #3. UI wiring is Phase 2b under issue #2.
