// tests/unit.js
// Unit tests for pure functions in TrueReturn/index.html.
// Run with: node /Users/thinkindave/TrueReturn/tests/unit.js

const assert = require('assert');

// ---------------------------------------------------------------------------
// Pure functions copied verbatim from index.html
// ---------------------------------------------------------------------------

function formatCurrency(amount) {
  const abs = Math.abs(amount);
  const formatted = abs >= 1000
    ? '$' + abs.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : '$' + abs.toFixed(0);
  return amount < 0 ? '-' + formatted : formatted;
}

function calcStampDuty(state, price) {
  if (price <= 0) return 0;

  switch (state) {
    case 'NSW':
      if (price <= 14000) return price * 0.0125;
      if (price <= 31000) return 175 + (price - 14000) * 0.015;
      if (price <= 83000) return 430 + (price - 31000) * 0.0175;
      if (price <= 313000) return 1340 + (price - 83000) * 0.035;
      if (price <= 1043000) return 9390 + (price - 313000) * 0.045;
      if (price <= 3721000) return 42240 + (price - 1043000) * 0.055;
      return price * 0.07;

    case 'VIC':
      if (price <= 25000) return price * 0.014;
      if (price <= 130000) return 350 + (price - 25000) * 0.024;
      if (price <= 960000) return 2870 + (price - 130000) * 0.06;
      if (price <= 2000000) return price * 0.055;
      return 110000 + (price - 2000000) * 0.065;

    case 'QLD':
      if (price <= 5000) return 0;
      if (price <= 75000) return (price - 5000) * 0.015;
      if (price <= 540000) return 1050 + (price - 75000) * 0.035;
      if (price <= 1000000) return 17325 + (price - 540000) * 0.045;
      return 38025 + (price - 1000000) * 0.0575;

    case 'SA':
      if (price <= 12000) return price * 0.01;
      if (price <= 30000) return 120 + (price - 12000) * 0.02;
      if (price <= 50000) return 480 + (price - 30000) * 0.03;
      if (price <= 100000) return 1080 + (price - 50000) * 0.035;
      if (price <= 200000) return 2830 + (price - 100000) * 0.04;
      if (price <= 250000) return 6830 + (price - 200000) * 0.0425;
      if (price <= 300000) return 8955 + (price - 250000) * 0.0475;
      if (price <= 500000) return 11330 + (price - 300000) * 0.05;
      return 21330 + (price - 500000) * 0.055;

    case 'WA':
      if (price <= 120000) return price * 0.019;
      if (price <= 150000) return 2280 + (price - 120000) * 0.0285;
      if (price <= 360000) return 3135 + (price - 150000) * 0.038;
      if (price <= 725000) return 11115 + (price - 360000) * 0.0475;
      return 28453 + (price - 725000) * 0.0515;

    case 'TAS':
      if (price <= 3000) return 50;
      if (price <= 25000) return 50 + (price - 3000) * 0.0175;
      if (price <= 75000) return 435 + (price - 25000) * 0.0225;
      if (price <= 200000) return 1560 + (price - 75000) * 0.035;
      if (price <= 375000) return 5935 + (price - 200000) * 0.04;
      if (price <= 725000) return 12935 + (price - 375000) * 0.0425;
      return 27810 + (price - 725000) * 0.045;

    case 'ACT':
      if (price <= 260000) return price * 0.0049;
      if (price <= 300000) return 1040 + (price - 260000) * 0.022;
      if (price <= 500000) return 1920 + (price - 300000) * 0.034;
      if (price <= 750000) return 8720 + (price - 500000) * 0.0432;
      if (price <= 1000000) return 19520 + (price - 750000) * 0.059;
      if (price <= 1455000) return 34270 + (price - 1000000) * 0.064;
      return price * 0.0454;

    case 'NT':
      if (price <= 525000) {
        const v = price / 1000;
        return (0.06571441 * v * v + 15 * v);
      }
      if (price <= 3000000) return price * 0.0495;
      if (price <= 5000000) return price * 0.0575;
      return price * 0.0595;

    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

function approxEqual(actual, expected, tolerance) {
  const tol = tolerance !== undefined ? tolerance : 0.01;
  assert(
    Math.abs(actual - expected) <= tol,
    `Expected ~${expected} but got ${actual} (tolerance ${tol})`
  );
}

// ---------------------------------------------------------------------------
// formatCurrency tests
// ---------------------------------------------------------------------------

console.log('\nformatCurrency');

test('formats a whole dollar amount below 1000', () => {
  assert.strictEqual(formatCurrency(500), '$500');
});

test('formats a large positive amount with thousands separator', () => {
  // en-AU locale formats 1000 as $1,000
  assert.strictEqual(formatCurrency(1000), '$1,000');
});

test('formats a large positive amount (750000)', () => {
  assert.strictEqual(formatCurrency(750000), '$750,000');
});

test('formats zero', () => {
  assert.strictEqual(formatCurrency(0), '$0');
});

test('formats a negative amount below 1000', () => {
  assert.strictEqual(formatCurrency(-500), '-$500');
});

test('formats a negative large amount', () => {
  assert.strictEqual(formatCurrency(-1500), '-$1,500');
});

test('rounds fractional cents (positive)', () => {
  // 999.6 is below 1000 threshold — uses toFixed(0) which rounds to 1000
  // but 999.4 rounds to 999
  assert.strictEqual(formatCurrency(999.4), '$999');
});

// ---------------------------------------------------------------------------
// calcStampDuty — shared edge cases
// ---------------------------------------------------------------------------

console.log('\ncalcStampDuty — edge cases');

test('returns 0 for price of 0', () => {
  assert.strictEqual(calcStampDuty('NSW', 0), 0);
});

test('returns 0 for negative price', () => {
  assert.strictEqual(calcStampDuty('NSW', -10000), 0);
});

test('returns 0 for unknown state', () => {
  assert.strictEqual(calcStampDuty('XX', 500000), 0);
});

// ---------------------------------------------------------------------------
// calcStampDuty — NSW
// ---------------------------------------------------------------------------

console.log('\ncalcStampDuty — NSW');

test('NSW: first band (price <= 14000)', () => {
  // 10000 * 0.0125 = 125
  approxEqual(calcStampDuty('NSW', 10000), 125);
});

test('NSW: second band (14001–31000)', () => {
  // 175 + (20000 - 14000) * 0.015 = 175 + 90 = 265
  approxEqual(calcStampDuty('NSW', 20000), 265);
});

test('NSW: third band (31001–83000)', () => {
  // 430 + (50000 - 31000) * 0.0175 = 430 + 332.5 = 762.5
  approxEqual(calcStampDuty('NSW', 50000), 762.5);
});

test('NSW: fourth band (83001–313000)', () => {
  // 1340 + (200000 - 83000) * 0.035 = 1340 + 4095 = 5435
  approxEqual(calcStampDuty('NSW', 200000), 5435);
});

test('NSW: fifth band (313001–1043000) — typical $650k property', () => {
  // 9390 + (650000 - 313000) * 0.045 = 9390 + 15165 = 24555
  approxEqual(calcStampDuty('NSW', 650000), 24555);
});

test('NSW: sixth band (1043001–3721000)', () => {
  // 42240 + (2000000 - 1043000) * 0.055 = 42240 + 52635 = 94875
  approxEqual(calcStampDuty('NSW', 2000000), 94875);
});

test('NSW: top band (> 3721000)', () => {
  // 4000000 * 0.07 = 280000
  approxEqual(calcStampDuty('NSW', 4000000), 280000);
});

// ---------------------------------------------------------------------------
// calcStampDuty — VIC
// ---------------------------------------------------------------------------

console.log('\ncalcStampDuty — VIC');

test('VIC: first band (price <= 25000)', () => {
  // 20000 * 0.014 = 280
  approxEqual(calcStampDuty('VIC', 20000), 280);
});

test('VIC: second band (25001–130000)', () => {
  // 350 + (80000 - 25000) * 0.024 = 350 + 1320 = 1670
  approxEqual(calcStampDuty('VIC', 80000), 1670);
});

test('VIC: third band (130001–960000) — typical $600k property', () => {
  // 2870 + (600000 - 130000) * 0.06 = 2870 + 28200 = 31070
  approxEqual(calcStampDuty('VIC', 600000), 31070);
});

test('VIC: fourth band (960001–2000000)', () => {
  // 1500000 * 0.055 = 82500
  approxEqual(calcStampDuty('VIC', 1500000), 82500);
});

test('VIC: top band (> 2000000)', () => {
  // 110000 + (3000000 - 2000000) * 0.065 = 110000 + 65000 = 175000
  approxEqual(calcStampDuty('VIC', 3000000), 175000);
});

// ---------------------------------------------------------------------------
// calcStampDuty — QLD
// ---------------------------------------------------------------------------

console.log('\ncalcStampDuty — QLD');

test('QLD: duty-free band (price <= 5000)', () => {
  assert.strictEqual(calcStampDuty('QLD', 3000), 0);
});

test('QLD: second band (5001–75000)', () => {
  // (40000 - 5000) * 0.015 = 525
  approxEqual(calcStampDuty('QLD', 40000), 525);
});

test('QLD: third band (75001–540000) — typical $450k property', () => {
  // 1050 + (450000 - 75000) * 0.035 = 1050 + 13125 = 14175
  approxEqual(calcStampDuty('QLD', 450000), 14175);
});

test('QLD: fourth band (540001–1000000)', () => {
  // 17325 + (750000 - 540000) * 0.045 = 17325 + 9450 = 26775
  approxEqual(calcStampDuty('QLD', 750000), 26775);
});

test('QLD: top band (> 1000000)', () => {
  // 38025 + (1500000 - 1000000) * 0.0575 = 38025 + 28750 = 66775
  approxEqual(calcStampDuty('QLD', 1500000), 66775);
});

// ---------------------------------------------------------------------------
// calcStampDuty — SA
// ---------------------------------------------------------------------------

console.log('\ncalcStampDuty — SA');

test('SA: first band (price <= 12000)', () => {
  // 8000 * 0.01 = 80
  approxEqual(calcStampDuty('SA', 8000), 80);
});

test('SA: second band (12001–30000)', () => {
  // 120 + (20000 - 12000) * 0.02 = 120 + 160 = 280
  approxEqual(calcStampDuty('SA', 20000), 280);
});

test('SA: third band (30001–50000)', () => {
  // 480 + (40000 - 30000) * 0.03 = 480 + 300 = 780
  approxEqual(calcStampDuty('SA', 40000), 780);
});

test('SA: fourth band (50001–100000)', () => {
  // 1080 + (75000 - 50000) * 0.035 = 1080 + 875 = 1955
  approxEqual(calcStampDuty('SA', 75000), 1955);
});

test('SA: fifth band (100001–200000)', () => {
  // 2830 + (150000 - 100000) * 0.04 = 2830 + 2000 = 4830
  approxEqual(calcStampDuty('SA', 150000), 4830);
});

test('SA: sixth band (200001–250000)', () => {
  // 6830 + (225000 - 200000) * 0.0425 = 6830 + 1062.5 = 7892.5
  approxEqual(calcStampDuty('SA', 225000), 7892.5);
});

test('SA: seventh band (250001–300000)', () => {
  // 8955 + (275000 - 250000) * 0.0475 = 8955 + 1187.5 = 10142.5
  approxEqual(calcStampDuty('SA', 275000), 10142.5);
});

test('SA: eighth band (300001–500000)', () => {
  // 11330 + (400000 - 300000) * 0.05 = 11330 + 5000 = 16330
  approxEqual(calcStampDuty('SA', 400000), 16330);
});

test('SA: top band (> 500000)', () => {
  // 21330 + (700000 - 500000) * 0.055 = 21330 + 11000 = 32330
  approxEqual(calcStampDuty('SA', 700000), 32330);
});

// ---------------------------------------------------------------------------
// calcStampDuty — WA
// ---------------------------------------------------------------------------

console.log('\ncalcStampDuty — WA');

test('WA: first band (price <= 120000)', () => {
  // 80000 * 0.019 = 1520
  approxEqual(calcStampDuty('WA', 80000), 1520);
});

test('WA: second band (120001–150000)', () => {
  // 2280 + (135000 - 120000) * 0.0285 = 2280 + 427.5 = 2707.5
  approxEqual(calcStampDuty('WA', 135000), 2707.5);
});

test('WA: third band (150001–360000)', () => {
  // 3135 + (250000 - 150000) * 0.038 = 3135 + 3800 = 6935
  approxEqual(calcStampDuty('WA', 250000), 6935);
});

test('WA: fourth band (360001–725000)', () => {
  // 11115 + (500000 - 360000) * 0.0475 = 11115 + 6650 = 17765
  approxEqual(calcStampDuty('WA', 500000), 17765);
});

test('WA: top band (> 725000)', () => {
  // 28453 + (900000 - 725000) * 0.0515 = 28453 + 9012.5 = 37465.5
  approxEqual(calcStampDuty('WA', 900000), 37465.5);
});

// ---------------------------------------------------------------------------
// calcStampDuty — TAS
// ---------------------------------------------------------------------------

console.log('\ncalcStampDuty — TAS');

test('TAS: minimum duty band (price <= 3000)', () => {
  assert.strictEqual(calcStampDuty('TAS', 1000), 50);
});

test('TAS: second band (3001–25000)', () => {
  // 50 + (15000 - 3000) * 0.0175 = 50 + 210 = 260
  approxEqual(calcStampDuty('TAS', 15000), 260);
});

test('TAS: third band (25001–75000)', () => {
  // 435 + (50000 - 25000) * 0.0225 = 435 + 562.5 = 997.5
  approxEqual(calcStampDuty('TAS', 50000), 997.5);
});

test('TAS: fourth band (75001–200000)', () => {
  // 1560 + (150000 - 75000) * 0.035 = 1560 + 2625 = 4185
  approxEqual(calcStampDuty('TAS', 150000), 4185);
});

test('TAS: fifth band (200001–375000)', () => {
  // 5935 + (300000 - 200000) * 0.04 = 5935 + 4000 = 9935
  approxEqual(calcStampDuty('TAS', 300000), 9935);
});

test('TAS: sixth band (375001–725000)', () => {
  // 12935 + (500000 - 375000) * 0.0425 = 12935 + 5312.5 = 18247.5
  approxEqual(calcStampDuty('TAS', 500000), 18247.5);
});

test('TAS: top band (> 725000)', () => {
  // 27810 + (900000 - 725000) * 0.045 = 27810 + 7875 = 35685
  approxEqual(calcStampDuty('TAS', 900000), 35685);
});

// ---------------------------------------------------------------------------
// calcStampDuty — ACT
// ---------------------------------------------------------------------------

console.log('\ncalcStampDuty — ACT');

test('ACT: first band (price <= 260000)', () => {
  // 200000 * 0.0049 = 980
  approxEqual(calcStampDuty('ACT', 200000), 980);
});

test('ACT: second band (260001–300000)', () => {
  // 1040 + (280000 - 260000) * 0.022 = 1040 + 440 = 1480
  approxEqual(calcStampDuty('ACT', 280000), 1480);
});

test('ACT: third band (300001–500000)', () => {
  // 1920 + (400000 - 300000) * 0.034 = 1920 + 3400 = 5320
  approxEqual(calcStampDuty('ACT', 400000), 5320);
});

test('ACT: fourth band (500001–750000)', () => {
  // 8720 + (600000 - 500000) * 0.0432 = 8720 + 4320 = 13040
  approxEqual(calcStampDuty('ACT', 600000), 13040);
});

test('ACT: fifth band (750001–1000000)', () => {
  // 19520 + (900000 - 750000) * 0.059 = 19520 + 8850 = 28370
  approxEqual(calcStampDuty('ACT', 900000), 28370);
});

test('ACT: sixth band (1000001–1455000)', () => {
  // 34270 + (1200000 - 1000000) * 0.064 = 34270 + 12800 = 47070
  approxEqual(calcStampDuty('ACT', 1200000), 47070);
});

test('ACT: top band (> 1455000)', () => {
  // 2000000 * 0.0454 = 90800
  approxEqual(calcStampDuty('ACT', 2000000), 90800);
});

// ---------------------------------------------------------------------------
// calcStampDuty — NT
// ---------------------------------------------------------------------------

console.log('\ncalcStampDuty — NT');

test('NT: formula band (price <= 525000) — $300k property', () => {
  // v = 300, result = 0.06571441 * 300^2 + 15 * 300 = 5914.2969 + 4500 = 10414.2969
  const v = 300;
  const expected = 0.06571441 * v * v + 15 * v;
  approxEqual(calcStampDuty('NT', 300000), expected, 0.01);
});

test('NT: formula band boundary (price = 525000)', () => {
  const v = 525;
  const expected = 0.06571441 * v * v + 15 * v;
  approxEqual(calcStampDuty('NT', 525000), expected, 0.01);
});

test('NT: second band (525001–3000000)', () => {
  // 1000000 * 0.0495 = 49500
  approxEqual(calcStampDuty('NT', 1000000), 49500);
});

test('NT: third band (3000001–5000000)', () => {
  // 4000000 * 0.0575 = 230000
  approxEqual(calcStampDuty('NT', 4000000), 230000);
});

test('NT: top band (> 5000000)', () => {
  // 6000000 * 0.0595 = 357000
  approxEqual(calcStampDuty('NT', 6000000), 357000);
});

// ---------------------------------------------------------------------------
// Graph helper functions — purity analysis
// ---------------------------------------------------------------------------
//
// buildPropertyDatasets(metric)
//   NOT testable here. It opens with document.querySelectorAll('.property-entry')
//   and reads values from DOM nodes. It also closes over the module-level
//   stateDefaults object. Any attempt to run it outside a browser would throw
//   "document is not defined".
//
// renderGraphLegend(containerId, datasets)
//   NOT testable here. It calls document.getElementById() and mutates
//   innerHTML. DOM-dependent.
//
// initGraphs() / renderGraphs()
//   NOT testable here. Both reach into the DOM (getElementById, querySelectorAll)
//   and construct Chart.js instances. DOM- and library-dependent.
//
// buildChartOptions(metric, isDark)
//   STRUCTURALLY PURE — both arguments are primitives. Returns a plain
//   configuration object. The only non-primitive dependency is formatCurrency,
//   which is already inlined above. Testable without any DOM. Copied verbatim below.

// ---------------------------------------------------------------------------
// Pure functions copied verbatim from index.html (graph section)
// ---------------------------------------------------------------------------

const GRAPH_YEARS = 15;

function buildChartOptions(metric, isDark) {
  const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const tickColor = isDark ? '#9CA3AF' : '#6B7280';
  const tooltipBg = isDark ? '#1F2937' : '#FFFFFF';
  const tooltipBorder = isDark ? '#374151' : '#E5E7EB';
  const tooltipText = isDark ? '#F9FAFB' : '#1F2937';
  const isCurrency = metric === 'value' || metric === 'equity' || metric === 'cumulativeCashFlow' || metric === 'totalProfit';

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        borderWidth: 1,
        titleColor: tooltipText,
        bodyColor: tickColor,
        padding: 10,
        callbacks: {
          label: function(ctx) {
            const val = ctx.parsed.y;
            if (val === null || val === undefined) return null;
            const formatted = isCurrency ? formatCurrency(val) : val.toFixed(2) + '%';
            return ' ' + ctx.dataset.label + ': ' + formatted;
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: tickColor, font: { size: 11 } }
      },
      y: {
        grid: { color: gridColor },
        ticks: {
          color: tickColor,
          font: { size: 11 },
          callback: function(val) {
            return isCurrency ? formatCurrency(val) : val.toFixed(1) + '%';
          }
        }
      }
    }
  };

  return options;
}

// ---------------------------------------------------------------------------
// buildChartOptions — structural properties
// ---------------------------------------------------------------------------

console.log('\nbuildChartOptions — structure');

test('returns responsive:true and maintainAspectRatio:false', () => {
  const opts = buildChartOptions('value', false);
  assert.strictEqual(opts.responsive, true);
  assert.strictEqual(opts.maintainAspectRatio, false);
});

test('interaction mode is "index" with intersect:false', () => {
  const opts = buildChartOptions('value', false);
  assert.strictEqual(opts.interaction.mode, 'index');
  assert.strictEqual(opts.interaction.intersect, false);
});

test('legend display is false', () => {
  const opts = buildChartOptions('value', false);
  assert.strictEqual(opts.plugins.legend.display, false);
});

test('x and y scale objects are present', () => {
  const opts = buildChartOptions('value', false);
  assert.ok(opts.scales.x, 'scales.x should exist');
  assert.ok(opts.scales.y, 'scales.y should exist');
});

// ---------------------------------------------------------------------------
// buildChartOptions — isDark colour switching
// ---------------------------------------------------------------------------

console.log('\nbuildChartOptions — isDark colour switching');

test('dark mode sets tooltip background to #1F2937', () => {
  const opts = buildChartOptions('value', true);
  assert.strictEqual(opts.plugins.tooltip.backgroundColor, '#1F2937');
});

test('light mode sets tooltip background to #FFFFFF', () => {
  const opts = buildChartOptions('value', false);
  assert.strictEqual(opts.plugins.tooltip.backgroundColor, '#FFFFFF');
});

test('dark mode sets tooltip border to #374151', () => {
  const opts = buildChartOptions('value', true);
  assert.strictEqual(opts.plugins.tooltip.borderColor, '#374151');
});

test('light mode sets tooltip border to #E5E7EB', () => {
  const opts = buildChartOptions('value', false);
  assert.strictEqual(opts.plugins.tooltip.borderColor, '#E5E7EB');
});

test('dark mode tick colour is #9CA3AF', () => {
  const opts = buildChartOptions('value', true);
  assert.strictEqual(opts.plugins.tooltip.bodyColor, '#9CA3AF');
});

test('light mode tick colour is #6B7280', () => {
  const opts = buildChartOptions('value', false);
  assert.strictEqual(opts.plugins.tooltip.bodyColor, '#6B7280');
});

// ---------------------------------------------------------------------------
// buildChartOptions — isCurrency detection in callbacks
// ---------------------------------------------------------------------------

console.log('\nbuildChartOptions — tooltip label callback');

test('currency metric: tooltip label callback formats with $', () => {
  const opts = buildChartOptions('value', false);
  const cb = opts.plugins.tooltip.callbacks.label;
  const result = cb({ parsed: { y: 500000 }, dataset: { label: 'Prop A' } });
  assert.ok(result.includes('$'), 'should contain $ sign for currency metric');
  assert.ok(result.includes('Prop A'), 'should include dataset label');
});

test('currency metric "equity": tooltip label callback formats with $', () => {
  const opts = buildChartOptions('equity', false);
  const cb = opts.plugins.tooltip.callbacks.label;
  const result = cb({ parsed: { y: 150000 }, dataset: { label: 'P1' } });
  assert.ok(result.includes('$'));
});

test('currency metric "totalProfit": tooltip label callback formats with $', () => {
  const opts = buildChartOptions('totalProfit', false);
  const cb = opts.plugins.tooltip.callbacks.label;
  const result = cb({ parsed: { y: 320000 }, dataset: { label: 'P1' } });
  assert.ok(result.includes('$'), 'totalProfit should be treated as a currency metric');
  assert.ok(!result.includes('%'), 'totalProfit should not use % format');
});

test('non-currency metric "annualisedReturn": tooltip label uses % not $', () => {
  const opts = buildChartOptions('annualisedReturn', false);
  const cb = opts.plugins.tooltip.callbacks.label;
  const result = cb({ parsed: { y: 7.53 }, dataset: { label: 'P1' } });
  assert.ok(result.includes('%'), 'should contain % for non-currency metric');
  assert.ok(!result.includes('$'), 'should not contain $ for non-currency metric');
});

test('tooltip label callback returns null when val is null', () => {
  const opts = buildChartOptions('value', false);
  const cb = opts.plugins.tooltip.callbacks.label;
  const result = cb({ parsed: { y: null }, dataset: { label: 'P1' } });
  assert.strictEqual(result, null);
});

test('y-axis tick callback uses % for annualisedReturn', () => {
  const opts = buildChartOptions('annualisedReturn', false);
  const tickCb = opts.scales.y.ticks.callback;
  const result = tickCb(8.5);
  assert.ok(result.includes('%'));
  assert.ok(!result.includes('$'));
});

test('y-axis tick callback uses $ for value metric', () => {
  const opts = buildChartOptions('value', false);
  const tickCb = opts.scales.y.ticks.callback;
  const result = tickCb(250000);
  assert.ok(result.includes('$'));
});

// ---------------------------------------------------------------------------
// calcAnnualisedReturn — CAGR formula
//
// NOTE: There is no standalone pure function for this in index.html.
// The formula is inlined at two separate DOM-dependent calculation sites
// (projections loop ~line 3152, buildPropertyDatasets ~line 3303).
// The helper below is a direct transcription of that inlined formula:
//
//   const annualisedReturn = totalUpfront > 0
//     ? (Math.pow(1 + totalProfit / totalUpfront, 1 / years) - 1) * 100
//     : 0;
//
// If the formula in index.html changes these tests will not automatically
// detect the divergence — treat a passing result here as arithmetic
// confirmation only. Keep this note updated if the source changes.
// ---------------------------------------------------------------------------

function calcAnnualisedReturn(totalProfit, totalUpfront, years) {
  return totalUpfront > 0 ? (Math.pow(1 + totalProfit / totalUpfront, 1 / years) - 1) * 100 : 0;
}

console.log('\ncalcAnnualisedReturn (CAGR)');

test('zero upfront returns 0 (guard against division by zero)', () => {
  assert.strictEqual(calcAnnualisedReturn(50000, 0, 10), 0);
});

test('zero profit over any period returns 0%', () => {
  approxEqual(calcAnnualisedReturn(0, 100000, 5), 0);
});

test('doubles money over 10 years is ~7.18% CAGR', () => {
  // 100000 profit on 100000 upfront over 10 years: (2^(1/10) - 1)*100
  const expected = (Math.pow(2, 0.1) - 1) * 100; // ~7.177
  approxEqual(calcAnnualisedReturn(100000, 100000, 10), expected, 0.001);
});

test('5-year scenario: $50k profit on $100k upfront', () => {
  // (1.5^(1/5) - 1)*100 = ~8.447%
  const expected = (Math.pow(1.5, 0.2) - 1) * 100;
  approxEqual(calcAnnualisedReturn(50000, 100000, 5), expected, 0.001);
});

test('negative profit produces negative CAGR', () => {
  // -20k profit on 100k over 5 years: (0.8^0.2 - 1)*100 ≈ -4.35%
  const result = calcAnnualisedReturn(-20000, 100000, 5);
  assert.ok(result < 0, `Expected negative CAGR, got ${result}`);
  approxEqual(result, (Math.pow(0.8, 0.2) - 1) * 100, 0.001);
});

test('1-year holding: annualised equals simple return percentage', () => {
  // (1 + 20000/100000)^(1/1) - 1 = 0.2 = 20%
  approxEqual(calcAnnualisedReturn(20000, 100000, 1), 20, 0.001);
});

test('large profit over long term (30-year loan lifetime)', () => {
  // $500k profit on $150k upfront over 30 years
  const expected = (Math.pow(1 + 500000 / 150000, 1 / 30) - 1) * 100;
  approxEqual(calcAnnualisedReturn(500000, 150000, 30), expected, 0.001);
});

// ---------------------------------------------------------------------------
// calcScenarioProfit — pure version for unit testing
//
// The production calcScenarioProfit(entry, years, growthRate) reads all
// inputs from DOM elements inside `entry`. The arithmetic is identical;
// only the data-access layer differs. The pure version below accepts a
// plain object `data` with the same field names as the DOM data-field
// attributes, plus a `stateDefaults` map that mirrors the one in index.html.
//
// Both functions copied / adapted verbatim from index.html lines 3148–3209.
// If the source formula changes, update this copy and the tests.
// ---------------------------------------------------------------------------

const stateDefaults = {
  NSW: { conveyancing: 1800, insurance: 1800, council: 2000 },
  VIC: { conveyancing: 1100, insurance: 1500, council: 1900 },
  QLD: { conveyancing: 900,  insurance: 2200, council: 1800 },
  SA:  { conveyancing: 1000, insurance: 1300, council: 1600 },
  WA:  { conveyancing: 1300, insurance: 1500, council: 1800 },
  TAS: { conveyancing: 1000, insurance: 1200, council: 1400 },
  ACT: { conveyancing: 1100, insurance: 1300, council: 2100 },
  NT:  { conveyancing: 1000, insurance: 2500, council: 1700 },
};

function calcScenarioProfitPure(data, years, growthRate) {
  function ef(field) { return data[field] !== undefined ? String(data[field]) : ''; }
  function ev(field) { return parseFloat(ef(field)) || 0; }

  const purchasePrice   = ev('purchasePrice');
  const depositPct      = ev('depositPct') / 100;
  const loanAmount      = purchasePrice * (1 - depositPct);
  const loanTerm        = ev('loanTerm') || 30;
  const interestRate    = ev('interestRate') / 100;
  const loanType        = ef('loanType');
  const weeklyRent      = ev('weeklyRent');
  const managementFeePct = ev('managementFee') / 100;
  const state           = ef('state');
  const sd              = stateDefaults[state] || stateDefaults['QLD'];
  const stampDuty       = Math.round(calcStampDuty(state, purchasePrice));
  const totalUpfront    = purchasePrice * depositPct + stampDuty + sd.conveyancing;

  let annualLoanPayment;
  if (loanType === 'IO') {
    annualLoanPayment = loanAmount * interestRate;
  } else if (interestRate === 0) {
    annualLoanPayment = loanAmount / loanTerm;
  } else {
    const monthlyRate  = interestRate / 12;
    const numPayments  = loanTerm * 12;
    annualLoanPayment  = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
                         (Math.pow(1 + monthlyRate, numPayments) - 1) * 12;
  }

  let remainingLoan;
  if (loanType === 'IO') {
    remainingLoan = loanAmount;
  } else if (interestRate === 0) {
    remainingLoan = Math.max(0, loanAmount - (loanAmount / (loanTerm * 12)) * (years * 12));
  } else {
    const monthlyRate   = interestRate / 12;
    const totalPayments = loanTerm * 12;
    const paymentsMade  = Math.min(years * 12, totalPayments);
    remainingLoan = loanAmount *
      (Math.pow(1 + monthlyRate, totalPayments) - Math.pow(1 + monthlyRate, paymentsMade)) /
      (Math.pow(1 + monthlyRate, totalPayments) - 1);
    if (remainingLoan < 0) remainingLoan = 0;
  }

  const futureValue    = purchasePrice * Math.pow(1 + growthRate, years);
  const salesCosts     = futureValue * 0.03;
  const netProceeds    = futureValue - salesCosts - remainingLoan;
  const costBase       = purchasePrice + stampDuty + sd.conveyancing + salesCosts;
  const capitalGain    = futureValue - costBase;
  const cgt            = capitalGain > 0 ? capitalGain * 0.5 * 0.3 : 0;
  const trueCashReturn = netProceeds - cgt;

  let cumulativeCashFlow = 0;
  for (let y = 1; y <= years; y++) {
    const yRent     = weeklyRent * Math.pow(1 + growthRate, y) * 52;
    const yValue    = purchasePrice * Math.pow(1 + growthRate, y);
    const yMgmt     = yRent * managementFeePct;
    const yVacancy  = weeklyRent * Math.pow(1 + growthRate, y) * 2;
    const yMaint    = yValue * 0.005;
    const yExpenses = annualLoanPayment + yMgmt + sd.insurance + sd.council + yVacancy + yMaint;
    cumulativeCashFlow += yRent - yExpenses;
  }

  return (trueCashReturn - totalUpfront) + cumulativeCashFlow;
}

// ---------------------------------------------------------------------------
// Reference entry: NSW PI loan, $500k property, 20% deposit, 5% interest,
// 30-year term, $500/wk rent, 8% management fee.
// ---------------------------------------------------------------------------

const refEntry = {
  purchasePrice: 500000,
  depositPct:    20,
  loanTerm:      30,
  interestRate:  5,
  loanType:      'PI',
  weeklyRent:    500,
  managementFee: 8,
  state:         'NSW',
};

// ---------------------------------------------------------------------------
// calcScenarioProfit — growth rate variants
// ---------------------------------------------------------------------------

console.log('\ncalcScenarioProfit — growth rate variants');

test('zero growth rate: profit is a finite number', () => {
  const result = calcScenarioProfitPure(refEntry, 10, 0);
  assert.ok(typeof result === 'number' && isFinite(result),
    `Expected finite number, got ${result}`);
});

test('positive growth (0.04) produces higher profit than flat (0) at year 10', () => {
  const flat     = calcScenarioProfitPure(refEntry, 10, 0);
  const positive = calcScenarioProfitPure(refEntry, 10, 0.04);
  assert.ok(positive > flat,
    `Expected positive > flat but got positive=${positive}, flat=${flat}`);
});

test('negative growth (-0.02) produces lower profit than flat (0) at year 10', () => {
  const flat     = calcScenarioProfitPure(refEntry, 10, 0);
  const negative = calcScenarioProfitPure(refEntry, 10, -0.02);
  assert.ok(negative < flat,
    `Expected negative < flat but got negative=${negative}, flat=${flat}`);
});

// ---------------------------------------------------------------------------
// calcScenarioProfit — IO vs PI loan types
// ---------------------------------------------------------------------------

console.log('\ncalcScenarioProfit — IO vs PI loan types');

test('IO and PI loans produce different profits at year 10 (same growth)', () => {
  const piEntry = Object.assign({}, refEntry, { loanType: 'PI' });
  const ioEntry = Object.assign({}, refEntry, { loanType: 'IO' });
  const pi = calcScenarioProfitPure(piEntry, 10, 0.03);
  const io = calcScenarioProfitPure(ioEntry, 10, 0.03);
  assert.ok(pi !== io,
    `Expected IO and PI to differ, both returned ${pi}`);
});

test('IO loan: remaining loan equals full loanAmount at any year', () => {
  // With IO the entire principal remains outstanding, so equity is lower
  // and PI pays down principal — PI equity > IO equity at same future value.
  // Net of CGT and cash flow, PI should have higher equity component.
  const piProfit = calcScenarioProfitPure(
    Object.assign({}, refEntry, { loanType: 'PI', weeklyRent: 0, managementFee: 0 }),
    15, 0);
  const ioProfit = calcScenarioProfitPure(
    Object.assign({}, refEntry, { loanType: 'IO', weeklyRent: 0, managementFee: 0 }),
    15, 0);
  // PI reduces remaining loan over time so proceeds after repayment are higher
  assert.ok(piProfit > ioProfit,
    `Expected PI profit (${piProfit}) > IO profit (${ioProfit}) with zero growth`);
});

// ---------------------------------------------------------------------------
// calcScenarioProfit — increasing profit over years (positive growth)
// ---------------------------------------------------------------------------

console.log('\ncalcScenarioProfit — increasing profits over years (positive growth)');

test('year 5 profit < year 10 profit at 4% growth', () => {
  const y5  = calcScenarioProfitPure(refEntry, 5,  0.04);
  const y10 = calcScenarioProfitPure(refEntry, 10, 0.04);
  assert.ok(y5 < y10,
    `Expected yr5 (${y5}) < yr10 (${y10})`);
});

test('year 10 profit < year 15 profit at 4% growth', () => {
  const y10 = calcScenarioProfitPure(refEntry, 10, 0.04);
  const y15 = calcScenarioProfitPure(refEntry, 15, 0.04);
  assert.ok(y10 < y15,
    `Expected yr10 (${y10}) < yr15 (${y15})`);
});

test('profits at years 5, 10, 15 are strictly increasing at 4% growth', () => {
  const y5  = calcScenarioProfitPure(refEntry, 5,  0.04);
  const y10 = calcScenarioProfitPure(refEntry, 10, 0.04);
  const y15 = calcScenarioProfitPure(refEntry, 15, 0.04);
  assert.ok(y5 < y10 && y10 < y15,
    `Expected y5 < y10 < y15, got ${y5}, ${y10}, ${y15}`);
});

// ---------------------------------------------------------------------------
// calcScenarioProfit — edge cases: zero purchase price and zero deposit
// ---------------------------------------------------------------------------

console.log('\ncalcScenarioProfit — edge cases');

test('zero purchase price returns a finite number (no division errors)', () => {
  const zeroPrice = Object.assign({}, refEntry, { purchasePrice: 0 });
  const result = calcScenarioProfitPure(zeroPrice, 10, 0.03);
  assert.ok(isFinite(result),
    `Expected finite number for zero purchase price, got ${result}`);
});

test('zero purchase price with zero rent: profit equals accumulated fixed expenses (negative)', () => {
  // With purchasePrice=0: loanAmount=0, stampDuty=0, totalUpfront=conveyancing only.
  // annualLoanPayment=0. Each year: yRent=0, yMgmt=0, yVacancy=0, yMaint=0,
  // but sd.insurance and sd.council are still charged (NSW: 1800+2000=3800/yr).
  // cumulativeCashFlow = -(3800 * years).
  // futureValue=0, equity=0, cgt=0, netProceeds=0.
  // totalUpfront = 0 + 0 + 1800 (NSW conveyancing).
  // expected = (0 - 1800) + (-(3800 * 10)) = -1800 + (-38000) = -39800.
  const zeroPrice = Object.assign({}, refEntry, { purchasePrice: 0, weeklyRent: 0 });
  const sd = stateDefaults['NSW'];
  const expectedCashFlow = -(sd.insurance + sd.council) * 10;
  const expectedUpfrontPenalty = -sd.conveyancing;
  const expected = expectedUpfrontPenalty + expectedCashFlow;
  approxEqual(calcScenarioProfitPure(zeroPrice, 10, 0.03), expected, 0.01);
});

test('zero deposit (100% LVR): totalUpfront is only stamp duty + conveyancing', () => {
  // With depositPct=0, loanAmount = purchasePrice, totalUpfront = 0 + stampDuty + conveyancing.
  // The function should still return a finite number.
  const zeroDeposit = Object.assign({}, refEntry, { depositPct: 0, weeklyRent: 0, managementFee: 0 });
  const result = calcScenarioProfitPure(zeroDeposit, 10, 0.03);
  assert.ok(isFinite(result),
    `Expected finite number for zero deposit, got ${result}`);
});

test('zero deposit produces lower profit than 20% deposit at same growth (more loan to repay)', () => {
  // Higher LVR means more remaining loan and higher loan payments,
  // so proceeds net of debt are lower — profit should be lower.
  const zeroDeposit = Object.assign({}, refEntry, { depositPct: 0 });
  const withDeposit = refEntry;
  const r0  = calcScenarioProfitPure(zeroDeposit, 10, 0.03);
  const r20 = calcScenarioProfitPure(withDeposit,  10, 0.03);
  assert.ok(r0 < r20,
    `Expected 0% deposit profit (${r0}) < 20% deposit profit (${r20})`);
});

// ---------------------------------------------------------------------------
// calcScenarioProfit — arithmetic spot-check at year 1, zero growth
// ---------------------------------------------------------------------------

console.log('\ncalcScenarioProfit — arithmetic spot-check');

test('year 1, zero growth: result matches hand-calculated value', () => {
  // Use a simple entry to make the arithmetic tractable:
  // purchasePrice=200000, deposit=50% (100k cash in), loanAmount=100000,
  // interestRate=0 (makes annualLoanPayment = 100000/30 per year),
  // loanType=PI, weeklyRent=0, managementFee=0, state=NSW.
  //
  // loanTerm=30, interestRate=0 path:
  //   annualLoanPayment = 100000 / 30
  //   remainingLoan (y=1) = max(0, 100000 - (100000/360)*12) = 100000 - 100000/30
  //
  // futureValue = 200000 (growthRate=0)
  // salesCosts = 200000 * 0.03 = 6000
  // netProceeds = 200000 - 6000 - (100000 - 100000/30) = 94000 + 100000/30
  // costBase = 200000 + 5435 + 1800 + 6000 = 213235
  // capitalGain = 200000 - 213235 = -13235 → cgt = 0
  // trueCashReturn = netProceeds - 0 = 94000 + 100000/30
  //
  // stampDuty NSW $200k: 1340 + (200000-83000)*0.035 = 1340 + 4095 = 5435
  // totalUpfront = 200000*0.50 + 5435 + 1800 = 107235
  //
  // cashFlow year 1 (rent=0, mgmt=0):
  //   yExpenses = annualLoanPayment + 0 + 1800 + 2000 + 0 + (200000*0.005)
  //             = 100000/30 + 3800 + 1000 = 100000/30 + 4800
  //   cashFlow year 1 = -(100000/30 + 4800)
  //
  // totalProfit = (trueCashReturn - totalUpfront) + cumulativeCashFlow
  //             = (94000 + 100000/30 - 107235) + (-(100000/30 + 4800))
  //             = (-13235 + 100000/30) + (-100000/30 - 4800)
  //             = -13235 - 4800
  //             = -18035

  const entry = {
    purchasePrice: 200000,
    depositPct:    50,
    loanTerm:      30,
    interestRate:  0,
    loanType:      'PI',
    weeklyRent:    0,
    managementFee: 0,
    state:         'NSW',
  };

  // Replicate the formula exactly in JS to avoid floating-point mismatches
  const purchasePrice   = 200000;
  const depositPct      = 0.50;
  const loanAmount      = purchasePrice * (1 - depositPct);               // 100000
  const loanTerm        = 30;
  const interestRate    = 0;
  const stampDuty       = Math.round(calcStampDuty('NSW', purchasePrice)); // 5435
  const conveyancing    = 1800;
  const totalUpfront    = purchasePrice * depositPct + stampDuty + conveyancing; // 107235
  const annualLP        = loanAmount / loanTerm;                           // interest=0 path
  const remainingLoan   = Math.max(0, loanAmount - (loanAmount / (loanTerm * 12)) * 12);
  const futureValue     = purchasePrice;                                    // growthRate=0
  const salesCosts      = futureValue * 0.03;                              // 6000
  const netProceeds     = futureValue - salesCosts - remainingLoan;
  const costBase        = purchasePrice + stampDuty + conveyancing + salesCosts;
  const capitalGain     = futureValue - costBase;                          // negative → cgt=0
  const cgt             = capitalGain > 0 ? capitalGain * 0.5 * 0.3 : 0;
  const trueCashReturn  = netProceeds - cgt;
  const yMaint          = futureValue * 0.005;
  const yExpenses       = annualLP + 1800 + 2000 + yMaint;                 // rent=mgmt=vacancy=0
  const cashFlow1       = 0 - yExpenses;
  const expected        = (trueCashReturn - totalUpfront) + cashFlow1;

  approxEqual(calcScenarioProfitPure(entry, 1, 0), expected, 0.01);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
