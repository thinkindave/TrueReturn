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

// Every test suite that must run. Each is executed in its own child process so
// that (a) the shared module-level counters in tests/harness.js don't pool into
// one running total, and (b) a failing suite's summary() process.exit(1) can't
// abort the rest of the smoke test.
// minTests is a ratchet, not an exact count: adding tests is fine, but a suite
// that silently shrinks (or stops running its tests at all) fails the check.
const TESTS_DIR = path.join(__dirname, '../tests');
const TEST_SUITES = [
  { label: 'tests/unit.js', file: path.join(TESTS_DIR, 'unit.js'), minTests: 199 },
  { label: 'tests/engine.test.js', file: path.join(TESTS_DIR, 'engine.test.js'), minTests: 128 }
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

// Result
console.log('');
console.log('Result:', failed === 0 ? 'PASS' : 'FAIL', `(${passed} passed, ${failed} failed)`);
process.exit(failed > 0 ? 1 : 0);
