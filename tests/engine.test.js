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

summary();
