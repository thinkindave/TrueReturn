# Opportunity-Cost Benchmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-property VAS/VGS/HISA selector that renders an after-tax opportunity-cost comparison line on each of the three projection period cards, plus a single note carrying the leverage asymmetry and the presets' as-at date.

**Architecture:** One new pure function in `engine.js` (`calcBenchmarkLine`) wrapping the existing, already-tested `calcBenchmark`. It returns a discriminated `{ show }` object because its consumer is a renderer, following `calcLeverageLine`'s precedent. The property's return figure is **passed in, never recomputed**, so the shipped "Annual Cash Return" cannot move. `index.html` gains a `data-field="benchmark"` select, three benchmark lines, one note, and render wiring inside the existing period loop at `index.html:4838`.

**Tech Stack:** Vanilla HTML/CSS/JS. No build system, no npm. `engine.js` is DOM-free and `require()`-able by Node tests. Tests use `tests/harness.js` (`test`, `assert`, `approxEqual`, `summary`). Entry point: `node .claude/smoke-test.js`.

**Design doc:** `docs/superpowers/specs/2026-07-29-opportunity-cost-benchmark.md` (commit `21fdba4`).

**Branch:** `feature/opportunity-cost-benchmark` (already created, design doc committed).

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `engine.js` | Pure calculation + presentation helpers. No DOM. | Add `asAt`/`source` to `BENCHMARK_PRESETS`, correct HISA to 4.8%, add `calcBenchmarkLine`, export it |
| `index.html` | Markup, CSS, DOM wiring | Add the select, 3 benchmark lines, 1 note, CSS, render wiring, 2 serialisation array entries |
| `tests/unit.js` | Pure-helper tests | Add `calcBenchmarkLine` suite |
| `tests/engine.test.js` | Reform tax engine tests | Extend the preset-shape test to require `asAt`/`source` |
| `.claude/smoke-test.js` | Structural checks | Add required IDs, `benchmark` data-field, preset-freshness check |
| `specs/truereturn-ui-requirements.md` | UI spec | §9 → v3.0; correct the stale worked figures |

**IMPORTANT for every task:** never `cd` in a Bash call. Use `git -C /Users/thinkindave/Claude/TrueReturn <cmd>` and absolute paths. Compound commands joined with `&&` trigger permission prompts — run one command per call.

---

## Task 1: Preset provenance and the HISA correction

**Files:**
- Modify: `engine.js:753-759`
- Test: `tests/engine.test.js:778-790`

- [ ] **Step 1: Write the failing test**

Replace the existing `benchmark presets exist as config with the disclaimer flag` test in `tests/engine.test.js` (currently at line 778) with:

```js
test('benchmark presets exist as config with provenance and the disclaimer flag', () => {
  for (const key of ['vas', 'vgs', 'hisa']) {
    const p = E.BENCHMARK_PRESETS[key];
    assert(p && typeof p.annualReturn === 'number' && p.label,
      `preset ${key} must be config with label + annualReturn`);
    // Provenance (issue #14): these are historical figures that go stale.
    // The smoke test fails when asAt is over 12 months old, so both fields
    // must exist and asAt must be a parseable ISO date.
    assert(typeof p.asAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.asAt),
      `preset ${key} must carry an ISO asAt date, got ${JSON.stringify(p.asAt)}`);
    assert(!isNaN(new Date(p.asAt + 'T00:00:00Z').getTime()),
      `preset ${key}.asAt must be a real date, got ${p.asAt}`);
    assert(typeof p.source === 'string' && p.source.length > 0,
      `preset ${key} must record a non-empty source`);
  }
  const r = E.calcBenchmark({
    depositCashInvested: 100000,
    contractDate: '2020-01-01', saleDate: '2025-01-01',
    benchmarkReturn: E.BENCHMARK_PRESETS.vas.annualReturn, marginalRate: 0.39,
  });
  assert.strictEqual(r.flags.historicalNotForecast, true);
});

test('HISA preset carries the refreshed 4.8% rate', () => {
  approxEqual(E.BENCHMARK_PRESETS.hisa.annualReturn, 0.048, 1e-9);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node /Users/thinkindave/Claude/TrueReturn/tests/engine.test.js`

Expected: FAIL — `preset vas must carry an ISO asAt date, got undefined`, and the HISA test fails with `Expected ~0.048 but got 0.045`.

- [ ] **Step 3: Update the presets**

In `engine.js`, replace lines 753-759 (the comment block ending `(figures as at July 2026; update from source when refreshed).` and the `BENCHMARK_PRESETS` object) with:

```js
// Preset values are CONFIG — historical, before tax, not a forecast.
// Each carries its own `asAt` and `source`: .claude/smoke-test.js FAILS when
// any asAt is more than 12 months old, so drift becomes a decision someone
// has to make rather than a wrong number nobody notices. When refreshing,
// update BOTH annualReturn and asAt, and re-check the source URL below.
//   VAS  — https://www.vanguard.com.au/personal/invest-with-us/etf?portId=8205&tab=performance
//   VGS  — https://www.vanguard.com.au/personal/invest-with-us/etf?portId=8212&tab=performance
//   HISA — https://www.finder.com.au/savings-accounts/interest-rate
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `node /Users/thinkindave/Claude/TrueReturn/tests/engine.test.js`

Expected: PASS, `117 passed, 0 failed` (one more than the previous 116).

- [ ] **Step 5: Commit**

```bash
git -C /Users/thinkindave/Claude/TrueReturn add engine.js tests/engine.test.js
```

```bash
git -C /Users/thinkindave/Claude/TrueReturn commit -m 'feat: benchmark preset provenance; HISA to 4.8% (#14)

Each preset now records asAt and source. The smoke test (Task 5) fails when
any asAt is over 12 months old, so the figures cannot go stale silently.

HISA moves 4.5% -> 4.8% per the current finder.com.au rate. No test pinned
the preset values previously, only their shape, so nothing else moves.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>'
```

---

## Task 2: `calcBenchmarkLine` in the engine

**Files:**
- Modify: `engine.js` (add function after `calcBenchmark`, which ends at line 809; and add to `module.exports` at line 930)
- Test: `tests/unit.js` (append a new section at the end, before the final `summary()` call)

- [ ] **Step 1: Write the failing tests**

First, update the require line at the top of `tests/unit.js` (line 6) to pull in the new function and its dependencies:

```js
const { formatCurrency, calcStampDuty, calcDepreciation, stateDefaults, calcLeverageLine,
        calcBenchmarkLine, calcBenchmark, BENCHMARK_PRESETS, addYearsISO } = require('../engine.js');
```

Then append this section to `tests/unit.js`, immediately **before** the closing `summary();` call:

```js
// ---------------------------------------------------------------------------
// calcBenchmarkLine tests (UI spec §9 v3.0, issue #14)
// ---------------------------------------------------------------------------

console.log('\ncalcBenchmarkLine');

// Shared fixture: the shipped default property's cash base and marginal rate.
// Frozen so a future mutation fails loudly here rather than breaking sibling
// tests order-dependently — same discipline as LEVERAGE_BASE_INPUT above.
const BENCHMARK_BASE_INPUT = Object.freeze({
  depositCashInvested: 154575,
  contractDate: '2026-07-29',
  years: 15,
  benchmarkKey: 'vgs',
  marginalRate: 0.37,
  propertyReturnPct: 11.27,
  purchasePrice: 650000,
});

test('returns the benchmark ROE as a percentage, matching calcBenchmark', () => {
  const r = calcBenchmarkLine(BENCHMARK_BASE_INPUT);
  assert.strictEqual(r.show, true);
  const direct = calcBenchmark({
    depositCashInvested: BENCHMARK_BASE_INPUT.depositCashInvested,
    contractDate: BENCHMARK_BASE_INPUT.contractDate,
    saleDate: addYearsISO(BENCHMARK_BASE_INPUT.contractDate, 15),
    benchmarkReturn: BENCHMARK_PRESETS.vgs.annualReturn,
    marginalRate: BENCHMARK_BASE_INPUT.marginalRate,
  });
  // calcBenchmark returns a FRACTION; the line must expose a PERCENTAGE.
  approxEqual(r.benchmarkRoePct, direct.benchmarkRoe * 100, 1e-9);
});

test('passes the supplied property return through untouched', () => {
  const r = calcBenchmarkLine(BENCHMARK_BASE_INPUT);
  // Pinning pass-through: recomputing this figure would move the shipped
  // "Annual Cash Return" for every existing user.
  assert.strictEqual(r.propertyReturnPct, 11.27);
});

test('benchmark ROE rises with holding period (deferred CGT)', () => {
  const y5  = calcBenchmarkLine({ ...BENCHMARK_BASE_INPUT, years: 5 });
  const y10 = calcBenchmarkLine({ ...BENCHMARK_BASE_INPUT, years: 10 });
  const y15 = calcBenchmarkLine({ ...BENCHMARK_BASE_INPUT, years: 15 });
  // CGT is paid once at sale, so a longer hold defers it and the annualised
  // after-tax return climbs toward the gross. This is WHY the line renders on
  // all three period cards rather than the 15-year card alone.
  assert(y5.benchmarkRoePct < y10.benchmarkRoePct,
    `expected 5y (${y5.benchmarkRoePct}) < 10y (${y10.benchmarkRoePct})`);
  assert(y10.benchmarkRoePct < y15.benchmarkRoePct,
    `expected 10y (${y10.benchmarkRoePct}) < 15y (${y15.benchmarkRoePct})`);
});

test('exposes a short label with the parenthetical stripped', () => {
  const r = calcBenchmarkLine(BENCHMARK_BASE_INPUT);
  assert.strictEqual(r.shortLabel, 'VGS');
});

test('short label leaves a preset with no parenthetical alone', () => {
  const r = calcBenchmarkLine({ ...BENCHMARK_BASE_INPUT, benchmarkKey: 'hisa' });
  assert.strictEqual(r.shortLabel, 'High-interest savings');
});

test('exposes the as-at month for display', () => {
  const r = calcBenchmarkLine(BENCHMARK_BASE_INPUT);
  assert.strictEqual(r.asAtLabel, 'July 2026');
});

test('leverage multiple agrees with calcLeverageLine on the same inputs', () => {
  const b = calcBenchmarkLine(BENCHMARK_BASE_INPUT);
  const l = calcLeverageLine({
    purchasePrice: 650000, totalUpfront: 154575,
    expectedGrowth: 0.06, annualisedReturn: 11.27,
  });
  // Both are purchasePrice / cash-invested. If these ever diverge, the note
  // and the leverage line would print different multiples for one property.
  approxEqual(b.leverageMultiple, l.leverageMultiple, 1e-9);
});

test('regime is DUAL_ERA for a sale after the 2027 boundary', () => {
  const r = calcBenchmarkLine(BENCHMARK_BASE_INPUT);
  assert.strictEqual(r.regime, 'DUAL_ERA');
});

test('regime is OLD for a sale before the 2027 boundary', () => {
  const r = calcBenchmarkLine({
    ...BENCHMARK_BASE_INPUT, contractDate: '2020-01-01', years: 5,
  });
  // Gates the note's "2027 CGT changes apply to shares too" sentence. It is
  // read off the arithmetic, never assumed from the contract date.
  assert.strictEqual(r.regime, 'OLD');
});

test('hidden when no benchmark key is selected', () => {
  assert.strictEqual(calcBenchmarkLine({ ...BENCHMARK_BASE_INPUT, benchmarkKey: '' }).show, false);
});

test('hidden for an unknown benchmark key', () => {
  assert.strictEqual(calcBenchmarkLine({ ...BENCHMARK_BASE_INPUT, benchmarkKey: 'btc' }).show, false);
});

test('hidden when cash invested is zero or negative', () => {
  assert.strictEqual(calcBenchmarkLine({ ...BENCHMARK_BASE_INPUT, depositCashInvested: 0 }).show, false);
  assert.strictEqual(calcBenchmarkLine({ ...BENCHMARK_BASE_INPUT, depositCashInvested: -1 }).show, false);
});

test('hidden when years is zero', () => {
  assert.strictEqual(calcBenchmarkLine({ ...BENCHMARK_BASE_INPUT, years: 0 }).show, false);
});

test('hidden when the property return is not finite', () => {
  // Issue #13's shape: NaN sailing through into a "NaN%" render.
  assert.strictEqual(calcBenchmarkLine({ ...BENCHMARK_BASE_INPUT, propertyReturnPct: NaN }).show, false);
  assert.strictEqual(calcBenchmarkLine({ ...BENCHMARK_BASE_INPUT, propertyReturnPct: null }).show, false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node /Users/thinkindave/Claude/TrueReturn/tests/unit.js`

Expected: FAIL — every new test errors with `calcBenchmarkLine is not a function`.

- [ ] **Step 3: Implement `calcBenchmarkLine`**

In `engine.js`, insert immediately after `calcBenchmark`'s closing brace (line 809) and before the `// ── Required disclaimers (spec §10)` comment:

```js
// ── Opportunity-cost benchmark line (UI spec §9 v3.0, issue #14) ─────────
// Presentation helper for the benchmark line on each projection period card.
// Like calcLeverageLine it returns a discriminated { show } object rather than
// the engine's usual null-on-inapplicable, because its consumer is a renderer,
// not a downstream calculation. Don't copy this shape into a calculation
// helper, and don't revert it to null here.
//
// propertyReturnPct is RECEIVED, never recomputed. It is the figure index.html
// already renders as "Annual Cash Return" (index.html:5067). engine.js also
// exposes calcEquityReturns, which computes a similar-looking figure but folds
// principalRepaid into its base — rewiring to that would move a shipped number
// for every existing user. The structural check in .claude/smoke-test.js pins
// this; the same guard exists for calcLeverageLine and for the same reason.
//
// The line renders on ALL THREE periods, unlike the leverage line. Leverage is
// fixed at purchase and identical across periods, so repeating it read as
// padding; the benchmark's after-tax return is NOT — CGT is paid once at sale,
// so a longer hold defers it and the annualised return climbs toward the gross.
const BENCHMARK_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function calcBenchmarkLine({ depositCashInvested, contractDate, years,
                             benchmarkKey, marginalRate, propertyReturnPct,
                             purchasePrice }) {
  const preset = BENCHMARK_PRESETS[benchmarkKey];
  if (!preset) return { show: false };
  if (!(depositCashInvested > 0) || !(years > 0)) return { show: false };
  // Guards NaN (issue #13's shape) and null, which annualizedReturn returns
  // when cash <= 0 — null would otherwise render as a silently wrong "0.0".
  if (!Number.isFinite(propertyReturnPct)) return { show: false };

  const b = calcBenchmark({
    depositCashInvested, contractDate,
    saleDate: addYearsISO(contractDate, years),
    benchmarkReturn: preset.annualReturn,
    marginalRate,
  });
  if (!Number.isFinite(b.benchmarkRoe)) return { show: false };

  // asAt is 'YYYY-MM-DD'; parsed by field rather than via Date so the label
  // cannot shift a month across timezones.
  const [asAtYear, asAtMonth] = String(preset.asAt || '').split('-');
  const asAtLabel = (BENCHMARK_MONTHS[Number(asAtMonth) - 1] && asAtYear)
    ? `${BENCHMARK_MONTHS[Number(asAtMonth) - 1]} ${asAtYear}`
    : '';

  return {
    show: true,
    label: preset.label,
    // 'VGS (international shares)' -> 'VGS'; a preset with no parenthetical
    // is left alone. The copy reads "The same cash in VGS over the same
    // period", where the full label would be unwieldy mid-sentence.
    shortLabel: preset.label.replace(/\s*\(.*\)\s*$/, ''),
    asAt: preset.asAt,
    asAtLabel,
    benchmarkRoePct: b.benchmarkRoe * 100,
    propertyReturnPct,
    // Same definition as calcLeverageLine's leverageMultiple — pinned by a
    // unit test so the note and the leverage line cannot print different
    // multiples for one property.
    leverageMultiple: purchasePrice > 0 ? purchasePrice / depositCashInvested : null,
    regime: b.regime,
  };
}
```

- [ ] **Step 4: Export it**

In `engine.js`, change the `module.exports` line 930 from:

```js
    calcBenchmark, BENCHMARK_PRESETS,
```

to:

```js
    calcBenchmark, BENCHMARK_PRESETS, calcBenchmarkLine,
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node /Users/thinkindave/Claude/TrueReturn/tests/unit.js`

Expected: PASS, `245 passed, 0 failed` (231 existing + 14 new).

- [ ] **Step 6: Commit**

```bash
git -C /Users/thinkindave/Claude/TrueReturn add engine.js tests/unit.js
```

```bash
git -C /Users/thinkindave/Claude/TrueReturn commit -m 'feat: calcBenchmarkLine engine helper (#14)

Wraps the existing calcBenchmark for the projection-card benchmark line.
Returns a discriminated { show } object following calcLeverageLine.

The property return is passed in and returned untouched, never recomputed --
a test pins the pass-through, and Task 5 adds the structural guard against
rewiring it to calcEquityReturns.

A test pins that the benchmark ROE rises with holding period, which is the
reason the line renders on all three period cards rather than 15-year only.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>'
```

---

## Task 3: Markup and CSS

**Files:**
- Modify: `index.html` — CSS after line 570; select after line 2923; benchmark lines after 3209 / (proj10 equivalent) / 3501-3502; note after 3624

- [ ] **Step 1: Add the CSS**

In `index.html`, immediately after the `.leverage-line strong.negative` rule (line 570), add:

```css
    /* Benchmark line — all three projection cards (UI spec §9 v3.0, #14) */
    .benchmark-line {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      line-height: 1.5;
      margin: 0.5rem 0 0.375rem;
    }
    .benchmark-line strong {
      color: var(--text-primary);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .benchmark-line strong.negative { color: var(--negative); }
    .benchmark-note {
      font-size: 0.75rem;
      color: var(--text-secondary);
      line-height: 1.5;
      margin: 0.75rem 0 0;
    }
    .benchmark-note strong {
      color: var(--text-primary);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
```

- [ ] **Step 2: Add the selector to the property row**

In `index.html`, immediately after the `Age / type` `prop-col` div closes (line 2924) and **before** `<input type="hidden" data-field="marginalTaxRate" ...>` (line 2925), add:

```html
                <div class="prop-col advanced-only" data-label="Compare with">
                  <select data-field="benchmark">
                    <option value="" selected>None</option>
                    <option value="vas">VAS (Australian shares)</option>
                    <option value="vgs">VGS (international shares)</option>
                    <option value="hisa">High-interest savings</option>
                  </select>
                </div>
```

- [ ] **Step 3: Add the benchmark line to all three period cards**

The line goes immediately **after** each period's `CgtTreatment` div closes and, on the 15-year card, **after** the leverage line. Reading order: figures → caveats → explanation → comparison.

For the **5-year** card, after the `proj5CgtTreatment` block closes (the `</div>` following line 3211), add:

```html
          <div class="proj-line benchmark-line" id="proj5Benchmark" hidden>
            The same cash in <strong id="proj5BenchmarkName"></strong> over the same period would have returned about <strong id="proj5BenchmarkRoe"></strong> a year after tax, with none of the holding costs, tenants, or time. Your property returned <strong id="proj5BenchmarkPropertyRoe"></strong>.
          </div>
```

For the **10-year** card, after its `proj10CgtTreatment` block closes, add the identical block with `proj10` substituted for `proj5` in all four IDs:

```html
          <div class="proj-line benchmark-line" id="proj10Benchmark" hidden>
            The same cash in <strong id="proj10BenchmarkName"></strong> over the same period would have returned about <strong id="proj10BenchmarkRoe"></strong> a year after tax, with none of the holding costs, tenants, or time. Your property returned <strong id="proj10BenchmarkPropertyRoe"></strong>.
          </div>
```

For the **15-year** card, after the `projLifeLeverage` div closes (the `</div>` following line 3502), add:

```html
          <div class="proj-line benchmark-line" id="projLifeBenchmark" hidden>
            The same cash in <strong id="projLifeBenchmarkName"></strong> over the same period would have returned about <strong id="projLifeBenchmarkRoe"></strong> a year after tax, with none of the holding costs, tenants, or time. Your property returned <strong id="projLifeBenchmarkPropertyRoe"></strong>.
          </div>
```

- [ ] **Step 4: Add the note beneath the period cards**

In `index.html`, immediately after the `minTaxFootnote` paragraph (line 3625) and before the closing `</div>` on line 3626, add:

```html
      <p class="benchmark-note" id="benchmarkNote" hidden>Your property figures are leveraged (~<strong id="benchmarkNoteLeverage"></strong> here); the benchmark is not.<span id="benchmarkNoteRegime"> The same 2027 CGT changes apply to shares too — reflected here.</span> <span id="benchmarkNoteName"></span> returns are historical figures as at <strong id="benchmarkNoteAsAt"></strong>, before tax — not a forecast.</p>
```

- [ ] **Step 5: Verify the markup parses and no IDs are duplicated**

Run: `node -e "const h=require('fs').readFileSync('/Users/thinkindave/Claude/TrueReturn/index.html','utf8');const m=h.match(/id=\"[^\"]+\"/g);const s=new Set();const d=[];m.forEach(x=>{if(s.has(x))d.push(x);s.add(x)});console.log(d.length?'DUPLICATE IDS: '+d.join(', '):'No duplicate IDs ('+s.size+' unique)')"`

Expected: `No duplicate IDs (...)`.

- [ ] **Step 6: Commit**

```bash
git -C /Users/thinkindave/Claude/TrueReturn add index.html
```

```bash
git -C /Users/thinkindave/Claude/TrueReturn commit -m 'feat: benchmark line markup and CSS (#14)

Per-property selector, one benchmark line on each of the three period cards,
and a single note beneath them carrying the leverage asymmetry, the 2027 CGT
clause and the presets as-at date.

The leverage multiple lives in the note rather than in each card sentence:
UI spec section 9 rules the asymmetry is stated once, and the multiple is
invariant across periods, so repeating it three times is the same padding
objection that put the leverage line on a single card.

Markup only -- no render wiring yet, so every element stays hidden.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>'
```

---

## Task 4: Render wiring and persistence

**Files:**
- Modify: `index.html` — render block inside the period loop (after the leverage line block ending at line 5160); `serializeState` line 3960; `deserializeState` line 3974

- [ ] **Step 1: Add `'benchmark'` to both serialisation arrays**

`serializeState` and `deserializeState` iterate a **hardcoded** field-name list, not `[data-field]` generally — without this the selection is silently dropped on reload.

In `index.html` line 3960, change:

```js
          ['name','purchasePrice','depositPct','loanType','loanTerm','state','interestRate','managementFee','weeklyRent','expectedGrowth','propertyAge','marginalTaxRate'].forEach(function(f) {
```

to:

```js
          ['name','purchasePrice','depositPct','loanType','loanTerm','state','interestRate','managementFee','weeklyRent','expectedGrowth','propertyAge','marginalTaxRate','benchmark'].forEach(function(f) {
```

In `index.html` line 3974, change:

```js
      var fields = ['name','purchasePrice','depositPct','loanType','loanTerm','state','interestRate','managementFee','weeklyRent','expectedGrowth','propertyAge','marginalTaxRate'];
```

to:

```js
      var fields = ['name','purchasePrice','depositPct','loanType','loanTerm','state','interestRate','managementFee','weeklyRent','expectedGrowth','propertyAge','marginalTaxRate','benchmark'];
```

- [ ] **Step 2: Add the render block**

In `index.html`, immediately after the leverage-line block's closing `}` (line 5160, the end of `if (leverageEl) { ... }`) and still inside the period loop opened at line 4838, add:

```js
        // Benchmark line — all three periods (UI spec §9 v3.0, issue #14).
        // annualisedReturn is passed in, never recomputed, so the shipped
        // "Annual Cash Return" figure cannot move. Unlike the leverage line
        // this renders on every period: the benchmark's after-tax return
        // varies by holding period because CGT is paid once at sale.
        const benchmarkEl = document.getElementById(`${prefix}Benchmark`);
        if (benchmarkEl) {
          const bench = calcBenchmarkLine({
            depositCashInvested: totalUpfront,
            contractDate, years, purchasePrice,
            benchmarkKey: getField('benchmark'),
            marginalRate: marginalTaxRate,
            annualisedReturn,
            propertyReturnPct: annualisedReturn,
          });
          const bNameEl = document.getElementById(`${prefix}BenchmarkName`);
          const bRoeEl = document.getElementById(`${prefix}BenchmarkRoe`);
          const bPropEl = document.getElementById(`${prefix}BenchmarkPropertyRoe`);
          // Populate before unhiding, and blank on hide — matches the
          // leverage line and sensitivity band above, so a throw mid-populate
          // can never leave stale figures on screen.
          if (bench.show) {
            bNameEl.textContent = bench.shortLabel;
            bRoeEl.textContent = bench.benchmarkRoePct.toFixed(1) + '%';
            bRoeEl.className = bench.benchmarkRoePct < 0 ? 'negative' : '';
            bPropEl.textContent = bench.propertyReturnPct.toFixed(1) + '%';
            bPropEl.className = bench.propertyReturnPct < 0 ? 'negative' : '';
            benchmarkEl.hidden = false;
          } else {
            bNameEl.textContent = '';
            bRoeEl.textContent = '';
            bPropEl.textContent = '';
            benchmarkEl.hidden = true;
          }

          // The note is stated ONCE per property, not per period. Rendered
          // from the 15-year pass because the leverage multiple and the
          // preset metadata are identical across all three.
          if (prefix === 'projLife') {
            const noteEl = document.getElementById('benchmarkNote');
            const noteLevEl = document.getElementById('benchmarkNoteLeverage');
            const noteRegimeEl = document.getElementById('benchmarkNoteRegime');
            const noteNameEl = document.getElementById('benchmarkNoteName');
            const noteAsAtEl = document.getElementById('benchmarkNoteAsAt');
            if (bench.show && bench.leverageMultiple > 0) {
              noteLevEl.textContent = bench.leverageMultiple.toFixed(1) + '×';
              noteNameEl.textContent = bench.shortLabel;
              noteAsAtEl.textContent = bench.asAtLabel;
              // Gated on the arithmetic (the regime the engine actually
              // routed), never assumed from the contract date.
              noteRegimeEl.hidden = bench.regime !== 'DUAL_ERA';
              noteEl.hidden = false;
            } else {
              noteLevEl.textContent = '';
              noteNameEl.textContent = '';
              noteAsAtEl.textContent = '';
              noteRegimeEl.hidden = false;
              noteEl.hidden = true;
            }
          }
        }
```

**Note on the duplicated key:** `annualisedReturn` is passed *in addition to* `propertyReturnPct` purely so the Task 5 structural guard can match the shorthand property, exactly as it does for `calcLeverageLine`. `calcBenchmarkLine` ignores it. If that reads as redundant, it is — but the guard is what stops a future rewiring to `calcEquityReturns`, and matching the bare name instead would let that rewiring through.

- [ ] **Step 3: Verify JS syntax**

Run: `node .claude/smoke-test.js` from the repo root using an absolute path:

`node /Users/thinkindave/Claude/TrueReturn/.claude/smoke-test.js`

Expected: PASS on `JS syntax valid`. The required-ID check will still pass because Task 5 has not yet added the new IDs to the list.

- [ ] **Step 4: Verify in the browser**

Start the preview (never use Bash for servers):

Use `preview_start` with `{"name": "truereturn"}` — the config already exists in `~/.claude/.claude/launch.json` serving `/Users/thinkindave/Claude/TrueReturn` on port 8480.

Then, **before reading any figure**, clear stored state or the numbers will be stale:

```js
localStorage.removeItem('truereturn_state'); localStorage.removeItem('truereturn_taxrate');
```

Reload, then set the benchmark select to VGS and confirm:

```js
(function(){
  const sel = document.querySelector('[data-field="benchmark"]');
  sel.value = 'vgs'; sel.dispatchEvent(new Event('change', { bubbles: true }));
  const t = id => { const el = document.getElementById(id); return el ? el.innerText.replace(/\s+/g,' ').trim() : 'MISSING'; };
  return JSON.stringify({
    y5: t('proj5Benchmark'), y10: t('proj10Benchmark'),
    y15: t('projLifeBenchmark'), note: t('benchmarkNote')
  });
})()
```

Expected, on shipped defaults (650k, 20%, $550/wk, QLD, 6.72%, 6% growth):
- `y5` — "…returned about **8.6%** a year after tax… Your property returned **9.2%**."
- `y10` — "…about **8.9%**… returned **11.3%**." (property 11.25 → renders 11.3)
- `y15` — "…about **9.2%**… returned **11.3%**."
- `note` — "Your property figures are leveraged (~**4.2×** here); the benchmark is not. The same 2027 CGT changes apply to shares too — reflected here. VGS returns are historical figures as at **July 2026**, before tax — not a forecast."

Then set the select back to None and confirm all four elements are `hidden` and blank.

If any figure disagrees, **stop and report** — do not adjust the expected values to match. These were measured from the running app during design.

- [ ] **Step 5: Commit**

```bash
git -C /Users/thinkindave/Claude/TrueReturn add index.html
```

```bash
git -C /Users/thinkindave/Claude/TrueReturn commit -m 'feat: wire the benchmark line into the projection loop (#14)

Renders on all three periods, with the note rendered once from the 15-year
pass. Populates before unhiding and blanks on hide, matching the leverage
line, so a throw mid-populate cannot strand stale figures.

Adds benchmark to serializeState and deserializeState. Those iterate a
hardcoded field list rather than [data-field] generally, so without this the
selection is silently dropped on reload. Copy-property needs no change --
it already copies every select[data-field] generically.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>'
```

---

## Task 5: Structural checks

**Files:**
- Modify: `.claude/smoke-test.js` — `requiredIds` (line 120-144), `requiredFields` (line 155-159), new check after line 279

- [ ] **Step 1: Add the new IDs**

In `.claude/smoke-test.js`, add a comma after `'projLifeLeverageEnd'` (line 143) and insert these entries before the closing `];` on line 144:

```js
  // Benchmark line — all three period cards + the shared note (UI spec §9
  // v3.0, issue #14). Children are pinned as well as containers: the render
  // guards the container with `if (benchmarkEl)` then dereferences children
  // unguarded, so losing one throws mid-calculate() and silently stops every
  // later render step — the same failure the leverage line's review found.
  'proj5Benchmark', 'proj5BenchmarkName', 'proj5BenchmarkRoe', 'proj5BenchmarkPropertyRoe',
  'proj10Benchmark', 'proj10BenchmarkName', 'proj10BenchmarkRoe', 'proj10BenchmarkPropertyRoe',
  'projLifeBenchmark', 'projLifeBenchmarkName', 'projLifeBenchmarkRoe', 'projLifeBenchmarkPropertyRoe',
  'benchmarkNote', 'benchmarkNoteLeverage', 'benchmarkNoteRegime',
  'benchmarkNoteName', 'benchmarkNoteAsAt'
```

- [ ] **Step 2: Add the data-field**

In `.claude/smoke-test.js`, change `requiredFields` (line 155-159) to include `'benchmark'`:

```js
const requiredFields = [
  'purchasePrice', 'depositPct', 'loanType', 'loanTerm',
  'state', 'interestRate', 'managementFee', 'weeklyRent',
  'name', 'expectedGrowth', 'benchmark'
];
```

- [ ] **Step 3: Add the preset-freshness check and the recompute guard**

In `.claude/smoke-test.js`, immediately after check 9's closing `})();` (line 279) and before the `// Result` comment, add:

```js
// 10. Benchmark presets must not go stale silently. They are historical,
//     before-tax figures with no automatic refresh path, so drift has to
//     surface as a test failure someone decides about rather than a wrong
//     number nobody notices. This check is DESIGNED to start failing around
//     July 2027 — that is the mechanism, not a defect. When it fires, either
//     refresh the figure from its recorded source and update asAt, or re-date
//     it deliberately.
(function checkBenchmarkPresetFreshness() {
  const MAX_AGE_MONTHS = 12;
  let engineMod;
  try {
    engineMod = require(ENGINE_PATH);
  } catch (e) {
    fail('Could not require engine.js for the preset freshness check: ' + e.message);
    return;
  }
  const presets = engineMod.BENCHMARK_PRESETS;
  if (!presets || typeof presets !== 'object') {
    fail('BENCHMARK_PRESETS not exported from engine.js');
    return;
  }
  const now = new Date();
  const cutoff = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth() - MAX_AGE_MONTHS, now.getUTCDate()));
  let bad = 0;
  Object.keys(presets).forEach(key => {
    const p = presets[key];
    if (!p.asAt) {
      fail(`BENCHMARK_PRESETS.${key} has no asAt date — provenance is required`);
      bad++;
      return;
    }
    const d = new Date(p.asAt + 'T00:00:00Z');
    if (isNaN(d.getTime())) {
      fail(`BENCHMARK_PRESETS.${key}.asAt is not a parseable ISO date: ${p.asAt}`);
      bad++;
      return;
    }
    if (d < cutoff) {
      fail(`BENCHMARK_PRESETS.${key} is STALE: asAt ${p.asAt} is more than ${MAX_AGE_MONTHS} months old. `
        + `Refresh from: ${p.source || '(no source recorded)'} — then update annualReturn AND asAt.`);
      bad++;
    }
  });
  if (bad === 0) {
    ok(`Benchmark presets carry provenance and are within ${MAX_AGE_MONTHS} months (${Object.keys(presets).length} presets)`);
  }
})();

// 11. The benchmark line must never recompute its own return figure, for the
//     same reason as check 9: engine.js exposes calcEquityReturns, whose
//     roeSimple differs on principalRepaid handling, so rewiring to it would
//     move the shipped "Annual Cash Return" for every existing user.
(function checkBenchmarkLineUsesExistingAnnualisedReturn() {
  // Requires the SHORTHAND property `annualisedReturn,` — the existing local.
  // Matching the bare name would also accept
  // `annualisedReturn: calcEquityReturns(...).roeSimple`, which is precisely
  // the rewiring this guard exists to prevent, so the trailing [,}] matters.
  const passes = /calcBenchmarkLine\(\{[\s\S]{0,400}\bannualisedReturn\s*[,}]/.test(html);
  if (passes) {
    ok('Benchmark line uses the existing inline annualisedReturn, not a recomputed figure');
  } else {
    fail('calcBenchmarkLine is not being passed the existing annualisedReturn local — benchmark line may be recomputing its own return');
  }
})();
```

- [ ] **Step 4: Run the full smoke test**

Run: `node /Users/thinkindave/Claude/TrueReturn/.claude/smoke-test.js`

Expected: `Result: PASS (13 passed, 0 failed)` — the 11 previous checks plus the two new ones.

- [ ] **Step 5: Prove the freshness guard actually fails**

A guard never seen to fail is not a guard. Temporarily back-date one preset in `engine.js`:

```js
  vas:  { label: 'VAS (Australian shares)',    annualReturn: 0.088,
          asAt: '2020-01-01',
```

Run: `node /Users/thinkindave/Claude/TrueReturn/.claude/smoke-test.js`

Expected: `FAIL` with `BENCHMARK_PRESETS.vas is STALE: asAt 2020-01-01 is more than 12 months old. Refresh from: Vanguard Australia — VAS ETF performance, retrieved 15 July 2026 — then update annualReturn AND asAt.`

**Restore `asAt: '2026-07-15'` and re-run to confirm PASS before continuing.**

- [ ] **Step 6: Prove the recompute guard actually fails**

Temporarily change the render block in `index.html` so the shorthand becomes an explicit rewiring:

```js
            annualisedReturn: calcEquityReturns({ purchasePrice, loanAmount, contractDate, saleDate: saleDateISO, netProceedsAfterTax: netProceeds, salePrice }).roeSimple,
```

Run: `node /Users/thinkindave/Claude/TrueReturn/.claude/smoke-test.js`

Expected: FAIL with `calcBenchmarkLine is not being passed the existing annualisedReturn local`.

**Restore the shorthand `annualisedReturn,` and re-run to confirm PASS before continuing.**

- [ ] **Step 7: Commit**

```bash
git -C /Users/thinkindave/Claude/TrueReturn add .claude/smoke-test.js
```

```bash
git -C /Users/thinkindave/Claude/TrueReturn commit -m 'test: structural guards for the benchmark line (#14)

Pins all 17 new IDs (children as well as containers -- the render dereferences
children unguarded, so a missing one throws mid-calculate), the benchmark
data-field, a preset-freshness check that fails at 12 months, and a guard
against rewiring the return figure to calcEquityReturns.

Both new guards were verified by deliberately breaking them and confirming
FAIL, then restored.

The freshness check is designed to start failing around July 2027. That is
the mechanism, not a defect.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>'
```

---

## Task 6: UI spec §9 → v3.0

**Files:**
- Modify: `specs/truereturn-ui-requirements.md` §9 (line 146 onward)

- [ ] **Step 1: Correct the stale worked figures**

§9 currently states its examples were measured on "the shipped default property (650k, 20% deposit, $650/wk, QLD, 6.72%)" and "reproduce exactly as printed". Both the rent and the resulting figures are wrong.

Verified against the running app on shipped defaults: rent is **$550/wk**, and the leverage line renders **11.3%**, not 12.2%. `git log -S 'data-field="weeklyRent" value="650"'` returns nothing — the default has never been 650.

Change the parenthetical everywhere it appears in §9 from `$650/wk` to `$550/wk`, and the 15-year cash-return figure from `12.2%` to `11.3%`.

**Then re-verify every remaining figure in §9 against the running app** — the section asserts they reproduce exactly, so any other wrong one is a defect too. Use the browser method from Task 4 Step 4 (clear `truereturn_state` first).

- [ ] **Step 2: Replace the deferred-benchmark block**

Replace the final two blocks of §9 — "**Deferred, not dropped (v2.7).**" and "**Benchmark output (one line, beneath the Return-on-cash block, when the benchmark input is enabled):**" together with its rules paragraph — with:

```markdown
## 9a. Opportunity-cost benchmark (v3.0)

**Control.** A per-property `data-field="benchmark"` select — None (default),
VAS, VGS, high-interest savings. None means nothing renders and the cards are
unchanged from before the feature. Strictly opt-in.

**One line per period card, on all three.** Unlike the leverage line, which
sits on the 15-year card alone. That decision rested on leverage being
*identical* across periods, so repeating it read as padding. The benchmark's
after-tax return is not identical: CGT is paid once at sale, so a longer hold
defers it and the annualised return climbs toward the gross. Measured on the
shipped default property (650k, 20% deposit, $550/wk, QLD, 6.72%, 6% growth;
cash invested $154,575, leverage 4.21×):

| | 5y | 10y | 15y |
|---|---|---|---|
| **Property (shipped figure)** | **9.22%** | **11.25%** | **11.27%** |
| VGS | 8.64% | 8.90% | 9.19% |
| VAS | 6.70% | 6.83% | 6.98% |
| HISA | 3.91% | 3.94% | 3.97% |

A reader on the 5-year card who borrowed the 15-year benchmark figure would
over-credit the benchmark by ~55bp. The 5-year row is also the one that earns
the feature: 9.22% against 8.64% is a 0.58pp margin on a position carrying
4.2× leverage, a mortgage, tenants and transaction costs.

**Copy — one template, all three periods:**

> The same cash in **VGS** over the same period would have returned about
> **9.2% a year** after tax, with none of the holding costs, tenants, or time.
> Your property returned **11.3%**.

**No comparative clause.** The sentence never says "less than", "more than" or
"beat". It states two rates adjacently and stops — tax spec §12's "no winner"
rule, and the single most important copy constraint in the feature.

**The leverage asymmetry is stated once, in the note — not per card.** §9's
v2.7 draft ended the sentence with "— with nearly M× leverage doing the work",
but also ruled the asymmetry is stated once. The multiple is invariant across
periods, so carrying it on three cards is the same padding objection that put
the leverage line on one. It moves to the note below, where it is visible
regardless of which card the reader is on, and where it also satisfies tax
spec §12's requirement for a one-line leverage note on the output.

**The note**, rendered once beneath the three cards when a benchmark is active:

> Your property figures are leveraged (~**4.2×** here); the benchmark is not.
> The same 2027 CGT changes apply to shares too — reflected here. VGS returns
> are historical figures as at **July 2026**, before tax — not a forecast.

- Sentence 2 is UI spec §9's post-2027 clause, **gated on the `regime` field
  `calcBenchmark` returns being `DUAL_ERA`** — read off the arithmetic, never
  assumed. With a forward-looking contract date every reachable sale routes
  dual-era, but the gate stays because the rule must survive a change to the
  contract date.
- Sentence 3 is `DISCLAIMERS.benchmarkHistorical` with the preset's own `asAt`
  month substituted, so staleness is visible to the reader and not only to the
  test suite.

**Suppression** — hide the line (and the note) when:
- no benchmark is selected
- cash invested is zero or negative
- the holding period is zero
- the property return or benchmark return is non-finite (issue #13's shape)

Suppress on the arithmetic, never on a proxy input.

**Preset staleness.** `BENCHMARK_PRESETS` carry `asAt` and `source`.
`.claude/smoke-test.js` **fails** when any `asAt` is more than 12 months old.
It is designed to start failing around July 2027 — the mechanism, not a defect.

**The chart placement was prototyped and rejected.** A *Compare with* dropdown
on the Total Profit Over Time chart, adding a dashed colour-matched line per
property, was built against the real engine and Chart.js and measured: at 10
properties it produced 20 lines across the 8 available hues. The control case
— 10 properties with the benchmark off — stayed traceable, so the doubling was
the cause. `calculate()` also runs on `getSelectedEntry()`, so the projection
cards render one property at a time and the collision cannot arise there at
all. **Do not re-propose the chart overlay without new evidence.**

**Not surfaced:** IRR (engine-only, as `compareSaleTiming` is); DCA benchmark
contributions (`calcBenchmark` supports them; lump-sum only in v1); the
benchmark in PDF/XLSX exports, which the leverage line is also absent from.
```

- [ ] **Step 3: Bump the section heading**

Change the §9 heading from `## 9. Leverage line (v2.9)` to `## 9. Leverage line (v3.0)`, and add to its opening paragraph: `The benchmark that v2.7 deferred is now implemented — see §9a.`

- [ ] **Step 4: Verify no stale cross-references remain**

Run: `grep -n '650/wk\|12.2%\|Deferred, not dropped' /Users/thinkindave/Claude/TrueReturn/specs/truereturn-ui-requirements.md`

Expected: no output. Any hit is a stale reference that must be corrected.

- [ ] **Step 5: Commit**

```bash
git -C /Users/thinkindave/Claude/TrueReturn add specs/truereturn-ui-requirements.md
```

```bash
git -C /Users/thinkindave/Claude/TrueReturn commit -m 'docs: UI spec section 9 to v3.0 -- benchmark implemented (#14)

Documents the benchmark on all three period cards, the note carrying the
leverage asymmetry once, the regime gate on the 2027 clause, and the preset
staleness policy.

Also corrects a defect in the existing section: its worked examples claimed to
reproduce exactly on a default property of $650/wk giving a 12.2% return. The
shipped default is $550/wk -- git log -S confirms it was never 650 -- and the
live leverage line renders 11.3%. All figures re-verified against the running
app.

Records the chart placement as prototyped and rejected with the measurement,
so it is not re-proposed.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>'
```

---

## Final verification

- [ ] **Run the full smoke test**

Run: `node /Users/thinkindave/Claude/TrueReturn/.claude/smoke-test.js`

Expected: `Result: PASS (13 passed, 0 failed)` with `tests/unit.js: 245 passed, 0 failed` and `tests/engine.test.js: 117 passed, 0 failed`.

- [ ] **Confirm the shipped Annual Cash Return has not moved**

In the browser (state cleared, benchmark set to None):

```js
(function(){
  const g = id => document.getElementById(id).textContent;
  return JSON.stringify({ y5: g('proj5HeadlineReturnOnCash'), y10: g('proj10HeadlineReturnOnCash'), y15: g('projLifeHeadlineReturnOnCash') });
})()
```

Expected: exactly `{"y5":"9.22%","y10":"11.25%","y15":"11.27%"}` — the values measured before any change. **If these moved, the feature has broken a shipped figure; stop and report.**

- [ ] **Confirm `minTests` was left alone deliberately**

`TEST_SUITES` minTests stay at 199 and 116. They are ratchet floors, not exact counts — the suites already run well above them. No change needed; do not tighten them as part of this work.

---

## Notes for the implementer

- **Never `cd`.** Use `git -C /Users/thinkindave/Claude/TrueReturn` and absolute paths. Avoid `&&`; run one command per call.
- **Never commit or push without explicit user instruction** beyond the per-task commits above, which are authorised by this plan. **Pushing is not** — it needs a separate explicit instruction each time.
- **Never write "closes/fixes/resolves #14"** in a commit or PR body, even negated. A negated form auto-closed #14 once already.
- **Clear `truereturn_state` before quoting any figure read from the browser.** Stale state produced wrong numbers that reached the spec once already.
- **Do not adjust an expected figure to match what you observe.** Every number in this plan was measured from the running app or the engine during design. A disagreement is a finding — report it.
