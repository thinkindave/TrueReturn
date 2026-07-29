# Design — opportunity-cost benchmark (issue #14)

**Date:** 2026-07-29
**Status:** awaiting PO review
**Issue:** #14 (scoped to the benchmark alone after the 2026-07-29 split; the
2027 reform-impact module moved to #17)
**Implements:** UI spec §9's deferred benchmark paragraph, on all three
projection periods. Amends UI spec §9 to v3.0.

---

## 1. What this builds

A benchmark line on each of the three projection period cards (5, 10, 15
years), stating what the **same cash** would have returned in VAS, VGS, or a
high-interest savings account over the **same clock**, after tax, unleveraged —
beside what the property returned.

Plus a per-property control selecting which benchmark (or none), and a single
note carrying the leverage asymmetry and the presets' as-at date.

`calcBenchmark` and `BENCHMARK_PRESETS` already exist in `engine.js` and are
tested. This is a wiring-and-presentation slice plus one small pure helper.

---

## 2. Placement — decided by prototype, not by argument

A chart-overlay placement was designed, prototyped, and **rejected**. Recording
it because the rejection is the most useful thing this design produced.

The intermediate design put a *Compare with* dropdown on the **Total Profit
Over Time** chart, adding one dashed, colour-matched benchmark line per
property. A working prototype was built against the real `engine.js`, real
Chart.js 4.4.4, real `GRAPH_COLORS` and real dataset options, and driven at
1–10 properties:

| Properties | Lines | Result |
|---|---|---|
| 1–3 | 2–6 | Readable; pairing obvious |
| 5 | 10 | Crowded; tracing a pair takes effort |
| 10 | 20 | Unusable; legend wraps, hues collide |

The control case settles the cause: **10 properties with the benchmark off is
busy but traceable** — ten distinct lines, one legend row. The doubling breaks
it, not pre-existing clutter. `GRAPH_COLORS` holds 8 hues and cycles, so 20
lines cannot be distinguished even in principle.

**The decisive finding came after the prototype.** `calculate()` operates on
`getSelectedEntry()` (`index.html:4510`) — **the projection cards render one
property at a time.** The multi-property collision that broke the chart cannot
occur on the cards. The placement that looked like a compromise is strictly
better on the axis that killed the alternative.

PO decision, 2026-07-29: per-period projection cards. Chart placement dropped.

---

## 3. Exploration findings

**A — `calcBenchmark` is currently unreachable from the UI.** Called only
inside `runSaleScenario` (`engine.js:592`); `index.html` never calls that — it
calls `calcReformSale` directly (`index.html:4904`). Wired the same way
`calcLeverageLine` was: called directly from the render path.

**B — the "same clock" requirement is satisfied by construction.**
`contractDate === TODAY_ISO` (`index.html:4528`) and the sale date is
`addYearsISO(TODAY_ISO, years)` (`index.html:4886`), so the benchmark's
`holdingYears` equals the period's `years` exactly. Nothing to reconcile.

**C — the benchmark return varies by period.** On the shipped default property
(650k, 20% deposit, **$550/wk**, QLD, 6.72%, marginal 0.37 — cash invested
$154,575, leverage 4.21×):

| | 5y | 10y | 15y |
|---|---|---|---|
| **Property (shipped figure)** | **9.22%** | **11.25%** | **11.27%** |
| VGS | 8.64% | 8.90% | 9.19% |
| VAS | 6.70% | 6.83% | 6.98% |
| HISA (at the new 4.8%) | 3.91% | 3.94% | 3.97% |

CGT is paid once at sale, so a longer hold defers it and the annualised
after-tax return climbs toward the gross. **This is why the line goes on all
three cards.** The leverage line sits on the 15-year card alone because
leverage is *identical* across periods and repeating it read as padding
(PO, 2026-07-28). That reasoning does not transfer: this figure is different on
every card, so a reader on the 5-year card who borrowed the 15-year number
would be over-crediting the benchmark by ~55bp.

**The 5-year row is the one that earns the feature.** The property returns
9.22% against VGS's 8.64% — a 0.58pp margin, on a position carrying 4.2×
leverage, a mortgage, tenants and transaction costs. That is the essay's thesis
rendered as two adjacent numbers, and it is invisible unless the line appears on
the 5-year card.

**Provenance of these figures.** The property row is read from the **running
app** (`proj5/proj10/projLifeHeadlineReturnOnCash`) after clearing
`truereturn_state`, not reconstructed. Two reconstruction attempts were wrong
first:

1. A probe reversed `calcStampDuty(state, price)`'s arguments, giving $0 stamp
   duty and a 4.90× multiple — caught only because 4.90 contradicted the 4.2×
   in UI spec §9.
2. A corrected probe still passed `quarantinePool: 0` where the app passes
   `quarantinePoolAtYear(years)`, understating the 5-year return by **2.2
   percentage points** (7.02% against the true 9.22%).

The benchmark rows do not depend on the pool and are exact. **Rule: property
figures come from the running app; only benchmark figures may be quoted from a
probe.**

**F — UI spec §9's worked examples do not reproduce.** §9 states its figures
were measured on "the shipped default property (650k, 20% deposit, $650/wk,
QLD, 6.72%)" and "reproduce exactly as printed", giving a 15-year cash return
of **12.2%**. The shipped default rent is **550**, not 650 — and `git log -S`
confirms it has never been 650 — and the live leverage line renders **11.3%**.
The parenthetical was wrong when written. Corrected in the v3.0 rewrite (§13).

**D — `DISCLAIMERS.benchmarkHistorical` exists and nothing consumes it**
(`engine.js:819`). The only unused member of that object. Written for this
feature and never wired.

**E — all three periods route `DUAL_ERA`.** `BOUNDARY_ISO` is 2027-07-01 and
the tool is forward-looking (`contractDate` is always today), so the earliest
possible benchmark sale is ~2031. UI spec §9's conditional post-2027 clause is
therefore *always* true in practice — but it is still gated on the `regime`
field `calcBenchmark` returns, never assumed, per this project's rule to gate
on the arithmetic rather than a proxy.

---

## 4. The control

A per-property `<select data-field="benchmark">` in the property row's details,
following the existing `data-field` convention for row inputs (never `id=`):

> Compare with: **None** · VAS (Australian shares) · VGS (international shares) · High-interest savings

Default **None**. With None selected nothing renders and the cards are
unchanged from what ships today. Strictly opt-in.

Per-property rather than global because it belongs to the property, not the
view.

**Two plumbing facts, verified rather than assumed:**

- **Copy-property needs no change.** `index.html:3795` generically copies every
  `select[data-field]` value to the clone, so a duplicated row keeps its
  comparator for free.
- **Persistence DOES need a change.** `serializeState` (`index.html:3960`) and
  `deserializeState` (`index.html:3974`) iterate a **hardcoded field-name
  array**, not `[data-field]` generally. `'benchmark'` must be added to both
  arrays or the selection is silently dropped on reload. This is exactly the
  kind of "it rides the existing path" assumption that is wrong here.

`addPropertyRow` (`index.html:3842`) clears every `[data-field]` to `''` on a
new row, which selects the None option — the correct default, no change needed.

---

## 5. `calcBenchmarkLine` — new pure function in `engine.js`

Follows `calcLeverageLine`'s precedent exactly: a presentation helper returning
a discriminated `{ show }` object, because its consumer is a renderer, not a
downstream calculation.

```js
calcBenchmarkLine({ depositCashInvested, contractDate, years,
                    benchmarkKey, marginalRate, propertyReturnPct })
  → { show: false }
  | { show: true, benchmarkRoePct, propertyReturnPct, label,
      leverageMultiple, regime, asAt }
```

- Looks the preset up from `BENCHMARK_PRESETS` by key; unknown key → `{ show: false }`.
- Calls the **existing** `calcBenchmark` once, with
  `saleDate = addYearsISO(contractDate, years)`. `calcBenchmark` is **not
  modified**.
- `benchmarkRoePct` is `benchmarkRoe * 100`. `calcBenchmark` returns a
  **fraction** and floors at `-1`, while everything on the cards is a
  percentage — the same units trap UI spec §9 flags for `expectedGrowth`.
  Converting at the engine boundary keeps it in one place.
- `propertyReturnPct` is **received, never recomputed** — it is the figure
  `index.html` already renders as "Annual Cash Return" (`index.html:5067`).
  This is the same discipline that protected the shipped figure when
  `calcLeverageLine` was added, and the smoke guard against rewiring it to
  `calcEquityReturns` applies here too.
- `{ show: false }` when: `depositCashInvested <= 0`; `benchmarkRoe` is `null`
  (which `annualizedReturn` returns when cash ≤ 0 or years ≤ 0); or either
  figure is non-finite — the `NaN%` class of bug from issue #13.
- `cpiRate` and `feeDrag` are left at `calcBenchmark`'s defaults (2.5% and
  0.10%), matching the rest of `index.html`, which passes neither.

**Why it must live in `engine.js`:** `tests/unit.js` is pure Node and can only
reach `engine.js` exports. Logic left inline in `index.html` would be
untestable, and TDD is mandatory on this project.

---

## 6. Copy

UI spec §9's deferred paragraph, used as written, with one structural change
(see below). Per period card, beneath the headline strip:

> The same cash in **VGS** over the same period would have returned about
> **9.2% a year** after tax, with none of the holding costs, tenants, or time.
> Your property returned **11.3%**.

Rendered on the 5-year card of the same property:

> The same cash in **VGS** over the same period would have returned about
> **8.6% a year** after tax, with none of the holding costs, tenants, or time.
> Your property returned **9.2%**.

Both reproduce against the running app on shipped defaults (§3 finding C).
The property figures are the app's own rendered "Annual Cash Return" at one
decimal, not recomputed — 11.27% and 9.22% respectively.

**The leverage fragment moves out of the per-card sentence.** §9's draft ended
"— with nearly M× leverage doing the work", but §9 also rules that the leverage
asymmetry is stated **once**. The multiple is invariant across periods, so
repeating it on three cards is the same padding objection that put the leverage
line on one card. It therefore renders once, in the note below (§7), where it
is visible regardless of which card the reader is looking at — which also
satisfies tax spec §12's requirement for a one-line note on the output.

**Verb neutrality.** "Your property returned X%" renders the sign as-is; at a
negative return the figure carries its own minus sign and the standard
`.negative` colour, matching the leverage line's treatment. No judgment
language, no ranking, no winner — tax spec §11 and §12.

**No comparative clause.** The sentence never says "less than", "more than",
or "beat". It states two rates adjacently and stops. This is the §12 "no
winner" rule and is the single most important copy constraint in the feature.

---

## 7. The note

One line beneath the three period cards, beside the existing
`projections-disclaimer`, rendered only when a benchmark is selected:

> Your property figures are leveraged (~**4.2×** here); the benchmark is not.
> The same 2027 CGT changes apply to shares too — reflected here. VGS returns
> are historical figures as at **July 2026**, before tax — not a forecast.

- Sentence 1 — tax spec §12's required leverage note, carrying the multiple
  once (§6).
- Sentence 2 — UI spec §9's post-2027 clause, gated on the `regime` field
  being `DUAL_ERA` (finding E), not assumed.
- Sentence 3 — `DISCLAIMERS.benchmarkHistorical` (finding D) with the preset's
  own `asAt` month substituted, so staleness is visible to the reader, not
  only to the test suite.

Blanked, not merely hidden, when the selection returns to None — the discipline
the leverage line adopted after review found it stranding stale text
(`index.html:5152-5158`).

---

## 8. `BENCHMARK_PRESETS` — provenance and refreshed HISA

Each preset gains `asAt` and `source`. HISA is corrected 4.5% → **4.8%**
(PO, 2026-07-29).

```js
const BENCHMARK_PRESETS = {
  vas:  { label: 'VAS (Australian shares)',    annualReturn: 0.088,
          asAt: '2026-07-15',
          source: 'Vanguard Australia — VAS ETF performance, retrieved 15 July 2026' },
  vgs:  { label: 'VGS (international shares)', annualReturn: 0.115,
          asAt: '2026-07-15',
          source: 'Vanguard Australia — VGS ETF performance, retrieved 15 July 2026' },
  hisa: { label: 'High-interest savings',      annualReturn: 0.048,
          asAt: '2026-07-29',
          source: 'finder.com.au savings account interest rates, retrieved 29 July 2026' },
};
```

Full URLs go in the code comment above the object, not in `source`, so the
rendered UI never has to carry a URL:

- VAS — `https://www.vanguard.com.au/personal/invest-with-us/etf?portId=8205&tab=performance`
- VGS — `https://www.vanguard.com.au/personal/invest-with-us/etf?portId=8212&tab=performance`
- HISA — `https://www.finder.com.au/savings-accounts/interest-rate`

No existing test pins these **values** — `tests/engine.test.js:778` asserts
only that each preset has a `label` and a numeric `annualReturn` — so the HISA
change breaks nothing. That test is extended to require `asAt` and `source`.

---

## 9. Staleness policy (PO decision, 2026-07-29)

Presets are config that goes stale silently. Chosen policy: **visible as-at
date plus a structural check that fails**.

New check in `.claude/smoke-test.js`: parse each preset's `asAt` and **FAIL**
when any is more than **12 months** older than the current date.

- It will begin failing around **July 2027 by design**. That is the mechanism,
  not a defect: drift becomes a decision someone must make rather than a wrong
  number nobody notices.
- The failure message names the preset, its `asAt` and its `source`.
- Per project convention the check is **verified by deliberately breaking it**
  (back-date a preset, confirm FAIL, restore). A guard never seen to fail is
  not a guard — the lesson from the leverage line's smoke regex, which would
  have passed the exact rewiring it was written to prevent.

---

## 10. Testing (TDD — failing test first)

`tests/unit.js`, against `calcBenchmarkLine`:

1. Known fixture → `benchmarkRoePct` equals `calcBenchmark(...).benchmarkRoe * 100`,
   pinning the units conversion and the sale-date construction.
2. ROE increases strictly with holding period for a fixed fixture — pins
   finding C, so a change to CGT routing cannot silently flatten it. Asserted
   as a direction, not as §3's figures, which are specific to the default
   property rather than to the fixture.
3. `depositCashInvested <= 0` → `{ show: false }`.
4. Unknown / absent `benchmarkKey` → `{ show: false }`.
5. Non-finite `propertyReturnPct` → `{ show: false }` (issue #13's shape).
6. `propertyReturnPct` is returned unchanged — it is passed through, never
   recomputed.
7. `regime` is `DUAL_ERA` for a sale after `BOUNDARY_ISO` and `OLD` before it,
   pinning the gate the note's second sentence depends on.

`tests/engine.test.js`: extend the existing preset-shape test to require a
parseable ISO `asAt` and a non-empty `source` on every preset.

**Regression guard:** assert the shipped "Annual Cash Return" figure is
unchanged by this slice, for all three periods — the same guard the leverage
line carried, for the same reason.

There is no DOM test harness in this project, so markup assembly is covered by
structural checks in `.claude/smoke-test.js` (required IDs pinned — **all**
child IDs, not just the container, per the finding that cost a review round on
the leverage line) plus PO visual review.

---

## 11. Edge cases

| Case | Behaviour |
|---|---|
| Benchmark = None | Nothing renders; cards identical to today |
| `totalUpfront <= 0` (100% LVR) | Line hidden on all three periods |
| Negative property return | Renders with its own sign and `.negative` colour |
| Benchmark ROE null | Line hidden (guards `annualizedReturn`'s null) |
| Property at the −100% floor | Line still renders; it introduces no new figure, and the floor is issue #18's problem |
| Property row copied | Comparator copies with it — it is a `data-field` |

---

## 12. Out of scope

- **DCA contributions.** `calcBenchmark` supports `contributions`; this slice
  is lump-sum only. Modelling holding costs as benchmark contributions is a
  modelling decision, not a display one, and deserves its own issue.
- **The chart overlay** — prototyped and rejected (§2). Not deferred; dropped.
- **Issue #18** — the chart-versus-card annualised-return inconsistency at
  total loss, found during this design and logged separately.
- **Exports** — the benchmark line is absent from PDF/XLSX, as the leverage
  line still is. Consistent, and a separate slice.

---

## 13. Spec amendments on implementation

- **UI spec §9 → v3.0.** Correct the stale worked examples first (finding F):
  the default property is **$550/wk**, not $650/wk, and the leverage line
  renders **11.3%**, not 12.2%. Re-verify every figure in §9 against the
  running app while rewriting — the section asserts they reproduce exactly, so
  a wrong one is a defect, not a typo. Then replace the "Deferred, not dropped (v2.7)" block with
  the implemented benchmark: the per-property control, the per-card copy, the
  leverage fragment's move into the note, the three-period rule and why it
  differs from the leverage line's one-period rule, the note's three sentences
  and their gates, and the staleness policy. Record the chart placement as
  prototyped and rejected, with the 10-property measurement, so it is not
  re-proposed.
- **Tax spec §12** — no change to method. Note that the required side-by-side
  ROE renders on each period card and the required leverage note renders once
  beneath them.
