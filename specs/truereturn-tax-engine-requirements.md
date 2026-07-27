# TrueReturn.au — Tax Engine Requirements: 2026–27 Budget Reforms

**Version:** 2.0 — FINAL. Incorporates the whole-journey addendum (`truereturn-spec-addendum-whole-journey.md` Parts A/C, now superseded): TrueReturn is a **whole-journey real-return tool**, not solely a 2027 tax calculator. "The essay" referenced in §§11–13 is the launch essay *"I Made $81,000 on Property. It Still Wasn't Worth It."* Engine mechanics only — UI requirements in `truereturn-ui-requirements.md`.
**Status of law:** Enacted. *Treasury Laws Amendment (Tax Reform No. 1) Act 2026*, passed with amendments and enacted **26 June 2026**. This spec models law, not proposals.
**Purpose of this doc:** Hand to Claude Code as the authoritative spec for refactoring the TrueReturn calculation engine. Claude Code should not re-derive tax law; where this doc says "ASSUMPTION" or "PENDING", implement as specified behind a config flag and do not guess further.

---

## 1. Summary of the reforms the engine must model

Two reforms, **different grandfathering logic**:

| Reform | Trigger date | Grandfathering basis |
|---|---|---|
| Negative gearing quarantine | Losses in income years starting on/after **1 July 2027** | **Purchase (contract) date** — applies only to interests acquired on/after 7:30pm AEST **12 May 2026** |
| CGT: indexation replaces 50% discount + 30% minimum tax | CGT events on/after **1 July 2027** | **Time-based** — gains accrued before 1 July 2027 keep old treatment via deemed sale/reacquisition; applies to **all** holders regardless of purchase date |

Key consequence: a property bought in 2020 keeps negative gearing forever but is still split into a pre-2027 and post-2027 CGT component if sold after 1 July 2027. The engine must model these two dimensions independently.

---

## 2. New engine inputs

| Input | Type | Notes |
|---|---|---|
| `contractDate` | date | Contract date, not settlement. Drives NG grandfathering. Straddle rule: contracts entered before 7:30pm 12 May 2026 but settled after are grandfathered. **UI note (spec v2.3):** the UI no longer asks for a date — it supplies a synthetic one from the grandfathering toggle (off → today, on → `2026-05-12`). This input remains the engine's API and is unchanged. |
| `dwellingType` | enum: `established` \| `newBuild` \| `affordableHousing` | New-build definition is PENDING ministerial instrument — accept user assertion, surface disclaimer. |
| `saleDate` | date | Determines whether CGT event is old regime (< 1 July 2027) or dual-era (≥ 1 July 2027). |
| `deemedValue20270630` | currency, optional | Estimated market value at 30 June 2027. Required for dual-era calc in market-value mode. Default: engine interpolates (see §5.4). |
| `cpiAssumption` | % p.a., default 2.5% | Used to project cost-base indexation for future-dated scenarios. |
| `marginalRate` | % | Existing input. Must now also feed the 30% minimum-tax comparison. |
| `apportionMode` | enum: `marketValue` \| `timeApportion` | See §5.5. `timeApportion` is a PENDING placeholder. |
| `currentValueEstimate` | currency | Comparison mode (§7): estimated value today, projected forward. |
| `growthAssumption` | % p.a. | Comparison mode (§7): projected capital growth for both scenarios. **Must accept negative values — no lower clamp at 0** (§13). |
| `saleDate1` / `saleDate2` | dates | Comparison mode (§7): pre-boundary and post-boundary sale dates. |
| `loanAmount` | currency | May already exist implicitly via loan payout. Must be an explicit input: it defines the deposit, which drives return-on-equity (§11). Deposit = `purchasePrice + purchaseCosts − loanAmount`. |
| `benchmarkReturn` | % p.a. | Opportunity-cost comparator (§12). Default configurable. |
| `benchmarkPreset` | enum: `custom` \| `vas` \| `vgs` \| `hisa` | Convenience presets that set `benchmarkReturn`. Values are config, not hard-coded, and carry a "before-tax, historical, not a forecast" disclaimer. |
| `dcaHoldingContributions` | bool, default `false` | If true, the benchmark also receives the property's out-of-pocket holding contributions as they occur (fairer total-wealth comparison). If false, benchmark receives the deposit as a lump sum only (matches the essay's simpler framing). |

Existing inputs retained: cost base elements (purchase price, stamp duty, buy/sell incidentals), capital works deductions claimed (Div 43), annual rent, annual deductible costs, loan interest, holding period.

---

## 3. Regime router (top-level decision logic)

```
if saleDate < 2027-07-01:
    CGT = OLD_REGIME (50% discount)          # unchanged current engine
if saleDate >= 2027-07-01:
    if dwellingType in (newBuild, affordableHousing):
        CGT = BEST_OF(OLD_REGIME_whole_gain, NEW_REGIME_whole_gain)   # §7b
    else:
        CGT = DUAL_ERA (pre-component + post-component)               # §5

if contractDate < 2026-05-12 19:30 AEST (or straddle contract):
    NG = FULL_DEDUCTIBILITY (current engine)  # for life of holding
elif dwellingType == newBuild:
    NG = FULL_DEDUCTIBILITY                    # exempt from quarantine
else:
    NG = FULL_DEDUCTIBILITY for income years starting before 1 July 2027,
         QUARANTINE_POOL for income years starting on/after 1 July 2027   # §4
```

Widely held trusts, super entities, and ministerially determined uses are out of scope (TrueReturn models individual investors).

---

## 4. Negative gearing quarantine module

Applies per §3 routing. Mechanics:

1. Each income year, compute `netRentalResult = assessableRent − deductions` (unchanged).
2. If result is a loss **and quarantine applies**: the loss is **not** deducted against salary/other income. No annual tax refund is generated. Add loss to `quarantinePool` (carried forward indefinitely, nominal dollars — no indexation of the pool).
3. Pool may be applied against: (a) net residential rental **income** from any non-quarantined year or other residential dwellings held, and (b) **capital gains from residential dwellings** at sale.
4. **Quarantined amounts must NOT be added to the CGT cost base** (explicit anti-double-benefit rule). This is a likely implementation bug — write a test asserting cost base is unchanged by the pool.
5. At sale, apply remaining pool against the residential capital gain. **ASSUMPTION (flag in code):** pool is applied against the gross capital gain before discount/indexation, consistent with the ordering treatment of losses in the new method statement. If the property sells at a loss or pool exceeds the gain, residual pool is reported as "stranded losses" — a real cost TrueReturn should surface, since for a single-property investor the pool may never be usable. This is a genuinely important output: the effective after-tax holding cost for quarantined properties is the **full pre-tax loss**, with recovery contingent and deferred.

Cash-flow impact: for quarantined properties, monthly bleed = pre-tax loss (no refund), and the "recovered later" amount must be shown as deferred and uncertain, not netted off silently.

---

## 5. CGT dual-era module (established dwellings, sold on/after 1 July 2027)

### 5.1 Deemed sale and reacquisition
Assets held at 30 June 2027 are deemed sold just before 1 July 2027 and reacquired 1 July 2027 at market value (or the apportioning alternative, §5.5). The notional gain/loss is **deferred** — no tax at 1 July 2027; both components crystallise at actual sale.

### 5.2 Pre-component (old law)
```
preGain = deemedValue20270630 − oldCostBase
oldCostBase = elements 1–5 as under current engine,
              reduced by Div 43 capital works claimed to 30 June 2027
taxablePre = preGain × 50%          # if held > 12 months at 30 June 2027
taxOnPre = taxablePre × marginalRate
```
Note: assets acquired 20 Sep 1985 – 21 Sep 1999 lose the frozen-indexation choice; only the 50% discount applies to the pre-component. (Minor for TrueReturn's audience; implement discount-only.)

### 5.3 Post-component (new law)
```
postCostBaseElement1 = deemedValue20270630, indexed by CPI from 1 July 2027 to saleDate
postExpenditure      = each cost base element incurred after 1 July 2027,
                       indexed from date incurred — EXCEPT third element
                       (costs of ownership), which is never indexed
sellingCosts         = element 2 incidentals at sale (incurred at sale → no uplift)
Div43 claimed post-1 July 2027 reduces the relevant element before indexation (ASSUMPTION — flag).
**Implementation note (2026-07-17):** callers MUST split cumulative Div 43 at the boundary and pass
`div43ClaimedPre` / `div43ClaimedPost` separately. Attributing the whole claim to the pre-component
(the original `calcReformSale` behaviour) understates CGT — measured at $13,127 (5.5%) on a default
15-year hold — because a post-2027 claim reduces element 1 *before* indexation, so the CPI factor
amplifies the reduction. Pre-component and post-component attribution are not interchangeable.

indexedCostBase = sum of above
postGain = salePrice − indexedCostBase
```
Indexation requires the (reacquired) asset be held ≥ 12 months and Australian residency for the whole holding period (a single day of foreign residency disqualifies — out of scope for v1, note in disclaimer).

### 5.4 Deemed-value default
If `deemedValue20270630` not supplied: linear interpolation between purchase price and sale price by time. Flag output as estimate-sensitive. (UI treatment deferred to the UI doc; the engine just needs the default + an override.)

### 5.5 Apportioning alternative — PENDING
The law allows choosing, at lodgment of the sale-year return, between the 30 June 2027 market value and a ministerial apportioning method **not yet prescribed**. Implement `timeApportion` mode as straight time-based apportionment of the whole-of-holding gain as a placeholder, behind a flag, clearly labelled "method not yet legislated". The engine should be able to show both modes so users see which is favourable — that choice is genuinely deferrable to sale under the law.

### 5.6 30% minimum tax on the post-component
Applies to the **post-1 July 2027 portion only** ("minimum tax capital gain"). Simplified engine rule:
```
taxOnPost = postGain × max(marginalRate, 30%)
```
**ASSUMPTIONS (flag both):**
- The statutory calculation is a gap comparison against actual tax paid across the whole return, and interacts badly with deductions (PwC notes effective rates can exceed 47% where taxable income < net capital gain). TrueReturn models the property in isolation, so `max(MTR, 30%)` is the defensible simplification. Document it.
- Whether the 30% floor is inclusive of Medicare levy is not settled in guidance reviewed; treat 30% as excluding Medicare levy, make configurable.
- Recipients of prescribed income-support payments are exempt from the minimum tax — out of scope for v1, disclaimer only.

### 5.7 Loss and pool ordering
New method statement prescribes ordering: capital losses and carry-forward losses apply against **discount (pre-component) gains first, then indexed gains**. Implement this ordering for (a) any user-entered capital losses and (b) interactions with the NG quarantine pool per §4.5.

### 5.8 Total
```
totalCGT = taxOnPre + taxOnPost
```

---

## 6. Old-regime path (regression safety)

For `saleDate < 1 July 2027`, or grandfathered NG years, the current engine's behaviour must be bit-identical. Before refactoring, capture current outputs for the St Leonards scenario (purchase ~$519k late 2020, sale $660k early 2026, selling costs ~$13.8k, cumulative rental loss ~$31.7k, NG relief ~$11.7k at MTR) as golden-file regression tests.

---

## 7. Sale-timing comparison engine

**Presentation note (UI spec v2.2, 2026-07-16):** originally scoped as the hero/launch feature; the PO has since removed all sale-timing UI — the "2027 reform impact" module (UI spec §3a) compares the same sale under old vs new rules, and the comparison/breakeven below is an **engine capability only** (tested, unused by UI, like the §7b optimizer). The engine spec below is unchanged and fully built.

For a single property, the engine must run the same holding under two sale-timing scenarios and return both after-tax outcomes side by side:

- **Scenario 1 — sell before the boundary:** `saleDate1 < 1 July 2027`, old regime (§6). Sale price = today's estimated value grown at `growthAssumption` to `saleDate1`.
- **Scenario 2 — hold and sell later:** `saleDate2 ≥ 1 July 2027`, dual-era (§5). Sale price grown at `growthAssumption` to `saleDate2`; deemed value per §5.4/§2. Holding costs, rent, and NG treatment continue to accrue for the extra holding period (NG per §3 routing — grandfathered properties keep deducting; post-Budget-night established purchases keep quarantining).

Additional inputs: `currentValueEstimate` (currency), `growthAssumption` (% p.a., default configurable — accepts negatives, see §13), `saleDate1`, `saleDate2`.

Required outputs:
1. After-tax net proceeds under each scenario (sale price − selling costs − CGT − loan payout, consistent with existing TrueReturn outputs), plus the ongoing holding cash flows between the two dates so the comparison is like-for-like on total wealth, not just tax.
2. The tax delta attributable purely to the regime change (hold growth constant, isolate the CGT difference).
3. **Breakeven growth rate**: the annual growth at which holding past 1 July 2027 still leaves the seller ahead despite the harsher regime. This is the single most useful number the tool can produce.
4. Sensitivity flag on the deemed-value estimate (§5.4) propagated to all Scenario 2 outputs.

Mandatory framing constraint (engine-level, non-negotiable): outputs must be labelled as the **tax component of a sale-timing decision only** — transaction costs of re-buying, replacement asset returns, and personal circumstances are outside the model. The tool must never emit "you should sell" language. This feature sits closest to the financial-advice line of anything on TrueReturn; disclaimers per §10 apply doubly.

**Test case T6 — comparison mode.**
Property bought 1 Jul 2020, cost base $600,000, grandfathered NG, current value estimate $780,000 at 1 Jan 2027, growth 4% p.a., MTR 39%, selling costs 2% of sale price, net rental loss $8,000/yr throughout.
Scenario 1: sell 1 Jun 2027. Scenario 2: sell 1 Jun 2030. Claude Code should hand-derive expected values from §5/§6 formulas and assert: (a) Scenario 1 applies 50% discount to the whole gain; (b) Scenario 2 splits at the deemed value with the post-component at max(39%, 30%); (c) a breakeven growth rate exists and is reported; (d) NG deductions continue in both scenarios (grandfathered).

---

## 7b. New-build / affordable-housing choice optimizer (DEMOTED — engine capability, not a launch feature)

Build the calculation (both paths already exist per §5/§6); expose as a secondary output only. Rationale: the 50% discount wins for the overwhelming majority of realistic growth/inflation combinations, the choice is not exercised until sale, and 'new build' remains legally undefined. Do not invest in UI for this in v1.

At disposal on/after 1 July 2027, the taxpayer **chooses** between:
- **Option A:** 50% CGT discount on the whole gain (60% for affordable housing). Choosing this means the deemed sale/reacquisition rules and the 30% minimum tax **do not apply at all** — single-era calc under old law.
- **Option B:** the indexation + minimum-tax regime (dual-era per §5).

Engine computes both, returns both figures and the winner. Rule of thumb the outputs should confirm: the discount wins when real gains are large relative to inflation; indexation wins only for low-real-growth, high-inflation holdings — and the 30% floor further tilts toward Option A for high-income sellers. New builds also retain full negative gearing (§3).

---

## 8. Test cases

CPI assumption 2.5% p.a. and marginal rate 39% (37% + 2% Medicare) unless stated. Expected values are hand-derived; Claude Code should verify independently from the formulas above and investigate any mismatch rather than adjusting expectations to fit.

**T1 — Old regime regression (grandfathered, sold pre-2027).**
Bought 1 Dec 2020, cost base $520,000 (incl. stamp duty). Div 43 claimed $10,000. Sold 1 Mar 2026 for $660,000, selling costs $14,000.
Cost base = 520,000 + 14,000 − 10,000 = 524,000. Gain = 136,000. Discounted = 68,000. Tax = 68,000 × 39% = **$26,520**. NG fully deductible in all years.

**T2 — Grandfathered NG, dual-era CGT (the key mixed case).**
Bought 1 Jul 2020, cost base $600,000, no Div 43. Deemed value 30 Jun 2027 = $800,000. Sold 1 Jul 2029 for $900,000, selling costs $20,000. No post-2027 capital expenditure.
Pre: gain 200,000 → discounted 100,000 → tax 39,000.
Post: indexed base = 800,000 × 1.025² = 840,500; + 20,000 selling costs = 860,500. Post gain = 39,500. MTR 39% > 30% → tax = 15,405.
Total CGT = **$54,405**. NG: fully deductible throughout (pre-Budget-night purchase).
Variant T2b: marginal rate 21% → tax on post = 39,500 × 30% = 11,850 (floor binds); tax on pre = 100,000 × 21% = 21,000.

**T3 — Post-Budget-night established purchase (quarantine).**
Bought 1 Aug 2026 (established), $700,000 cost base. Net rental loss $12,000/yr. Sold 1 Aug 2031 for $850,000, selling costs $18,000. Deemed value 30 Jun 2027 = $710,000.
NG: FY2026-27 loss (part year, say $11,000) fully deductible (income year started before 1 Jul 2027). FY2027-28 → FY2031-32 losses quarantined: pool = 4 full years + part year (implement pro-rating; for the test use 4 × 12,000 + 1,000 = $49,000). No annual refunds in those years.
CGT: pre gain = 10,000 → discounted 5,000. Post: indexed base = 710,000 × 1.025^(4.08yrs) ≈ 785,146; + 18,000 = 803,146; post gain = 46,854. Apply pool per §4.5 ordering (pre first, then post): pool 49,000 extinguishes pre gross gain 10,000 and 39,000 of the post gain → post gain 7,854 taxed at max(39%,30%) = $3,063; pre = $0; residual pool = $0. Assert cost base was NOT increased by the pool. (Treat exact figures as directional given the §4.5 ordering assumption; the invariants — no annual refund, no cost-base double-dip, pool applied at sale — are the hard requirements.)

**T4 — New-build optimizer.**
Bought 1 Oct 2026 (new build), $700,000. Sold 1 Oct 2032 for $950,000, selling costs $20,000. NG fully deductible throughout.
Option A: gain = 950,000 − 720,000 = 230,000 → discounted 115,000 → tax at 39% = $44,850.
Option B: deemed value 30 Jun 2027 = $715,000 (interpolated ≈ 3/72 months… use supplied value 715,000 for the test). Pre: 15,000 → 7,500 → 2,925. Post: 715,000 × 1.025^5.25 ≈ 813,566 + 20,000 = 833,566; post gain 116,434 × 39% = 45,409. Option B total ≈ $48,334.
Engine must return Option A as winner and show both.

**T5 — Stranded pool.** As T3 but sold at $720,000 (minimal gain): assert residual quarantine pool is reported, not silently discarded, and never reduces salary tax.

---

## 9. Explicitly out of scope / pending (do not build)

- 'New residential dwelling' eligibility logic — definition pending ministerial legislative instrument (EM criteria include separate title and "genuinely adds to supply"; knock-down-rebuild 1-for-1 expected to fail). Accept user's checkbox with disclaimer.
- The prescribed apportioning method (instrument not made) — placeholder only per §5.5.
- Trust structures, trustee reporting, AMIT interactions, part-year residency, small-business concessions, the Innovative Business CGT Concession (announced 18 Jun 2026, not in the Act), and the 30% discretionary-trust minimum tax (from 1 Jul 2028, separate future bill).
- The full statutory minimum-tax gap calculation across the whole tax return (§5.6 simplification stands).
- Pre-CGT (pre-1985) assets.

## 10. Required disclaimers (engine-level, surfaced wherever new-regime figures appear)

General information only, not tax advice; simplified minimum-tax treatment; new-build definition pending; deemed-value estimate sensitivity; apportioning method not yet legislated; CPI projection is an assumption; benchmark presets are historical, before-tax figures, not a forecast (§12).

---

## 11. Return-on-equity / leverage outputs

The essay's pivotal reveal is that a property growing ~5% p.a. returned ~11.5% p.a. **because of leverage**. The engine already has every figure needed; it just doesn't report them. Add these as first-class outputs on every calculation (old regime, dual-era, and both comparison scenarios).

**Definitions:**
```
depositCashInvested      = purchasePrice + purchaseCosts − loanAmount
totalCashInvested        = depositCashInvested + Σ(after-tax holding contributions)
netProceedsAfterTax      = salePrice − sellingCosts − CGT − loanPayout
netProfit                = netProceedsAfterTax − totalCashInvested
holdingYears             = (saleDate − contractDate) in years
```

**Outputs (all neutral, no judgment):**
1. **Return on equity (headline, matches essay):**
   `roeSimple = (1 + netProfit / depositCashInvested) ^ (1/holdingYears) − 1`
   Report as "% p.a. return on the cash you put in."
2. **Return on equity (precise, optional secondary):** IRR of the actual dated cash flows — deposit out at t0, holding contributions out as incurred, `netProceedsAfterTax` in at sale. This is lower than `roeSimple` because it prices the timing of the monthly bleed; label it "accounts for money you fed in along the way." Show both; note they differ and why.
3. **Leverage multiple:** `assetValueAtPurchase / depositCashInvested` (e.g. "~5×").
4. **Amplification pair (the teaching output):** report **asset growth rate** and **return on equity** side by side, so the gap is explicit and works in *both* directions. When growth is low/negative (§13), the same pair shows leverage amplifying the loss — this is the essay's half-growth ($22.5k) and flat (−$36.5k) cases, and must not be suppressed.

**Constraint:** never annotate the amplification as good or bad. "Your asset grew 5.0% p.a.; your cash returned 11.5% p.a. The difference is leverage" — and nothing more.

**Test case T7 — return on equity.**
Purchase $520,000, purchase costs in-price, `loanAmount` $416,000 → deposit $104,000. Sold $660,000, selling costs $14,000, CGT $27,000, loan payout $416,000. After-tax holding contributions ~$20,000 over the hold. Hold 5.1 yrs.
`netProceedsAfterTax` = 660,000 − 14,000 − 27,000 − 416,000 = $203,000.
`totalCashInvested` = 104,000 + 20,000 = $124,000. `netProfit` = $79,000.
Assert: `roeSimple` on deposit ≈ (1 + 79,000/104,000)^(1/5.1) − 1 ≈ **~11.5% p.a.** (reconciles to essay); IRR is lower once the $20k interim contributions are dated; amplification pair reports asset growth ~5% p.a. against ROE ~11.5% p.a.; leverage multiple ≈ 5×.

---

## 12. Opportunity-cost benchmark

The essay's intellectual core is that the honest test isn't "did I profit" but "did I beat a boring index fund, after tax." Model an unleveraged benchmark over the identical timeline and cash.

**Method:**
1. Benchmark receives `depositCashInvested` at t0 (lump sum). If `dcaHoldingContributions`, it additionally receives each holding contribution on the date incurred.
2. Compound at `benchmarkReturn` to the sale date. No leverage, no holding costs, no management drag beyond an optional `benchmarkFeeDrag` (config, default 0.10% p.a.).
3. **Tax the benchmark through the same regime router (§3).** A benchmark disposal before 1 July 2027 → 50% discount. On/after → **dual-era** (indexation + 30% floor), because the CGT change applies to *all* CGT assets. Deemed 30 June 2027 value = the benchmark's own compounded value on that date. NG quarantine does **not** apply (not residential rental).
4. Return: `benchmarkNetProfit`, `benchmarkRoe` (% p.a. after tax), on the same cash and same clock as the property.

**Outputs:** property ROE after tax vs benchmark ROE after tax, both after-tax, both on the same cash, with a one-line note that the property figure is leveraged and the benchmark is not. No "winner."

**Reinforces the reform story:** because the benchmark also routes through the dual-era CGT engine, a post-2027 benchmark sale shows *its* after-tax return falling too — the essay's point that "the CGT change hits shares as well," rendered automatically.

**Test case T8 — benchmark, pre-2027 sale.**
Same $104,000 deposit, `benchmarkReturn` 9% p.a., sold same timeline (2026 → old regime), MTR 39%.
Value = 104,000 × 1.09^5.1 ≈ $163,100. Gain $59,100 → discounted $29,550 → CGT ≈ $11,525. `benchmarkNetProfit` ≈ $47,575. `benchmarkRoe` ≈ **~7.7% p.a. after tax**.
Assert: engine reports property ROE (~11.5%) and benchmark ROE (~7.7%) side by side, both after tax, neutrally; leverage note present; no judgment verb. (Confirms the essay's "same ballpark on money, but property only won via leverage" — shown, not stated.)

---

## 13. Negative and zero growth handling (amends §7 and the regime router)

The essay teaches downside through *growth*, not deemed-value error: half-growth (+14.25% total → $22.5k), flat (0% → −$36.5k), Melbourne (3.3% over 5yr → −$22k). The engine must handle this cleanly.

1. `growthAssumption` accepts negatives; **no clamp at 0**.
2. When projected sale price ≤ cost base: capital **loss**, CGT = 0, loss recorded (available per §5.7 ordering / user capital-loss input). Holding costs and selling costs still apply, so `netProfit` can be **negative**.
3. Negative `netProfit` and negative ROE must render as real figures, never blanked, clamped, or shown as $0. The −$36.5k flat-growth case is a required, displayable output.
4. Amplification pair (§11 #4) at negative growth shows leverage magnifying the loss — the honest mirror of the upside.
