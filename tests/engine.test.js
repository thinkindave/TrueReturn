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

test('§5.3: no CPI indexation when the reacquired asset is held under 12 months', () => {
  // Sale 2027-12-01: only ~5 months after the 1 July 2027 deemed reacquisition.
  const r = E.calcDualEraCGT({
    deemedValue: 800000, oldCostBase: 600000,
    salePrice: 830000, saleDate: '2027-12-01', sellingCosts: 10000,
    cpiRate: 0.025, marginalRate: 0.39,
  });
  approxEqual(r.indexedCostBase, 810000, 0.001);   // 800000 + 10000, NO uplift
  approxEqual(r.postGross, 20000, 0.001);
  approxEqual(r.taxOnPost, 7800, 0.001);
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
  // §5.7 intra-event netting: the same-sale post loss (8,000, unindexed)
  // nets against the pre gain before the carried-forward pool applies —
  // current-year losses precede carry-forwards.
  approxEqual(r.poolUsed, 2000, 0.001);
  approxEqual(r.strandedPool, 47000, 0.001);
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

test('low growth + high inflation: Option B (indexation) wins', () => {
  // Sale price barely above cost; 5% CPI indexes the deemed base past the
  // sale price so the post component is a loss, leaving only the small
  // pre-component — cheaper than discounting the whole nominal gain.
  const r = E.calcNewBuildOptimizer({
    acquisitionCosts: 700000, salePrice: 800000, saleDate: '2032-10-01',
    sellingCosts: 20000, deemedValue: 715000, cpiRate: 0.05, marginalRate: 0.39,
  });
  approxEqual(r.optionA.tax, 15600, 0.01);         // (800000−720000)×0.5×0.39
  approxEqual(r.optionB.totalCGT, 2925, 0.01);     // pre 15000→7500→2925; post is a loss
  assert.strictEqual(r.winner, 'B');
});

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

test('benchmark presets exist as config with provenance and the disclaimer flag', () => {
  for (const key of ['vas', 'vgs', 'hisa']) {
    const p = E.BENCHMARK_PRESETS[key];
    assert(p && typeof p.annualReturn === 'number' && p.label,
      `preset ${key} must be config with label + annualReturn`);
    // Provenance (issue #14): these are historical figures that go stale.
    // .claude/smoke-test.js FAILS when asAt is over 12 months old, so both
    // fields must exist and asAt must be a parseable ISO date.
    assert(typeof p.asAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.asAt),
      `preset ${key} must carry an ISO asAt date, got ${JSON.stringify(p.asAt)}`);
    assert(!isNaN(new Date(p.asAt + 'T00:00:00Z').getTime()),
      `preset ${key}.asAt must be a real date, got ${p.asAt}`);
    assert(typeof p.source === 'string' && p.source.length > 0,
      `preset ${key} must record a non-empty source`);
  }
  const r = E.calcBenchmark({
    depositCashInvested: 100000,
    contractDate: '2020-01-01', saleDate: '2025-01-01',
    benchmarkReturn: E.BENCHMARK_PRESETS.vas.annualReturn, marginalRate: 0.39,
  });
  assert.strictEqual(r.flags.historicalNotForecast, true);
});

test('HISA preset carries the refreshed 4.8% rate', () => {
  approxEqual(E.BENCHMARK_PRESETS.hisa.annualReturn, 0.048, 1e-9);
});

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
  // pre loss 47,720 + post loss vs UNINDEXED base (672,280+12,900=685,180):
  // 685,180 − 645,000 = 40,180. Indexation must not enlarge it to ~74k.
  approxEqual(r.capitalLossRealized, 47720 + 40180, 0.5);
});

test('dual-era mixed case: same-sale post loss nets against pre gain before discount (§5.7)', () => {
  // Rise then fall: pre-component gain 200k; post falls below deemed value.
  const r = E.calcDualEraCGT({
    deemedValue: 800000, oldCostBase: 600000,
    salePrice: 700000, saleDate: '2029-07-01', sellingCosts: 0,
    cpiRate: 0.025, marginalRate: 0.39,
  });
  approxEqual(r.taxOnPre, 19500, 0.5);      // (200k − 100k) → 50k discounted × 39%
  approxEqual(r.taxOnPost, 0, 0.001);
  approxEqual(r.capitalLossRealized, 0, 0.001); // fully absorbed intra-event
});

test('dual-era mixed case: loss exceeding the gain leaves a residual, CGT 0', () => {
  // pre gain 50k, post loss 100k (unindexed 800k vs sale 700k)
  const r = E.calcDualEraCGT({
    deemedValue: 800000, oldCostBase: 750000,
    salePrice: 700000, saleDate: '2029-07-01', sellingCosts: 0,
    cpiRate: 0.025, marginalRate: 0.39,
  });
  approxEqual(r.taxOnPre, 0, 0.001);
  approxEqual(r.taxOnPost, 0, 0.001);
  approxEqual(r.capitalLossRealized, 50000, 0.5);
});

test('dual-era in-between zone: neither post gain nor post loss', () => {
  // salePrice between unindexed (800,000) and indexed (840,500) bases.
  const r = E.calcDualEraCGT({
    deemedValue: 800000, oldCostBase: 800000,
    salePrice: 820000, saleDate: '2029-07-01', sellingCosts: 0,
    cpiRate: 0.025, marginalRate: 0.39,
  });
  approxEqual(r.taxOnPost, 0, 0.001);
  approxEqual(r.capitalLossRealized, 0, 0.001);
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

test('§13 benchmark: negative return produces CGT 0 and a real negative ROE', () => {
  const r = E.calcBenchmark({
    depositCashInvested: 100000,
    contractDate: '2024-01-01', saleDate: '2026-01-01',
    benchmarkReturn: -0.03, feeDrag: 0, marginalRate: 0.39,
  });
  approxEqual(r.cgt, 0, 0.001);
  assert(r.netProfit < 0 && isFinite(r.netProfit));
  assert(r.benchmarkRoe < 0 && isFinite(r.benchmarkRoe));
});

test('benchmark held under 12 months gets no CGT discount', () => {
  const r = E.calcBenchmark({
    depositCashInvested: 100000,
    contractDate: '2026-01-01', saleDate: '2026-07-01',
    benchmarkReturn: 0.10, feeDrag: 0, marginalRate: 0.39,
  });
  // ~6 months at 10%: gain ≈ 100000×(1.1^0.4956 − 1); taxed WITHOUT discount
  const gain = r.valueAtSale - 100000;
  approxEqual(r.cgt, gain * 0.39, 1);
});

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

test('principal paydown counts as cash invested, not profit (ROE unchanged)', () => {
  const io = E.runSaleScenario(wholeJourneyInputs, '2027-06-01'); // interest-only: balance == loanAmount
  const paydown = E.runSaleScenario({ ...wholeJourneyInputs, loanBalance: 400000 }, '2027-06-01');
  // $80k repaid raises netProceeds but is offset in totalCashInvested:
  approxEqual(paydown.equity.totalCashInvested, io.equity.totalCashInvested + 80000, 0.01);
  approxEqual(paydown.equity.roeSimple, io.equity.roeSimple, 1e-9);
  assert(paydown.equity.flags.principalRepaidAtSale === true
      && io.equity.flags.principalRepaidAtSale === false);
});

test('partialJourney flag marks comparison-mode ROE when purchase predates valuation', () => {
  const partial = E.runSaleScenario(wholeJourneyInputs, '2027-06-01');
  assert.strictEqual(partial.equity.flags.partialJourney, true); // 2020 contract, 2025 valuation
  const full = E.runSaleScenario(
    { ...wholeJourneyInputs, contractDate: '2025-07-01' }, '2027-06-01');
  assert.strictEqual(full.equity.flags.partialJourney, false);
});

test('§10: benchmark disclaimer exists', () => {
  assert(typeof E.DISCLAIMERS.benchmarkHistorical === 'string'
    && E.DISCLAIMERS.benchmarkHistorical.length > 0);
});

// ── Code-review fixes: 12-month discount wiring, guards, deflation clamp ─
console.log('\ncode-review fixes');

test('property held under 12 months gets no 50% discount (old regime)', () => {
  const r = E.runSaleScenario({
    contractDate: '2026-08-01', dwellingType: 'established',
    acquisitionCosts: 700000, valuationDate: '2026-08-01',
    currentValueEstimate: 750000, growthAssumption: 0,
    marginalRate: 0.39, sellingCostsPct: 0.02,
    annualNetRental: 0, loanBalance: 0, cpiRate: 0.025,
  }, '2027-06-01');
  // gain = 750,000 − (700,000 + 15,000) = 35,000; no discount at 10 months
  approxEqual(r.cgt, 35000 * 0.39, 0.5);
});

test('dual-era pre-component: no discount when under 12 months at 30 Jun 2027', () => {
  const r = E.runSaleScenario({
    contractDate: '2026-09-01', dwellingType: 'established',
    acquisitionCosts: 700000, valuationDate: '2026-09-01',
    currentValueEstimate: 700000, growthAssumption: 0.04,
    marginalRate: 0.39, sellingCostsPct: 0.02,
    annualNetRental: 0, loanBalance: 0, cpiRate: 0.025,
  }, '2030-06-01');
  // ~10 months held at the deemed date → taxablePre must equal the full
  // (undiscounted) pre component after offsets
  approxEqual(r.detail.taxablePre, Math.max(0, r.detail.preAfterOffsets), 0.001);
});

test('non-positive deposit (100%+ LVR) yields no equity/benchmark blocks', () => {
  const r = E.runSaleScenario(
    { ...wholeJourneyInputs, loanAmount: 620000 }, '2027-06-01'); // deposit = 0
  assert.strictEqual(r.equity, null);
  assert.strictEqual(r.benchmark, null);
});

test('equity release over the hold is flagged, never silently absorbed', () => {
  const r = E.runSaleScenario(
    { ...wholeJourneyInputs, loanBalance: 520000 }, '2027-06-01');
  assert.strictEqual(r.equity.flags.loanIncreasedOverHold, true);
  const base = E.runSaleScenario(wholeJourneyInputs, '2027-06-01');
  assert.strictEqual(base.equity.flags.loanIncreasedOverHold, false);
});

test('deflationary CPI never shrinks the indexed cost base', () => {
  const r = E.calcDualEraCGT({
    deemedValue: 800000, oldCostBase: 800000,
    salePrice: 810000, saleDate: '2029-07-01', sellingCosts: 0,
    cpiRate: -0.02, marginalRate: 0.39,
  });
  approxEqual(r.indexedCostBase, 800000, 0.001);
});

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

test('calcReformSale throws loudly when deemedValue is missing on a non-OLD route', () => {
  assert.throws(() => E.calcReformSale({
    contractDate: '2020-07-01', dwellingType: 'established', saleDate: '2029-07-01',
    salePrice: 900000, sellingCostsPct: 0.02, acquisitionCosts: 600000,
    marginalRate: 0.39,
  }), /deemedValue is required/);
});

test('affordable housing: 60% discount applies to option A only; option B pre stays 50%', () => {
  const r = E.calcReformSale({
    contractDate: '2026-10-01', dwellingType: 'affordableHousing', saleDate: '2030-10-01',
    salePrice: 950000, sellingCostsPct: 0, acquisitionCosts: 700000,
    deemedValue: 720000, marginalRate: 0.39,
  });
  // Option A: gain 250,000 × (1−0.6) = 100,000 × 39% = 39,000
  approxEqual(r.detail.optionA.tax, 100000 * 0.39, 0.5);
  // Option B pre: gain 20,000 → 50% discount (held >12mo at 2027-06-30? contract
  // 2026-10-01 → under 12 months at the deemed date → NO discount → taxablePre = 20,000)
  approxEqual(r.detail.optionB.taxablePre, 20000, 0.5);
  assert.strictEqual(r.flags.deemedValueIsEstimate, true); // Issue 3: flag present on BEST_OF
});

test('calcReformSale: post-2027 Div 43 reduces the post element, not the pre cost base', () => {
  const common = { contractDate: '2026-07-17', dwellingType: 'established',
    saleDate: '2041-07-17', salePrice: 650000 * Math.pow(1.06, 15),
    sellingCostsPct: 0.03, acquisitionCosts: 673775,
    deemedValue: 650000 * Math.pow(1.06, 0.955), marginalRate: 0.37 };
  const split = E.calcReformSale({ ...common, div43Claimed: 5820, div43ClaimedPost: 85590 });
  const allPre = E.calcReformSale({ ...common, div43Claimed: 91410, div43ClaimedPost: 0 });
  // Attributing post-2027 claims to the pre component understates CGT:
  assert(split.cgt > allPre.cgt, 'splitting Div 43 at the boundary must raise CGT here');
  approxEqual(split.detail.preGross, 19241, 50);
  approxEqual(allPre.detail.preGross, 104831, 50);
});

test('calcReformSale: OLD route applies the full Div 43 (pre + post) to the cost base', () => {
  const r = E.calcReformSale({
    contractDate: '2020-12-01', dwellingType: 'established', saleDate: '2026-03-01',
    salePrice: 660000, sellingCostsPct: 14000 / 660000, acquisitionCosts: 520000,
    div43Claimed: 6000, div43ClaimedPost: 4000, marginalRate: 0.39,
  });
  approxEqual(r.cgt, 26520, 0.01); // spec T1: total 10,000 claimed
});

test('§10: reform-scope disclaimer exists and omits the general-advice line', () => {
  const s = E.DISCLAIMERS.reformScope;
  assert(typeof s === 'string' && s.length > 0);
  assert(/Tax Reform No\. 1/.test(s), 'must name the Act');
  assert(!/financial advice/i.test(s), 'general-advice wording belongs to the standing disclaimer');
});

test('affordable housing: pool offsets a discounted gain, so relief is worth less than MTR', () => {
  const args = (pool) => ({
    contractDate: '2026-07-18', dwellingType: 'affordableHousing',
    saleDate: '2041-07-18', salePrice: 650000 * Math.pow(1.06, 15),
    sellingCostsPct: 0.03, acquisitionCosts: 673775,
    deemedValue: 650000 * Math.pow(1.06, 0.95), marginalRate: 0.37,
    quarantinePool: pool,
  });
  const V = E.calcReformSale(args(0)).cgt - E.calcReformSale(args(31958)).cgt;
  const full = 31958 * 0.37;
  assert(V < full * 0.6, 'a 60%-discounted gain must recover well under full MTR value');
  assert(E.calcReformSale(args(31958)).detail.optionA.strandedPool === 0,
    'and strandedPool stays 0 — so a headline branching on it alone would lie');
});

test('§10: forward-looking scope disclaimer exists and names the 12 May 2026 assumption', () => {
  const s = E.DISCLAIMERS.forwardLooking;
  assert(typeof s === 'string' && /12 May 2026/.test(s) && /overstate/.test(s));
});

test('calcDepreciation: newBuild matches the newest bracket (2.5%)', () => {
  assert.strictEqual(E.calcDepreciation('newBuild', 800000), E.calcDepreciation('new', 800000));
  approxEqual(E.calcDepreciation('newBuild', 800000), 800000 * 0.75 * 0.025, 0.001);
});

test('new build: deemed value cannot move the outcome (Option A ignores it) — zero band', () => {
  const args = (dv) => ({
    contractDate: '2026-07-24', dwellingType: 'newBuild', saleDate: '2041-07-24',
    salePrice: 650000 * Math.pow(1.06, 15), sellingCostsPct: 0.03,
    acquisitionCosts: 673775, deemedValue: dv, marginalRate: 0.37,
  });
  const dv = 650000 * Math.pow(1.06, 0.94);
  const lo = E.calcReformSale(args(dv * 0.9));
  const hi = E.calcReformSale(args(dv * 1.1));
  assert.strictEqual(lo.detail.winner, 'A', 'precondition: Option A wins here');
  approxEqual(hi.trueCashReturn - lo.trueCashReturn, 0, 0.001);
});

test('established: deemed value does move the outcome — non-zero band', () => {
  const args = (dv) => ({
    contractDate: '2026-07-24', dwellingType: 'established', saleDate: '2041-07-24',
    salePrice: 650000 * Math.pow(1.06, 15), sellingCostsPct: 0.03,
    acquisitionCosts: 673775, deemedValue: dv, marginalRate: 0.37,
  });
  const dv = 650000 * Math.pow(1.06, 0.94);
  const lo = E.calcReformSale(args(dv * 0.9));
  const hi = E.calcReformSale(args(dv * 1.1));
  assert(Math.abs(hi.trueCashReturn - lo.trueCashReturn) > 1, 'established must show a real spread');
});

// ── calcReformImpact (UI spec §3a v3.1, issue #17) ──────────────────────
// Reference figures measured on the shipped build with truereturn_state
// cleared and cross-checked against the rendered #proj5CGT / #projLifeCGT.
// Default property: $650,000, 20% deposit, $550/wk, 6% growth, QLD, mid-age,
// MTR 0.37. Do not "correct" these numbers without re-measuring in-app.
console.log('\ncalcReformImpact (2027 reform impact module)');

// Div 43 MUST be included and MUST be split at the deemed date. A mid-age
// $650,000 property claims $6,093.75/yr; omitting it inflates the cost base
// and shrinks the gain, which moves 5-year CGT from $25,025 to $12,776 and
// the CGT-only delta from -$12,057 to -$18,670. The split matters too: tax
// spec §5.3 says a post-2027 claim reduces the post-component's element 1
// before indexation, so folding it into the pre-component understates CGT.
// This mirrors index.html's own preYears/div43Pre/div43Post construction.
const REFORM_FIXTURE_DEPR = E.calcDepreciation('mid', 650000);

function reformImpactFixture(years, salePrice, pool, overrides) {
  const preYears = Math.max(0, Math.min(years, E.yearFrac('2026-07-30', E.DEEMED_DATE_ISO)));
  const base = {
    contractDate: '2026-07-30',
    dwellingType: 'established',
    saleDate: E.addYearsISO('2026-07-30', years),
    salePrice: salePrice,
    sellingCostsPct: 0.03,
    acquisitionCosts: 673775,
    div43Claimed: REFORM_FIXTURE_DEPR * preYears,
    div43ClaimedPost: REFORM_FIXTURE_DEPR * (years - preYears),
    deemedValue: 650000 * Math.pow(1.06, E.yearFrac('2026-07-30', E.DEEMED_DATE_ISO)),
    quarantinePool: pool,
    marginalRate: 0.37,
    remainingLoan: 0,
  };
  return Object.assign(base, overrides || {});
}

test('the CGT-only delta is negative at 5 years — the trap this module avoids', () => {
  const saleArgs = reformImpactFixture(5, 869846.63, 62779.64);
  const r = E.calcReformImpact({ saleArgs, quarantineRows: [], years: 5 });
  // New-rules CGT is LOWER than old-rules CGT: the pool offsets a still-small
  // gain by more than the lost 50% discount costs. Shipping this figure alone
  // would claim the reform SAVED the investor money.
  assert(r.newCGT < r.oldCGT, 'precondition: new-rules CGT is lower at 5 years');
  // These two reproduce the rendered #proj5CGT and its old-rules counterpart.
  approxEqual(r.newCGT, 25025, 5);
  approxEqual(r.oldCGT, 37082, 5);
  approxEqual(r.newCGT - r.oldCGT, -12057, 5);
});

test('tax on rental profits is counted, and the pool makes the sides differ', () => {
  // Years 1-2 are losses; year 3 is profitable. Under the new rules the pool
  // absorbs the profit (taxOnProfit 0); under the old rules it is taxed in
  // full. Omitting this term overstated the reform's cost by $20,708 at 15
  // years on the default property.
  const rows = [
    { fyStartISO: '2026-07-01', netResult: -20592, quarantined: 0, refund: 20592 * 0.37, taxOnProfit: 0 },
    { fyStartISO: '2027-07-01', netResult: -18751, quarantined: 18751, refund: 0, taxOnProfit: 0 },
    { fyStartISO: '2028-07-01', netResult: 10000, quarantined: 0, refund: 0, taxOnProfit: 0 },
  ];
  const r = E.calcReformImpact({
    saleArgs: reformImpactFixture(3, 650000 * Math.pow(1.06, 3), 8751),
    quarantineRows: rows, years: 3,
  });
  approxEqual(r.newProfitTax, 0, 0.01);
  approxEqual(r.oldProfitTax, 3700, 0.01);
  assert(r.oldProfitTax > r.newProfitTax,
    'the pool absorbing profit is a new-rules advantage and must show as one');
  // The full identity: every channel accounted for, nothing left implicit.
  approxEqual(r.delta,
    (r.newCGT - r.oldCGT) + (r.oldRefunds - r.newRefunds) + (r.newProfitTax - r.oldProfitTax),
    0.01);
});

test('total-tax delta is positive at all three periods — sign is corrected', () => {
  // Refund rows for the default property: FY2026-27 starts pre-boundary and
  // is deductible under both rulebooks; every later loss year is quarantined
  // under the new rules only.
  const rows = [
    // refund and taxOnProfit are fields buildQuarantineSchedule emits and
    // calcReformImpact reads directly — a row without them scores zero.
    { fyStartISO: '2026-07-01', netResult: -20592, quarantined: 0, refund: 20592 * 0.37, taxOnProfit: 0 },
    { fyStartISO: '2027-07-01', netResult: -19500, quarantined: 19500, refund: 0, taxOnProfit: 0 },
    { fyStartISO: '2028-07-01', netResult: -18200, quarantined: 18200, refund: 0, taxOnProfit: 0 },
    { fyStartISO: '2029-07-01', netResult: -16800, quarantined: 16800, refund: 0, taxOnProfit: 0 },
    { fyStartISO: '2030-07-01', netResult: -8280, quarantined: 8280, refund: 0, taxOnProfit: 0 },
  ];
  const periods = [[5, 869846.63, 62779.64], [10, 1164051.00, 87190.03], [15, 1557762.83, 31958.21]];
  periods.forEach(([years, price, pool]) => {
    const r = E.calcReformImpact({
      saleArgs: reformImpactFixture(years, price, pool),
      quarantineRows: rows, years: years,
    });
    assert(r.delta > 0, years + 'yr: the reform must cost, not save, once refunds are counted');
    assert.strictEqual(r.show, true, years + 'yr must show the module');
    // The full identity: every channel accounted for, nothing left implicit.
    approxEqual(r.delta,
      (r.newCGT - r.oldCGT) + (r.oldRefunds - r.newRefunds) + (r.newProfitTax - r.oldProfitTax),
      0.01);
  });
  // The 5-year case is the one that inverts on a CGT-only reading — assert
  // the correction explicitly rather than leaving it implied by the loop.
  const r5 = E.calcReformImpact({
    saleArgs: reformImpactFixture(5, 869846.63, 62779.64),
    quarantineRows: rows, years: 5,
  });
  assert(r5.newCGT - r5.oldCGT < 0 && r5.delta > 0,
    'at 5 years the CGT-only delta is negative but the total-tax delta is positive');
});

test('pre-boundary refunds are identical under both rulebooks', () => {
  const rows = [
    { fyStartISO: '2026-07-01', netResult: -20592, quarantined: 0, refund: 20592 * 0.37, taxOnProfit: 0 },
    { fyStartISO: '2027-07-01', netResult: -19500, quarantined: 19500, refund: 0, taxOnProfit: 0 },
  ];
  const r = E.calcReformImpact({
    saleArgs: reformImpactFixture(5, 869846.63, 62779.64),
    quarantineRows: rows, years: 5,
  });
  // 20592 * 0.37 = 7619.04 — deductible under both rulebooks.
  approxEqual(r.newRefunds, 7619.04, 0.5);
  // The old rules additionally refund the quarantined year: + 19500 * 0.37.
  approxEqual(r.oldRefunds, 7619.04 + 7215, 0.5);
  assert(r.oldRefunds > r.newRefunds, 'old rules must refund strictly more');
});

test('new refunds are never zero merely because quarantine applies', () => {
  const rows = [{ fyStartISO: '2026-07-01', netResult: -20592, quarantined: 0, refund: 20592 * 0.37, taxOnProfit: 0 }];
  const r = E.calcReformImpact({
    saleArgs: reformImpactFixture(15, 1557762.83, 31958.21),
    quarantineRows: rows, years: 15,
  });
  assert(r.newRefunds > 0, 'losses before 1 July 2027 stay deductible under the new rules');
});

test('new build: delta is exactly zero and the module hides itself', () => {
  // New builds keep full negative gearing (no quarantine, so no rows and no
  // pool) and may elect the 50% discount on the whole gain — which IS the
  // old-rules calculation. The reform genuinely does nothing to them.
  [[5, 869846.63], [10, 1164051.00], [15, 1557762.83]].forEach(([years, price]) => {
    const saleArgs = reformImpactFixture(years, price, 0, { dwellingType: 'newBuild' });
    const r = E.calcReformImpact({ saleArgs, quarantineRows: [], years });
    approxEqual(r.delta, 0, 0.01);
    assert.strictEqual(r.show, false, years + 'yr new build must hide the module');
  });
});

test('sub-dollar deltas are suppressed on the arithmetic, not on dwellingType', () => {
  const saleArgs = reformImpactFixture(15, 1557762.83, 31958.21);
  const r = E.calcReformImpact({ saleArgs, quarantineRows: [], years: 15 });
  // An established property with a real delta must NOT be suppressed.
  assert.strictEqual(r.show, true, 'established with a real delta must show');
  assert.strictEqual(saleArgs.dwellingType, 'established', 'gate is arithmetic, not type');
});

test('the negative arm is reachable — low growth leaves the property better off', () => {
  // 3% growth over 15 years: the indexed post-2027 cost base outruns the
  // gain, so the reform genuinely reduces the tax.
  const salePrice = 650000 * Math.pow(1.03, 15);
  const saleArgs = reformImpactFixture(15, salePrice, 31958.21, {
    deemedValue: 650000 * Math.pow(1.03, E.yearFrac('2026-07-30', E.DEEMED_DATE_ISO)),
  });
  const r = E.calcReformImpact({ saleArgs, quarantineRows: [], years: 15 });
  assert(r.delta < 0, 'a low-growth hold must be able to produce a negative delta');
  assert.strictEqual(r.show, true, 'a negative delta still shows — it is not suppressed');
});

test('split is null on an OLD-route sale and populated on DUAL_ERA', () => {
  // A sale before 1 July 2027 routes OLD: single era, so no split to show.
  const oldRoute = reformImpactFixture(0, 650000, 0, { saleDate: '2027-01-30' });
  const rOld = E.calcReformImpact({
    saleArgs: oldRoute, quarantineRows: [], years: 0,
  });
  assert.strictEqual(rOld.split, null, 'OLD route has no era split');

  const rDual = E.calcReformImpact({
    saleArgs: reformImpactFixture(15, 1557762.83, 31958.21),
    quarantineRows: [], years: 15,
  });
  assert(rDual.split !== null, 'DUAL_ERA must carry a split');
  approxEqual(rDual.split.taxOnPre + rDual.split.taxOnPost, rDual.newCGT, 0.01);
});

test('pool accounting is reported, not assumed — stranded and used are distinct', () => {
  // A large pool against a small gain strands most of itself. The UI note
  // must be able to tell "used up" from "never recovered", because the card
  // says so a few lines above and the two must not contradict.
  const saleArgs = reformImpactFixture(5, 650000 * Math.pow(0.96, 5), 200000);
  const r = E.calcReformImpact({ saleArgs, quarantineRows: [], years: 5 });
  assert(r.strandedPool > 0, 'a big pool against a shrunken sale price must strand');
  approxEqual(r.poolUsedAtSale + r.strandedPool, r.pooledAtSale, 0.01);
});

test('a fully absorbed pool reports nothing stranded', () => {
  const saleArgs = reformImpactFixture(15, 1557762.83, 31958.21);
  const r = E.calcReformImpact({ saleArgs, quarantineRows: [], years: 15 });
  approxEqual(r.strandedPool, 0, 0.01);
  approxEqual(r.poolUsedAtSale, r.pooledAtSale, 0.01);
});

test('the year window slices the schedule — a 5-year card ignores years 6-15', () => {
  // index.html passes the SAME full 15-row schedule to all three periods, so
  // this bound is the only thing keeping the cards distinct. Without it the
  // 5-year card reports fifteen years of refunds.
  const rows = [];
  for (let y = 0; y < 15; y++) {
    const loss = y === 0;
    rows.push({
      fyStartISO: (2026 + y) + '-07-01',
      netResult: loss ? -20592 : 10000,
      quarantined: 0,
      refund: loss ? 20592 * 0.37 : 0,
      taxOnProfit: 0,
    });
  }
  const at5 = E.calcReformImpact({
    saleArgs: reformImpactFixture(5, 869846.63, 62779.64), quarantineRows: rows, years: 5,
  });
  const at15 = E.calcReformImpact({
    saleArgs: reformImpactFixture(15, 1557762.83, 31958.21), quarantineRows: rows, years: 15,
  });
  // Years 2-5 are profitable: 4 years * 10000 * 0.37 = 14800 under old rules.
  approxEqual(at5.oldProfitTax, 14800, 0.01);
  // Years 2-15 are profitable: 14 * 10000 * 0.37 = 51800.
  approxEqual(at15.oldProfitTax, 51800, 0.01);
  assert(at15.oldProfitTax > at5.oldProfitTax,
    'a longer hold must count more years, or the window is not being applied');
});

test('new build at low growth: indexation wins, so the module shows', () => {
  // New builds elect between the 50% discount -- which IS the old-rules
  // calculation -- and indexation. Above roughly CPI growth the discount
  // wins and the reform changes nothing, which is the case the sibling test
  // above pins. BELOW it, indexation wins and the reform genuinely helps, so
  // the module must NOT hide. Measured on a $480k VIC new build at 2%
  // growth: Option A $47,372 vs Option B $39,051, an $8,321 saving.
  //
  // This is also the only route to the BEST_OF winner-B split, so it is what
  // stops that branch being dead code.
  const saleArgs = reformImpactFixture(15, 480000 * Math.pow(1.02, 15), 0, {
    dwellingType: 'newBuild',
    acquisitionCosts: 505570,
    deemedValue: 480000 * Math.pow(1.02, E.yearFrac('2026-07-30', E.DEEMED_DATE_ISO)),
  });
  const r = E.calcReformImpact({ saleArgs, quarantineRows: [], years: 15 });
  assert(r.delta < 0, 'indexation must leave a low-growth new build better off');
  assert.strictEqual(r.show, true, 'a real difference must never be suppressed');
  assert(r.split !== null, 'a winning Option B carries the dual-era split');
  approxEqual(r.split.taxOnPre + r.split.taxOnPost, r.newCGT, 0.01);
});

summary();
