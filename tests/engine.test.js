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
