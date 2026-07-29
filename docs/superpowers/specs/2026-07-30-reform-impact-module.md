# Design — the 2027 reform impact module (issue #17)

**Date:** 2026-07-30
**Status:** awaiting PO review
**Issue:** #17 (split out of #14; the opportunity-cost benchmark shipped there
and is closed)
**Implements:** UI spec §3a, with two documented deviations (§6 below).
Amends UI spec §3a to v3.1.

---

## 1. What this builds

A contextual module on each of the three projection period cards (5, 10, 15
years), stating what the 2026–27 reform does to the **tax** on the user's own
modelled property: the same sale, the same growth, the same holding costs,
priced under the old rules beside the new ones.

Collapsed, it is one sentence. Expanded, it is a two-column table.

`calcReformSale`, `calcOldRegimeCGT` and `buildQuarantineSchedule` already
exist in `engine.js` and are tested. This adds one pure helper that composes
them, plus presentation.

---

## 2. The measurement that reshaped the spec

§3a as written leads the collapsed sentence with the **CGT-only** delta (tax
spec §7 output 2). Measured on the shipped build — default property,
established, contract date today, MTR 37%, `truereturn_state` cleared, probe
figures cross-checked against the rendered `#proj5CGT` / `#projLifeCGT`:

| | 5yr | 10yr | 15yr |
|---|---|---|---|
| CGT, new rules | $25,025 | $100,155 | $239,505 |
| CGT, old rules | $37,082 | $95,514 | $171,802 |
| **CGT-only delta** | **−$12,057** | +$4,641 | +$67,703 |

**At 5 years the CGT-only delta is negative**: shipped as specified, the
5-year card would read *"the 2027 tax changes saved you $12,057"* while the
15-year card of the same property read *"cost you $67,703"*.

It is not a rounding artefact and it is not wrong arithmetic — the quarantine
pool ($62,780 at 5 years) offsets a gain that is still small, by more than the
lost 50% discount costs. It is only a *saving* because the refunds the old
rules would have paid annually are absent from the number. This is precisely
the failure UI spec §4 already documents for the pool in isolation — "a CGT
figure shown by itself makes quarantine look like a **benefit**" — and §3a
walks into it from the other direction.

**Refunds are not zero under the new rules.** Quarantine applies only to income
years starting on/after 1 July 2027, so ~11 months of losses stay deductible
under both rulebooks: $7,619 on the default property, identical on both sides.
The old-rules column additionally receives the refunds that are quarantined
after the boundary.

Counting both channels:

| | 5yr | 10yr | 15yr |
|---|---|---|---|
| Total tax, old rules | $6,235 | $55,362 | $131,651 |
| Total tax, new rules | $17,406 | $92,536 | $231,886 |
| **Total-tax delta** | **+$11,171** | **+$37,174** | **+$100,235** |

Correct sign at every period, and the growth over time is the most informative
thing the module has to say.

---

## 3. What the module measures

**Total tax on this property over the holding period, under each rulebook.**

```
totalTax = CGT at sale − negative-gearing refunds received along the way
```

Old rules: 50% discount on the whole gain, no quarantine pool, every loss year
deductible.
New rules: the engine's routed CGT (dual-era or best-of), pool applied, losses
deductible only up to 30 June 2027.

Deliberately **not** a net-outcome or total-profit comparison. The card's
`cumulativeCashFlow` (index.html:5137) is pre-tax on both sides — it has never
counted refunds — so no shipped figure a "net outcome" row could agree with
exists. Staying in tax space means the module cannot contradict the profit
figures already on the card.

---

## 4. Placement

A new always-visible `.proj-line` on each period card, below the deemed-value
sensitivity band, the CGT-treatment line and the benchmark line, above the
collapsed `period-body` sections.

Same family as the sensitivity band and the benchmark line, which is the
precedent set by §3 (band may not be hidden behind a toggle) and by #14. It is
specifically **not** placed inside the collapsed *Cash Out Position* section: a
reader who never opens that drawer would never learn the reform moved their
number.

All three cards, not the 15-year card alone. The leverage line's single-card
treatment is the wrong precedent here — the compounding from $11k to $100k is
the substance.

---

## 5. Copy and states

### Collapsed (default)

One sentence, verb swapping on sign, with a `see how` expander:

> The 2027 tax changes **add $11,171** to the tax on this property over 5 years. *see how*

> The 2027 tax changes **reduce** the tax on this property by **$15,354** over 15 years. *see how*

**The negative arm is measured, not hypothetical.** Sweeping `expectedGrowth`
on the default property in the shipped build (simple mode, MTR pinned to
`SIMPLE_MODE_TAX` = 0.37):

| growth | 5yr | 10yr | 15yr |
|---|---|---|---|
| 0% | +$31,039 | +$62,371 | +$84,943 |
| 2% | +$18,809 | +$27,025 | +$22,250 |
| **3%** | +$11,089 | +$7,085 | **−$15,354** |
| 4% | +$3,077 | +$1,776 | +$14,597 |
| 6% (default) | +$11,171 | +$37,174 | +$100,235 |

At 3% growth over 15 years the indexed post-2027 cost base outruns the gain,
so the reform genuinely leaves this property better off. The delta is also
**not monotonic in growth** — it dips near 4% and climbs steeply after — so no
"the longer you hold, the worse it gets" copy may be written anywhere in the
module. The sentence states the measured figure and nothing more.

Note the tax rate cannot be varied in the default (simple) mode: the visible
`#marginalTaxRateSelect` is inert there by design, and `calculate()` reads
`SIMPLE_MODE_TAX`. Advanced mode is where MTR moves.

A single neutral noun phrase for both signs ("account for $X") was rejected —
that is the wording that concealed the sign problem in §2.

### Expanded

Two columns, nothing ranked, nothing selectable, no colour judgment
(15-year card shown):

```
                                          Old rules    New rules
Capital gains tax at sale                   $171,802     $239,505
   gain to 30 Jun 2027 (50% discount)              —           $0
   gain after 30 Jun 2027 (indexed)                —     $239,505
Negative-gearing refunds along the way      −$40,152      −$7,619
──────────────────────────────────────────────────────────────────
Total tax over 15 years                     $131,651     $231,886
```

The dual-era sub-rows are **tax**, not gain, and appear on the new-rules side
only — the old rules have no era split. On the default property the pre-2027
component reads $0 because the pool consumes the whole $17,497 pre-boundary
gain. That is surprising and correct, and it is the clearest available
demonstration of where the pool actually goes.

Below the table, when a pool exists at sale, one note:

> The $31,958 still pooled at sale is already used up in the tax line above.

Negative results render as real negatives per §3a / tax spec §13 — never
blanked, clamped, or shown as $0.

---

## 6. Deviations from §3a as written

1. **Headline is the total-tax delta, not the CGT-only delta.** §2 above.
   §3a's own trigger sentence — shown only when the outcome "actually
   differs" — is honoured better by a number whose sign is right.

2. **No separate quarantine-treatment row.** §3a itemises one. It would
   double-count: the quarantine difference *is* the refunds row, and the
   pool's value at sale *is* already inside the new-rules CGT figure. Carried
   as the plain note under the table instead, which is §4's reconciliation
   discipline applied here.

3. **No duplicate deemed-value sensitivity band.** §3a asks for the band on
   the new-rules figure. It is already visible two lines above on the same
   card. §3 requires the band be visible wherever a dual-era figure is shown,
   not that it be shown twice.

Framing rules from §3a and §5 are unchanged and binding: no question-mark
titles, no imperative verbs, neither side ranked, no winner badge, no colour
judgment, no sale-timing dimension anywhere.

---

## 7. Trigger

Hide the entire module when `|totalTaxDelta| < $1`.

Gate on the arithmetic, never on `dwellingType` — the same rule §3 v2.6
adopted for the degenerate sensitivity band, for the same reason: it stays
correct if the winning CGT option changes.

**New builds land at exactly $0 and hide themselves.** Measured, all three
periods:

| | 5yr | 10yr | 15yr |
|---|---|---|---|
| New-rules CGT (best of) | $37,082 | $95,514 | $171,802 |
| Old-rules CGT | $37,082 | $95,514 | $171,802 |
| Delta | $0 | $0 | $0 |

New builds keep full negative gearing (`ng === 'FULL'`) and may elect the 50%
discount on the whole gain — Option A wins at every period, and Option A *is*
the old-rules calculation. The reform genuinely does nothing to them. No
special case is needed to express this.

---

## 8. Code shape

Per CLAUDE.md's split, the calculation goes in `engine.js` and only rendering
goes in `index.html`. Same pattern as `calcLeverageLine` and
`calcBenchmarkLine`.

**New pure helper** `calcReformImpact({ saleArgs, quarantineRows, years, marginalRate })`
in `engine.js`, returning:

```js
{
  show,                  // |delta| >= 1
  delta,                 // newTotalTax − oldTotalTax; signed
  oldCGT, newCGT,
  oldRefunds, newRefunds,
  oldTotalTax, newTotalTax,
  split: { taxOnPre, taxOnPost } | null,   // new-rules side; null on OLD route
  pooledAtSale,          // for the note; 0 when no pool
}
```

It composes existing tested pieces — `calcReformSale` for the new-rules side,
`calcOldRegimeCGT` with `quarantinePool: 0` for the old-rules side, and the
`quarantineRows` the UI already builds for the refund sums. It performs no DOM
access and takes no dates it is not given.

**`index.html`** gains one `.proj-line` block per period card plus an expander,
populated in the existing per-period loop where `saleArgs` and
`quarantineSched` are already in scope. Populate before unhiding and blank on
hide, matching the sensitivity band, stranded note and leverage line.

**Tests** go in `tests/engine.test.js`, TDD, failing first. Required cases:

- the 5-year sign inversion — CGT-only delta negative, total-tax delta positive
- all three periods on the default property, against the figures in §2
- new build → `show === false`, delta exactly 0, all three periods
- a negative total-tax delta renders its own arm — 3% growth, 15 years,
  MTR 0.37 → −$15,354 (§5)
- refunds identical on both sides for pre-boundary years
- `split` is `null` on an OLD-route sale

---

## 9. Out of scope

- No sale-timing dimension. `compareSaleTiming` and the breakeven solver remain
  engine-only, per §3a and tax spec §7's presentation note.
- No expand/collapse persistence. `serializeState` iterates a hardcoded field
  array (index.html ~3960/~3974); the module's open state is transient, like
  the existing accordion sections.
- No change to any figure currently on the card. The module reads; it never
  feeds back into Cash Out, Total Profit or Annual Cash Return.
