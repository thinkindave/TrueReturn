#!/usr/bin/env node
/**
 * TrueReturn smoke test script.
 * Run with: node .claude/smoke-test.js
 * Exits 0 on PASS, 1 on FAIL.
 */

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(__dirname, '../index.html');
const TESTS_PATH = path.join(__dirname, '../tests/unit.js');

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

// 2. Unit tests
try {
  require(TESTS_PATH);
  ok('Unit tests passed');
} catch(e) {
  fail('Unit tests failed: ' + e.message);
}

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
  // Reform UI wiring (2b-1, UI spec §§3–5)
  'quarantineSection', 'resQuarantinePool', 'resRefundsForegone',
  'resRecoveredAlongWay', 'resPoolBenefit', 'deemedValueChip',
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
  'name', 'expectedGrowth',
  // Reform UI wiring (2b-1, UI spec §2/§5)
  'grandfathered', 'dwellingType', 'deemedValueOverride'
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
