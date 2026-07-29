# TrueReturn.au — UI Requirements: 2026–27 Budget Reform Update

**Version:** 3.0 — FINAL. **v3.0 change (issue #14, 2026-07-29):** the opportunity-cost benchmark deferred since v2.7 is **implemented** — a per-property VAS/VGS/HISA selector rendering an after-tax comparison line on **all three** period cards, plus a single note beneath them carrying the leverage asymmetry, the 2027 CGT clause and the presets' as-at date. New **§9a**. Three things differ from the v2.7 sketch: the line goes on all three periods, not the 15-year card alone, because the benchmark's after-tax return *varies by holding period* (CGT is paid once at sale) unlike the invariant leverage multiple; the leverage fragment moves out of the per-card sentence into the note, because §9 rules the asymmetry is stated once; and a chart-overlay placement was prototyped and **rejected** (20 lines across 8 hues at 10 properties). Preset provenance (`asAt`/`source`) and a 12-month staleness check in the smoke test were added at the same time, and HISA was corrected 4.5% → 4.8%. **§9's worked figures were also corrected — they cited a default rent of $650/wk the app has never had, and one example demonstrated the wrong arm of its own rule.** **v2.9 change (code review, 2026-07-29, follow-up to issue #14):** v2.8's suppression rule was **directionally wrong** and is corrected. It read "show the clause only when the cash return exceeds the assumed growth", on the reasoning that leverage can only ever widen a gap upward. That reasoning holds only under positive growth. Leverage pushes the cash return further from zero in *growth's own direction*, so when growth is **negative** the cash return sits *below* the growth rate precisely **because** of leverage — and v2.8 suppressed the clause exactly there. Reachable on the shipped build: 50% deposit, $650/wk rent, −2% growth gives a −6.4% cash return on a 1.9× stake, with the clause wrongly hidden. The help-tip that reads "leverage multiplies gains and losses equally" could therefore never appear in a loss — the only case where it earns its place — and the suppression contradicted §9's own neutrality requirement. From v2.9 the rule is direction-aware (four-quadrant table in §9), with two added suppressions: never claim leverage at the −100% floor, and judge the gap on the figures **as displayed** (`toFixed(1)`) rather than raw. **v2.8 change (PO decision, 2026-07-29, follow-up to issue #14):** §9's leverage clause becomes **conditional** rather than always-on — the "— the difference is leverage (~M× here)" clause and its help-tip are suppressed when leverage is not the explanation, leaving the true, still-useful short form. (v2.8's *test* for when that holds was wrong; v2.9 replaces it. The conditionality itself stands.) **v2.7 change (PO decision, 2026-07-28, issue #14):** §9 is rewritten from the "Return-on-your-cash block" to the **leverage line** — a single always-visible sentence on the 15-year period only, giving the leverage multiple and the assumed-growth/cash-return juxtaposition. The v2.6 block is superseded: the comparison cards it targeted were removed at v2.2, return on cash was found to be already shipping (the headline strip's Annual Cash Return cell), and the asset-growth figure turned out to be the user's own `expectedGrowth` input rather than a derived result. The benchmark output paragraph at the end of §9 is unchanged and explicitly deferred, not dropped. **v2.6 changes (PO decisions, 2026-07-24):** the deemed-value chip loses its edit control and becomes a single informational line (§2, issue #7); zero-spread sensitivity bands are suppressed instead of rendering "$X to $X" (§3, issue #8); the new-build CGT treatment line now shows BOTH the chosen and alternative figures (§1.4, issue #9). **v2.5 change (PO decision, 2026-07-19):** grandfathering removed entirely — the tool assumes all purchases are post-12-May-2026 so the reform always applies (a scope note in the reform banner covers the grandfathered minority); and the separate Age + Dwelling-type controls are merged into one "Age / type" dropdown, with Affordable Housing dropped. Both are detailed in §2 Group 1. **v2.3 change (PO decision, 2026-07-17, now superseded by v2.5):** the contract-date picker was replaced by a **grandfathering toggle** (§2 Group 1) — the tool is forward-looking, so the only two reachable regimes are "reform applies" (default) and "bought before 12 May 2026". Rationale and the exact regime mapping are in §2. Companion to `truereturn-tax-engine-requirements.md` v2.0 (the tax spec). Incorporates the whole-journey addendum (Parts B/C, now superseded) and resolves the Part C positioning decision: **TrueReturn is a whole-journey real-return tool** — the whole-journey calculator is the front door. **v2.1 change (PO decision, 2026-07-16):** the sale-timing comparison is demoted from headline feature to a *contextual 2027 reform impact module* (§1.2, §3a) — no nav tab, no "Sell before or after?" question-framing anywhere in the product. **v2.2 change (PO decision, 2026-07-16):** the module contains **no sale-timing dimension at all** — its detail compares the user's own modelled sale under old rules vs new rules (same sale date, same growth); the pre-boundary counterfactual sale and the breakeven rate have **no UI surface** (both remain engine capabilities only). Rationale: the essay never frames TrueReturn as a sale-timing tool; without a sale-date input the calculator never models a pre-2027 sale, so constructing one in the module would be the product's only timing comparison — and a personal decision-question edges from general information toward personal financial advice regardless of copy rules. The tax spec is authoritative for all calculations; this doc covers presentation, inputs, and copy only. Where they conflict, the tax spec wins.
**Design constraint:** Conform to TrueReturn's existing design system (typography, palette, components). This is an update to a live product, not a redesign. Claude Code should read the existing stylesheets/components before building and reuse them; introduce no new visual language beyond what this doc specifies.

---

## 1. Information architecture

**The whole-journey calculator is the landing view.** TrueReturn's identity (per the launch essay) is: "enter your purchase price, costs, rent, holding period, expected growth, tax rate; see what the real return actually is." The 2027 comparison is the headline feature *within* that tool, not the front door. Structure:

1. **Landing view: the whole-journey calculator** — the existing single-sale TrueReturn calculator, upgraded with:
   - the **leverage line** (§9) — the gap between assumed growth and return on the cash actually invested is named explicitly, not left for the reader to infer;
   - the **opportunity-cost benchmark** (§2/§3 additions) — optional, collapsed by default;
   - the **downside growth range and quick-sets** (§2);
   - the dual-era engine invisibly (a post-2027 sale date now routes to the new calculation with no user action needed).
2. **2027 reform impact module — contextual, not a destination (v2.2).** A module *inside* the calculator results, shown only when the modelled outcome actually differs under the reform. No nav tab, no dedicated view, and **no "Sell before or after?" question-framing anywhere** — module titles are descriptive ("What the 2027 tax changes do to this property"). It leads with the regime-only tax delta (information about the law's effect); the collapsible detail compares the **same modelled sale** under old rules vs new rules (§3a). No sale-timing dimension exists anywhere in the module: no counterfactual sale date, no breakeven. All inputs derive from calculator state; the module has no controls of its own.
3. Quarantine cash-flow view appears **conditionally** — only when inputs indicate an established dwelling with a post-Budget-night contract date (§4 below). Do not show quarantine UI to grandfathered users; irrelevant warnings erode trust.
4. New-build optimizer: **no dedicated UI in v1** (tax spec §7b). Where a new-build sale is computed, show a single line naming the chosen CGT treatment **with both figures side by side** so the reader can see why it won — v1.0 showed only the alternative's figure, which forced the reader to take "best" on trust (PO feedback, issue #9). Format:
   > "Best CGT treatment: **50% discount — $A** (vs indexation $B). Chosen automatically; new builds may pick either regime."

   Both amounts are the CGT payable under each option (`detail.optionA.tax` and `detail.optionB.totalCGT`). Keep it to one line — no collapsible detail row, no table. Neutral framing: "best" here means "lower tax under these inputs", which the two figures now demonstrate rather than assert.

## 2. Input flow (whole-journey calculator)

Progressive disclosure in three groups. Do not present all inputs at once.

**Group 1 — the property (always visible):**
- **No grandfathering input (v2.5 — PO decision, 2026-07-19).** The tool is forward-looking: it assesses purchases the user has not yet made, all of which are post-Budget-night, so the reform **always applies** — negative gearing quarantined from 2027 (except new builds), no 50% discount on the pre-2027 CGT component. There is no toggle, no date picker. Rationale: grandfathering by definition only ever applies to purchases on/before 12 May 2026 — a vanishing minority for a "should I buy this deal" tool — and the input it required was pure friction and a source of counterintuitive results. The engine keeps `contractDate` as its API; the UI always supplies **today**, so the router routes as "reform applies" every time. The engine's grandfathering path stays in place (tested, correct) but is no longer exercised by the UI — same treatment as the comparison engine.
  **Scope note (load-bearing, not boilerplate):** an existing owner who bought pre-12-May-2026 is genuinely grandfathered and would get *overstated* tax here. The reform banner (§5) must state the assumption plainly: "This calculator assumes you're buying after 12 May 2026, so the 2027 negative-gearing and CGT changes apply. If you bought earlier, your negative gearing and CGT are grandfathered and this will overstate your tax."
- **Age / type — one merged dropdown (v2.5).** Replaces the separate Age and Dwelling-type controls; lives in the always-visible main property row (not an expandable details area). Four options, each doing double duty (depreciation bracket **and** reform routing):

  | Option (label) | Depreciation (of 75% of price) | Reform routing |
  |---|---|---|
  | New build | 2.5% | **newBuild** — NG-exempt, best-of CGT |
  | Established, under 10 years | 2.5% | established — quarantine + dual-era |
  | Established, 10–20 years *(default)* | 1.25% | established |
  | Established, 20+ years | 0.75% | established |

  New build and Established-<10y share 2.5% (same building age; they differ only in reform status). **Affordable housing is dropped entirely** (niche, not in the launch essay; those investors already know their concessions). Implementation: keep `calcDepreciation` keyed on `new`/`mid`/`old` and add `newBuild` → 2.5% (one line, existing tests untouched); the dropdown values are `newBuild`/`new`/`mid`/`old`; derive `dwellingType = (value === 'newBuild') ? 'newBuild' : 'established'`. With both reform inputs now gone from the details area, remove the per-row expandable details area and its "Show details" toggle — the row returns to its plain 13-column form.
- Purchase price + purchase costs; loan amount (drives the deposit for §9) and current loan balance (for net-proceeds output).

**Group 2 — the projection:**
- Sale timing stays the live product's model: the 5/10/15-year projection periods plus the snapshot-year selector — no new sale-date input (design constraint: update, not redesign). Each period's implied sale date (today + N years) routes to the dual-era engine invisibly when it lands on/after 1 July 2027.
- Growth assumption slider, **−5% to +10% p.a.**, default 4%. Label: "Assumed capital growth." (Where the 2027 module is shown, the same rate drives both its outcomes.) The negative range is deliberate — the reader must be able to drag into flat and negative territory and watch the return crater (growth-sensitivity pedagogy per tax spec §13).
- **Downside quick-set chips** beside the slider: "Half your growth", "Flat (0%)", and a "Your city's last 5 years" preset (config table of capital-city 5yr figures, clearly dated and sourced). Each sets the slider and re-runs.
- Marginal tax rate (reuse existing TrueReturn MTR input).
- **Benchmark comparison (optional, collapsed by default):** "Compare against an index fund" — a preset chooser (VAS / VGS / high-interest savings / custom %) feeding `benchmarkReturn`, with a `dcaHoldingContributions` checkbox labelled "also invest what you spent holding the property." Preset chips carry the disclaimer: "Historical, before tax, not a forecast." Available on both the whole-journey calculator and comparison mode.

**Group 3 — holding costs (reuse existing TrueReturn inputs):** rent, expenses, interest. Pre-fill from existing calculator state if the user arrived from there.

**Deemed value — informational only, not an input (v2.6, PO decision 2026-07-24).** Display ONE plain read-only line stating the assumption: "Estimated value at 30 June 2027: **$X**" with a help-tip explaining that the 2027 change splits the gain at that date and this is our projection at the user's growth rate. **No edit affordance, no reset link, no `deemedValueOverride` field** — remove the control and the stored field entirely.
  **Rationale:** v1.0 called this "the sensitive one" and gave it an editable chip. Measurement on the shipped build says otherwise: a ±10% swing in the deemed value moves the 15-year outcome **~2.4%** (~$21k) for established dwellings and **0.0%** for new builds (the Option-A 50%-discount path ignores the deemed value entirely). It is a real assumption worth stating — hence the line — but not one worth a hand-entry control that essentially no user will exercise. Keeping the line preserves honesty; dropping the control removes UI weight from a tool being deliberately simplified.

## 3. Output display (whole-journey calculator)

The calculator's results keep TrueReturn's existing output style: the after-tax net figure as the hero, the headline strip's Annual Cash Return cell, the leverage line (§9) on the 15-year period, the benchmark line when enabled (§9, deferred), and the existing collapsible breakdown — now itemising the dual-era split when a post-2027 sale routes there (pre-2027 component, post-2027 component, minimum-tax top-up if it bound), the deemed-value chip (§2), and the quarantine pool line (§4) where applicable.

**Deemed-value sensitivity band (mandatory wherever a dual-era figure is shown):** a one-line range: "If the 30 June 2027 value is 10% lower/higher than estimated, this outcome ranges from $A to $B." Implemented as engine re-runs at ±10% on `deemedValue20270630`, holding every other input (including the Div 43 split and quarantine pool) constant. If the band width exceeds 15% of the net-proceeds figure, add: "This estimate matters a lot for your result — consider getting a real valuation in mid-2027." It may not be hidden behind a toggle — the band must be visible whenever its figure is (a period's collapsed detail does not count as visible; place it in the always-visible headline strip).

**Suppress the degenerate band (v2.6).** When the ±10% re-runs return the SAME figure (zero spread), hide that period's band entirely rather than rendering "$X to $X", which reads as a bug. This is the normal case for **new builds**: the Option-A whole-gain path wins and ignores the deemed value completely, so the 2027 value genuinely cannot move the result. Suppress on an exact-equality/negligible-spread test, not on dwelling type — the rule should follow the arithmetic, so it stays correct if the winning option changes.

**Calibration note (measured 2026-07-17 — corrects v1.0's framing).** v1.0 called this "the single most important honesty feature on the page." Measurement says otherwise for the tool's main use case: on a non-grandfathered property a ±10% deemed-value swing moves the outcome **0.66%**; grandfathered, **2.53%**. The reason is structural — for a purchase made now, only ~11 months of gain falls in the pre-2027 era, and without the 50% discount that slice is taxed at the same rate as the post-2027 slice, so moving gain across the boundary changes little. The discount is what makes the boundary bite, and only grandfathered holdings have it. Consequence: the 15% warning threshold will effectively never fire in v1. **Keep the band** (cheap, truthful, and it correctly reports "this barely matters"), but do not architect around it, and do not lower the threshold to manufacture alarm — a narrow band is the honest answer here.

## 3a. The 2027 reform impact module (v2.2)

**Trigger:** shown only when the modelled outcome actually differs under the reform — the sale date is on/after 1 July 2027, or quarantine applies to any modelled year. Never shown otherwise; irrelevant warnings erode trust.

**Collapsed state (default) — one factual sentence, the tax delta first:**
> "The 2027 tax changes account for **$X** of this result." — with an expand affordance ("see how").
The delta is engine output 2 in tax spec §7: the user's own modelled sale re-priced under the old law, same sale date, same growth — regime-only difference. This is information about the law, not about what to do.

**Expanded detail — the same sale, two rulebooks:**
- Two-column table: the user's modelled sale **under the old rules** beside the same sale **under the new rules** (identical sale date, growth, and holding costs — only the tax law differs). NOT presented as options to pick between; nothing in this table is choosable. Itemised per §3: CGT (with the dual-era split on the new-rules side), quarantine treatment difference (old side shows the annual refunds that would have applied; new side shows the pool per §4), net outcome per side.
- The deemed-value chip and sensitivity band (§3) for the new-rules figure.
- **No sale-timing dimension (v2.2):** no counterfactual sale date, no pre-2027 scenario, no breakeven rate — anywhere in the product. `compareSaleTiming` and the breakeven solver remain engine capabilities only (tested, unused by UI), like the new-build optimizer.

**Framing rules (in addition to §5):** no question-mark titles, no imperative verbs in the module ("sell", "hold", "act"), no side ranked above the other, no colour judgment. The module explains what the Act does to this property; the reader draws their own conclusion.

**Negative results render honestly:** when a scenario's result goes negative, the net figure renders as a real negative (e.g. "−$36.5k") with no colour alarm beyond TrueReturn's standard negative convention — never blanked, clamped, or shown as $0 (tax spec §13). Honest, not editorialised.

## 4. Quarantine pool display

Shown only when the negative-gearing quarantine actually applies — i.e. whenever the engine's regime router returns `ng === 'QUARANTINE_FROM_2027'` (contract date on/after 12 May 2026 and the dwelling is not a new build), with any post-1-July-2027 holding period. Note this includes **affordable housing**, which gets the best-of CGT choice but is *not* NG-exempt; only new builds are. Never key this off `dwellingType === 'established'` — route from the engine. Two elements:

**a) Cash-flow reframe (in the holding-costs breakdown):** replace the old "tax refund" line with:
> "Annual loss: $X. Under the old rules you'd have received ~$Y back each year. These losses are now quarantined — see below."

**b) Pool tracker (small module, not a hero).**

**MANDATORY — the full recovery reconciliation (added 2026-07-17, corrected after measurement).** The pool figure must never appear alone: a CGT figure shown by itself makes quarantine look like a *benefit* (the pool offsets the gain, so quarantined CGT is **lower**). But the counterweight is NOT a simple "cost" — an earlier draft of this spec mandated "net cost = refunds foregone − pool CGT saving", which measurement proved **wrong**: that quantity is algebraically identical to the tax on profitable rental years the pool absorbed, i.e. money the investor *kept*. Printing it as a cost is a factual error.

**The correct model.** Quarantined losses are recovered through *three* channels, and an honest module shows all of them:
```
W  = refunds given up      = Σ(quarantined loss × marginalRate)
A  = recovered along the way = (grossQuarantined − poolAtSale) × marginalRate
                               (pool absorbing profitable rental years)
V  = recovered at sale       = CGT with pool=0 minus CGT with pool  (MEASURE, don't estimate)
S  = stranded                = strandedPool × marginalRate
```
Display, in this order, adjacent to and equally prominent as the pool figure:
> "Refunds given up: **$W** · Recovered along the way: **$A** · Recovered at sale: **$V** · Stranded, never recovered: **$S**"

**The headline must branch on the measured residual, NOT on `S` alone (corrected 2026-07-18).** Compute `R = W − A − V − S`. `R` captures relief lost to *rate mismatch* — a pooled dollar offsetting a discounted gain is worth less than the refund it replaced. Measured example: an affordable-housing property (which quarantines, but whose `BEST_OF` route normally takes Option A's 60% discount) recovers only **$4,730 of $11,824** at sale — **60% of the relief is gone** — while `strandedPool` is still 0. Branching on `S` alone therefore prints "Every dollar comes back" over a 60% loss. Display a residual row whenever `|R|` is material (> 1% of `W`) and let it drive the headline:
- `R ≈ 0` and `S == 0` → "Every dollar comes back — just later than it would have. The pool isn't indexed, so inflation erodes it while it waits."
- `R > 0` → lead with it: "Worth less than a refund: about **$R** of relief is lost because these losses offset a discounted gain rather than your salary." (`R` and `S` are distinct losses; show both when both are non-zero.)
- `S > 0` → the stranded residue leads, as before.
`R` may also be **negative** where the 30% minimum-tax floor makes a pooled dollar worth *more* than the refund it replaced (reachable at the 19%/32.5% marginal rates the UI offers). Show it honestly rather than clamping — a labelled residual row absorbs both directions.
**Never assert full recovery from `S == 0`.** The engine's `strandedPool` measures unusable pool dollars, not their value.

**The regime's real nominal cost is the lost 50% discount on the pre-2027 slice, not the quarantine.** Measured on the default example: total tax over the hold is $235,990 grandfathered vs $239,529 under the reform — a **$3,539** difference, entirely the discount. Do not attribute that to the pool module; it belongs to the grandfathering toggle (§2 Group 1).

Then the running figure — "Quarantined losses by sale: $Z" — with the *later / only maybe* explainer:
- ~~**Less:**~~ **STRUCK (2026-07-17 — this claim was false).** v1.0 asserted each quarantined dollar saves "~half what the old annual refund would have," reasoning from how capital losses interact with the 50% discount. That holds only where the gain *is* discounted. The post-1-July-2027 component gets **indexation and no discount**, taxed at `max(MTR, 30%)` — so against it a pooled dollar is worth the **same** as a refunded dollar, just later. Since quarantine only applies to income years starting on/after 1 July 2027, the pool is overwhelmingly consumed against post-2027 gains, where "less" is simply wrong. Do not ship the "less" line. If a pool dollar ever *is* worth less than a refund dollar (pool consumed against a discounted pre-2027 gain), the reconciliation above shows it as measured `V`, without needing a rule of thumb.
- **Later:** nothing back until you sell; the pool isn't indexed, so inflation erodes it while it waits. **This is the primary real cost** — lead with it.
- **Only maybe:** if the sale gain is smaller than the pool, the remainder is stranded — show it explicitly: "Stranded losses (never recovered): $S" whenever S > 0. Never silently absorb this. This is the other real cost.

## 5. Disclaimers and legal-status flags

- Global banner (dismissible, reappears per session) on any view using the new engine. **v2.4 correction (2026-07-18):** v1.0 specified this text as "Models the *Treasury Laws Amendment (Tax Reform No. 1) Act 2026*. Some details … are still pending. General information, not tax or financial advice." — but the page already carries a permanent `.intro-disclaimer` saying "general information only and does not constitute financial advice." Repeating it reads as nagging and dilutes both. **The banner must carry only the reform-specific part**, letting the standing disclaimer do the general-advice work:
  > "Models the *Treasury Laws Amendment (Tax Reform No. 1) Act 2026*."

  Do not concatenate `DISCLAIMERS.generalInfo` into it (that constant is the engine's single source for the general-advice line and is correct for contexts that lack a standing disclaimer; this view has one). Compose the banner from a dedicated `DISCLAIMERS.reformScope` string, followed by `DISCLAIMERS.forwardLooking` (the "assumes you're buying after 12 May 2026…" scope note, §2 Group 1).

  **v2.7 correction (2026-07-27, PO issue #10):** the earlier "Some details — the new-build definition and the official apportioning method — are still pending, and are flagged where they apply" clause was **removed** — it promised flags that no longer exist. The new-build "definition not yet finalised" caveat chip went when Dwelling Type folded into the Age/type dropdown (#5), and the apportioning method never had a UI surface (engine-only `timeApportion` placeholder). Rather than leave the banner pointing at absent flags, `reformScope` is trimmed to just the Act reference; the forward-looking scope note carries the substantive caveat.
- **Never-sell rule (from tax spec §7): no UI copy may say or imply "you should sell/hold."** Allowed verbs: "produces," "results in," "leaves you ahead/behind under these assumptions." Banned: "recommended," "better choice," "you should," winner/loser badges, trophies, ticks against a scenario. **v2.1 addition: no decision-question framing** — titles and headings may not pose the reader's own choice back to them as a question ("Sell before or after…?" is the canonical violation); describe what the law/model does instead.
- Pending-law chips: small inline "law pending" markers on the new-build selector and the apportioning-mode option, each opening a two-sentence explainer.
- The minimum-tax simplification (tax spec §5.6) gets a footnote on any result where the 30% floor bound: "Simplified minimum-tax calculation; interactions with your other income and deductions can change this."

## 6. Copy guidelines

Plain verbs, sentence case, TrueReturn's existing voice (candid, numerate, lightly wry — match the essays). Name things by what the user recognises: "value at 30 June 2027," not "deemed reacquisition market value." Every jargon term used in results (quarantined, indexation, minimum tax, leverage multiple, return on equity) gets a hover/tap definition of one sentence. IRR is deliberately absent from that list — it is not surfaced (§9). Reuse the essay's framings where they already exist: "the cash you actually put in", "with none of the holding costs, tenants, or time." Errors state what to fix: "Sale date 1 must be before 1 July 2027 — that's the whole comparison." / "Add a loan amount to see your return on the cash you put in."

## 7. Explicitly not in v1

- Any sale-timing comparison UI (v2.2: the 2027 module compares rulebooks on the same sale, never sale dates; `compareSaleTiming` and the breakeven solver are engine-only). Any future surfacing is a PO decision, not a fast-follow.
- New-build optimizer UI (tax spec §7b — engine only).
- Multi-property portfolios (pool offsetting across properties is engine-supported conceptually but out of UI scope).
- Apportioning-method mode as a user-facing toggle (keep behind a query param or dev flag until the instrument is legislated).
- Saving/sharing scenarios, PDF export, and the 2027-toggle retrofit of older essay embeds — all fast-follows.

## 8. Quality floor

Responsive to mobile (scenario cards stack; verdict strip stays on top). Keyboard-navigable inputs with visible focus. Reduced-motion respected on any transitions. All figures formatted with TrueReturn's existing currency conventions. Engine calls debounced on slider input; results update without full reflow so the sensitivity of the growth slider is *felt* (watching the breakeven relationship move is half the pedagogy).

## 9. Leverage line (v3.0)

**Supersedes the v2.6 "Return-on-your-cash block."** That block specified a `roeSimple` headline, an amplification pair in prose, and a collapsible IRR, on the whole-journey calculator and both comparison cards. Three things changed: the comparison cards were removed at v2.2; return on cash was found to be already shipping (the headline strip's **Annual Cash Return** cell, computed inline on the same cash base as `roeSimple` but **not equal to it** — `calcEquityReturns` nets holding contributions and principal repaid into its profit numerator, so the two figures differ. Do not treat them as interchangeable; the structural guard in `.claude/smoke-test.js` exists to stop exactly that substitution); and the asset growth rate turned out to be the user's own `expectedGrowth` input rather than a derived figure. What remained worth adding was the leverage multiple and the juxtaposition.

**One line, on the 15-year period only.** Always visible, **below** the sensitivity bands — last of the always-visible lines, immediately above the collapsible detail (PO decision from preview, 2026-07-29: it reads cleaner under the 30 June 2027 value line than above it). Reading order is therefore: the figures → their caveats → what explains them. Not repeated on the 5- and 10-year periods: leverage is fixed at purchase and identical across all three, so repeating it reads as padding (PO decision, 2026-07-28).

**Copy — one template, both directions:**

> At the **X.X%** a year growth you assumed, your cash {returned|fell} **Y.Y%** — the difference is leverage (~M× here).

"a year" appears once and governs both figures.

**The leverage clause is conditional (v2.8, rule corrected at v2.9).** Everything from the em dash onward — "— the difference is leverage (~M× here)" *and* the help-tip that explains leverage — renders **only when leverage is genuinely what put the gap there**. Otherwise the sentence stops after the cash figure and takes a full stop. Three renderings:

All four below are measured on the shipped default property (650k, 20% deposit, **$550/wk**, QLD, 6.72%, marginal 0.37), 15-year period, except where noted — they reproduce exactly as printed **from a cleared `truereturn_state`**:

> *Leverage explains the gap (growth up):* At the **6.0%** a year growth you assumed, your cash returned **11.3%** — the difference is leverage (~**4.2×** here). `?`
>
> *Leverage explains the gap (growth down, 50% deposit):* At the **-2.0%** a year growth you assumed, your cash fell **10.1%** — the difference is leverage (~**1.9×** here). `?`
>
> *It does not — costs and tax ate the gap:* At the **1.0%** a year growth you assumed, your cash fell **8.2%**.
>
> *It does not — no gap survives display precision:* At the **2.13%** a year growth you assumed, your cash returned **2.1%**. (Raw 2.08% against 2.13%; both print 2.1, so the clause would claim a difference the reader cannot see.)

On this property the two figures cross at about **2.14%** assumed growth — at 2.1% the cash return is 1.98%, at 2.15% it is 2.19%. Below the crossing, holding costs and tax outrun the leveraged gain.

**These figures were wrong until 2026-07-29 and the error is instructive.** §9 previously cited the default rent as **$650/wk** — `git log -S 'data-field="weeklyRent" value="650"'` returns nothing, so it never was — and carried figures measured at that rent while claiming they reproduced from defaults. The display-precision example was worse than merely stale: at $550/wk, 1.5% growth yields **−2.0%**, so that example demonstrated the *costs-and-tax* arm, not the display-precision arm it was captioned as. The replacement at 2.13% is a real instance, and the cash return moves roughly 5× faster than growth here, so the band where both round alike is only about 0.02pp wide. **Re-measure this block against the running app whenever it is edited; do not carry a figure forward on trust.**

**Rule — direction-aware.** Leverage pushes the cash return further from zero in *growth's own direction*, so the clause shows when the gap runs that way and hides when it runs against it:

| Assumed growth | Cash return | What actually caused the gap | Clause |
|---|---|---|---|
| ≥ 0 | above growth | leverage | **show** |
| ≥ 0 | at or below growth | holding costs and tax | hide |
| < 0 | below growth | leverage amplifying the fall | **show** |
| < 0 | at or above growth | rental income offsetting the fall | hide |

Strict inequality both ways: exact equality takes the short form, because there is no difference to attribute. Two further suppressions:

- **Never at the −100% floor.** The cash return is clamped there (issue #13, "Known reading at the floor" below), so a multiple printed beside a clamped figure invites arithmetic that cannot reconcile.
- **Judge the gap as displayed, not raw.** Both figures render via `toFixed(1)`, so a 6.04% return against 6.0% growth would print "6.0% … returned 6.0% — the difference is leverage", claiming a difference the reader cannot see. Compare the rounded figures. Same discipline as the 1.05 leverage-multiple threshold below, and revisit both together if that precision ever changes. The reverse case — a return just *below* growth where both print alike — needs no rule, because the short form makes no claim.

Decided in `calcLeverageLine` as the `leverageExplainsGap` field, not in the renderer, so it is unit-testable — there is no DOM test harness in this project.

**Rationale.** Leverage multiplies the growth that lands on the cash stake. It cannot change the *sign* of that growth; it can only push the cash return further from zero in the same direction. So the gap that leverage explains runs upward under positive growth and **downward under negative growth** — a 1.9× stake at −2% growth producing a −6.4% cash return is leverage doing what leverage does. (The multiple states the *direction and presence* of amplification, not its magnitude: −2 × 1.9 is not −6.4, because the gap also carries interest, tax and transaction costs. Do not invite the reader to multiply.) (v2.8 stated the rule as "cash return exceeds growth" and so suppressed the clause on every declining property, which is the one case where the "multiplies gains *and losses* equally" tip earns its place. That was wrong and is corrected here.) A gap running *against* growth's direction has a different cause, and the clause must not claim it: under positive growth that gap is holding costs and tax (on the default property — 650k, 20% deposit, $550/wk, QLD — 1.0% growth yields −8.2% on cash, and no multiple applied to +1.0% produces −8.2%); under negative growth it is usually rental income offsetting the fall (80% deposit, $1200/wk rent, −2% growth yields +2.8%). The second case holds while the position is negative-carry, which the default interest rate makes true; at a low enough interest rate a positive-carry position could put leverage behind an upward gap under negative growth, and the rule then stays silent where the clause would have been fair. That under-claim is the safe direction and is accepted.

**Zero growth is its own arm.** At exactly 0% assumed growth the clause never shows: leverage multiplies growth, and any multiple of zero is zero, so nothing in the gap is leverage — it is rent, principal repayment and costs. Implementations must also treat a *displayed* −0.0% as zero rather than positive; `Number((-0.04).toFixed(1))` is `-0`, and `-0 >= 0` is true in JavaScript, so a two-arm selector silently routes small negative growth through the upward branch. Asserting leverage in either is a false cause, which is exactly the kind of comfortable misreading this product exists to prevent. Note the units when implementing: `expectedGrowth` is a fraction, the cash return is already a percentage. The help-tip must hide with the clause — a tip explaining leverage sitting beside a sentence that no longer mentions leverage is worse than no tip. The verb branches on the sign of the cash return only; the asset figure carries its own sign. The cash figure is rendered as an absolute value so a negative return reads "your cash fell 10.1%", never "fell −10.1%".

**The asset figure is an assumption, not a finding.** It is `expectedGrowth` as typed by the user, so the copy attributes it ("the growth you assumed") rather than reporting it ("the property grew"). Presenting an input back as a modelled discovery is precisely the self-deception this product exists to counter.

**Suppression** — hide the whole line when there is no leverage gap to explain:
- leverage multiple below 1.05. The threshold is tied to the display precision: the multiple renders to one decimal place, so anything below 1.05 would print "~1.0× here" while the sentence claims a difference exists. A cash purchase sits below 1 (acquisition costs push cash invested above the purchase price); the band between is reachable at roughly a 91–95% deposit.
- non-positive purchase price or cash invested
- non-finite growth or cash-return figures — guards the `NaN%` class of bug from issue #13

Suppress on the arithmetic, never on a proxy input, so the rule stays correct if the inputs change (the same discipline as v2.6's degenerate sensitivity band).

**Neutrality (tax spec §11).** No judgment language, no ranking, no colour beyond the standard negative convention on the two figures. **The line itself must always render when growth is weak or negative** — that is when it carries the most information, and withholding it would make the feature dishonest. Zero growth is a loss, not break-even, and the line says so without comment. The conditional clause above is not an exception to this: what varies is only *which cause the sentence names*, never whether the sentence appears. The only things that hide the line as a whole are the arithmetic suppressions below. (v2.8 blurred this — by keying the clause on "return exceeds growth" it stripped the leverage attribution from every declining property, which read as partial suppression of exactly the case neutrality protects. The v2.9 direction-aware rule restores it: under negative growth the clause shows whenever leverage really is amplifying the fall.)

**Known reading at the floor.** When the modelled loss exceeds the cash invested, the shipped Annual Cash Return is floored at −100% (issue #13), and the line therefore reads "your cash fell 100.0%". This mirrors the headline figure exactly rather than introducing a second number, but it means the line cannot distinguish "lost everything" from "lost more than everything".

**IRR is not surfaced.** It remains an engine capability, tested and unused, alongside `compareSaleTiming` and the new-build optimizer.

**The benchmark deferred at v2.7 is now implemented — see §9a.**

---

## 9a. Opportunity-cost benchmark (v3.0)

Implements tax spec §12. Consumes the leverage line's outputs: the property's return on cash supplies the X.X%, the leverage multiple supplies the M× in the note.

**Control.** A per-property `data-field="benchmark"` select — **None** (default), VAS, VGS, high-interest savings. None means nothing renders and the cards are byte-identical to before the feature. Strictly opt-in.

Two plumbing facts, both verified rather than assumed:
- **Copy-property needs no change** — `index.html` copies every `select[data-field]` value to the clone generically.
- **Persistence does.** `serializeState` and `deserializeState` iterate a **hardcoded field-name array**, not `[data-field]` generally, so `'benchmark'` must appear in both. Adding a `data-field` input to this app does *not* automatically persist it.

**One line per period card, on all three.** Unlike the leverage line, which sits on the 15-year card alone. That decision rested on leverage being *identical* across periods, so repeating it read as padding. The benchmark's after-tax return is not identical: CGT is paid once at sale, so a longer hold defers it and the annualised return climbs toward the gross. Measured on the shipped default property (as §9 above; cash invested $154,575, leverage 4.21×):

| | 5y | 10y | 15y |
|---|---|---|---|
| **Property (shipped figure)** | **9.22%** | **11.25%** | **11.27%** |
| VGS | 8.64% | 8.90% | 9.19% |
| VAS | 6.70% | 6.83% | 6.98% |
| HISA | 3.91% | 3.94% | 3.97% |

A reader on the 5-year card who borrowed the 15-year benchmark figure would over-credit the benchmark by ~55bp. The 5-year row is also the one that earns the feature: **9.22% against 8.64%** is a 0.58pp margin on a position carrying 4.2× leverage, a mortgage, tenants and transaction costs.

**Copy — one template, all three periods:**

> The same cash in **VGS** over the same period would have returned about **9.2% a year** after tax, with none of the holding costs, tenants, or time. Your property returned **11.3%**.

**No comparative clause.** The sentence never says "less than", "more than" or "beat". It states two rates adjacently and stops — tax spec §12's "no winner" rule, and the single most important copy constraint in the feature.

**The leverage asymmetry is stated once, in the note — not per card.** v2.7's draft ended the sentence with "— with nearly M× leverage doing the work", while also ruling the asymmetry is stated once. The multiple is invariant across periods, so carrying it on three cards is the same padding objection that put the leverage line on one. It moves to the note, where it is visible regardless of which card the reader is on, and where it also satisfies tax spec §12's requirement for a one-line leverage note on the output.

**The note**, rendered once beneath the three cards when a benchmark is active:

> Your property figures are leveraged (~**4.2×** here); the benchmark is not. The same 2027 CGT changes apply to shares too — reflected here. VGS returns are historical figures as at **July 2026**, before tax — not a forecast.

- Sentence 2 is **gated on the `regime` field `calcBenchmark` returns being `DUAL_ERA`** — read off the arithmetic, never assumed. With a forward-looking contract date every reachable sale routes dual-era, but the gate stays so the rule survives a change to the contract date. A unit test pins both arms.
- Sentence 3 is `DISCLAIMERS.benchmarkHistorical` with the preset's own `asAt` month substituted, so staleness is visible to the reader and not only to the test suite.

**Suppression** — hide the line and the note when: no benchmark is selected; cash invested is zero or negative; the holding period is zero; or either figure is non-finite (issue #13's shape). Suppress on the arithmetic, never on a proxy input. Populate before unhiding and blank on hide, so a throw mid-populate cannot strand stale figures.

**The note's leverage sentence is separately conditional.** It renders only when the multiple is at least **1.05×** — `LEVERAGE_DISPLAY_MIN` in `engine.js`, the *same* constant `calcLeverageLine` uses to hide its whole clause, shared precisely so the two cannot drift. Below it the multiple prints "~1.0×" and the sentence "Your property figures are leveraged" is simply **false**: a cash purchase has no borrowing at all, and acquisition costs push cash invested above the purchase price so the multiple sits below 1. The band between is reachable at roughly a 91–95% deposit.

When it is suppressed the note keeps its remaining sentences — the 2027 CGT clause and the staleness disclaimer are required regardless of leverage, so the note must not be hidden wholesale to solve this. Bracketing unit tests at 1.04/1.05/1.06 pin that `calcBenchmarkLine.leverageIsMaterial` and `calcLeverageLine.show` agree on every side of the threshold.

This was caught in review: the first implementation gated the sentence on `leverageMultiple > 0`, so a 100% deposit rendered "Your property figures are leveraged (~1.0× here); the benchmark is not" on an unleveraged property — the exact false claim the threshold exists to prevent, and worse in the note than in the leverage line because the sentence's entire subject *is* the leverage asymmetry.

**Preset staleness.** `BENCHMARK_PRESETS` carry `asAt` and `source` (Vanguard performance pages for VAS/VGS retrieved 15 July 2026; finder.com.au for HISA, 29 July 2026 — HISA was corrected 4.5% → 4.8% at implementation). `.claude/smoke-test.js` **fails** when any `asAt` is more than 12 months old. It is designed to start failing around July 2027 — the mechanism, not a defect. Verified by deliberately back-dating a preset and confirming the failure.

**The chart placement was prototyped and rejected.** A *Compare with* dropdown on the Total Profit Over Time chart, adding a dashed colour-matched line per property, was built against the real engine and Chart.js and measured: at 10 properties it produced **20 lines across the 8 available `GRAPH_COLORS` hues**. The control case — 10 properties with the benchmark off — stayed traceable, so the doubling was the cause. `calculate()` also runs on `getSelectedEntry()`, so the projection cards render one property at a time and the collision cannot arise there at all. **Do not re-propose the chart overlay without new evidence.**

**Not surfaced:** DCA benchmark contributions (`calcBenchmark` supports `contributions`; lump-sum only in v1) and the benchmark in PDF/XLSX exports, which the leverage line is also absent from.
