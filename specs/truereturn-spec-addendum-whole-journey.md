# TrueReturn.au — Spec Addendum: Whole-Journey Outputs (Essay Reconciliation)

> **STATUS: SUPERSEDED (2026-07-15).** The Part C decision was made: TrueReturn is the **whole-journey real-return tool**. This addendum has been folded into the final specs — Part A → tax spec v2.0 (§2 inputs, §§11–13, tests T7/T8), Part B → UI spec v2.0 (§1 IA, §2, §3, §6, §9). The v2.0 specs are authoritative; this file is kept for history only.

**Version:** 1.0 — addendum to `truereturn-tax-engine-requirements.md` (§§ referenced as *tax spec*) and `truereturn-ui-requirements.md` (*UI spec*).
**Why this exists:** The reform-update specs model the 2027 tax changes thoroughly, but the launch essay ("I Made $81,000 on Property. It Still Wasn't Worth It.") frames TrueReturn as a *whole-journey* tool — "enter your purchase price, costs, rent, holding period, expected growth, tax rate; see what the real return actually is." Three things the essay teaches are not yet in scope. This closes them. Where this addendum conflicts with the tax spec on *calculation*, the tax spec still wins; this only adds.
**Neutrality constraint (inherited, non-negotiable):** All new outputs obey tax spec §7 / UI spec §5 — no "you should", no winner/loser badges, no green/red judgment. Show the numbers; the reader decides.

---

## PART A — ENGINE ADDITIONS (append to tax spec)

### A.1 New / confirmed inputs (extend tax spec §2)

| Input | Type | Notes |
|---|---|---|
| `loanAmount` | currency | May already exist implicitly via loan payout. Must be an explicit input: it defines the deposit, which drives return-on-equity (A.2). Deposit = `purchasePrice + purchaseCosts − loanAmount`. |
| `benchmarkReturn` | % p.a. | Opportunity-cost comparator (A.3). Default configurable. |
| `benchmarkPreset` | enum: `custom` \| `vas` \| `vgs` \| `hisa` | Convenience presets that set `benchmarkReturn`. Values are config, not hard-coded, and carry a "before-tax, historical, not a forecast" disclaimer. |
| `dcaHoldingContributions` | bool, default `false` | If true, the benchmark also receives the property's out-of-pocket holding contributions as they occur (fairer total-wealth comparison). If false, benchmark receives the deposit as a lump sum only (matches the essay's simpler framing). |
| `growthAssumption` | % p.a. | **Amend range:** must accept negative values (see A.4). No lower clamp at 0. |

Retained: everything in tax spec §2.

### A.2 Return-on-equity / leverage outputs (new tax spec §11)

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
4. **Amplification pair (the teaching output):** report **asset growth rate** and **return on equity** side by side, so the gap is explicit and works in *both* directions. When growth is low/negative (A.4), the same pair shows leverage amplifying the loss — this is the essay's half-growth ($22.5k) and flat (−$36.5k) cases, and must not be suppressed.

**Constraint:** never annotate the amplification as good or bad. "Your asset grew 5.0% p.a.; your cash returned 11.5% p.a. The difference is leverage" — and nothing more.

**Test case T7 — return on equity.**
Purchase $520,000, purchase costs in-price, `loanAmount` $416,000 → deposit $104,000. Sold $660,000, selling costs $14,000, CGT $27,000, loan payout $416,000. After-tax holding contributions ~$20,000 over the hold. Hold 5.1 yrs.
`netProceedsAfterTax` = 660,000 − 14,000 − 27,000 − 416,000 = $203,000.
`totalCashInvested` = 104,000 + 20,000 = $124,000. `netProfit` = $79,000.
Assert: `roeSimple` on deposit ≈ (1 + 79,000/104,000)^(1/5.1) − 1 ≈ **~11.5% p.a.** (reconciles to essay); IRR is lower once the $20k interim contributions are dated; amplification pair reports asset growth ~5% p.a. against ROE ~11.5% p.a.; leverage multiple ≈ 5×.

### A.3 Opportunity-cost benchmark (new tax spec §12)

The essay's intellectual core is that the honest test isn't "did I profit" but "did I beat a boring index fund, after tax." Model an unleveraged benchmark over the identical timeline and cash.

**Method:**
1. Benchmark receives `depositCashInvested` at t0 (lump sum). If `dcaHoldingContributions`, it additionally receives each holding contribution on the date incurred.
2. Compound at `benchmarkReturn` to the sale date. No leverage, no holding costs, no management drag beyond an optional `benchmarkFeeDrag` (config, default 0.10% p.a.).
3. **Tax the benchmark through the same regime router (tax spec §3).** A benchmark disposal before 1 July 2027 → 50% discount. On/after → **dual-era** (indexation + 30% floor), because the CGT change applies to *all* CGT assets. Deemed 30 June 2027 value = the benchmark's own compounded value on that date. NG quarantine does **not** apply (not residential rental).
4. Return: `benchmarkNetProfit`, `benchmarkRoe` (% p.a. after tax), on the same cash and same clock as the property.

**Outputs:** property ROE after tax vs benchmark ROE after tax, both after-tax, both on the same cash, with a one-line note that the property figure is leveraged and the benchmark is not. No "winner."

**Reinforces the reform story:** because the benchmark also routes through the dual-era CGT engine, a post-2027 benchmark sale shows *its* after-tax return falling too — the essay's point that "the CGT change hits shares as well," rendered automatically.

**Test case T8 — benchmark, pre-2027 sale.**
Same $104,000 deposit, `benchmarkReturn` 9% p.a., sold same timeline (2026 → old regime), MTR 39%.
Value = 104,000 × 1.09^5.1 ≈ $163,100. Gain $59,100 → discounted $29,550 → CGT ≈ $11,525. `benchmarkNetProfit` ≈ $47,575. `benchmarkRoe` ≈ **~7.7% p.a. after tax**.
Assert: engine reports property ROE (~11.5%) and benchmark ROE (~7.7%) side by side, both after tax, neutrally; leverage note present; no judgment verb. (Confirms the essay's "same ballpark on money, but property only won via leverage" — shown, not stated.)

### A.4 Negative and zero growth handling (amend tax spec §7 and regime router)

The essay teaches downside through *growth*, not deemed-value error: half-growth (+14.25% total → $22.5k), flat (0% → −$36.5k), Melbourne (3.3% over 5yr → −$22k). The engine must handle this cleanly.

1. `growthAssumption` accepts negatives; **no clamp at 0**.
2. When projected sale price ≤ cost base: capital **loss**, CGT = 0, loss recorded (available per §5.7 ordering / user capital-loss input). Holding costs and selling costs still apply, so `netProfit` can be **negative**.
3. Negative `netProfit` and negative ROE must render as real figures, never blanked, clamped, or shown as $0. The −$36.5k flat-growth case is a required, displayable output.
4. Amplification pair (A.2 #4) at negative growth shows leverage magnifying the loss — the honest mirror of the upside.

---

## PART B — UI ADDITIONS (append to UI spec)

### B.1 Leverage / return-on-equity display (new UI spec §9)

On the single-sale calculator **and** both comparison cards, add a **"Return on your cash"** block beneath the net-figure hero:

- Headline: "**X.X% a year** on the ~$Nk you actually put in." (uses `roeSimple`, A.2 #1)
- Immediately below, the amplification pair as a single plain line: "The property itself grew **A.A%** a year. Your cash returned **X.X%** — the difference is leverage (~M× here)."
- Collapsible: the precise IRR ("accounts for the money you fed in along the way: **Y.Y%**") with a one-sentence why-it's-lower note.
- Neutral only. No "great return" / "poor return" language, no colour judgment (UI spec §5).

### B.2 Opportunity-cost benchmark (extend UI spec §2 inputs and §3 outputs)

**Input (Group 2, optional, collapsed by default):** "Compare against an index fund" — a preset chooser (VAS / VGS / high-interest savings / custom %) feeding `benchmarkReturn`, with a `dcaHoldingContributions` checkbox labelled "also invest what you spent holding the property." Preset chips carry the disclaimer: "Historical, before tax, not a forecast."

**Output (one line, beneath the Return-on-cash block):**
> "The same cash in [VGS] over the same period would have returned about **Y.Y% a year** after tax, with none of the holding costs, tenants, or time. Your property returned **X.X%** — with nearly M× leverage doing the work."

Rules: after-tax on both sides; state the leverage asymmetry once; never declare a winner. If benchmark sale routes post-2027, add: "(the same 2027 CGT changes apply to shares too — reflected here)."

### B.3 Growth slider range + downside quick-sets (amend UI spec §2 and §3)

- **Extend the growth slider** from `0–10%` to **`−5% to +10%`** (comparison mode) so the reader can drag into flat and negative territory and watch the return crater — the growth-sensitivity pedagogy the essay relies on.
- Add **downside quick-set chips** beside the slider: "Half your growth", "Flat (0%)", and a "Your city's last 5 years" preset (config table of capital-city 5yr figures, clearly dated and sourced). Each sets the slider and re-runs.
- When the result goes negative, the net figure renders as a real negative (e.g. "−$36.5k") with no colour alarm beyond TrueReturn's standard negative convention — honest, not editorialised.

### B.4 Copy notes

Match the essay's register (candid, numerate, lightly wry). Reuse its framings where they already exist: "the cash you actually put in", "with none of the holding costs, tenants, or time." Every new jargon term (leverage multiple, return on equity, IRR) gets the standard one-sentence hover/tap definition (UI spec §6). Errors stay task-fixing ("Add a loan amount to see your return on the cash you put in").

---

## PART C — SCOPE NOTE (for your decision, not for Claude Code)

The reform specs scope TrueReturn as a **2027 tax calculator**; the essay's closing scopes it as a **whole-journey real-return tool**. Parts A–B pull the app toward the essay. Before building, confirm that's the intended identity — because if it is, leverage (A.2) and the benchmark (A.3) are arguably *more* central to the landing experience than the dual-era CGT machinery, and the IA (UI spec §1) may want the whole-journey calculator, not the comparison mode, as the front door — with "Sell before or after 1 July 2027?" as the headline *feature within it* rather than the hero view. That's a positioning call only you can make; the engine work in Parts A–B is required either way.
