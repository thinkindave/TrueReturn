# Quarantined Losses — Module Redesign (issue #6)

**Status:** Approved design, 2026-07-24. Supersedes UI spec §4/§4b.
**Tracking:** GitHub issue #6. Builds on branch `feature/reform-ui-wiring`.
**Companion specs:** `specs/truereturn-ui-requirements.md` (v2.6 → to be bumped to v2.7 on implementation), `specs/truereturn-tax-engine-requirements.md` §4. The tax spec is authoritative for all calculation; nothing here changes the engine.

---

## 1. Why this exists

The shipped quarantine module is over-detailed for what it needs to say. It carries a four-channel recovery reconciliation (refunds given up / recovered along the way / recovered at sale / stranded), a residual row, a running pool figure and a two-bullet explainer — most of it inside a collapsed accordion.

PO feedback (issue #6): *"we're giving too much detail here. Essentially, we just want to make clear that, if there was a rental loss, there is a pool that can be claimed at sale. Perhaps even just take the same 5/10/15yr projection approach."*

Two findings from exploring the shipped build reshaped the fix:

**Finding A — the tax-benefit module is already correct, but its explanation is stranded.** Stepping the snapshot year on the default property:

| Snapshot year | Potential Tax Benefit | Correct? |
|---|---|---|
| 1 (FY2026-27) | $7,619/yr | Yes — quarantine only starts for income years beginning on/after 1 July 2027 |
| 2, 3, 5 | $0/yr | Yes — quarantined |
| 10 | −$272/yr | Yes — property turned profitable, tax payable |

So the PO's question ("should we hide the tax-benefit module when quarantine shows?") resolves to **no** — it holds real information in all three states. But the sentence explaining the `$0` renders into `#resQuarantineNote`, which lives in `#quarantineSection`'s **collapsed body — a different section**. A user sees "$0/yr" with no explanation unless they expand something unrelated. (Flagged as a WARNING in the 2b-1 code review; not actioned then.)

**Finding B — the "worth less than a refund" residual is now unreachable.** That case required the pool to offset a *discounted* gain, which needed either affordable housing (removed, issue #5) or a grandfathered pre-2027 discount (removed, issue #4). Today an established property quarantines but gets **no** pre-2027 discount (`heldOver12MonthsAt2027` is false because `contractDate` is always today), so a pooled dollar is worth exactly the marginal rate → residual `R = 0`. At marginal rates below 30% the minimum-tax floor makes it worth slightly *more* (`R < 0`). The `R > 0` branch cannot be reached from the UI.

## 2. The design

**Core move:** split the story so each half sits where the user feels it. The **cost** belongs on the tax-benefit line (annual, in the cash-flow view). The **recovery** belongs in the projections grid. The bespoke module is deleted.

### 2.1 Tax-benefit line — the cost

Keep the module; do **not** hide it. Relocate its explanation to sit with the figure.

- **Quarantined loss year** (quarantine applies AND that year's net rental result is a loss): value renders `$0/yr`, with an adjacent note:
  > "Quarantined: under the old rules this would have been about **$X** back. It's added to your quarantined losses instead, claimable at sale."

  `$X` = that year's loss × marginal rate (the refund the old rules would have produced).
- **Pre-quarantine year** (income year starting before 1 July 2027): unchanged — real benefit figure, no note.
- **Profitable year** (net rental result positive → tax payable, negative "benefit"): unchanged, no note.

The note must render **adjacent to `#resTaxBenefit`**, inside the same section, visible without expanding anything else. `#resQuarantineNote` in its current location is removed.

### 2.2 Projections grid — the recovery

One new row in the existing 5/10/15-year grid, alongside Value / CGT / True Return:

| | 5 yr | 10 yr | 15 yr |
|---|---|---|---|
| **Quarantined losses** | $A | $B | $C |

- Value per period = the quarantine pool accumulated to that period's sale year, i.e. the existing `quarantinePoolAtYear(n)` / `buildEntryQuarantinePool` result. This is the **net** pool — it already accounts for absorption by profitable rental years, so no itemisation of "recovered along the way" is needed.
- Help-tip: "Rental losses that no longer reduce your salary tax. They build up and offset your capital gain when you sell — worth roughly **$V** in tax at your marginal rate."  `$V` = the measured pool benefit at sale (re-run the sale with `quarantinePool: 0` and difference the CGT — do not estimate).
- **Visibility:** the row is shown only when quarantine actually applies AND the pool is greater than zero. Hidden entirely for new builds (NG-exempt) and for properties that never run a loss. Follow the arithmetic, not the dwelling type.

**Why the pool and not the tax value** (PO decision): the row shows the **losses** ($31,958), not what they're worth ($11,825). "Losses" cannot be misread as cash coming back, whereas a "tax saved" row reads as a win. The tax value lives in the tip.

### 2.3 Stranded losses — the one honesty exception

If the pool cannot be fully used at sale (the gain is too small to absorb it), it must **never** be silently swallowed. Surface it as a short note beneath the row, shown **only when greater than zero**:

> "At **10 years**, **$S** of these losses would never be recovered — the sale gain isn't large enough to absorb them."

`S` = `strandedPool` from that period's sale detail. **Stranding is per-period** — a property can strand at 5 years (small gain) but not at 15 (larger gain), so a single figure would be wrong. Show one note beneath the row, rendered when **any** displayed period has `strandedPool > 0`, naming each affected period and its amount (comma-separated if more than one). Do not add a second grid row.

### 2.4 Deleted

The entire `#quarantineSection` and everything only it used:
- the always-visible header (pool figure, "Refunds Given Up", the recovery headline `#resQuarantineNet`)
- the four-row reconciliation: `#resRefundsForegone`, `#resRecoveredAlongWay`, `#resPoolBenefit`, the pool row, `#resStrandedRow`/`#resStrandedLosses`
  — note these are the **display elements**. The underlying calculations for the pool benefit (`V`, §2.2's tip) and the stranded amount (`S`, §2.3) are **retained** and re-used; only their old rows are removed.
- the residual row `#resQuarantineResidual` and its label/tip/value spans (unreachable per Finding B)
- the "Later" / "Only maybe" explainer bullets
- `#resQuarantineNote` in its current location (replaced by §2.1's adjacent note)
- their CSS, their entries in `.claude/smoke-test.js`'s required-ids list, and any now-dead JS.

The **engine is untouched** — `buildQuarantineSchedule`, `applyOffsets`, the pool arithmetic and their tests all stay. This is a presentation change only.

## 3. The non-negotiable constraint

**The pool row is only honest because the cost lives on the tax-benefit line.**

The deleted reconciliation existed for a real reason: shown alone, the pool makes the reform look like a **benefit**, because quarantine *lowers* your CGT. During 2b-1 this produced a module that reported quarantined CGT as lower than grandfathered CGT with no counterweight — a genuine "this looks good for you" misread of a change that costs the investor money.

Therefore:
- §2.1's note is **required**, not optional polish. If it is ever removed, weakened, or hidden behind an expander, the pool row becomes misleading and must be removed with it.
- Any future change that hides the tax-benefit module when quarantine applies must first relocate the cost signal somewhere equally visible.

This is a rule, not a comment. It belongs in the UI spec alongside the row.

## 4. Copy rules

Inherits UI spec §5/§6 unchanged: sentence case, no advice or imperative framing, no judgment verbs, no decision-question titles. Every jargon term ("quarantined losses") carries a one-sentence help-tip. Figures use the app's existing currency conventions; negatives render as real negatives.

## 5. Testing

**Engine (`tests/engine.test.js`)** — no new engine behaviour, but pin the two premises the UI now relies on, if not already covered:
- the pool at year N equals `buildQuarantineSchedule`'s accumulated-and-absorbed figure (the row's value)
- the measured pool benefit `V` equals CGT-without-pool minus CGT-with-pool (the tip's value)

**Structural (`.claude/smoke-test.js`)** — required-ids list drops every deleted id and gains the new row's ids.

**Browser verification** (screenshots return black frames in this environment — verify by DOM read):
1. Established, default growth: the row shows a rising pool across 5/10/15yr; tax-benefit note renders adjacent to `#resTaxBenefit` and is visible without expanding anything; no `#quarantineSection` in the DOM.
2. Snapshot year 1: tax benefit shows a real figure with no note. Year 3: `$0/yr` with the note. A profitable year: negative figure, no note.
3. New build: the row is hidden entirely.
4. A low/negative-growth case where the gain cannot absorb the pool: the stranded note appears with a non-zero figure.
5. No console errors, no NaN.

## 6. Out of scope

- Any engine change.
- The reform banner (issue #10) and minimum-tax footnote (issue #11) — separate queued decisions.
- Help-tip keyboard accessibility (issue #12) — pre-existing and project-wide.
