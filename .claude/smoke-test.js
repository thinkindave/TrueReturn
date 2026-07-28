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
  { label: 'tests/engine.test.js', file: path.join(TESTS_DIR, 'engine.test.js'), minTests: 116 }
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
  'proj5CgtTreatment', 'proj10CgtTreatment', 'projLifeCgtTreatment'
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
  'name', 'expectedGrowth'
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

// Result
console.log('');
console.log('Result:', failed === 0 ? 'PASS' : 'FAIL', `(${passed} passed, ${failed} failed)`);
process.exit(failed > 0 ? 1 : 0);
