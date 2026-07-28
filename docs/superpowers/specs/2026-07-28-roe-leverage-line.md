# Return-on-cash leverage line (issue #14, phase 2b-2)

**Status:** Design proposal, 2026-07-28. Direction approved verbally by PO; awaiting written-spec review. Amends UI spec §9.
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

One always-visible line, on the **15-year period only** (`projLife`), beneath the headline strip and above the existing sensitivity bands. Reading order: what happened → why → caveats.

**Copy — one template, both directions:**

> At the **X.X%** a year growth you assumed, your cash {returned|fell} **Y.Y%** — the difference is leverage (~M× here).

The asset figure is attributed as an assumption, not reported as a finding. This is a deliberate revision to the sketched wording ("The property itself grew X.X% a year"), made on discovering that `assetGrowthAnnual` *is* the user's `expectedGrowth` input (§4) rather than a derived result. Stating it as an outcome would dress an input up as a discovery, which the product's whole premise argues against. Rendered positive:

> At the **6.0%** a year growth you assumed, your cash returned **11.7%** — the difference is leverage (~5× here).

The same renderer, unmodified, on a declining assumption:

> At the **−1.6%** a year growth you assumed, your cash fell **21.6%** — the difference is leverage (~5× here).

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
