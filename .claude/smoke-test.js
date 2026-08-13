#!/usr/bin/env node
/**
 * TrueReturn smoke test script.
 * Run with: node .claude/smoke-test.js
 * Exits 0 on PASS, 1 on FAIL.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const HTML_PATH = path.join(__dirname, '../index.html');
// about.html is a hand-written explainer of what the engine does. It has no
// runtime tie to engine.js — it does not even load it — so check 19 is the only
// thing standing between it and silent drift.
const ABOUT_PATH = path.join(__dirname, '../about.html');

// Every test suite that must run. Each is executed in its own child process so
// that (a) the shared module-level counters in tests/harness.js don't pool into
// one running total, and (b) a failing suite's summary() process.exit(1) can't
// abort the rest of the smoke test.
// minTests is a ratchet, not an exact count: adding tests is fine, but a suite
// that silently shrinks (or stops running its tests at all) fails the check.
const TESTS_DIR = path.join(__dirname, '../tests');
const TEST_SUITES = [
  { label: 'tests/unit.js', file: path.join(TESTS_DIR, 'unit.js'), minTests: 248 },
  { label: 'tests/engine.test.js', file: path.join(TESTS_DIR, 'engine.test.js'), minTests: 138 }
];

// Files in tests/ that are not themselves suites.
const NON_SUITE_FILES = ['harness.js'];

let passed = 0;
let failed = 0;

function ok(msg) { console.log('✓', msg); passed++; }
function fail(msg) { console.error('✗', msg); failed++; }

const html = fs.readFileSync(HTML_PATH, 'utf8');

// 1. JS syntax
try {
  const match = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!match) throw new Error('No <script> block found');
  new Function(match[1]);
  ok('JS syntax valid');
} catch(e) {
  fail('JS syntax error: ' + e.message);
}

// 2. Unit tests — each suite reported separately so a failure is attributable
//    to the right file.
TEST_SUITES.forEach(suite => {
  if (!fs.existsSync(suite.file)) {
    fail(`${suite.label}: suite file not found`);
    return;
  }

  const run = spawnSync(process.execPath, [suite.file], {
    encoding: 'utf8',
    timeout: 120000
  });
  const output = (run.stdout || '') + (run.stderr || '');

  // harness.js summary() prints "N passed, M failed" on its own line to stdout.
  // Match against stdout only, anchored: a *failing* test whose name contains
  // that phrase is written to stderr, and stderr is concatenated after stdout,
  // so an unanchored search over both streams could pick up the test name
  // instead of the real summary.
  // Take the LAST such line, not the first: if a suite calls summary() more than
  // once, the final call is the authoritative total.
  const summaryRe = /^[ \t]*(\d+) passed, (\d+) failed[ \t]*$/gm;
  let summary = null;
  let m;
  while ((m = summaryRe.exec(run.stdout || '')) !== null) summary = m;
  const suitePassed = summary ? Number(summary[1]) : null;
  const suiteFailed = summary ? Number(summary[2]) : null;
  const counts = summary ? `${suitePassed} passed, ${suiteFailed} failed` : null;

  if (run.status === 0 && summary && suiteFailed === 0) {
    // A suite that ran no tests reports "0 passed, 0 failed" and exits 0 —
    // green, but proving nothing. Guard against a suite quietly going vacuous.
    if (suitePassed < suite.minTests) {
      fail(`${suite.label}: only ${suitePassed} tests ran, expected at least ${suite.minTests} — has the suite been truncated or disabled?`);
      return;
    }
    ok(`${suite.label}: ${counts}`);
    return;
  }

  // Distinguish a real test failure from an infrastructure one.
  const reason = counts
    || (run.error ? `could not run suite: ${run.error.message}` : null)
    || 'suite did not report a summary (crashed on load?)';
  const exitNote = run.status === 0 ? '' : ` [exit ${run.status === null ? 'null' : run.status}]`;
  fail(`${suite.label}: ${reason}${exitNote}`);
  // Surface the individual failing assertions so the cause is visible.
  const failingLines = output.split('\n').filter(l => l.includes('✗'));
  if (failingLines.length) {
    failingLines.forEach(l => console.error('   ' + l.trim()));
  } else if (output.trim()) {
    console.error(output.trim().split('\n').slice(-15).map(l => '   ' + l).join('\n'));
  }
});

// 2b. Suite-list drift guard. This whole check exists because tests/engine.test.js
//     sat unrun for months; a hand-maintained TEST_SUITES list can repeat that
//     silently, so fail when a .js file in tests/ is not wired up above.
(function checkNoUnwiredSuites() {
  const wired = new Set(TEST_SUITES.map(s => path.basename(s.file)));
  const unwired = fs.readdirSync(TESTS_DIR)
    .filter(f => f.endsWith('.js'))
    .filter(f => !wired.has(f) && !NON_SUITE_FILES.includes(f));

  if (unwired.length) {
    unwired.forEach(f => fail(`tests/${f} exists but is not in TEST_SUITES — it would never run`));
  } else {
    ok(`All test files in tests/ are wired into the smoke test (${wired.size} suites)`);
  }
})();

// 3. Required fixed IDs
// Note: expectedGrowth was intentionally removed (moved to per-property data-field)
const requiredIds = [
  'addPropertyBtn', 'themeToggle',
  'breakdownPropertyLabel', 'projectionsPropertyLabel',
  'resTotalUpfront', 'resMonthlyCashFlow',
  'resTaxBenefit',
  'proj5Value', 'proj5Growth', 'proj5TrueReturn', 'proj5ReturnOnCash',
  'proj10Value', 'proj10Growth', 'proj10TrueReturn', 'proj10ReturnOnCash',
  'projLifeValue', 'projLifeGrowth', 'projLifeTrueReturn', 'projLifeReturnOnCash',
  // Reform UI wiring — quarantine redesign (#6) + deemed value / sensitivity / banner
  'resTaxBenefitNote', 'proj5Quarantined', 'proj10Quarantined',
  'projLifeQuarantined', 'deemedValueChip',
  'proj5Sensitivity', 'proj10Sensitivity', 'projLifeSensitivity',
  'minTaxFootnote', 'reformBanner',
  // New-build CGT treatment line (UI spec §1.4)
  'proj5CgtTreatment', 'proj10CgtTreatment', 'projLifeCgtTreatment',
  // Leverage line — 15-year projection card only (UI spec §9 v2.9, issue #14).
  // The four children matter more than the container: the render guards the
  // container with `if (leverageEl)` and then dereferences the children
  // unguarded, so losing one throws mid-calculate() and silently stops the
  // deemed-value chip, min-tax footnote, reform banner and Property
  // Highlights from updating.
  'projLifeLeverage', 'projLifeLeverageGrowth', 'projLifeLeverageVerb',
  'projLifeLeverageRoe', 'projLifeLeverageMult',
  // Reform impact module — all three cards (UI spec §3a v3.1, issue #17).
  // Same reasoning as the leverage line above: the render guards only the
  // container with `if (reformEl)` and then dereferences every child
  // unguarded, so losing one throws mid-calculate() and silently stops the
  // later render steps.
  'proj5ReformImpact', 'proj5ReformImpactText', 'proj5ReformImpactToggle', 'proj5ReformImpactDetail',
  'proj5ReformOldCgt', 'proj5ReformNewCgt', 'proj5ReformSplitPre', 'proj5ReformSplitPost',
  'proj5ReformNewPre', 'proj5ReformNewPost', 'proj5ReformOldRefunds', 'proj5ReformNewRefunds',
  'proj5ReformOldProfitTax', 'proj5ReformNewProfitTax', 'proj5ReformTotalLabel', 'proj5ReformOldTotal',
  'proj5ReformNewTotal', 'proj5ReformPoolNote',
  'proj10ReformImpact', 'proj10ReformImpactText', 'proj10ReformImpactToggle', 'proj10ReformImpactDetail',
  'proj10ReformOldCgt', 'proj10ReformNewCgt', 'proj10ReformSplitPre', 'proj10ReformSplitPost',
  'proj10ReformNewPre', 'proj10ReformNewPost', 'proj10ReformOldRefunds', 'proj10ReformNewRefunds',
  'proj10ReformOldProfitTax', 'proj10ReformNewProfitTax', 'proj10ReformTotalLabel', 'proj10ReformOldTotal',
  'proj10ReformNewTotal', 'proj10ReformPoolNote',
  'projLifeReformImpact', 'projLifeReformImpactText', 'projLifeReformImpactToggle', 'projLifeReformImpactDetail',
  'projLifeReformOldCgt', 'projLifeReformNewCgt', 'projLifeReformSplitPre', 'projLifeReformSplitPost',
  'projLifeReformNewPre', 'projLifeReformNewPost', 'projLifeReformOldRefunds', 'projLifeReformNewRefunds',
  'projLifeReformOldProfitTax', 'projLifeReformNewProfitTax', 'projLifeReformTotalLabel', 'projLifeReformOldTotal',
  'projLifeReformNewTotal', 'projLifeReformPoolNote',
  'projLifeLeverageClause', 'projLifeLeverageEnd',
  // Benchmark line — all three period cards + the shared note (UI spec §9
  // v3.0, issue #14). Children are pinned as well as containers: the render
  // guards the container with `if (benchmarkEl)` then dereferences children
  // unguarded, so losing one throws mid-calculate() and silently stops every
  // later render step — the same failure the leverage line's review found.
  'proj5Benchmark', 'proj5BenchmarkName', 'proj5BenchmarkRoe', 'proj5BenchmarkPropertyRoe',
  'proj10Benchmark', 'proj10BenchmarkName', 'proj10BenchmarkRoe', 'proj10BenchmarkPropertyRoe',
  'projLifeBenchmark', 'projLifeBenchmarkName', 'projLifeBenchmarkRoe', 'projLifeBenchmarkPropertyRoe',
  'benchmarkNote', 'benchmarkNoteLeverageSentence', 'benchmarkNoteLeverage',
  'benchmarkNoteRegime', 'benchmarkNoteName', 'benchmarkNoteAsAt',
  // The visible comparator control lives in the Projections module; the
  // per-property value is a hidden data-field="benchmark" in the row.
  'benchmarkSelect'
];
let idsFailed = false;
requiredIds.forEach(id => {
  if (!html.includes('id="' + id + '"')) {
    fail('Missing ID: ' + id);
    idsFailed = true;
  }
});
if (!idsFailed) ok('All required IDs present (' + requiredIds.length + ')');

// 4. Required data-field attributes
const requiredFields = [
  'purchasePrice', 'depositPct', 'loanType', 'loanTerm',
  'state', 'interestRate', 'managementFee', 'weeklyRent',
  'name', 'expectedGrowth', 'benchmark'
];
let fieldsFailed = false;
requiredFields.forEach(f => {
  if (!html.includes('data-field="' + f + '"')) {
    fail('Missing data-field: ' + f);
    fieldsFailed = true;
  }
});
if (!fieldsFailed) ok('All required data-field attributes present (' + requiredFields.length + ')');

// 5. Script execution order: engine.js (which declares stateDefaults) loaded
//    before the inline app script, and before initPropertySelection() runs.
const ENGINE_PATH = path.join(__dirname, '../engine.js');
const engineJs = fs.readFileSync(ENGINE_PATH, 'utf8');
const engineTagMatches = html.match(/<script src="engine\.js"><\/script>/g);
const engineTagIdx = html.indexOf('<script src="engine.js"></script>');
const appScriptIdx = html.indexOf('window.TrueReturn');
const initIdx = html.indexOf('initPropertySelection();');
if (!engineJs.includes('const stateDefaults')) {
  fail('stateDefaults not found in engine.js');
} else if (!engineTagMatches || engineTagMatches.length !== 1) {
  fail('index.html must contain exactly one <script src="engine.js"></script> tag, found ' + (engineTagMatches ? engineTagMatches.length : 0));
} else if (appScriptIdx === -1) {
  fail('window.TrueReturn not found in index.html');
} else if (engineTagIdx >= appScriptIdx) {
  fail('CRITICAL: engine.js <script> tag must appear before the inline app script');
} else if (initIdx === -1) {
  fail('initPropertySelection() call not found');
} else if (initIdx < engineTagIdx) {
  fail('CRITICAL: initPropertySelection() called before engine.js is loaded');
} else {
  ok('Script execution order correct (engine.js before app script)');
}

// 6. No inline event handlers
const inlineHandlers = html.match(/\s(onclick|onchange|oninput)=/g);
if (inlineHandlers && inlineHandlers.length > 0) {
  fail('Inline event handlers found: ' + inlineHandlers.join(', '));
} else {
  ok('No inline event handlers');
}

// 7. HeadlineReturnOnCash must write annualisedReturn (CAGR), not returnOnCash (total %).
//    The fix in cb693c3 corrected this; this check prevents regression.
//    We look for the three HeadlineReturnOnCash assignment blocks and confirm each
//    assigns `annualisedReturn`, not `returnOnCash`.
(function checkHeadlineReturnMetric() {
  // Collect every line that assigns .textContent to a HeadlineReturnOnCash element.
  // Pattern: hReturnOnCashEl.textContent = <expression>
  const assignRe = /hReturnOnCashEl\.textContent\s*=\s*([^;]+);/g;
  let match;
  let assignCount = 0;
  let wrongCount = 0;

  while ((match = assignRe.exec(html)) !== null) {
    assignCount++;
    const expr = match[1].trim();
    // The expression must reference annualisedReturn, not returnOnCash (the total-return variable).
    if (!expr.includes('annualisedReturn')) {
      fail(`HeadlineReturnOnCash writes "${expr}" — expected annualisedReturn (CAGR), not returnOnCash (total %)`);
      wrongCount++;
    }
  }

  if (assignCount === 0) {
    fail('HeadlineReturnOnCash assignment not found — has the projections block been removed or renamed?');
  } else if (wrongCount === 0) {
    ok(`HeadlineReturnOnCash writes annualisedReturn (CAGR) at all ${assignCount} site(s)`);
  }
})();

// 8. ReturnOnCash accordion highlight also uses annualisedReturn
(function checkAccordionReturnMetric() {
  const assignRe = /rocEl\.textContent\s*=\s*([^;]+);/g;
  let match;
  let assignCount = 0;
  let wrongCount = 0;

  while ((match = assignRe.exec(html)) !== null) {
    assignCount++;
    const expr = match[1].trim();
    if (!expr.includes('annualisedReturn')) {
      fail(`ReturnOnCash accordion highlight writes "${expr}" — expected annualisedReturn (CAGR), not returnOnCash (total %)`);
      wrongCount++;
    }
  }

  if (assignCount === 0) {
    fail('rocEl.textContent assignment not found — has the Investment Performance block been removed or renamed?');
  } else if (wrongCount === 0) {
    ok(`ReturnOnCash accordion highlight writes annualisedReturn (CAGR) at all ${assignCount} site(s)`);
  }
})();

// 9. Leverage line must never recompute its own ROE figure. engine.js also
//    exposes calcEquityReturns, which computes a similar-looking figure but
//    differs on principalRepaid handling. If calcLeverageLine were rewired to
//    that (or to any fresh computation) instead of the existing inline
//    annualisedReturn, the shipped "Annual Cash Return" figure would move for
//    every existing user. This check pins both halves of that contract.
(function checkLeverageLineUsesExistingAnnualisedReturn() {
  // #18 replaced the inline roeBase formula with an engine call, so this half
  // now pins the derivation it became: the local must be the engine's CAGR,
  // floored at -100 rather than blanked (tax spec §13.3, "never blanked").
  const rateLine = 'const annualisedReturnRate = annualizedReturn(totalProfit, totalUpfront, years);';
  const floorLine = "const annualisedReturn = annualisedReturnRate === null ? -100 : annualisedReturnRate * 100;";
  const hasRoeBase = html.includes(rateLine) && html.includes(floorLine);
  if (!hasRoeBase) {
    fail('Card CAGR local not found or altered — expected:\n    ' + rateLine + '\n    ' + floorLine);
  }

  // Requires the SHORTHAND property `annualisedReturn,` — i.e. the existing
  // local variable. Matching the bare name would also accept
  // `annualisedReturn: calcEquityReturns(...).roeSimple`, which is precisely
  // the rewiring this guard exists to prevent, so the trailing [,}] matters.
  const passesAnnualisedReturn =
    /calcLeverageLine\(\{[\s\S]{0,200}\bannualisedReturn\s*[,}]/.test(html);
  if (!passesAnnualisedReturn) {
    fail('calcLeverageLine is not being passed the existing annualisedReturn local — leverage line may be recomputing its own ROE');
  }

  if (hasRoeBase && passesAnnualisedReturn) {
    ok('Leverage line uses the existing inline annualisedReturn, not a recomputed figure');
  }
})();

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

(function checkReformImpactUsesEngineOutput() {
  // The module must read calcReformImpact's output, not recompute a delta in
  // the DOM layer. A literal subtraction of two cgt figures in index.html is
  // exactly the CGT-only delta this feature exists to avoid shipping — it is
  // negative at 5 years and positive at 15 on the same property, so the two
  // period cards would contradict each other.
  const wired = /calcReformImpact\(\{[\s\S]{0,200}\bsaleArgs\s*[,}]/.test(html);
  if (!wired) {
    fail('calcReformImpact is not being passed the existing saleArgs — the module may be building its own sale');
    return;
  }
  // The refund and rental-profit terms are what make this a total-tax delta
  // rather than the CGT-only delta that reads as a saving at 5 years and a
  // cost at 15 on the same property. They come entirely from the schedule,
  // so passing an empty array here silently reverts the feature. Assert the
  // real schedule is wired in.
  const schedWired = /calcReformImpact\(\{[\s\S]{0,200}quarantineRows:\s*quarantineSched\.rows/.test(html);
  if (!schedWired) {
    fail('calcReformImpact is not being passed quarantineSched.rows — the module may have reverted to a CGT-only delta');
    return;
  }
  ok('Reform impact module reads calcReformImpact output with the real quarantine schedule');
})();

(function checkSnapshotProfitYearReadsThePool() {
  // Issue #20. The snapshot's Est. Benefit must take a profitable year's tax
  // from the quarantine schedule, not from the pool-blind snTaxBenefit local.
  // snTaxBenefit charges the whole profit at MTR, which is the OLD rulebook's
  // answer on a page that assumes the reform applies (UI spec §2 Group 1) — it
  // summed to $20,708 across years 10-15 on the default property, exactly the
  // reform module's old-rules rental-profit row, while the module's new-rules
  // row read $0.
  const branchWired = /snIsPoolAbsorbedProfitYear\s*=\s*!!\([\s\S]{0,120}\.absorbed\s*>\s*0/.test(html);
  if (!branchWired) {
    fail('No snIsPoolAbsorbedProfitYear branch gated on the schedule row\'s absorbed amount — a profitable year may be back to charging the full profit at MTR');
    return;
  }
  // The figure itself has to come off the row. If this branch ever renders
  // snTaxBenefit again it is the old bug verbatim.
  const readsTaxOnProfit = /snPoolTaxOnProfit\s*=\s*snQuarantineRow\.taxOnProfit/.test(html);
  if (!readsTaxOnProfit) {
    fail('The pool-absorbed profit branch is not reading snQuarantineRow.taxOnProfit — the rendered figure may be recomputed in the DOM layer');
    return;
  }
  // A bare $0 against a profitable year is a fresh honesty defect: it reads as
  // rental profit being untaxed. The note carrying the counterweight — the
  // relief is finite and drawn from a pool that will not be there at sale — is
  // required, not polish (quarantined-losses redesign spec §3).
  //
  // Matched on the opening clause only: the shipped string escapes its
  // apostrophe (there\'s), so pinning the whole sentence would need the escape
  // baked into the pattern. The clause is distinctive enough to catch removal.
  // The sentence must stay NEUTRAL — an earlier draft said using the pool
  // "leaves less of it to offset your capital gain at sale", which frames §4's
  // channel A as a cost. That is the factual error §4 records, and the
  // direction flips on the marginal rate anyway (code review, issue #20).
  const hasCounterweight = /This uses up part of your quarantined-loss pool/.test(html);
  if (!hasCounterweight) {
    fail('The pool-absorbed profit note has lost its counterweight sentence — a $0 charge on a profitable year would stand unexplained');
    return;
  }
  ok('Snapshot profit-year Est. Benefit reads the quarantine schedule and keeps its counterweight note');
})();

(function checkNoInlineCagrRecomputation() {
  // Issue #18. The CAGR formula was written out twice in the DOM layer, and the
  // two copies disagreed in the degenerate case: the projection card floored a
  // total loss at -100%, the Total Profit chart returned null and its tooltip
  // silently dropped the rate. Same property, same year, two answers, one of
  // them invisible — and tax spec §13.3 forbids blanking a negative return.
  //
  // engine.js annualizedReturn already owns the contract (-1 on ratio <= 0,
  // null on a non-positive stake or period) and is tested for it. Both call
  // sites must read it rather than restate the formula, so they cannot drift
  // again. Assert no inline `Math.pow(base, 1 / period)` CAGR survives.
  const inlineCagr = html.match(/Math\.pow\([A-Za-z_$][\w$]*,\s*1\s*\/\s*(y|years)\b\s*\)/g) || [];
  if (inlineCagr.length > 0) {
    fail(`index.html still computes CAGR inline ${inlineCagr.length} time(s) (${inlineCagr.join(', ')}) — both sites must call engine annualizedReturn so the card and the chart cannot disagree at a total loss`);
    return;
  }
  // Both sites must pass the same three arguments to the engine helper.
  const engineCalls = html.match(/annualizedReturn\(\s*totalProfit\s*,\s*totalUpfront\s*,/g) || [];
  if (engineCalls.length < 2) {
    fail(`Expected both the projection card and the chart to call annualizedReturn(totalProfit, totalUpfront, ...) — found ${engineCalls.length}`);
    return;
  }
  ok(`Card and chart both derive CAGR from engine annualizedReturn (${engineCalls.length} sites, no inline formula)`);
})();

// 17. NaN tripwire on numeric input reads.
//
//     #18 routed both CAGR sites through engine.annualizedReturn. Its guard is
//     `cashInvested <= 0 || years <= 0`, and BOTH comparisons are false for NaN
//     — so a NaN would flow past it, through Math.pow, and out as NaN. The card
//     renders via .toFixed(2) at three unguarded sites, so it would print
//     "NaN%": exactly the symptom of issue #13.
//
//     Before #18 this could not happen, but only by accident of the old code's
//     SHAPE: `roeBase > 0` is false for NaN, so NaN fell to the -100 arm. That
//     accidental sink is gone. What stands in its place is a convention — every
//     numeric input in this file is read as `parseFloat(...) || 0`, where the
//     `|| 0` catches NaN because NaN is falsy.
//
//     That convention is now load-bearing and completely invisible at the call
//     site. A new input field read with a bare parseFloat would reintroduce #13
//     silently. This check pins it: every parseFloat must be one of
//       a) sanitised          — carries a `|| 0` fallback (all user-input reads)
//       b) a known constant   — parseFloat(SIMPLE_MODE_TAX)
//       c) internal geometry  — the sparkline's own computed coordinates
//     Adding a raw parseFloat on a field value fails here. If you are adding one
//     deliberately and it genuinely cannot be NaN, extend GEOMETRY_ALLOWLIST and
//     say why. The real fix, if this ever fires for a reachable input, is to
//     widen the engine guard to `!(cashInvested > 0) || !(years > 0)`.
//
//     Scope: parseFloat only, because it is this file's sole idiom for reading
//     numeric input. `Number()` is not used for input, and the two parseInt
//     calls read a <select> year and a dataset index, neither of which feeds the
//     CAGR path. If input reading ever moves to another idiom, widen this.
(function checkNumericInputsCannotYieldNaN() {
  const GEOMETRY_ALLOWLIST = [
    'parseFloat(yp(',   // sparkline y-coordinate, from its own scale function
    'parseFloat(gy)',   // sparkline gridline offset, computed above
  ];
  const offenders = [];

  html.split('\n').forEach((line, i) => {
    const calls = (line.match(/parseFloat\(/g) || []).length;
    if (calls === 0) return;

    const sanitised = (line.match(/\|\|\s*0/g) || []).length;
    const constants = (line.match(/parseFloat\(SIMPLE_MODE_TAX\)/g) || []).length;
    const geometry = GEOMETRY_ALLOWLIST
      .reduce((n, pat) => n + line.split(pat).length - 1, 0);

    if (sanitised + constants + geometry < calls) {
      offenders.push(`  line ${i + 1}: ${line.trim().slice(0, 100)}`);
    }
  });

  if (offenders.length > 0) {
    fail(
      `${offenders.length} parseFloat call(s) lack a NaN sink — a NaN here reaches ` +
      `engine annualizedReturn, whose guard does not catch it, and renders "NaN%" (#13, #18):\n` +
      offenders.join('\n') +
      `\n  Fix: add a \`|| 0\` fallback, or allowlist it in this check with a reason.`
    );
    return;
  }
  ok('All numeric input reads carry a NaN sink (parseFloat ... || 0), so NaN cannot reach the CAGR path');
})();

// 18. The quarantine absorption rule has ONE owner.
//
//     engine.buildQuarantineSchedule decides how much of the pool a profitable
//     rental year absorbs, and reports it per row as `absorbed`. index.html used
//     to re-derive that — `pool -= Math.min(pool, Math.max(0, netResult))` —
//     twice, character for character, so the rule lived in three places (#21).
//     They were bit-identical, so nothing was wrong; the hazard was that a
//     change to the engine would silently desynchronise the snapshot note from
//     the projections pool row, with nothing failing to signal it.
//
//     Both DOM copies now call engine.quarantinePoolAtYear(rows, y). This check
//     pins that: no re-derivation in the DOM, and the engine helper still there
//     to be called.
(function checkQuarantineAbsorptionHasOneOwner() {
  // Three layers, because pinning the one spelling that was deleted would let
  // a differently-written re-derivation walk straight back in. Between them
  // these catch a renamed accumulator, a reordered Math.max, the non-compound
  // form, an extracted temporary and the ternary form. Known residual gap: a
  // re-derivation that renames the accumulator AND avoids Math.max (e.g.
  // `p -= Math.min(p, nr > 0 ? nr : 0)`) at a NEW fourth site would pass — arm
  // 2's exact count is the backstop when it replaces an existing site.
  const suspects = [
    // (a) any Math.min/Math.max reasoning about netResult. The DOM's only
    //     legitimate uses of netResult are building annualResults rows and the
    //     snapshot's `netResult - absorbed`, none of which clamp.
    [/Math\.(?:min|max)\([^;]{0,80}netResult/g, 'a Math.min/Math.max applied to netResult'],
    // (b) the min(accumulator, max(...)) shape, whatever things are called.
    [/Math\.min\(\s*[\w.$\[\]]+\s*,\s*Math\.max\(/g, 'a min(x, max(...)) clamp'],
    // (c) any accumulator literally named `pool` being mutated. After #21 every
    //     mention of `pool` in index.html is prose in a comment.
    [/\bpool\s*(?:\+=|-=|=[^=])/g, 'a mutated `pool` accumulator'],
  ];
  for (const [re, what] of suspects) {
    const hits = html.match(re) || [];
    if (hits.length > 0) {
      fail(
        `index.html appears to re-derive the pool-absorption rule — found ${hits.length}x ${what} ` +
        `(${hits.map(h => h.replace(/\s+/g, ' ').slice(0, 50)).join(' | ')}). It must read the ` +
        `engine's own answer via quarantinePoolAtYear(rows, y), or the snapshot note and the ` +
        `projections pool row can drift apart silently (#21)`
      );
      return;
    }
  }
  // The DOM must actually be calling the engine helper, not have dropped the
  // pool entirely — that would zero the figure rather than desynchronise it.
  // Exact count, not a minimum: a fourth call site should be a deliberate edit
  // here, so it cannot mask a re-derivation added alongside the real three.
  const callSites = html.match(/quarantinePoolAtYear\(\s*[\w.$]+\s*,/g) || [];
  if (callSites.length !== 3) {
    fail(
      `Expected exactly 3 DOM sites (sale, period pool, chart closure) to call ` +
      `quarantinePoolAtYear(rows, ...) — found ${callSites.length}`
    );
    return;
  }
  if (!/function quarantinePoolAtYear\(rows, y\)/.test(engineJs)) {
    fail('engine.js no longer defines quarantinePoolAtYear(rows, y) — the DOM call sites have nothing to call');
    return;
  }
  ok(`Quarantine absorption rule has one owner (engine helper, ${callSites.length} DOM call sites, no re-derivation)`);
})();

// 19. The About page must still describe what the engine actually does.
//
//     about.html is prose. Nothing imports it, nothing renders from it, and it
//     does not load engine.js — so when the engine changes underneath it, the
//     page keeps confidently stating the old behaviour and no test goes red.
//     That is not hypothetical: the page sat unedited from 31 March 2026 while
//     index.html and engine.js took 56 commits, and by the time anyone read it
//     four of its numbers were plainly wrong. Conveyancing was still described
//     as a fixed $1,500 after it became a per-state figure. Insurance and
//     council rates were still described as percentages of purchase price after
//     they became flat per-state dollar amounts — on the page's own $650k QLD
//     example, its "0.15%" implied $975 where the app charges $2,200. The
//     depreciation rate for a new property read 1.75% against an engine that
//     applies 2.5%, over age brackets the app no longer offers.
//
//     So every expectation below is DERIVED at runtime — from engine.js, and for
//     the age brackets from the app's own <select>. No figure is written down in
//     this file, deliberately: a hardcoded expectation drifts from the engine
//     exactly the way the page did, and then certifies the drift as correct.
//     Change a depreciation rate or a stateDefaults entry and this check fails
//     until about.html — and the in-app tax note that repeats the same facts —
//     is brought along with it.
//
//     Where a claim cannot be derived one-directionally, it is checked as an
//     IDENTITY instead. The engine will not say what depreciation rate it
//     applies, only what it returns, so the rate and the building-value fraction
//     are both read off the page and multiplied back out against
//     calcDepreciation. And the assertions are counted, not just present: a page
//     that states the right figure beside a superseded one is still wrong.
//
//     Scope note: this pins figures that are mechanically checkable against the
//     engine. Prose claims with no numeric counterpart in engine.js (the 2027
//     reform wording, the stamp duty threshold vintage) are out of its reach and
//     still need a human to read the page.
(function checkAboutPageFiguresMatchEngine() {
  if (!fs.existsSync(ABOUT_PATH)) {
    fail('about.html not found at ' + ABOUT_PATH + ' — the About page figures cannot be checked against the engine');
    return;
  }
  const about = fs.readFileSync(ABOUT_PATH, 'utf8');

  let engineMod;
  try {
    engineMod = require(ENGINE_PATH);
  } catch (e) {
    fail('Could not require engine.js for the About page figure check: ' + e.message);
    return;
  }
  const { stateDefaults, BUILDING_PEST, LOAN_ESTABLISHMENT, calcDepreciation } = engineMod;
  if (typeof calcDepreciation !== 'function' || !stateDefaults
      || typeof BUILDING_PEST !== 'number' || typeof LOAN_ESTABLISHMENT !== 'number') {
    fail('engine.js must export calcDepreciation, stateDefaults, BUILDING_PEST and LOAN_ESTABLISHMENT — '
      + 'without them the About page figures cannot be derived, and this check would pass vacuously');
    return;
  }

  let bad = 0;

  // 1-based line of a string, so a failure names a place and not just a number.
  const lineOf = (source, needle) => {
    const idx = source.indexOf(needle);
    return idx === -1 ? '?' : source.slice(0, idx).split('\n').length;
  };

  // The <li> that owns a fact — used both as the SCOPE of the search and as the
  // "page says" quote in a failure.
  //
  // Scoping matters as much here as it does for the in-app note below. about.html
  // carries an unrelated "Sales costs — 3% of sale price" bullet, so a whole-file
  // search for a 3% depreciation rate would be satisfied by a completely
  // different sentence and report the page as correct. Every fact is therefore
  // checked against the one bullet that is supposed to state it.
  //
  // Two structural hazards are reported rather than absorbed. Scoping by first
  // match is only sound while an anchor is unique, so a second occurrence is a
  // failure, not a coin toss. And the opening tag is matched as <li[^>]*> rather
  // than the literal '<li>': a bullet that gained a class attribute would
  // otherwise silently widen the scope to the previous bullet or read as removed.
  const bulletWith = (source, anchor) => {
    const hits = source.split(anchor).length - 1;
    if (hits === 0) return { problem: 'missing' };
    if (hits > 1) return { problem: 'ambiguous', hits };
    const idx = source.indexOf(anchor);
    const openRe = /<li[^>]*>/g;
    let open = null;
    let m;
    while ((m = openRe.exec(source)) !== null && m.index <= idx) open = m;
    const end = source.indexOf('</li>', idx);
    if (!open || end === -1) return { problem: 'unbounded' };
    return { text: source.slice(open.index, end + 5), line: lineOf(source, anchor) };
  };
  const reportBulletProblem = (res, anchor, what) => {
    if (res.problem === 'ambiguous') {
      fail(`"${anchor}" appears ${res.hits}× in about.html — the ${what} figures are scoped by first `
        + `match, so the check can no longer be sure which bullet it is reading. Make the anchor unique.`);
    } else if (res.problem === 'unbounded') {
      fail(`Found "${anchor}" in about.html but could not bound it to a <li>…</li> — the ${what} `
        + `figures cannot be scoped, so they are no longer being checked against engine.js`);
    } else {
      fail(`about.html no longer has a bullet containing "${anchor}" — the ${what} description has been `
        + `reworded or removed, and its figures can no longer be held to engine.js`);
    }
    bad++;
  };

  // Counting the figures a bullet states, not just looking for the ones that
  // should be there. Presence-only assertions let a superseded figure survive
  // beside a correct one: a half-finished edit that adds the new range but
  // leaves the old "0.15% of purchase price p.a." in the same <li> reads as
  // green while the page contradicts itself.
  // Must end on a digit, so "fixed $800, plus GST" reports "$800" and not "$800,".
  const dollarFigures = text => text.match(/\$[\d,]*\d/g) || [];
  const percentFigures = text => text.match(/[\d.]+%/g) || [];

  // Engine values are raw numbers; both pages write money with thousands
  // separators, so compare in the page's own spelling.
  const money = n => '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // Anchored on both sides, because a bare substring test is satisfied by the
  // wrong figure: "2.5%" sits inside "12.5%", and "$900" inside "$900,000".
  // A loose match would then certify a neighbouring number as the right one,
  // which is the failure mode this whole check exists to prevent.
  //
  // The trailing guard rejects a following digit, and a comma ONLY when digits
  // follow it — i.e. a thousands separator continuing the number. An earlier
  // version rejected any following comma, which made "fixed $800, plus GST"
  // read as the page not stating $800 at all: a false failure on ordinary
  // punctuation, and one that masked a real count assertion in testing.
  const states = (source, figure) =>
    new RegExp('(?<![\\d.,])' + figure.replace(/[$.]/g, '\\$&') + '(?!\\d)(?!,\\d)').test(source);

  // --- Shared: what a depreciation sentence claims --------------------------
  //
  // The engine cannot be asked "what rate do you apply?". calcDepreciation only
  // returns rate × fraction × price — a single product — so any check that
  // recovered a rate from it would have to supply the fraction itself. An
  // earlier version of this check did exactly that: it divided by `price * 0.75`,
  // a copy of engine.js's building-value fraction hardcoded into the one file
  // that claims to hardcode nothing. Two things were wrong with it. The page's
  // own "of 75% of purchase price" claim went completely unguarded, and had the
  // engine moved to a 70% fraction the check would have demanded the page state
  // 2.3333% — a rate that exists nowhere.
  //
  // So BOTH numbers are parsed off the page and the PRODUCT is checked against
  // the engine: statedRate × statedFraction × price === calcDepreciation(...).
  // Nothing about the engine's internal split is assumed, and the fraction is
  // pinned by the same assertion that pins the rates.
  //
  // The fraction is identified by ELIMINATION rather than by matching prose:
  // strip the "R% (bracket wording)" groups and exactly one bare percentage must
  // remain. That works unchanged across about.html's "of 75% of purchase price
  // p.a." and the in-app note's terser "of 75% of the property value", and it
  // doubles as the count guard — a second bare percentage means a superseded
  // figure is still sitting in the sentence beside its replacement.
  const parseDepreciationClaims = text => {
    const groupRe = /([\d.]+)%\s*\(([^)]*)\)/g;
    const groups = [];
    let m;
    while ((m = groupRe.exec(text)) !== null) {
      groups.push({ rate: Number(m[1]), descriptor: m[2] });
    }
    const bare = (text.replace(/([\d.]+)%\s*\(([^)]*)\)/g, '').match(/[\d.]+%/g) || [])
      .map(s => Number(s.replace('%', '')));
    return { groups, bare };
  };
  // Every term is linear in price, so the value is arbitrary; this is the page's
  // own worked example, which keeps the dollar figures in failure messages
  // recognisable to whoever is reading the page.
  const PRICE = 650000;
  const statedDepreciation = (rate, fraction) => (rate / 100) * (fraction / 100) * PRICE;
  const sameMoney = (a, b) => Math.abs(a - b) < 0.01;

  // The age brackets are DERIVED from the app's own <select>, not restated here.
  // Bracket wording was a quarter of what the last drift got wrong ("mid / 5–20
  // yrs" against a select offering four different brackets), and a check that
  // only looked at percentages would have stayed green through all of it.
  const selectBlock = html.match(/<select[^>]*data-field="propertyAge"[^>]*>([\s\S]*?)<\/select>/);
  const ageOptions = [];
  if (selectBlock) {
    const optRe = /<option[^>]*value="([^"]+)"[^>]*>([^<]*)<\/option>/g;
    let om;
    while ((om = optRe.exec(selectBlock[1])) !== null) {
      ageOptions.push({ value: om[1], label: om[2].trim() });
    }
  }
  const norm = s => s.toLowerCase().replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim();
  // The distinctive half of an option label: three of the four begin
  // "Established," and are told apart only by what follows it.
  const bracketToken = label => norm(label.replace(/^\s*established\s*,?\s*/i, ''));

  const bracketsKnown = ageOptions.length > 0;
  if (!bracketsKnown) {
    fail('No <select data-field="propertyAge"> with <option> children found in index.html — the age '
      + 'brackets that about.html and the in-app tax note must agree with cannot be derived, so both '
      + 'depreciation sentences would go unchecked');
    bad++;
  }

  // --- Arm 1: the About page's depreciation bullet ---------------------------
  const DEP_ANCHOR = 'Depreciation estimate';
  const depBullet = bulletWith(about, DEP_ANCHOR);
  if (depBullet.problem) {
    reportBulletProblem(depBullet, DEP_ANCHOR, 'depreciation');
  } else if (bracketsKnown) {
    const claims = parseDepreciationClaims(depBullet.text);
    if (claims.bare.length !== 1) {
      fail(`about.html's depreciation bullet must state exactly one building-value fraction (the "of X% of `
        + `purchase price" term) outside its per-bracket rates — found ${claims.bare.length}`
        + `${claims.bare.length ? ' (' + claims.bare.map(b => b + '%').join(', ') + ')' : ''}.\n    `
        + `Page says: ${depBullet.text}\n    `
        + (claims.bare.length === 0
            ? 'Without it the stated rates cannot be multiplied out and checked against calcDepreciation at all.'
            : 'A leftover percentage means a superseded figure is still in the bullet beside its replacement.')
        + `\n    Fix about.html:${depBullet.line}`);
      bad++;
    } else {
      const fraction = claims.bare[0];
      const claimed = new Set();
      ageOptions.forEach(({ value, label }) => {
        const token = bracketToken(label);
        const group = claims.groups.find(g => norm(g.descriptor).includes(token));
        if (!group) {
          fail(`about.html's depreciation bullet does not cover the "${label}" age bracket that index.html's `
            + `propertyAge <select> offers (looked for "${token}" in its bracket wording).\n    `
            + `Page says: ${depBullet.text}\n    `
            + `The bullet and the select have to describe the same brackets — the last drift was as much `
            + `about stale brackets as about stale rates.\n    `
            + `Fix about.html:${depBullet.line}, or index.html:${lineOf(html, 'data-field="propertyAge"')} if the select changed`);
          bad++;
          return;
        }
        claimed.add(group);
        const stated = statedDepreciation(group.rate, fraction);
        const actual = calcDepreciation(value, PRICE);
        if (sameMoney(stated, actual)) return;
        const impliedRate = Number(((actual / PRICE) * 100 / (fraction / 100)).toFixed(4));
        fail(`about.html claims ${group.rate}% of ${fraction}% of purchase price for "${label}" — `
          + `${money(Math.round(stated))} a year on a ${money(PRICE)} property — but engine `
          + `calcDepreciation('${value}', ${PRICE}) returns ${money(Math.round(actual))}.\n    `
          + `Page says: ${depBullet.text}\n    `
          + `Either the rate or the ${fraction}% building-value fraction is wrong; holding the page's own `
          + `${fraction}% fraction, the rate should read ${impliedRate}%.\n    `
          + `Fix about.html:${depBullet.line}`);
        bad++;
      });
      claims.groups.filter(g => !claimed.has(g)).forEach(g => {
        fail(`about.html's depreciation bullet states a ${g.rate}% rate for "${g.descriptor}", which matches no `
          + `age bracket the propertyAge <select> offers — a superseded rate left beside its replacement `
          + `reads as green while the page contradicts itself.\n    `
          + `Page says: ${depBullet.text}\n    Fix about.html:${depBullet.line}`);
        bad++;
      });
    }
  }

  // --- Arm 2: the same rates in the in-app tax note -------------------------
  // The About page and this note carry the same fact and drifted together, so
  // they have to be pinned together — correcting only about.html would leave the
  // note stating 1.75% to every user of the calculator itself, unguarded.
  // Scoped to the note, not the whole file: index.html is 6,500 lines and a
  // file-wide search would be satisfied by any unrelated "2.5%".
  const NOTE_ANCHOR = 'Depreciation is estimated at';
  const noteBlocks = html.match(/<div class="computed-note">[\s\S]*?<\/div>/g) || [];
  const taxNote = noteBlocks.find(b => b.includes(NOTE_ANCHOR));
  if (!taxNote) {
    fail(`No .computed-note in index.html contains "${NOTE_ANCHOR}" — the in-app tax note has been removed `
      + `or reworded, and its depreciation rates can no longer be held to the engine`);
    bad++;
  } else if (bracketsKnown) {
    // The note is deliberately NOT held to the select's label wording the way
    // about.html is — it is a compact in-app helper and writes its brackets
    // tersely ("10-20y", not "Established, 10–20 years"). What it IS held to is
    // the arithmetic: the set of rate × fraction products it states must be the
    // set the engine actually computes, so a wrong rate or a wrong fraction
    // fails here whatever the surrounding wording.
    const noteClaims = parseDepreciationClaims(taxNote);
    const noteLine = lineOf(html, NOTE_ANCHOR);
    const quoted = taxNote.replace(/\s+/g, ' ').slice(0, 220) + '…';
    if (noteClaims.bare.length !== 1) {
      fail(`The in-app tax note must state exactly one building-value fraction (the "of X% of the property `
        + `value" term) outside its per-bracket rates — found ${noteClaims.bare.length}`
        + `${noteClaims.bare.length ? ' (' + noteClaims.bare.map(b => b + '%').join(', ') + ')' : ''}.\n    `
        + `Note says: ${quoted}\n    `
        + (noteClaims.bare.length === 0
            ? 'Without it the stated rates cannot be multiplied out and checked against calcDepreciation at all.'
            : 'A leftover percentage means a superseded figure is still in the note beside its replacement.')
        + `\n    Fix index.html:${noteLine}`);
      bad++;
    } else {
      const fraction = noteClaims.bare[0];
      // asKey is the comparison (order-insensitive, cent-rounded); asMoney is the
      // same set spelled for a human, sorted by value rather than lexically.
      const uniq = values => [...new Set(values.map(v => Number(v.toFixed(2))))].sort((a, b) => b - a);
      const asKey = values => uniq(values).join('|');
      const asMoney = values => uniq(values).map(v => money(Math.round(v))).join(', ');
      const statedValues = noteClaims.groups.map(g => statedDepreciation(g.rate, fraction));
      const engineValues = ageOptions.map(o => calcDepreciation(o.value, PRICE));
      if (asKey(statedValues) !== asKey(engineValues)) {
        // Reported as the rates the note SHOULD carry, derived by holding its own
        // stated fraction — the actionable form of "your products are wrong".
        const shouldRead = [...new Set(engineValues.map(v =>
          Number(((v / PRICE) * 100 / (fraction / 100)).toFixed(4))))].sort((a, b) => b - a);
        fail(`The in-app tax note's depreciation rates do not multiply out to what engine calcDepreciation `
          + `computes. Its ${noteClaims.groups.map(g => g.rate + '%').join(', ')} of ${fraction}% give `
          + `${asMoney(statedValues)} a year on a ${money(PRICE)} property; the engine gives `
          + `${asMoney(engineValues)}.\n    Note says: ${quoted}\n    `
          + `Holding the note's own ${fraction}% fraction, the rates should read `
          + `${shouldRead.map(r => r + '%').join(', ')}.\n    Fix index.html:${noteLine}`);
        bad++;
      }
    }
  }

  // --- Arm 3: per-state cost ranges ----------------------------------------
  // These three are the ones that went furthest wrong, because the engine did
  // not just change a number — it changed the SHAPE of the answer, from a fixed
  // fee and two percentages of price to eight flat per-state amounts. The page
  // can only be honest about that as a range, so derive the range and demand
  // both ends of it. Naming the state that carries each extreme keeps the
  // failure message actionable when stateDefaults is what moved.
  const stateKeys = Object.keys(stateDefaults);
  const costFields = [
    { field: 'conveyancing', anchor: 'Conveyancing',   what: 'conveyancing / legal fees' },
    { field: 'insurance',    anchor: 'Insurance',      what: 'insurance' },
    { field: 'council',      anchor: 'Council rates',  what: 'council rates' },
  ];
  costFields.forEach(({ field, anchor, what }) => {
    const entries = stateKeys.map(s => ({ state: s, value: stateDefaults[s][field] }));
    if (entries.some(e => typeof e.value !== 'number')) {
      fail(`stateDefaults no longer carries a numeric .${field} for every state — `
        + `the About page's ${what} range cannot be derived`);
      bad++;
      return;
    }
    const bullet = bulletWith(about, anchor);
    if (bullet.problem) {
      reportBulletProblem(bullet, anchor, what);
      return;
    }
    const lo = entries.reduce((a, b) => (b.value < a.value ? b : a));
    const hi = entries.reduce((a, b) => (b.value > a.value ? b : a));
    [['lowest', lo], ['highest', hi]].forEach(([which, extreme]) => {
      const figure = money(extreme.value);
      if (!states(bullet.text, figure)) {
        fail(`about.html does not state the ${which} ${what} figure, ${figure} (${extreme.state}).\n    `
          + `Page says: ${bullet.text}\n    `
          + `Engine does: a flat per-state amount from stateDefaults, `
          + `${money(lo.value)} (${lo.state}) to ${money(hi.value)} (${hi.state}) — not a fixed fee or a % of price.\n    `
          + `Fix about.html:${bullet.line}`);
        bad++;
        return;
      }
      // The page does not just quote a range, it ATTRIBUTES each end to a state.
      // Checking the dollar amount alone would stay green through a stateDefaults
      // edit that moved an extreme from one state to another without changing its
      // value, leaving the page confidently naming the wrong state. Matched in a
      // window around the figure so either order of "figure (STATE)" reads.
      const at = bullet.text.indexOf(figure);
      const window = bullet.text.slice(Math.max(0, at - 16), at + figure.length + 16);
      if (!new RegExp('\\b' + extreme.state + '\\b').test(window)) {
        fail(`about.html states ${figure} as the ${which} ${what} figure but does not attribute it to `
          + `${extreme.state}, which is the state stateDefaults actually gives that value.\n    `
          + `Page says: ${bullet.text}\n    `
          + `Engine does: ${money(lo.value)} (${lo.state}) to ${money(hi.value)} (${hi.state}).\n    `
          + `Fix about.html:${bullet.line}`);
        bad++;
      }
    });
    // Count as well as presence. stateDefaults gives these as flat dollar
    // amounts, so the bullet should carry exactly two figures — the two ends of
    // the range — and no percentage at all. This is what catches the half-done
    // edit: adding the new range while leaving "0.15% of purchase price p.a." in
    // the same <li> passes every presence test above while the page contradicts
    // itself. A percentage here is a claim the engine does not support.
    const dollars = dollarFigures(bullet.text);
    const percents = percentFigures(bullet.text);
    if (dollars.length !== 2) {
      fail(`about.html's ${what} bullet states ${dollars.length} dollar figure(s) (${dollars.join(', ') || 'none'}) `
        + `— expected exactly 2, the ends of the per-state range.\n    Page says: ${bullet.text}\n    `
        + `Fix about.html:${bullet.line}`);
      bad++;
    }
    if (percents.length > 0) {
      fail(`about.html's ${what} bullet still states a percentage (${percents.join(', ')}), but stateDefaults `
        + `gives ${field} as a flat per-state dollar amount, not a percentage of anything. This is the exact `
        + `claim that was wrong before — a superseded percentage left beside the new range.\n    `
        + `Page says: ${bullet.text}\n    Fix about.html:${bullet.line}`);
      bad++;
    }
  });

  // --- Arm 4: the two genuinely fixed fees ----------------------------------
  // These two are correct on the page today, so this arm catches nothing right
  // now — which is exactly the point of adding it. Conveyancing was also a fixed
  // fee once, and the page's claim about it rotted the moment the engine moved
  // it per-state. Pinning these means the same move on inspection or loan
  // establishment fails here on the commit that makes it, instead of being
  // discovered in the copy months later.
  const fixedFees = [
    { name: 'BUILDING_PEST',      value: BUILDING_PEST,      anchor: 'Building &amp; pest', what: 'building & pest inspection' },
    { name: 'LOAN_ESTABLISHMENT', value: LOAN_ESTABLISHMENT, anchor: 'Loan establishment',  what: 'loan establishment fee' },
  ];
  fixedFees.forEach(({ name, value, anchor, what }) => {
    const bullet = bulletWith(about, anchor);
    if (bullet.problem) {
      reportBulletProblem(bullet, anchor, what);
      return;
    }
    const figure = money(value);
    if (!states(bullet.text, figure)) {
      fail(`about.html does not state the ${what} as ${figure}.\n    `
        + `Page says: ${bullet.text}\n    `
        + `Engine does: ${name} = ${figure}, a single fixed fee for every state.\n    `
        + `Fix about.html:${bullet.line}`);
      bad++;
      return;
    }
    // One fee, one figure. If this bullet ever carries two, the engine has most
    // likely moved to a per-state range and only half the sentence was updated.
    const dollars = dollarFigures(bullet.text);
    if (dollars.length !== 1) {
      fail(`about.html's ${what} bullet states ${dollars.length} dollar figures (${dollars.join(', ')}) but `
        + `${name} is a single fixed fee — a second figure suggests a half-finished edit.\n    `
        + `Page says: ${bullet.text}\n    Fix about.html:${bullet.line}`);
      bad++;
    }
  });

  if (bad === 0) {
    ok(`About page figures match engine.js (${ageOptions.length} age brackets multiplied out against `
      + `calcDepreciation in about.html and the in-app tax note, ${costFields.length} per-state cost ranges `
      + `with state attribution over ${stateKeys.length} states, ${fixedFees.length} fixed fees)`);
  }
})();

// Result
console.log('');
console.log('Result:', failed === 0 ? 'PASS' : 'FAIL', `(${passed} passed, ${failed} failed)`);
process.exit(failed > 0 ? 1 : 0);
