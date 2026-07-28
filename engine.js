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
      if (ageBracket === 'new' || ageBracket === 'newBuild') return buildingValue * 0.025;
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

// Adds whole calendar years to an ISO date (UTC-safe; Feb 29 rolls to Mar 1).
function addYearsISO(iso, years) {
  const d = isoToUTC(iso);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
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
    capitalLossRealized: Math.max(0, -o.preAfter),
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
  // §5.3: indexation requires the reacquired asset be held ≥ 12 months.
  const indexationApplies = yrs >= 1;
  // deflation never shrinks the base (frozen-indexation convention)
  const indexedElement1 = (deemedValue - div43ClaimedPost)
    * (indexationApplies ? Math.max(1, cpiFactor(cpiRate, yrs)) : 1);
  const indexedExpenditure = postExpenditures.reduce((sum, e) =>
    sum + e.amount * (indexationApplies && e.indexable !== false
      ? Math.max(1, cpiFactor(cpiRate, yearFrac(e.date, saleDate))) : 1), 0);
  const indexedCostBase = indexedElement1 + indexedExpenditure + sellingCosts;
  const postGross = salePrice - indexedCostBase;

  // §13: losses are measured against the UNINDEXED cost base — indexation
  // cannot create or enlarge a loss (mirrors the frozen-indexation rule).
  // salePrice between the two bases ⇒ neither gain nor loss (both 0).
  const unindexedPostCostBase = (deemedValue - div43ClaimedPost)
    + postExpenditures.reduce((s, e) => s + e.amount, 0) + sellingCosts;

  // §5.7 intra-event netting: both components crystallise at the same
  // disposal, so a same-sale component loss (measured unindexed, §13)
  // offsets the other component's gross gain — pre/discount gains first,
  // then post/indexed — before user losses and the quarantine pool apply.
  // Only the residual survives as a reportable capital loss.
  const preLoss = Math.max(0, -preGross);
  const postLoss = Math.max(0, unindexedPostCostBase - salePrice);
  let sameSaleLoss = preLoss + postLoss;
  let preNet = Math.max(0, preGross);
  let postNet = Math.max(0, postGross);
  const absorbPre = Math.min(preNet, sameSaleLoss);
  preNet -= absorbPre; sameSaleLoss -= absorbPre;
  const absorbPost = Math.min(postNet, sameSaleLoss);
  postNet -= absorbPost; sameSaleLoss -= absorbPost;

  const o = applyOffsets({ preGross: preNet, postGross: postNet, capitalLosses, quarantinePool });

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
    capitalLossRealized: sameSaleLoss,
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
                                 minTaxFloor = 0.30, discountPct = 0.5,
                                 heldOver12Months = true, heldOver12MonthsAt2027 = true }) {
  const optionA = calcOldRegimeCGT({
    salePrice, sellingCosts, acquisitionCosts,
    div43Claimed: div43ClaimedPre + div43ClaimedPost,
    capitalLosses, quarantinePool, marginalRate, heldOver12Months, discountPct,
  });
  // discountPct deliberately NOT forwarded: spec §7b grants the 60%
  // affordable-housing discount under Option A only; the dual-era
  // pre-component is fixed at 50% by spec §5.2.
  const optionB = calcDualEraCGT({
    deemedValue, oldCostBase: acquisitionCosts, div43ClaimedPre,
    salePrice, saleDate, sellingCosts, div43ClaimedPost,
    cpiRate, marginalRate, capitalLosses, quarantinePool,
    minTaxFloor, heldOver12MonthsAt2027,
  });
  return {
    optionA, optionB,
    winner: optionA.tax <= optionB.totalCGT ? 'A' : 'B',
    flags: { newBuildDefinitionPending: true },
  };
}

// ── Reform-aware sale outcome for the UI (Phase 2b-1) ────────────────────
// Routes one sale through the 2026–27 regimes and returns the superset of
// the fields the UI consumed from legacySaleOutcome. Unlike the legacy
// math, selling costs are a cost-base element (spec §5.2/T1) — an approved
// change to live behaviour, recorded in issue #2. deemedValue is required
// whenever the sale routes DUAL_ERA or BEST_OF (caller projects it).
function calcReformSale({ contractDate, dwellingType = 'established', saleDate,
                          salePrice, sellingCostsPct = 0.03,
                          acquisitionCosts, div43Claimed = 0, div43ClaimedPost = 0,
                          deemedValue = null, deemedValueIsEstimate = true,
                          quarantinePool = 0, capitalLosses = 0,
                          cpiRate = 0.025, marginalRate, remainingLoan = 0 }) {
  // div43Claimed = cumulative Div 43 claimed to 30 June 2027 ("pre"); the new
  // div43ClaimedPost param is cumulative Div 43 claimed after that date. Tax
  // spec §5.3: a post-2027 claim reduces the post-component's element 1
  // BEFORE indexation, so it must never be folded into the pre-component's
  // cost base — that understates CGT (measured $13,127 / 5.5% on a default
  // 15-year hold). The OLD route has no era split, so the full pre+post sum
  // reduces the single cost base there.
  const route = routeRegimes({ contractDate, dwellingType, saleDate });
  if (route.cgt !== 'OLD' && deemedValue == null) {
    throw new Error('calcReformSale: deemedValue is required for ' + route.cgt + ' routes');
  }
  const sellingCosts = salePrice * sellingCostsPct;
  const heldOver12Months = yearFrac(contractDate, saleDate) >= 1;
  const heldOver12MonthsAt2027 = yearFrac(contractDate, DEEMED_DATE_ISO) >= 1;

  let cgt, detail;
  const flags = {};
  if (route.cgt === 'OLD') {
    detail = calcOldRegimeCGT({
      salePrice, sellingCosts, acquisitionCosts,
      div43Claimed: div43Claimed + div43ClaimedPost,
      capitalLosses, quarantinePool, marginalRate, heldOver12Months,
    });
    cgt = detail.tax;
  } else if (route.cgt === 'BEST_OF') {
    detail = calcNewBuildOptimizer({
      acquisitionCosts, salePrice, saleDate, sellingCosts, deemedValue,
      div43ClaimedPre: div43Claimed, div43ClaimedPost, cpiRate, marginalRate,
      capitalLosses, quarantinePool,
      discountPct: dwellingType === 'affordableHousing' ? 0.6 : 0.5,
      heldOver12Months, heldOver12MonthsAt2027,
    });
    cgt = detail.winner === 'A' ? detail.optionA.tax : detail.optionB.totalCGT;
    flags.newBuildDefinitionPending = true;
    flags.deemedValueIsEstimate = deemedValueIsEstimate;
  } else {
    detail = calcDualEraCGT({
      deemedValue, oldCostBase: acquisitionCosts, div43ClaimedPre: div43Claimed,
      div43ClaimedPost, salePrice, saleDate, sellingCosts, cpiRate, marginalRate,
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
          capitalLosses = 0, div43Claimed = 0, div43ClaimedPost = 0,
          purchasePrice = null, purchaseCosts = 0, loanAmount = null,
          benchmarkReturn = null, benchmarkFeeDrag = 0.001,
          dcaHoldingContributions = false } = inputs;

  const route = routeRegimes({ contractDate, dwellingType, saleDate });
  const growthYears = yearFrac(valuationDate, saleDate);
  const salePrice = currentValueEstimate * Math.pow(1 + growthAssumption, growthYears);
  const sellingCosts = salePrice * sellingCostsPct;
  // Derived the same way calcReformSale does, so both routers agree.
  const heldOver12Months = yearFrac(contractDate, saleDate) >= 1;
  const heldOver12MonthsAt2027 = yearFrac(contractDate, DEEMED_DATE_ISO) >= 1;

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
      salePrice, sellingCosts, acquisitionCosts, div43Claimed: div43Claimed + div43ClaimedPost,
      capitalLosses, quarantinePool: sched.poolAtSale, marginalRate,
      heldOver12Months,
    });
    cgt = detail.tax;
  } else {
    deemedValue = deemedValueOverride !== undefined
      ? deemedValueOverride
      : currentValueEstimate * Math.pow(1 + growthAssumption, yearFrac(valuationDate, DEEMED_DATE_ISO));
    flags.deemedValueIsEstimate = deemedValueOverride === undefined;
    if (route.cgt === 'BEST_OF') {
      const opt = calcNewBuildOptimizer({
        acquisitionCosts, salePrice, saleDate, sellingCosts, deemedValue,
        div43ClaimedPre: div43Claimed, div43ClaimedPost, cpiRate, marginalRate,
        capitalLosses, quarantinePool: sched.poolAtSale,
        discountPct: dwellingType === 'affordableHousing' ? 0.6 : 0.5,
        heldOver12Months, heldOver12MonthsAt2027,
      });
      detail = opt;
      cgt = opt.winner === 'A' ? opt.optionA.tax : opt.optionB.totalCGT;
      flags.newBuildDefinitionPending = true;
    } else {
      const dual = calcDualEraCGT({
        deemedValue, oldCostBase: acquisitionCosts, div43ClaimedPre: div43Claimed,
        div43ClaimedPost,
        salePrice, saleDate, sellingCosts, cpiRate, marginalRate,
        capitalLosses, quarantinePool: sched.poolAtSale,
        heldOver12MonthsAt2027,
        deemedValueIsEstimate: flags.deemedValueIsEstimate === true,
      });
      detail = dual;
      cgt = dual.totalCGT;
    }
  }

  const netProceeds = salePrice - sellingCosts - cgt - loanBalance;

  // Whole-journey blocks (spec §§11–12). Comparison-mode caveat: holding
  // flows are only modelled valuation→sale, so when the purchase predates
  // the valuation the absolute ROE/IRR overstate the whole journey — the
  // pre-valuation bleed is missing while the full gain is counted. The
  // scenario DELTA still cancels this. flags.partialJourney marks it so the
  // UI never presents these as whole-journey figures; the whole-journey
  // calculator (Phase 2b) calls calcEquityReturns directly with full flows.
  let equity = null, benchmark = null;
  if (loanAmount !== null && purchasePrice !== null
      && purchasePrice + purchaseCosts - loanAmount > 0) {
    // Flows are dated at FY start — up to ~a year early; bias is consistent and cancels in scenario deltas.
    const holdingCashflows = sched.rows.map(r => ({
      date: r.fyStartISO,
      amount: r.netResult + r.refund - r.taxOnProfit,
    }));
    const principalRepaid = Math.max(0, loanAmount - loanBalance);
    equity = {
      ...calcEquityReturns({
        purchasePrice, purchaseCosts, loanAmount,
        contractDate, saleDate, netProceedsAfterTax: netProceeds,
        holdingCashflows, salePrice, principalRepaid,
      }),
      flags: {
        partialJourney: valuationDate > contractDate,
        principalRepaidAtSale: loanAmount - loanBalance > 0,
        loanIncreasedOverHold: loanBalance > loanAmount,
      },
    };
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

  return {
    saleDate, cgtRegime: route.cgt, ngRegime: route.ng,
    salePrice, sellingCosts, cgt, deemedValue, detail, holding,
    netProceeds,
    totalWealth: netProceeds + holding.netCashflow,
    equity, benchmark,
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
      if (fLo * fMid <= 0) { hi = mid; } else { lo = mid; fLo = fMid; }
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
// Mixed-sign interim flows (non-conventional) may have multiple IRRs; this
// returns whichever root the bracket catches, or null.
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

// ── Return on equity / leverage (spec §11) ───────────────────────────────
// The essay's pivotal outputs: what the investor's CASH returned, next to
// what the ASSET did — the gap is leverage, reported without judgment.
// holdingCashflows: dated after-tax flows (negative = money fed in).
// netProfit generalizes spec §11 to cash-positive years: inflows join the
// profit side; only outflows count as cash invested. With all-negative
// flows (the essay case, T7) this is exactly the spec formula.
// principalRepaid: loan principal paid down over the hold. Its timing is
// unknown to the engine, so it is modelled as repaid at sale — neutral for
// roeSimple, best-case for IRR. It counts as cash invested, not profit.
function calcEquityReturns({ purchasePrice, purchaseCosts = 0, loanAmount,
                             contractDate, saleDate, netProceedsAfterTax,
                             holdingCashflows = [], salePrice = null,
                             principalRepaid = 0 }) {
  const depositCashInvested = purchasePrice + purchaseCosts - loanAmount;
  let contributions = 0, holdingInflows = 0;
  for (const f of holdingCashflows) {
    if (f.amount < 0) contributions -= f.amount;
    else holdingInflows += f.amount;
  }
  const totalCashInvested = depositCashInvested + contributions + principalRepaid;
  const netProfit = netProceedsAfterTax + holdingInflows - totalCashInvested;
  const holdingYears = yearFrac(contractDate, saleDate);

  // Deposit-only base is deliberate (spec §11 #1): profit nets contributions,
  // the base does not — do not "fix" to totalCashInvested (breaks T7).
  const roeSimple = annualizedReturn(netProfit, depositCashInvested, holdingYears);
  const irr = irrFromCashflows([
    { date: contractDate, amount: -depositCashInvested },
    ...holdingCashflows,
    { date: saleDate, amount: netProceedsAfterTax },
    ...(principalRepaid > 0
      ? [{ date: saleDate, amount: -principalRepaid }]
      : []),
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

  const holdingYears = yearFrac(contractDate, saleDate);

  let cgtDetail, cgt, regime;
  if (saleDate < BOUNDARY_ISO) {
    regime = 'OLD';
    cgtDetail = calcOldRegimeCGT({
      salePrice: valueAtSale, sellingCosts: 0,
      acquisitionCosts: totalContributed, marginalRate,
      heldOver12Months: holdingYears >= 1,
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
  return {
    valueAtSale, totalContributed, cgt, cgtDetail, netProfit, holdingYears,
    benchmarkRoe: annualizedReturn(netProfit, depositCashInvested, holdingYears),
    regime,
    flags: { historicalNotForecast: true, unleveraged: true },
  };
}

// ── Required disclaimers (spec §10) — single source for Phase 2 UI ───────
const DISCLAIMERS = {
  generalInfo: 'General information only, not tax or financial advice. Models the Treasury Laws Amendment (Tax Reform No. 1) Act 2026.',
  minTaxSimplified: 'Simplified minimum-tax calculation; interactions with your other income and deductions can change this.',
  newBuildPending: 'The legal definition of a new residential dwelling is still pending a ministerial instrument.',
  deemedValueEstimate: 'The 30 June 2027 value is an estimate; your actual outcome depends on the real market value at that date.',
  apportionPending: 'The official apportioning method has not yet been legislated; the time-based split shown is a placeholder.',
  cpiAssumption: 'Future cost-base indexation uses a projected CPI assumption, not actual CPI.',
  benchmarkHistorical: 'Benchmark presets are historical, before-tax figures — not a forecast.',
  reformScope: 'Models the Treasury Laws Amendment (Tax Reform No. 1) Act 2026.',
  forwardLooking: 'This calculator assumes you\'re buying after 12 May 2026, so the 2027 negative-gearing and CGT changes apply. If you bought earlier, your negative gearing and CGT are grandfathered and this will overstate your tax.',
};

// ── Leverage line (UI spec §9 v2.9, issue #14) ───────────────────────────
// Presentation helper for the 15-year projection line. It does NOT compute
// return on cash — it RECEIVES the figure index.html already renders as
// "Annual Cash Return", so that shipped number cannot move (the inline
// computation and calcEquityReturns differ on principalRepaid handling).
// The `annualisedReturn` param spells "annualised" the UK way deliberately,
// mirroring the local variable at index.html:5051 — engine.js's own
// annualizedReturn() nearby uses the US spelling; that's a different thing.
// assetGrowthPct is the user's own expectedGrowth input: futureValue is
// purchasePrice * (1+expectedGrowth)^years, so the annualised asset growth
// is identically that input — deriving it would be a no-op round trip.
// Hidden when there is no leverage gap to explain: a cash purchase has
// totalUpfront >= purchasePrice, giving a multiple at or below 1 — but the
// gate below is stricter still, and also hides a band of genuinely
// leveraged purchases (roughly a 91-95% deposit). See it for why.
// Returns a discriminated { show } object rather than the engine's usual
// null-on-inapplicable, because this function's consumer is a renderer, not
// a downstream calculation — { show: false } is a display instruction, not
// a "no result" sentinel. Don't copy this shape into a calculation helper,
// and don't revert to null here.
function calcLeverageLine({ purchasePrice, totalUpfront, expectedGrowth,
                            annualisedReturn }) {
  if (!(purchasePrice > 0) || !(totalUpfront > 0)) return { show: false };
  if (!Number.isFinite(expectedGrowth) || !Number.isFinite(annualisedReturn)) {
    // Guards against NaN (issue #13's shape) and also against null, which
    // engine.annualizedReturn returns when cashInvested <= 0 — null would
    // otherwise sail through every other guard and render as a silently
    // wrong "0.0" via Math.abs(null).toFixed(1).
    return { show: false };
  }
  // leverageMultiple is purchasePrice / totalUpfront, i.e. it's pinned to
  // the "Cash Invested" figure this same card already shows. Contrast
  // calcEquityReturns' own leverageMultiple field, which is based on
  // depositCashInvested — a different base. Don't assume the two match.
  const leverageMultiple = purchasePrice / totalUpfront;
  // Below 1.05 the renderer's toFixed(1) prints "~1.0x", which asserts a
  // difference that doesn't exist — so the gate has to hide it. Revisit
  // this number if the render precision (currently toFixed(1)) changes.
  if (leverageMultiple < 1.05) return { show: false };
  // Hoisted so the predicate below reads against the two fields the line
  // actually displays, and so the fraction -> percentage conversion exists
  // once. Note the units: expectedGrowth is a fraction, annualisedReturn is
  // already a percentage.
  const assetGrowthPct = expectedGrowth * 100;
  const cashReturnPct = annualisedReturn;
  // Whether the "the difference is leverage" clause is actually TRUE.
  //
  // Leverage multiplies the growth landing on the cash stake, so it can only
  // push the cash return further from zero in growth's OWN direction. The
  // rule is therefore direction-aware, not "return beats growth":
  //   growth >= 0, return above  -> leverage
  //   growth >= 0, return below  -> holding costs and tax
  //   growth <  0, return below  -> leverage amplifying the fall
  //   growth <  0, return above  -> rental income offsetting the fall
  // The third row is the one a naive `return > growth` test gets wrong: at
  // -2% growth on a 2x stake the cash return sits BELOW the growth rate
  // precisely BECAUSE of leverage, and that is the only case where the
  // help-tip ("multiplies gains and losses equally") earns its place.
  // Strict inequality both ways, so exact equality takes the short form —
  // there is no difference to attribute.
  //
  // Judged on the ROUNDED figures because both render via toFixed(1): a raw
  // 6.04 against 6.0 growth prints "6.0% ... 6.0% - the difference is
  // leverage", claiming a difference the reader cannot see. Same discipline
  // as the 1.05 multiple threshold above; revisit both if that precision
  // changes. The reverse (return just below growth, both printing alike) is
  // harmless — the short form makes no claim.
  const shownGrowth = Number(assetGrowthPct.toFixed(1));
  const shownReturn = Number(cashReturnPct.toFixed(1));
  // At the -100% floor, never claim leverage: annualisedReturn is clamped
  // there (issue #13), so a multiple stated beside a clamped figure invites
  // arithmetic that cannot reconcile. Tested on the displayed figure, since
  // anything printing as "100.0%" reads to the reader as the floor.
  const atFloor = shownReturn <= -100;
  return {
    show: true,
    assetGrowthPct,
    cashReturnPct,
    leverageMultiple,
    leverageExplainsGap: !atFloor && (shownGrowth >= 0
      ? shownReturn > shownGrowth
      : shownReturn < shownGrowth),
  };
}

// ── Node export guard ────────────────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    stateDefaults, BUILDING_PEST, LOAN_ESTABLISHMENT,
    formatCurrency, calcStampDuty, calcDepreciation, legacySaleOutcome,
    BUDGET_NIGHT_ISO, BOUNDARY_ISO, DEEMED_DATE_ISO,
    daysBetween, yearFrac, cpiFactor, fyStartYear, addYearsISO,
    routeRegimes,
    applyOffsets, calcOldRegimeCGT, interpolateDeemedValue,
    calcDualEraCGT, calcTimeApportionedCGT,
    buildQuarantineSchedule, proRateAnnualResults,
    calcNewBuildOptimizer, calcReformSale,
    runSaleScenario, compareSaleTiming,
    annualizedReturn, irrFromCashflows, calcEquityReturns,
    calcBenchmark, BENCHMARK_PRESETS,
    calcLeverageLine,
    DISCLAIMERS,
  };
}
