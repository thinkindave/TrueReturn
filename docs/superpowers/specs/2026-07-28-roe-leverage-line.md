# Return-on-cash leverage line (issue #14, phase 2b-2)

**Status:** Design proposal, 2026-07-28. Direction approved verbally by PO; awaiting written-spec review. Amends UI spec §9.
**Amended 2026-07-29 (PO-approved copy fix, UI spec v2.8):** the leverage clause is **conditional** — see "The leverage clause is conditional" in §2. The examples below were written before that rule and are corrected in place.
**Corrected 2026-07-29 (code review, UI spec v2.9):** v2.8's test for *when* the clause holds was directionally wrong — it hid the clause on every declining property, where leverage is precisely what deepens the loss. The rule is now direction-aware; §2 and the declining-property example below are corrected accordingly.
**Tracking:** GitHub issue #14. Branches from local `main` (`486ab4e`).
**Companion specs:** `specs/truereturn-ui-requirements.md` §9 (v2.6 → v2.7 on implementation), `specs/truereturn-tax-engine-requirements.md` §11. The tax spec stays authoritative for calculation; nothing here changes `engine.js`.

---

## 1. Why this exists, and why it is much smaller than §9 implies

Issue #14 carried phase 2b-2 forward as "whole-journey ROE / opportunity-cost benchmark UI", on the recorded basis that the §§11–13 engine work from #3 was engine-only and unsurfaced. Exploring the shipped build before designing changed the scope substantially.

**Finding A — return on cash already ships.** Every projection period's always-visible headline strip carries an **Annual Cash Return** cell (`proj5HeadlineReturnOnCash`, `proj10…`, `projLife…`), plus the same figure again as a section highlight and a body line item. It is computed inline at `index.html:5051`:

```js
const roeBase = totalUpfront > 0 ? 1 + totalProfit / totalUpfront : 0;
const annualisedReturn = roeBase > 0 ? (Math.pow(roeBase, 1 / years) - 1) * 100 : -100;
```

That is `engine.js`'s `annualizedReturn` formula, on the same base: `totalUpfront` (`index.html:4570`) is `deposit + stampDuty + conveyancing + BUILDING_PEST + LOAN_ESTABLISHMENT`, which is exactly the engine's `depositCashInvested` (`purchasePrice + purchaseCosts − loanAmount`). Issue #13 already aligned its degenerate-case behaviour to the engine's `ratio <= 0` floor, and left a comment saying so.

So `roeSimple` is not missing. What §9 describes as a new "Return on your cash" block would restate a number already on screen. **The block is therefore rejected; only the two figures that are genuinely absent get surfaced.**

**Finding B — dollar profit is not comparable between property rows, and the tool invites that comparison.** `depositPct` is a per-property field, and the UI ships a Copy button plus the tip *"Duplicate a property to test different scenarios."* Two rows can therefore carry different leverage, at which point net profit stops being a comparable quantity:

| Row | Cash in | Net profit | Leverage | Annual cash return |
|---|---|---|---|---|
| A: $520k @ 20% deposit | $104,000 | $79,000 | 5.0× | **11.7%** |
| B: $650k @ 40% deposit | $260,000 | $79,000 | 2.5× | **5.3%** |

Identical dollar outcome; less than half the return. A user comparing those rows on Total Profit concludes they are equivalent. The existing Annual Cash Return cell already distinguishes them — what is missing is any explanation of *why* two rows with the same profit return different rates. That explanation is the leverage multiple, and it is the gap this design fills.

**Finding C — the benchmark depends on these outputs.** §9's benchmark line is *"the same cash in [VGS] would have returned about Y.Y% a year after tax… Your property returned X.X% — with nearly M× leverage doing the work."* `X.X%` is `roeSimple` and `M×` is `leverageMultiple`. The comparison must be expressed as a rate, because the property's dollars come off a leveraged position and the benchmark's off an unleveraged one; comparing final dollars would flatter the property purely for having borrowed (tax spec §12). The existing Annual Cash Return help-tip already gestures at this: *"compare against shares or index funds."* The benchmark is therefore a clean follow-on once `leverageMultiple` exists, and is **out of scope here**.

## 2. The design

One always-visible line, on the **15-year period only** (`projLife`), **below** the existing sensitivity bands — last of the always-visible lines, immediately above the collapsible detail. Reading order: what happened → its caveats → what explains it. (Originally specified above the bands; moved on PO review of the preview, 2026-07-29.)

**Copy — one template, both directions:**

> At the **X.X%** a year growth you assumed, your cash {returned|fell} **Y.Y%** — the difference is leverage (~M× here).

The asset figure is attributed as an assumption, not reported as a finding. This is a deliberate revision to the sketched wording ("The property itself grew X.X% a year"), made on discovering that `assetGrowthAnnual` *is* the user's `expectedGrowth` input (§4) rather than a derived result. Stating it as an outcome would dress an input up as a discovery, which the product's whole premise argues against. Rendered positive:

> At the **6.0%** a year growth you assumed, your cash returned **11.7%** — the difference is leverage (~5× here).

The same renderer, unmodified, on a declining assumption — the clause still shows, because a −21.6% cash return against −1.6% growth is leverage amplifying the fall:

> At the **−1.6%** a year growth you assumed, your cash fell **21.6%** — the difference is leverage (~5× here).

And the case where it is suppressed, growth positive but the cash return dragged under it by holding costs and tax:

> At the **1.0%** a year growth you assumed, your cash fell **1.8%**.

**The leverage clause is conditional (amended 2026-07-29, UI spec v2.8; rule corrected v2.9).** Everything from the em dash onward — the clause *and* the help-tip — renders only when leverage is genuinely what put the gap there. Otherwise the sentence stops after the cash figure and takes a full stop.

Leverage pushes the cash return further from zero in *growth's own direction* — it cannot flip the sign, only widen the distance from zero. So the gap it explains runs **upward under positive growth and downward under negative growth**:

| Assumed growth | Cash return | Cause | Clause |
|---|---|---|---|
| ≥ 0 | above growth | leverage | **show** |
| ≥ 0 | at or below growth | holding costs and tax | hide |
| < 0 | below growth | leverage amplifying the fall | **show** |
| < 0 | at or above growth | rental income offsetting the fall | hide |

The v2.7 wording stated a false cause on row 2 (on the default property — 650k, 20% deposit, QLD — 1.0% growth yields −1.8% on cash, and no multiple applied to +1.0% produces −1.8%). The v2.8 fix over-corrected into row 3, hiding the clause on every declining property; that is reachable at 50% deposit, $650/wk rent, −2% growth, where the −6.4% cash return is a 1.9× stake on a falling asset, and it is the only situation in which the help-tip's "multiplies gains **and losses** equally" earns its place. Row 4 is real too: 80% deposit, $1200/wk rent, −2% growth gives +2.8%, where the gap is rental income, not leverage. Equality shows the short form in both directions — there is no difference to attribute. Two further suppressions: never claim leverage at the −100% floor (the cash return is clamped there, issue #13, so a multiple beside it cannot be reconciled arithmetically), and judge the gap on the figures **as displayed** via `toFixed(1)`, since a raw 6.04 against 6.0 growth would claim a difference the reader cannot see — the same discipline that raised the leverage-multiple threshold from 1.01 to 1.05. The decision lives in `calcLeverageLine` as `leverageExplainsGap`, not in the renderer, so it is unit-testable; the help-tip sits inside the clause's wrapper span so it hides with it.

Verb selection is by sign on the cash figure only (`returned`/`fell`); the asset figure renders its own sign and needs no verb branch. No other branching, no commentary, no colour beyond TrueReturn's existing negative convention on the two figures. Tax spec §11's constraint is explicit: never annotate the amplification as good or bad, and never suppress it when growth is weak. Measured behaviour of the shared renderer across growth assumptions, from `engine.js` (test case T7 inputs):

| Growth case | Asset growth | Return on cash | Net profit |
|---|---|---|---|
| Essay case | 4.8% p.a. | 11.7% p.a. | $79,000 |
| Half growth | 2.5% p.a. | 4.0% p.a. | $23,000 |
| Flat | 0.0% p.a. | −7.5% p.a. | −$34,000 |
| Small decline | −1.6% p.a. | −21.6% p.a. | −$74,000 |

The flat row is the important one: zero growth is a **$34k loss**, not break-even, because holding and selling costs still land. The line makes leverage's symmetry visible without a word of editorialising.

**Help-tip**, following the keyboard-reachable pattern established by #12 (`486ab4e`):

> Your deposit and costs bought a much larger asset, so the property's growth lands on your smaller cash stake. Leverage multiplies gains and losses equally.

**Why 15-year only.** The line explains a structural property of the investment, not a per-period result; the leverage multiple is identical across all three periods (it is fixed at purchase). Repeating one invariant sentence three times per property reads as padding. The 15-year card is where the compounding story is most fully told. PO decision, 2026-07-28.

## 3. Explicitly out of scope

- **The §9 "Return on your cash" block** — rejected per Finding A; its headline restates the shipped Annual Cash Return cell.
- **IRR** (`irr`, tax spec §11 #2). A third return figure alongside two others invites "which is the real one?" for little gain. Remains an engine capability, tested and unused — as `compareSaleTiming` and the new-build optimizer already are.
- **The opportunity-cost benchmark** (§12, `calcBenchmark`, `BENCHMARK_PRESETS`) — a separate slice. It needs a new per-property input and carries config staleness (the presets are flagged in `engine.js` as historical figures as at July 2026, not a forecast).
- **A ROE row in the property comparison table** — considered and dropped; it would duplicate the headline cell.
- **Unifying the inline ROE computation with `engine.calcEquityReturns`** — see §4.
- **The §5.3 residency / §5.6 income-support disclaimer question** carried on #14 — unrelated to this line; stays open on the issue.

## 4. Implementation approach: compute inline, do not unify

`index.html` duplicates engine ROE logic rather than calling `engine.calcEquityReturns`, which is a real maintenance smell — #13 had to patch the degenerate case in both places. Unifying is nonetheless **rejected for this slice**, because the two are not equivalent: `calcEquityReturns` folds `principalRepaid` into `totalCashInvested`, and the inline version does not. Switching would move **Annual Cash Return — a figure that already ships, on the metric the product is named after — for every existing user.**

**Amended 2026-07-28 during planning.** This section originally said "no `engine.js` change". That is revised to *one additive function*, `calcLeverageLine`: `tests/unit.js` can only reach `engine.js` exports, so keeping the logic in `index.html` would make it untestable and break the mandatory-TDD rule. The constraint that actually matters is unchanged — nothing existing in `engine.js` is touched, and `calcLeverageLine` **receives** the already-computed `annualisedReturn` rather than recomputing it, so the shipped figure still cannot move.

This slice therefore adds the two missing figures beside the existing `annualisedReturn` computation, in the same loop (`index.html:4822`, `{years: 15, prefix: 'projLife'}`):

- `assetGrowthAnnual` — **is the `expectedGrowth` input, not a derived figure.** `futureValue = purchasePrice * Math.pow(1 + expectedGrowth, years)` (`index.html:4823`), so annualised asset growth is identically `expectedGrowth`. Render that field directly; computing `Math.pow(futureValue / purchasePrice, 1 / years) - 1` would be a no-op round trip. (Distinct from the existing "Capital Growth" highlight, which is a dollar amount in the collapsed Value section.)
- `leverageMultiple` = `purchasePrice / totalUpfront`. The only genuinely derived new figure.

Both reuse the existing `roeBase > 0` guard shape so degenerate cases behave identically to the shipped cell. No `engine.js` change, no risk to a shipped number, and the diff is a few lines of JS plus one template block.

**Follow-on issue to raise:** unify the inline ROE computation onto `engine.calcEquityReturns`, measuring and deliberately accepting the `principalRepaid` delta under golden-file tests. Deliberate, measured, and separately reviewable — not smuggled in under a display feature.

## 5. Edge cases

| Case | Behaviour |
|---|---|
| `totalUpfront <= 0` (100% LVR) | `leverageMultiple` undefined → hide the whole line. Matches engine's `null` return. |
| Loss exceeds cash invested | Return floors at −100% p.a., per the #13 fix. Line still renders. |
| `purchasePrice <= 0` | Hide the line. |
| Zero growth exactly | Renders "grew 0.0% a year"; no special case. The negative net figure carries the message. |
| Little or no leverage (multiple below 1.05) | Hide the line — it would assert a difference that does not exist. Threshold raised from 1.01 after code review (2026-07-28): the multiple renders via `toFixed(1)`, so the 1.01–1.05 band printed "~1.0× here" alongside a sentence claiming a difference. Reachable at roughly a 91–94% deposit. |
| `expectedGrowth` or `annualisedReturn` non-finite | Hide the line. Added after code review: guards the `NaN%` class of bug from #13, and stops `engine.annualizedReturn`'s `null` return rendering as a silently wrong "0.0". |

The last row is the same discipline as v2.6's degenerate-sensitivity-band suppression (§3): suppress on the arithmetic, not on a proxy input, so it stays correct if the inputs change.

## 6. Quality floor

- **Keyboard and screen-reader reachable** help-tip, using the pattern from #12 — not a hover-only `<span>`.
- **Mobile:** the headline strip already collapses to stacked full-width rows via its own media query; one wrapped sentence beneath it needs no new rules.
- **Negative figures** use the existing `.negative` convention, never blanked or clamped (tax spec §13).
- Numbers formatted with existing conventions: rates to one decimal, leverage to one decimal with `~` and `×`.

## 7. Testing (TDD — failing test first)

Unit tests in `tests/unit.js`:

1. The rendered asset-growth figure equals the `expectedGrowth` input for all three periods (guards against reintroducing the no-op round trip of §4).
2. `leverageMultiple` is 5.0× for 520k / 104k.
3. Declining property yields both figures negative, with cash return more negative than asset growth.
4. Zero growth yields 0.0% asset growth and a negative cash return.
5. `totalUpfront <= 0` and the below-1.05 no-leverage case both suppress the line, with fixtures bracketing the threshold so the constant cannot drift untested.
6. The shipped Annual Cash Return figure is **unchanged** by this slice — a regression guard on Finding A's warning, asserted for all three periods.

Test 6 is the one that matters most; it is the guard against the §4 risk.

## 8. Spec amendment

UI spec §9 currently specifies a block beneath the net-figure hero, with the amplification pair as prose, a `roeSimple` headline, and a collapsible IRR, on the whole-journey calculator *and* both comparison cards. This design replaces that with a single line on the 15-year period, no headline restatement and no IRR — and the comparison cards no longer exist (removed at v2.2).

On implementation, bump `specs/truereturn-ui-requirements.md` to **v2.7**, rewriting §9 to match, and record the PO decision and Finding A as the rationale. The benchmark output paragraph of §9 stays as written, unimplemented, and is explicitly deferred rather than dropped.
