# TrueReturn.au — UI Requirements: 2026–27 Budget Reform Update

**Version:** 2.3 — FINAL. **v2.3 change (PO decision, 2026-07-17):** the contract-date picker is replaced by a **grandfathering toggle** (§2 Group 1) — the tool is forward-looking, so the only two reachable regimes are "reform applies" (default) and "bought before 12 May 2026". Rationale and the exact regime mapping are in §2. Companion to `truereturn-tax-engine-requirements.md` v2.0 (the tax spec). Incorporates the whole-journey addendum (Parts B/C, now superseded) and resolves the Part C positioning decision: **TrueReturn is a whole-journey real-return tool** — the whole-journey calculator is the front door. **v2.1 change (PO decision, 2026-07-16):** the sale-timing comparison is demoted from headline feature to a *contextual 2027 reform impact module* (§1.2, §3a) — no nav tab, no "Sell before or after?" question-framing anywhere in the product. **v2.2 change (PO decision, 2026-07-16):** the module contains **no sale-timing dimension at all** — its detail compares the user's own modelled sale under old rules vs new rules (same sale date, same growth); the pre-boundary counterfactual sale and the breakeven rate have **no UI surface** (both remain engine capabilities only). Rationale: the essay never frames TrueReturn as a sale-timing tool; without a sale-date input the calculator never models a pre-2027 sale, so constructing one in the module would be the product's only timing comparison — and a personal decision-question edges from general information toward personal financial advice regardless of copy rules. The tax spec is authoritative for all calculations; this doc covers presentation, inputs, and copy only. Where they conflict, the tax spec wins.
**Design constraint:** Conform to TrueReturn's existing design system (typography, palette, components). This is an update to a live product, not a redesign. Claude Code should read the existing stylesheets/components before building and reuse them; introduce no new visual language beyond what this doc specifies.

---

## 1. Information architecture

**The whole-journey calculator is the landing view.** TrueReturn's identity (per the launch essay) is: "enter your purchase price, costs, rent, holding period, expected growth, tax rate; see what the real return actually is." The 2027 comparison is the headline feature *within* that tool, not the front door. Structure:

1. **Landing view: the whole-journey calculator** — the existing single-sale TrueReturn calculator, upgraded with:
   - the **"Return on your cash"** block (§9) — leverage/ROE is first-class on the landing experience;
   - the **opportunity-cost benchmark** (§2/§3 additions) — optional, collapsed by default;
   - the **downside growth range and quick-sets** (§2);
   - the dual-era engine invisibly (a post-2027 sale date now routes to the new calculation with no user action needed).
2. **2027 reform impact module — contextual, not a destination (v2.2).** A module *inside* the calculator results, shown only when the modelled outcome actually differs under the reform. No nav tab, no dedicated view, and **no "Sell before or after?" question-framing anywhere** — module titles are descriptive ("What the 2027 tax changes do to this property"). It leads with the regime-only tax delta (information about the law's effect); the collapsible detail compares the **same modelled sale** under old rules vs new rules (§3a). No sale-timing dimension exists anywhere in the module: no counterfactual sale date, no breakeven. All inputs derive from calculator state; the module has no controls of its own.
3. Quarantine cash-flow view appears **conditionally** — only when inputs indicate an established dwelling with a post-Budget-night contract date (§4 below). Do not show quarantine UI to grandfathered users; irrelevant warnings erode trust.
4. New-build optimizer: **no dedicated UI in v1** (tax spec §7b). Where a new-build sale is computed, show a single line in the results: "Best CGT treatment: 50% discount (chosen automatically — new builds may pick either regime)" with the alternative figure in a collapsible detail row.

## 2. Input flow (whole-journey calculator)

Progressive disclosure in three groups. Do not present all inputs at once.

**Group 1 — the property (always visible):**
- **Grandfathering toggle (v2.3 — replaces the contract-date picker).** Label: "I bought this before 12 May 2026" (default **off**). Off = the reform applies (negative gearing quarantined from 2027; no 50% discount on the pre-2027 CGT component). On = full negative gearing for life, and the pre-2027 component keeps the 50% discount. Help-tip: "Contracts signed before 7:30pm AEST 12 May 2026 keep full negative gearing for life — contract date, not settlement. The 2027 CGT change applies either way."
  **Rationale (PO decision, 2026-07-17):** TrueReturn is forward-looking — users are assessing purchases they haven't made yet, and every such purchase is post-Budget-night. A date picker asked users to supply a date whose only two meaningful outcomes are the two states of this toggle, while silently hiding a $19k cliff. The two regimes collapse exactly: grandfathered (≤ 12 May 2026) is *always* held >12 months at 30 June 2027 (Budget night + 12 months = 12 May 2027 < 30 June 2027), and any purchase from 1 July 2026 onward *never* is. The only date-sensitive gap (13 May – 30 June 2026: quarantined but still discounted) is in the past and unreachable for a forward-looking buyer.
  **Implementation:** the engine keeps `contractDate` as its API. The UI maps the toggle to a synthetic date — off → today, on → `2026-05-12` — and the regime router does the rest. No engine change.
- Dwelling type: Established / New build / Affordable housing. New build option carries an inline caveat chip: "Definition not yet finalised in law" linking to a short explainer. Note new build is the **only** NG-exempt type; affordable housing gets the best-of CGT choice but still quarantines (§4).
- Purchase price + purchase costs; loan amount (drives the deposit for §9) and current loan balance (for net-proceeds output).
- Current estimated value (`currentValueEstimate`).

**Group 2 — the projection:**
- Sale timing stays the live product's model: the 5/10/15-year projection periods plus the snapshot-year selector — no new sale-date input (design constraint: update, not redesign). Each period's implied sale date (today + N years) routes to the dual-era engine invisibly when it lands on/after 1 July 2027.
- Growth assumption slider, **−5% to +10% p.a.**, default 4%. Label: "Assumed capital growth." (Where the 2027 module is shown, the same rate drives both its outcomes.) The negative range is deliberate — the reader must be able to drag into flat and negative territory and watch the return crater (growth-sensitivity pedagogy per tax spec §13).
- **Downside quick-set chips** beside the slider: "Half your growth", "Flat (0%)", and a "Your city's last 5 years" preset (config table of capital-city 5yr figures, clearly dated and sourced). Each sets the slider and re-runs.
- Marginal tax rate (reuse existing TrueReturn MTR input).
- **Benchmark comparison (optional, collapsed by default):** "Compare against an index fund" — a preset chooser (VAS / VGS / high-interest savings / custom %) feeding `benchmarkReturn`, with a `dcaHoldingContributions` checkbox labelled "also invest what you spent holding the property." Preset chips carry the disclaimer: "Historical, before tax, not a forecast." Available on both the whole-journey calculator and comparison mode.

**Group 3 — holding costs (reuse existing TrueReturn inputs):** rent, expenses, interest. Pre-fill from existing calculator state if the user arrived from there.

**Deemed value input (the sensitive one):** default is engine-computed (interpolation per tax spec §5.4) and displayed as a *read-only chip with an edit affordance*: "Estimated value at 30 June 2027: $X (our estimate — edit if you have a better one)". On edit, it becomes a normal currency field with a "reset to estimate" link. Never bury this input: it must be visible in the Scenario 2 results area, because users need to see what assumption drove their number.

## 3. Output display (whole-journey calculator)

The calculator's results keep TrueReturn's existing output style: the after-tax net figure as the hero, the Return-on-your-cash block (§9) beneath it, the benchmark line when enabled (§9), and the existing collapsible breakdown — now itemising the dual-era split when a post-2027 sale routes there (pre-2027 component, post-2027 component, minimum-tax top-up if it bound), the deemed-value chip (§2), and the quarantine pool line (§4) where applicable.

**Deemed-value sensitivity band (mandatory wherever a dual-era figure is shown):** a one-line range: "If the 30 June 2027 value is 10% lower/higher than estimated, this outcome ranges from $A to $B." Implemented as engine re-runs at ±10% on `deemedValue20270630`. If the band width exceeds 15% of the net-proceeds figure, add: "This estimate matters a lot for your result — consider getting a real valuation in mid-2027." This is the single most important honesty feature on the page; it may not be hidden behind a toggle (the module's collapsed/expanded state does not count as hiding — the band must be visible whenever its figure is).

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

**b) Pool tracker (small module, not a hero):** a running figure — "Quarantined losses by sale: $Z" — with three-line explainer using the *less, later, only maybe* framing:
- **Less:** at sale, each quarantined dollar offsets the gross gain, typically saving ~half what the old annual refund would have (mirrors how capital losses already interact with the discount).
- **Later:** nothing back until you sell; the pool isn't indexed, so inflation erodes it while it waits.
- **Only maybe:** if the sale gain is smaller than the pool, the remainder is stranded — show it explicitly: "Stranded losses (never recovered): $W" in the results breakdown whenever W > 0. Never silently absorb this.

## 5. Disclaimers and legal-status flags

- Global banner (dismissible, reappears per session) on any view using the new engine: "Models the *Treasury Laws Amendment (Tax Reform No. 1) Act 2026*. Some details (new-build definition, the official apportioning method) are still pending — flagged where they apply. General information, not tax or financial advice."
- **Never-sell rule (from tax spec §7): no UI copy may say or imply "you should sell/hold."** Allowed verbs: "produces," "results in," "leaves you ahead/behind under these assumptions." Banned: "recommended," "better choice," "you should," winner/loser badges, trophies, ticks against a scenario. **v2.1 addition: no decision-question framing** — titles and headings may not pose the reader's own choice back to them as a question ("Sell before or after…?" is the canonical violation); describe what the law/model does instead.
- Pending-law chips: small inline "law pending" markers on the new-build selector and the apportioning-mode option, each opening a two-sentence explainer.
- The minimum-tax simplification (tax spec §5.6) gets a footnote on any result where the 30% floor bound: "Simplified minimum-tax calculation; interactions with your other income and deductions can change this."

## 6. Copy guidelines

Plain verbs, sentence case, TrueReturn's existing voice (candid, numerate, lightly wry — match the essays). Name things by what the user recognises: "value at 30 June 2027," not "deemed reacquisition market value." Every jargon term used in results (quarantined, indexation, minimum tax, leverage multiple, return on equity, IRR) gets a hover/tap definition of one sentence. Reuse the essay's framings where they already exist: "the cash you actually put in", "with none of the holding costs, tenants, or time." Errors state what to fix: "Sale date 1 must be before 1 July 2027 — that's the whole comparison." / "Add a loan amount to see your return on the cash you put in."

## 7. Explicitly not in v1

- Any sale-timing comparison UI (v2.2: the 2027 module compares rulebooks on the same sale, never sale dates; `compareSaleTiming` and the breakeven solver are engine-only). Any future surfacing is a PO decision, not a fast-follow.
- New-build optimizer UI (tax spec §7b — engine only).
- Multi-property portfolios (pool offsetting across properties is engine-supported conceptually but out of UI scope).
- Apportioning-method mode as a user-facing toggle (keep behind a query param or dev flag until the instrument is legislated).
- Saving/sharing scenarios, PDF export, and the 2027-toggle retrofit of older essay embeds — all fast-follows.

## 8. Quality floor

Responsive to mobile (scenario cards stack; verdict strip stays on top). Keyboard-navigable inputs with visible focus. Reduced-motion respected on any transitions. All figures formatted with TrueReturn's existing currency conventions. Engine calls debounced on slider input; results update without full reflow so the sensitivity of the growth slider is *felt* (watching the breakeven relationship move is half the pedagogy).

## 9. Return-on-your-cash block (leverage / ROE display)

On the whole-journey calculator **and** both comparison cards, add a **"Return on your cash"** block beneath the net-figure hero:

- Headline: "**X.X% a year** on the ~$Nk you actually put in." (uses `roeSimple`, tax spec §11 #1)
- Immediately below, the amplification pair as a single plain line: "The property itself grew **A.A%** a year. Your cash returned **X.X%** — the difference is leverage (~M× here)."
- Collapsible: the precise IRR ("accounts for the money you fed in along the way: **Y.Y%**") with a one-sentence why-it's-lower note.
- Neutral only. No "great return" / "poor return" language, no colour judgment (§5).

**Benchmark output (one line, beneath the Return-on-cash block, when the benchmark input is enabled):**
> "The same cash in [VGS] over the same period would have returned about **Y.Y% a year** after tax, with none of the holding costs, tenants, or time. Your property returned **X.X%** — with nearly M× leverage doing the work."

Rules: after-tax on both sides; state the leverage asymmetry once; never declare a winner. If benchmark sale routes post-2027, add: "(the same 2027 CGT changes apply to shares too — reflected here)."
