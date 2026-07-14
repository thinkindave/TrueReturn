// engine.js — TrueReturn pure calculation engine.
// Loaded by index.html as a classic script (declarations land in the global
// lexical scope) and require()'d by node tests via the module.exports guard.
// No DOM access in this file.

// ── Legacy pure functions (moved verbatim from index.html) ──────────────
    const stateDefaults = {
      NSW: { conveyancing: 1800, insurance: 1800, council: 2000 },
      VIC: { conveyancing: 1100, insurance: 1500, council: 1900 },
      QLD: { conveyancing: 900,  insurance: 2200, council: 1800 },
      SA:  { conveyancing: 1000, insurance: 1300, council: 1600 },
      WA:  { conveyancing: 1300, insurance: 1500, council: 1800 },
      TAS: { conveyancing: 1000, insurance: 1200, council: 1400 },
      ACT: { conveyancing: 1100, insurance: 1300, council: 2100 },
      NT:  { conveyancing: 1000, insurance: 2500, council: 1700 },
    };
    const BUILDING_PEST      = 600;
    const LOAN_ESTABLISHMENT = 800;

    function formatCurrency(amount) {
      const abs = Math.abs(amount);
      const formatted = abs >= 1000
        ? '$' + abs.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
        : '$' + abs.toFixed(0);
      return amount < 0 ? '-' + formatted : formatted;
    }

    function calcStampDuty(state, price) {
      if (price <= 0) return 0;

      switch (state) {
        case 'NSW':
          if (price <= 14000) return price * 0.0125;
          if (price <= 31000) return 175 + (price - 14000) * 0.015;
          if (price <= 83000) return 430 + (price - 31000) * 0.0175;
          if (price <= 313000) return 1340 + (price - 83000) * 0.035;
          if (price <= 1043000) return 9390 + (price - 313000) * 0.045;
          if (price <= 3721000) return 42240 + (price - 1043000) * 0.055;
          return price * 0.07;

        case 'VIC':
          if (price <= 25000) return price * 0.014;
          if (price <= 130000) return 350 + (price - 25000) * 0.024;
          if (price <= 960000) return 2870 + (price - 130000) * 0.06;
          if (price <= 2000000) return price * 0.055;
          return 110000 + (price - 2000000) * 0.065;

        case 'QLD':
          if (price <= 5000) return 0;
          if (price <= 75000) return (price - 5000) * 0.015;
          if (price <= 540000) return 1050 + (price - 75000) * 0.035;
          if (price <= 1000000) return 17325 + (price - 540000) * 0.045;
          return 38025 + (price - 1000000) * 0.0575;

        case 'SA':
          if (price <= 12000) return price * 0.01;
          if (price <= 30000) return 120 + (price - 12000) * 0.02;
          if (price <= 50000) return 480 + (price - 30000) * 0.03;
          if (price <= 100000) return 1080 + (price - 50000) * 0.035;
          if (price <= 200000) return 2830 + (price - 100000) * 0.04;
          if (price <= 250000) return 6830 + (price - 200000) * 0.0425;
          if (price <= 300000) return 8955 + (price - 250000) * 0.0475;
          if (price <= 500000) return 11330 + (price - 300000) * 0.05;
          return 21330 + (price - 500000) * 0.055;

        case 'WA':
          if (price <= 120000) return price * 0.019;
          if (price <= 150000) return 2280 + (price - 120000) * 0.0285;
          if (price <= 360000) return 3135 + (price - 150000) * 0.038;
          if (price <= 725000) return 11115 + (price - 360000) * 0.0475;
          return 28453 + (price - 725000) * 0.0515;

        case 'TAS':
          if (price <= 3000) return 50;
          if (price <= 25000) return 50 + (price - 3000) * 0.0175;
          if (price <= 75000) return 435 + (price - 25000) * 0.0225;
          if (price <= 200000) return 1560 + (price - 75000) * 0.035;
          if (price <= 375000) return 5935 + (price - 200000) * 0.04;
          if (price <= 725000) return 12935 + (price - 375000) * 0.0425;
          return 27810 + (price - 725000) * 0.045;

        case 'ACT':
          if (price <= 260000) return price * 0.006;
          if (price <= 300000) return 1560 + (price - 260000) * 0.022;
          if (price <= 500000) return 1920 + (price - 300000) * 0.034;
          if (price <= 750000) return 8720 + (price - 500000) * 0.0432;
          if (price <= 1000000) return 19520 + (price - 750000) * 0.059;
          if (price <= 1455000) return 34270 + (price - 1000000) * 0.064;
          return price * 0.0454;

        case 'NT':
          if (price <= 525000) {
            const v = price / 1000;
            return (0.06571441 * v * v + 15 * v);
          }
          if (price <= 3000000) return price * 0.0495;
          if (price <= 5000000) return price * 0.0575;
          return price * 0.0595;

        default:
          return 0;
      }
    }

    function calcDepreciation(ageBracket, purchasePrice) {
      const buildingValue = purchasePrice * 0.75;
      if (ageBracket === 'new') return buildingValue * 0.025;
      if (ageBracket === 'mid') return buildingValue * 0.0125;
      return buildingValue * 0.0075;
    }

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

// ── Node export guard ────────────────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    stateDefaults, BUILDING_PEST, LOAN_ESTABLISHMENT,
    formatCurrency, calcStampDuty, calcDepreciation, legacySaleOutcome,
    BUDGET_NIGHT_ISO, BOUNDARY_ISO, DEEMED_DATE_ISO,
    daysBetween, yearFrac, cpiFactor, fyStartYear,
    routeRegimes,
    applyOffsets, calcOldRegimeCGT, interpolateDeemedValue,
    calcDualEraCGT, calcTimeApportionedCGT,
    buildQuarantineSchedule, proRateAnnualResults,
    calcNewBuildOptimizer,
  };
}
