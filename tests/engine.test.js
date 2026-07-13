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

summary();
