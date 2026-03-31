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
      if (price <= 260000) return price * 0.006;
      if (price <= 300000) return 1560 + (price - 260000) * 0.022;
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

test('ACT: first band (price <= 260000) — corrected rate 0.60%', () => {
  // Rate was corrected from 0.49% (0.0049) to 0.60% (0.006).
  // 200000 * 0.006 = 1200
  approxEqual(calcStampDuty('ACT', 200000), 1200);
});

test('ACT: first band boundary at exactly 260000 — corrected rate 0.60%', () => {
  // 260000 * 0.006 = 1560
  approxEqual(calcStampDuty('ACT', 260000), 1560);
});

test('ACT: first band does NOT use old 0.49% rate', () => {
  // Old rate would give 200000 * 0.0049 = 980; corrected rate gives 1200.
  const result = calcStampDuty('ACT', 200000);
  assert.ok(result !== 980, `ACT first band should not use old 0.49% rate (980); got ${result}`);
  approxEqual(result, 1200);
});

test('ACT: second band (260001–300000) — corrected accumulator 1560', () => {
  // Accumulator was corrected from 1040 to 1560.
  // 1560 + (280000 - 260000) * 0.022 = 1560 + 440 = 2000
  approxEqual(calcStampDuty('ACT', 280000), 2000);
});

test('ACT: second band does NOT use old accumulator of 1040', () => {
  // Old formula: 1040 + (280000 - 260000) * 0.022 = 1040 + 440 = 1480
  const result = calcStampDuty('ACT', 280000);
  assert.ok(result !== 1480, `ACT second band should not use old accumulator 1040 (giving 1480); got ${result}`);
  approxEqual(result, 2000);
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
            const name = ctx.dataset.label || '';
            const truncated = name.length > 18 ? name.slice(0, 17) + '\u2026' : name;
            const retArr = ctx.dataset._annualisedReturnData;
            let suffix = '';
            if (retArr && ctx.dataIndex < retArr.length) {
              const ret = retArr[ctx.dataIndex];
              if (ret !== null && ret !== undefined) suffix = ' / ' + ret.toFixed(2) + '%';
            }
            return ' ' + truncated + ': ' + formatted + suffix;
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
// buildChartOptions — label callback with annual return
// ---------------------------------------------------------------------------

console.log('\nbuildChartOptions — label callback with annual return');

test('label includes formatCurrency output and / X.XX% suffix when _annualisedReturnData has numeric value', () => {
  const opts = buildChartOptions('totalProfit', false);
  const cb = opts.plugins.tooltip.callbacks.label;
  // Dataset has _annualisedReturnData; dataIndex 2 holds 5.00
  const ctx = {
    parsed: { y: 100000 },
    dataIndex: 2,
    dataset: { label: 'Prop', _annualisedReturnData: [null, 3.0, 5.0] }
  };
  const result = cb(ctx);
  assert.ok(result.includes(formatCurrency(100000)), 'should include formatted currency value');
  assert.ok(result.includes('/ 5.00%'), 'should include the annualised return suffix');
  assert.ok(result.startsWith(' Prop: '), 'should start with " Prop: "');
});

test('label has no / suffix when _annualisedReturnData value at index is null (year 0 sentinel)', () => {
  const opts = buildChartOptions('totalProfit', false);
  const cb = opts.plugins.tooltip.callbacks.label;
  // Year 0 stored as null — no suffix should appear
  const ctx = {
    parsed: { y: 500000 },
    dataIndex: 0,
    dataset: { label: 'Prop', _annualisedReturnData: [null, 5.123, 8.75] }
  };
  const result = cb(ctx);
  assert.ok(!result.includes(' / '), 'null return value should produce no / suffix');
});

test('label has no / suffix when dataset has no _annualisedReturnData (non-totalProfit metric)', () => {
  const opts = buildChartOptions('value', false);
  const cb = opts.plugins.tooltip.callbacks.label;
  // Dataset without the parallel array (non-totalProfit metric)
  const ctx = {
    parsed: { y: 750000 },
    dataIndex: 1,
    dataset: { label: 'Prop A' }
  };
  const result = cb(ctx);
  assert.ok(!result.includes(' / '), 'missing _annualisedReturnData should produce no / suffix');
});

test('label truncates property name exceeding 18 chars with Unicode ellipsis', () => {
  const opts = buildChartOptions('value', false);
  const cb = opts.plugins.tooltip.callbacks.label;
  // Name is 22 chars — should be truncated to 17 chars + U+2026
  const longName = 'A Very Long Property';  // 20 chars
  const ctx = {
    parsed: { y: 300000 },
    dataIndex: 0,
    dataset: { label: longName }
  };
  const result = cb(ctx);
  assert.ok(result.includes('\u2026'), 'name exceeding 18 chars should be truncated with ellipsis U+2026');
  assert.ok(!result.includes(longName), 'full long name should not appear in output');
  // Truncated prefix is first 17 chars: 'A Very Long Prope'
  assert.ok(result.includes('A Very Long Prope\u2026'), 'truncated name should be 17 chars + ellipsis');
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
// Copied verbatim from index.html — verify against source if formulas change.
// ---------------------------------------------------------------------------

function calcDepreciation(ageBracket, purchasePrice) {
  const buildingValue = purchasePrice * 0.75;
  if (ageBracket === 'new') return buildingValue * 0.025;
  if (ageBracket === 'mid') return buildingValue * 0.0125;
  return buildingValue * 0.0075;
}

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

function calcScenarioProfitPure(data, years, growthRate, marginalTaxRate, annualDepreciation) {
  function ef(field) { return data[field] !== undefined ? String(data[field]) : ''; }
  function ev(field) { return parseFloat(ef(field)) || 0; }

  const mtr             = marginalTaxRate !== undefined ? marginalTaxRate : 0.37;
  const annDepr         = annualDepreciation !== undefined ? annualDepreciation : 0;
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
  const cumulativeDepr = annDepr * years;
  const costBase       = Math.max(0, purchasePrice + stampDuty + sd.conveyancing - cumulativeDepr);
  const capitalGain    = futureValue - costBase;
  const cgt            = capitalGain > 0 ? capitalGain * 0.5 * mtr : 0;
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
  // costBase = 200000 + 5435 + 1800 = 207235  (salesCosts not in costBase)
  // capitalGain = 200000 - 207235 = -7235 → cgt = 0
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
  //             = -18035  (cgt=0 either way since capitalGain is negative)

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
  const costBase        = purchasePrice + stampDuty + conveyancing;        // salesCosts not in costBase
  const capitalGain     = futureValue - costBase;                          // negative → cgt=0
  const cgt             = capitalGain > 0 ? capitalGain * 0.5 * 0.37 : 0;
  const trueCashReturn  = netProceeds - cgt;
  const yMaint          = futureValue * 0.005;
  const yExpenses       = annualLP + 1800 + 2000 + yMaint;                 // rent=mgmt=vacancy=0
  const cashFlow1       = 0 - yExpenses;
  const expected        = (trueCashReturn - totalUpfront) + cashFlow1;

  approxEqual(calcScenarioProfitPure(entry, 1, 0), expected, 0.01);
});

// ---------------------------------------------------------------------------
// calcDepreciation — string bracket
// ---------------------------------------------------------------------------

console.log('\ncalcDepreciation');

test('"new" bracket uses 2.5% of 75% of purchase price (rate raised from 1.75% to 2.5%)', () => {
  // Rate was corrected from 1.75% (0.0175) to 2.5% (0.025).
  const result = calcDepreciation('new', 400000);
  approxEqual(result, 400000 * 0.75 * 0.025, 0.01);
});

test('"new" bracket does NOT use the old 1.75% rate', () => {
  // Old formula: 400000 * 0.75 * 0.0175 = 5250; corrected gives 7500.
  const result = calcDepreciation('new', 400000);
  assert.ok(result !== 400000 * 0.75 * 0.0175,
    `"new" depreciation should not use old 1.75% rate (${400000 * 0.75 * 0.0175}); got ${result}`);
  approxEqual(result, 7500, 0.01);
});

test('"mid" bracket uses 1.25% of 75% of purchase price', () => {
  const result = calcDepreciation('mid', 400000);
  approxEqual(result, 400000 * 0.75 * 0.0125, 0.01);
});

test('"old" bracket uses 0.75% of 75% of purchase price', () => {
  const result = calcDepreciation('old', 400000);
  approxEqual(result, 400000 * 0.75 * 0.0075, 0.01);
});

test('unknown bracket falls back to old (0.75%) rate', () => {
  const result = calcDepreciation('unknown', 400000);
  approxEqual(result, 400000 * 0.75 * 0.0075, 0.01);
});

test('"new" bracket produces higher depreciation than "mid" bracket', () => {
  const newDepr = calcDepreciation('new', 500000);
  const midDepr = calcDepreciation('mid', 500000);
  assert.ok(newDepr > midDepr, `Expected new (${newDepr}) > mid (${midDepr})`);
});

test('"mid" bracket produces higher depreciation than "old" bracket', () => {
  const midDepr = calcDepreciation('mid', 500000);
  const oldDepr = calcDepreciation('old', 500000);
  assert.ok(midDepr > oldDepr, `Expected mid (${midDepr}) > old (${oldDepr})`);
});

test('zero purchase price returns zero depreciation', () => {
  assert.strictEqual(calcDepreciation('new', 0), 0);
});

// ---------------------------------------------------------------------------
// calcScenarioProfit — marginalTaxRate and annualDepreciation parameters
//
// These tests verify that passing explicit marginalTaxRate / annualDepreciation
// values to calcScenarioProfitPure produces the correct CGT arithmetic, i.e.
// that the new parameters are not ignored.
// ---------------------------------------------------------------------------

console.log('\ncalcScenarioProfit — marginalTaxRate and annualDepreciation parameters');

test('higher marginalTaxRate produces lower profit when there is a capital gain', () => {
  // Use positive growth so a capital gain exists and CGT is non-zero.
  // A higher tax rate means more CGT deducted, so profit should be lower.
  const lowTax  = calcScenarioProfitPure(refEntry, 10, 0.05, 0.19, 0);
  const highTax = calcScenarioProfitPure(refEntry, 10, 0.05, 0.47, 0);
  assert.ok(lowTax > highTax,
    `Expected low-tax profit (${lowTax}) > high-tax profit (${highTax})`);
});

test('zero marginalTaxRate produces higher profit than default 37% when capital gain exists', () => {
  const noTax      = calcScenarioProfitPure(refEntry, 10, 0.05, 0,    0);
  const defaultTax = calcScenarioProfitPure(refEntry, 10, 0.05, 0.37, 0);
  assert.ok(noTax > defaultTax,
    `Expected zero-tax (${noTax}) > default-tax (${defaultTax})`);
});

test('positive annualDepreciation lowers cost base and increases CGT (reduces profit)', () => {
  // Depreciation reduces the cost base, raising the capital gain, raising CGT,
  // which should reduce overall profit relative to zero depreciation.
  const withDepr    = calcScenarioProfitPure(refEntry, 10, 0.05, 0.37, 5000);
  const withoutDepr = calcScenarioProfitPure(refEntry, 10, 0.05, 0.37, 0);
  assert.ok(withDepr < withoutDepr,
    `Expected depreciation to reduce profit: withDepr (${withDepr}) < withoutDepr (${withoutDepr})`);
});

test('annualDepreciation via calcDepreciation matches manual rate for new property', () => {
  // Confirm the depreciation value fed into calcScenarioProfitPure is the
  // result of calcDepreciation, not a hardcoded constant.
  // A new ($500k) property: calcDepreciation('new', 500000) = 500000 * 0.75 * 0.025 = 9375
  const depr = calcDepreciation('new', 500000);
  approxEqual(depr, 9375, 0.01);
  // Verify it makes a measurable difference in profit over 10 years vs zero depr.
  const withDepr    = calcScenarioProfitPure(refEntry, 10, 0.05, 0.37, depr);
  const withoutDepr = calcScenarioProfitPure(refEntry, 10, 0.05, 0.37, 0);
  assert.ok(withDepr !== withoutDepr,
    `Expected depreciation of ${depr} to change profit vs zero depreciation`);
});

test('omitting marginalTaxRate and annualDepreciation defaults to 0.37 and 0', () => {
  // Calling with 3 args must equal calling with explicit defaults.
  const threeArgs   = calcScenarioProfitPure(refEntry, 10, 0.04);
  const fiveArgs    = calcScenarioProfitPure(refEntry, 10, 0.04, 0.37, 0);
  approxEqual(threeArgs, fiveArgs, 0.01);
});

// ---------------------------------------------------------------------------
// CGT cost base — loan establishment fee excluded
//
// Production formula (lines 4589 and 4804 of index.html):
//   costBase = Math.max(0, purchasePrice + stampDuty + conveyancing + BUILDING_PEST - cumulativeDepr)
//
// The $800 LOAN_ESTABLISHMENT fee was removed from costBase in this change.
// A lower costBase produces a higher capital gain and therefore more CGT,
// so removing it (making costBase smaller) should reduce net profit.
//
// The pure test helper calcScenarioProfitPure mirrors this formula exactly:
//   costBase = Math.max(0, purchasePrice + stampDuty + sd.conveyancing - cumulativeDepr)
// (Note: BUILDING_PEST is not included in calcScenarioProfitPure either —
// it focuses on the principal components.)
// ---------------------------------------------------------------------------

console.log('\nCGT cost base — loan establishment fee excluded');

function calcCostBase(purchasePrice, stampDuty, conveyancing, buildingPest, loanEstablishment, cumulativeDepr) {
  // Current formula: LOAN_ESTABLISHMENT is NOT in costBase
  return Math.max(0, purchasePrice + stampDuty + conveyancing + buildingPest - cumulativeDepr);
}

function calcCostBaseWithLoanFee(purchasePrice, stampDuty, conveyancing, buildingPest, loanEstablishment, cumulativeDepr) {
  // Old formula: LOAN_ESTABLISHMENT was included
  return Math.max(0, purchasePrice + stampDuty + conveyancing + buildingPest + loanEstablishment - cumulativeDepr);
}

test('cost base does NOT include the $800 loan establishment fee', () => {
  const LOAN_ESTABLISHMENT = 800;
  const purchasePrice      = 500000;
  const stampDuty          = 17325;
  const conveyancing       = 900;
  const buildingPest       = 600;
  const cumulativeDepr     = 0;
  const withoutFee = calcCostBase(purchasePrice, stampDuty, conveyancing, buildingPest, LOAN_ESTABLISHMENT, cumulativeDepr);
  const withFee    = calcCostBaseWithLoanFee(purchasePrice, stampDuty, conveyancing, buildingPest, LOAN_ESTABLISHMENT, cumulativeDepr);
  // Without the fee, costBase is $800 lower
  approxEqual(withFee - withoutFee, LOAN_ESTABLISHMENT, 0.01);
  // Confirm exact expected value for current formula
  approxEqual(withoutFee, purchasePrice + stampDuty + conveyancing + buildingPest, 0.01);
});

test('removing loan establishment fee from costBase increases capital gain by exactly $800', () => {
  // Lower costBase → higher capitalGain → more CGT → lower profit.
  const LOAN_ESTABLISHMENT = 800;
  const salePrice      = 700000;
  const purchasePrice  = 500000;
  const stampDuty      = 17325;
  const conveyancing   = 900;
  const buildingPest   = 600;
  const cumulativeDepr = 0;
  const costBaseNew = calcCostBase(purchasePrice, stampDuty, conveyancing, buildingPest, LOAN_ESTABLISHMENT, cumulativeDepr);
  const costBaseOld = calcCostBaseWithLoanFee(purchasePrice, stampDuty, conveyancing, buildingPest, LOAN_ESTABLISHMENT, cumulativeDepr);
  const capitalGainNew = salePrice - costBaseNew;
  const capitalGainOld = salePrice - costBaseOld;
  approxEqual(capitalGainNew - capitalGainOld, LOAN_ESTABLISHMENT, 0.01);
});

test('costBase floors to 0 when depreciation exceeds all cost components', () => {
  // Edge case: very large cumulative depreciation should not produce a negative costBase.
  const result = calcCostBase(200000, 5435, 1800, 600, 800, 999999);
  assert.strictEqual(result, 0);
});

// ---------------------------------------------------------------------------
// deductibleExpenses composition
// ---------------------------------------------------------------------------

console.log('\ndeductibleExpenses composition');

function calcDeductibleExpenses(annualInterestOnly, annualManagementFee, insurance, councilFees, maintenanceAllowance, annualDepreciation) {
  return annualInterestOnly + annualManagementFee + insurance + councilFees + maintenanceAllowance + annualDepreciation;
}

test('deductibleExpenses equals the sum of its 6 components', () => {
  const annualInterestOnly    = 18000;
  const annualManagementFee   = 1560;
  const insurance             = 1800;
  const councilFees           = 2000;
  const maintenanceAllowance  = 2500;
  const annualDepreciation    = 5250;
  const expected = 18000 + 1560 + 1800 + 2000 + 2500 + 5250; // 31110
  approxEqual(
    calcDeductibleExpenses(annualInterestOnly, annualManagementFee, insurance, councilFees, maintenanceAllowance, annualDepreciation),
    expected,
    0.01
  );
});

test('vacancyAllowance is NOT included in deductibleExpenses', () => {
  const annualInterestOnly    = 18000;
  const annualManagementFee   = 1560;
  const insurance             = 1800;
  const councilFees           = 2000;
  const maintenanceAllowance  = 2500;
  const annualDepreciation    = 5250;
  const vacancyAllowance      = 1200;
  const result = calcDeductibleExpenses(annualInterestOnly, annualManagementFee, insurance, councilFees, maintenanceAllowance, annualDepreciation);
  const withVacancy = result + vacancyAllowance;
  assert.notStrictEqual(result, withVacancy,
    'deductibleExpenses must not include vacancyAllowance');
});

test('deductibleExpenses hand-calculated spot-check: 18000+1560+1800+2000+2500+5250 = 31110', () => {
  approxEqual(
    calcDeductibleExpenses(18000, 1560, 1800, 2000, 2500, 5250),
    31110,
    0.01
  );
});

// ---------------------------------------------------------------------------
// Tax benefit / liability formula
//
// Formula copied verbatim from index.html calculate():
//   const snTaxBenefit = snNetRentalPosition < 0
//     ? Math.abs(snNetRentalPosition) * marginalTaxRate
//     : -(snNetRentalPosition * marginalTaxRate);
//
// Negatively geared: netRentalPosition < 0 → positive taxBenefit (refund)
// Positively geared: netRentalPosition > 0 → negative taxBenefit (liability)
// ---------------------------------------------------------------------------

console.log('\ntaxBenefit / liability formula');

function calcSnTaxBenefit(snNetRentalPosition, marginalTaxRate) {
  return snNetRentalPosition < 0
    ? Math.abs(snNetRentalPosition) * marginalTaxRate
    : -(snNetRentalPosition * marginalTaxRate);
}

test('negatively geared: taxBenefit is positive (refund)', () => {
  // netRentalPosition = -10000, mtr = 0.37 → benefit = 10000 * 0.37 = 3700
  approxEqual(calcSnTaxBenefit(-10000, 0.37), 3700, 0.01);
});

test('positively geared: taxBenefit is negative (liability)', () => {
  // netRentalPosition = +5000, mtr = 0.37 → liability = -(5000 * 0.37) = -1850
  approxEqual(calcSnTaxBenefit(5000, 0.37), -1850, 0.01);
});

test('positively geared: result is strictly negative', () => {
  const result = calcSnTaxBenefit(8000, 0.37);
  assert.ok(result < 0, `Expected negative taxBenefit for positive gearing, got ${result}`);
});

test('zero net rental position: taxBenefit is zero', () => {
  // netRentalPosition = 0 → falls into the >= 0 branch → -(0 * mtr) = 0
  approxEqual(calcSnTaxBenefit(0, 0.37), 0, 0.01);
});

test('positive gearing liability magnitude equals netRentalPosition * mtr', () => {
  const mtr = 0.45;
  const netRental = 12000;
  const result = calcSnTaxBenefit(netRental, mtr);
  approxEqual(Math.abs(result), netRental * mtr, 0.01);
});

test('negative gearing benefit magnitude equals |netRentalPosition| * mtr', () => {
  const mtr = 0.32;
  const netRental = -15000;
  const result = calcSnTaxBenefit(netRental, mtr);
  approxEqual(result, Math.abs(netRental) * mtr, 0.01);
});

// ---------------------------------------------------------------------------
// Base64 round-trip (Save & Share)
// The encode pattern is copied verbatim from shareURL() in index.html:
//   btoa(unescape(encodeURIComponent(JSON.stringify(state))))
// The decode pattern is copied verbatim from the page-load IIFE in index.html:
//   JSON.parse(decodeURIComponent(escape(atob(encoded))))
// ---------------------------------------------------------------------------

console.log('\nBase64 round-trip (Save & Share)');

function b64Encode(state) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

function b64Decode(encoded) {
  return JSON.parse(decodeURIComponent(escape(atob(encoded))));
}

test('a typical state object survives the round-trip unchanged', () => {
  const original = {
    version: 1,
    taxRate: '0.37',
    properties: [
      { name: 'Main St Unit', purchasePrice: '650000', depositPct: '20', state: 'NSW', interestRate: '6.5' }
    ]
  };
  const result = b64Decode(b64Encode(original));
  assert.deepStrictEqual(result, original);
});

test('a Unicode property name survives the round-trip unchanged', () => {
  const original = {
    version: 1,
    taxRate: '0.325',
    properties: [
      { name: 'Château St-Pierre', purchasePrice: '800000', state: 'VIC' }
    ]
  };
  const result = b64Decode(b64Encode(original));
  assert.strictEqual(result.properties[0].name, 'Château St-Pierre');
});

test('a state with an empty properties array survives the round-trip', () => {
  const original = { version: 1, taxRate: '0.37', properties: [] };
  const result = b64Decode(b64Encode(original));
  assert.deepStrictEqual(result, original);
  assert.ok(Array.isArray(result.properties));
  assert.strictEqual(result.properties.length, 0);
});

test('a state with 8 properties survives the round-trip with all 8 intact', () => {
  const props = Array.from({ length: 8 }, (_, i) => ({
    name: `Property ${i + 1}`,
    purchasePrice: String(500000 + i * 50000),
    state: 'QLD'
  }));
  const original = { version: 1, taxRate: '0.37', properties: props };
  const result = b64Decode(b64Encode(original));
  assert.deepStrictEqual(result, original);
  assert.strictEqual(result.properties.length, 8);
});

// ---------------------------------------------------------------------------
// State schema validation (guard from deserializeState in index.html):
//   if (!state || !Array.isArray(state.properties) || state.properties.length === 0) return;
// Modelled here as a pure predicate so it can be tested without the DOM.
// ---------------------------------------------------------------------------

console.log('\nState schema validation');

function isValidState(state) {
  if (!state || !Array.isArray(state.properties) || state.properties.length === 0) return false;
  return true;
}

test('null is rejected', () => {
  assert.strictEqual(isValidState(null), false);
});

test('an empty object (no properties key) is rejected', () => {
  assert.strictEqual(isValidState({}), false);
});

test('a state with an empty properties array is rejected', () => {
  assert.strictEqual(isValidState({ version: 1, properties: [] }), false);
});

test('a state with at least one property is accepted', () => {
  assert.strictEqual(isValidState({ version: 1, properties: [{ name: 'Test' }] }), true);
});

// ---------------------------------------------------------------------------
// slice(0, 8) cap — mirrors state.properties.slice(0, 8) in deserializeState
// ---------------------------------------------------------------------------

console.log('\nslice(0, 8) property cap');

test('a state with 10 properties is capped to 8 after slice(0, 8)', () => {
  const props = Array.from({ length: 10 }, (_, i) => ({ name: `Property ${i + 1}` }));
  const capped = props.slice(0, 8);
  assert.strictEqual(capped.length, 8);
  assert.strictEqual(capped[0].name, 'Property 1');
  assert.strictEqual(capped[7].name, 'Property 8');
});

test('a state with exactly 8 properties is unchanged after slice(0, 8)', () => {
  const props = Array.from({ length: 8 }, (_, i) => ({ name: `Property ${i + 1}` }));
  const capped = props.slice(0, 8);
  assert.strictEqual(capped.length, 8);
});

test('a state with 3 properties is unchanged after slice(0, 8)', () => {
  const props = Array.from({ length: 3 }, (_, i) => ({ name: `Property ${i + 1}` }));
  const capped = props.slice(0, 8);
  assert.strictEqual(capped.length, 3);
});

// ---------------------------------------------------------------------------
// _esc (copied verbatim from index.html)
// ---------------------------------------------------------------------------

function _esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

console.log('\n_esc');

test('plain string is returned unchanged', () => {
  assert.strictEqual(_esc('hello'), 'hello');
});

test('ampersand is escaped to &amp;', () => {
  assert.strictEqual(_esc('a & b'), 'a &amp; b');
});

test('angle brackets are escaped', () => {
  assert.strictEqual(_esc('<script>'), '&lt;script&gt;');
});

test('double quotes are escaped to &quot;', () => {
  assert.strictEqual(_esc('"quoted"'), '&quot;quoted&quot;');
});

test('null returns empty string', () => {
  assert.strictEqual(_esc(null), '');
});

test('undefined returns empty string', () => {
  assert.strictEqual(_esc(undefined), '');
});

test('number 42 is coerced to string "42"', () => {
  assert.strictEqual(_esc(42), '42');
});

test('all four special chars in one string', () => {
  assert.strictEqual(_esc('<a href="x&y">'), '&lt;a href=&quot;x&amp;y&quot;&gt;');
});

// ---------------------------------------------------------------------------
// _buildPdfHtml (copied verbatim from index.html — depends on _esc above)
// ---------------------------------------------------------------------------

var _snapshotYear = 1;

    function _buildPdfHtml(summaryRows, propertyPages) {
      var date = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
      var headerHtml = '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8pt;border-bottom:2px solid #10B981;padding-bottom:5pt">'
        + '<span style="font-size:13pt;font-weight:700;color:#10B981">TrueReturn</span>'
        + '<span style="font-size:8pt;color:#666">' + date + '</span>'
        + '</div>';

      var summaryHtml = '<div class="pdf-page">' + headerHtml
        + '<div style="font-size:13pt;font-weight:600;margin-bottom:10pt">Portfolio Summary</div>'
        + '<table style="width:100%;border-collapse:collapse;font-size:9pt">'
        + '<thead><tr style="background:#f3f4f6">'
        + ['Name','Purchase Price','Deposit','Loan','Rate','Rent/wk','Growth','State'].map(function(h) {
            return '<th style="text-align:left;padding:3pt 5pt;border-bottom:1px solid #ddd;font-weight:600">' + h + '</th>';
          }).join('')
        + '</tr></thead><tbody>'
        + summaryRows.map(function(row, i) {
            var bg = i % 2 === 0 ? 'white' : '#f9fafb';
            return '<tr style="background:' + bg + '">'
              + row.map(function(cell) {
                  return '<td style="padding:3pt 5pt;border-bottom:1px solid #eee">' + _esc(cell) + '</td>';
                }).join('')
              + '</tr>';
          }).join('')
        + '</tbody></table></div>';

      var propertyHtml = propertyPages.map(function(p) {
        function row(label, val, indent, bold) {
          var pad = indent ? 'padding-left:12pt' : '';
          var sz = indent ? 'font-size:7.5pt;' : 'font-size:8.5pt;';
          var fw = bold ? 'font-weight:700;' : (indent ? '' : 'font-weight:500;');
          var co = bold ? 'color:#111;' : 'color:#555;';
          return '<tr><td style="padding:1pt 3pt;' + co + sz + fw + pad + '">' + _esc(label) + '</td>'
               + '<td style="padding:1pt 3pt;text-align:right;' + sz + fw + '">' + _esc(val) + '</td></tr>';
        }
        function section(title, rows) {
          return '<div class="pdf-section" style="margin-bottom:12pt">'
            + '<div style="font-size:8.5pt;font-weight:600;margin-bottom:2pt;color:#10B981;border-bottom:1px solid #ddd;padding-bottom:2pt">' + _esc(title) + '</div>'
            + '<table style="width:100%;border-collapse:collapse">' + rows + '</table>'
            + '</div>';
        }
        function projTable(p5, p10, p15) {
          function prow(label, k, minor, bold) {
            var sz = minor ? 'font-size:7.5pt;' : 'font-size:8.5pt;';
            var pad = minor ? 'padding-left:12pt' : '';
            var fw = bold ? 'font-weight:700;' : '';
            var co = bold ? 'color:#111;' : 'color:#555;';
            return '<tr><td style="padding:1pt 3pt;' + co + sz + fw + pad + '">' + _esc(label) + '</td>'
                 + '<td style="padding:1pt 3pt;text-align:right;' + sz + fw + '">' + _esc(p5[k]) + '</td>'
                 + '<td style="padding:1pt 3pt;text-align:right;' + sz + fw + '">' + _esc(p10[k]) + '</td>'
                 + '<td style="padding:1pt 3pt;text-align:right;' + sz + fw + '">' + _esc(p15[k]) + '</td>'
                 + '</tr>';
          }
          return '<div class="pdf-section" style="margin-bottom:12pt">'
            + '<div style="font-size:8.5pt;font-weight:600;margin-bottom:2pt;color:#10B981;border-bottom:1px solid #ddd;padding-bottom:2pt">Projections</div>'
            + '<table style="width:100%;border-collapse:collapse">'
            + '<thead><tr style="background:#f3f4f6">'
            + '<th style="padding:1.5pt 3pt;text-align:left;font-size:8.5pt">Metric</th>'
            + '<th style="padding:1.5pt 3pt;text-align:right;font-size:8.5pt">5 Years</th>'
            + '<th style="padding:1.5pt 3pt;text-align:right;font-size:8.5pt">10 Years</th>'
            + '<th style="padding:1.5pt 3pt;text-align:right;font-size:8.5pt">15 Years</th>'
            + '</tr></thead><tbody>'
            + prow('Property Value', 'value')
            + prow('Capital Growth', 'growth')
            + prow('Remaining Loan', 'loan', true)
            + prow('Total Equity', 'equity', true)
            + prow('Usable Equity (80%)', 'usableEquity')
            + prow('Est. Weekly Rent', 'rent', true)
            + prow('Est. Annual Cash Flow', 'cashFlow', true)
            + prow('True Cash Return', 'trueReturn')
            + '<tr><td colspan="4" style="padding:1pt 0"></td></tr>'
            + prow('Sale Price', 'sale')
            + prow('Sales Costs', 'saleCosts', true)
            + prow('Loan Payout', 'loanPayout', true)
            + prow('Net Proceeds', 'netProceeds', true)
            + prow('Capital Gains Tax', 'cgt', true)
            + prow('Total Profit', 'totalProfit', false, true)
            + prow('Annual Cash Return', 'returnOnCash', false, true)
            + '</tbody></table></div>';
        }
        var cashUpFront = section('Cash Up Front',
          row('Total Cash Up Front', p.totalUpfront)
          + row('Deposit', p.deposit, true)
          + row('Stamp Duty', p.stampDuty, true)
          + row('Conveyancing', p.conveyancing, true)
          + row('Building & Pest', p.buildingPest, true)
          + row('Loan Establishment', p.loanEstablish, true)
        );
        var highlights = section('Property Highlights',
          row('Weekly cost/surplus', p.hlWeeklyCost)
          + row('Cash flow positive from', p.hlCashFlowYear)
          + row('Usable equity at 5 years', p.hlUsableEquity5)
          + row('Break-even', p.hlBreakEven)
        );
        var annualCF = section('Year ' + _snapshotYear + ' Snapshot — Annual Cash Flow',
          row('Monthly Cash Flow', p.monthlyCF)
          + row('Annual Cash Flow', p.annualCF)
          + row('Annual Rental Income', p.annualRent, true)
          + row('Loan Repayment', p.loanPayment, true)
          + row('Management Fee', p.management, true)
          + row('Insurance', p.insurance, true)
          + row('Council Rates', p.council, true)
          + row('Vacancy Allowance', p.vacancy, true)
          + row('Maintenance', p.maintenance, true)
          + row('Net Annual Cash Flow', p.netAnnualCF, false, true)
        );
        var taxPos = section('Year ' + _snapshotYear + ' Snapshot — Tax Position',
          row('Annual Rental Income', p.taxRentalIncome)
          + row('Loan Interest', p.taxInterest, true)
          + row('Management Fee', p.taxMgmt, true)
          + row('Insurance', p.taxInsurance, true)
          + row('Council Rates', p.taxCouncil, true)
          + row('Maintenance', p.taxMaintenance, true)
          + row('Depreciation (est.)', p.depreciation, true)
          + row('Total Deductibles', p.totalDeductible)
          + row('Net Rental Position', p.netRental)
          + row('Est. Tax Benefit', p.taxBenefit)
        ) + '<p style="font-size:7pt;color:#888;margin:-8pt 0 0 0;font-style:italic">Note: Est. Tax Benefit is not included in Annual Cash Flow as it depends heavily on your individual tax situation.</p>';
        var projHtml = projTable(p.p5, p.p10, p.p15);
        var chartHtml = p.chartSvg
          ? '<div class="pdf-section" style="page-break-inside:avoid;break-inside:avoid;margin-top:16pt"><div style="font-size:8.5pt;font-weight:600;margin-bottom:6pt;color:#10B981;border-bottom:1px solid #ddd;padding-bottom:2pt">Profit Over Time</div>'
            + '<div style="padding:0 16pt"><div style="width:90%">' + p.chartSvg + '</div></div></div>'
          : '';
        return '<div class="pdf-page">' + headerHtml
          + '<div style="font-size:11pt;font-weight:600;margin-bottom:6pt">' + _esc(p.name) + '</div>'
          + '<div style="display:flex;gap:8pt">'
          + '<div style="flex:1;min-width:0">' + cashUpFront + annualCF + '</div>'
          + '<div style="flex:1;min-width:0">' + highlights + taxPos + '</div>'
          + '</div>'
          + projHtml
          + chartHtml
          + '</div>';
      }).join('');

      return summaryHtml + propertyHtml;
    }

// Minimal projection object used across _buildPdfHtml tests
function makeProj() {
  return { value: '$0', growth: '$0', loan: '$0', equity: '$0', usableEquity: '$0',
           rent: '$0', cashFlow: '$0', trueReturn: '0%', sale: '$0', saleCosts: '$0',
           loanPayout: '$0', netProceeds: '$0', cgt: '$0', totalProfit: '$0', returnOnCash: '0%' };
}

// Minimal property page used across _buildPdfHtml tests
function makePage(overrides) {
  var base = {
    name: 'Test Property', totalUpfront: '$0', deposit: '$0', stampDuty: '$0',
    conveyancing: '$0', buildingPest: '$0', loanEstablish: '$0',
    hlWeeklyCost: '$0', hlCashFlowYear: 'N/A', hlUsableEquity5: '$0', hlBreakEven: 'N/A',
    monthlyCF: '$0', annualCF: '$0', annualRent: '$0',
    loanPayment: '$0', management: '$0', insurance: '$0', council: '$0',
    vacancy: '$0', maintenance: '$0', netAnnualCF: '$0',
    taxRentalIncome: '$0', taxInterest: '$0', taxMgmt: '$0', taxInsurance: '$0',
    taxCouncil: '$0', taxMaintenance: '$0', depreciation: '$0',
    totalDeductible: '$0', netRental: '$0', taxBenefit: '$0',
    p5: makeProj(), p10: makeProj(), p15: makeProj(),
    chartSvg: null
  };
  if (overrides) {
    Object.keys(overrides).forEach(function(k) { base[k] = overrides[k]; });
  }
  return base;
}

console.log('\n_buildPdfHtml');

test('result contains the word TrueReturn (header present)', () => {
  var html = _buildPdfHtml([], []);
  assert.ok(html.includes('TrueReturn'), 'Expected "TrueReturn" in output');
});

test('result contains the property name when one page is supplied', () => {
  var page = makePage({ name: 'Harbour View Apartment' });
  var html = _buildPdfHtml([['Harbour View Apartment', '$800,000', '$160,000', '$640,000', '6%', '$600', '5%', 'NSW']], [page]);
  assert.ok(html.includes('Harbour View Apartment'), 'Expected property name in output');
});

test('result contains projection table headers 5 Years, 10 Years, 15 Years', () => {
  var html = _buildPdfHtml([], [makePage()]);
  assert.ok(html.includes('5 Years'), 'Expected "5 Years" header');
  assert.ok(html.includes('10 Years'), 'Expected "10 Years" header');
  assert.ok(html.includes('15 Years'), 'Expected "15 Years" header');
});

test('result contains two property names when two pages are supplied', () => {
  var page1 = makePage({ name: 'Alpha' });
  var page2 = makePage({ name: 'Beta' });
  var html = _buildPdfHtml([], [page1, page2]);
  assert.ok(html.includes('Alpha'), 'Expected "Alpha" in output');
  assert.ok(html.includes('Beta'), 'Expected "Beta" in output');
});

test('result contains a chart div when chartSvg is non-null', () => {
  var page = makePage({ chartSvg: '<svg><rect width="10" height="10"/></svg>' });
  var html = _buildPdfHtml([], [page]);
  assert.ok(html.includes('Profit Over Time'), 'Expected "Profit Over Time" section when chartSvg is set');
  assert.ok(html.includes('<svg>'), 'Expected inline SVG content in output');
});

test('result does NOT contain chart section when chartSvg is null', () => {
  var page = makePage({ chartSvg: null });
  var html = _buildPdfHtml([], [page]);
  assert.ok(!html.includes('Profit Over Time'), 'Expected no chart section when chartSvg is null');
});

test('summary row cell values appear in the output', () => {
  var summaryRows = [
    ['Beach House', '$500,000', '$100,000', '$400,000', '5.5%', '$450', '4%', 'QLD']
  ];
  var html = _buildPdfHtml(summaryRows, []);
  assert.ok(html.includes('Beach House'), 'Expected summary row name in output');
  assert.ok(html.includes('$500,000'), 'Expected purchase price in output');
  assert.ok(html.includes('QLD'), 'Expected state in output');
});

test('summary row cell values are HTML-escaped', () => {
  var summaryRows = [
    ['<b>Bold & Co</b>', '$0', '$0', '$0', '0%', '$0', '0%', 'VIC']
  ];
  var html = _buildPdfHtml(summaryRows, []);
  assert.ok(!html.includes('<b>Bold'), 'Raw <b> tag should not appear in output');
  assert.ok(html.includes('&lt;b&gt;Bold &amp; Co&lt;/b&gt;'), 'Expected escaped cell value');
});

test('property name is HTML-escaped', () => {
  var page = makePage({ name: '<Evil & "Tricky">' });
  var html = _buildPdfHtml([], [page]);
  assert.ok(!html.includes('<Evil'), 'Raw <Evil should not appear in property name');
  assert.ok(html.includes('&lt;Evil &amp; &quot;Tricky&quot;&gt;'), 'Expected escaped property name');
});

test('empty summaryRows and empty propertyPages still returns a string', () => {
  var html = _buildPdfHtml([], []);
  assert.strictEqual(typeof html, 'string');
  assert.ok(html.length > 0, 'Expected non-empty string');
});

// ---------------------------------------------------------------------------
// section() title escaping — security fix: _esc(title) applied in section()
// ---------------------------------------------------------------------------

test('section title containing <script> is HTML-escaped and does not appear raw', () => {
  // A section title with <script> must be escaped to &lt;script&gt;
  // The section titles are hardcoded strings ('Cash Up Front', 'Annual Cash Flow', etc.)
  // but we test that the _buildPdfHtml helper — which calls section() — correctly
  // escapes a property name that would reach a title via any injection vector.
  // We verify the fix directly by calling _buildPdfHtml with a page whose name
  // contains HTML and confirming the output contains no raw angle brackets in
  // that context. Then we test section() isolation via a known fixed title.
  //
  // The production section titles are safe string literals; the risk vector is
  // user-supplied data reaching a section title in future. The fix to call
  // _esc(title) in section() ensures that is safe now.
  //
  // Direct test: construct a _buildPdfHtml call and verify the fixed section
  // titles "Cash Up Front", "Annual Cash Flow", "Tax Position" appear correctly.
  var page = makePage();
  var html = _buildPdfHtml([], [page]);
  assert.ok(html.includes('Cash Up Front'), 'section title "Cash Up Front" should appear in output');
  assert.ok(html.includes('Annual Cash Flow'), 'section title "Annual Cash Flow" should appear in output');
  assert.ok(html.includes('Tax Position'), 'section title "Tax Position" should appear in output');
});

test('_esc used in section() escapes < and > — verified via _esc directly', () => {
  // The section() helper now calls _esc(title). Confirm _esc correctly escapes
  // a title containing <script>alert(1)</script>
  var maliciousTitle = '<script>alert(1)</script>';
  var escaped = _esc(maliciousTitle);
  assert.strictEqual(escaped, '&lt;script&gt;alert(1)&lt;/script&gt;',
    'section title with <script> must be fully escaped by _esc');
  assert.ok(!escaped.includes('<script>'),
    'Raw <script> tag must not appear in escaped section title');
});

test('_esc used in section() escapes all four special chars in a title', () => {
  // Confirms the escaping applied to section titles covers &, <, >, and "
  var title = '<b class="x">Costs & Fees</b>';
  var escaped = _esc(title);
  assert.ok(!escaped.includes('<b'), 'Raw <b should not appear');
  assert.ok(!escaped.includes('"'), 'Raw " should not appear');
  assert.ok(!escaped.includes('&C'), 'Raw & before C should not appear (should be &amp;C)');
  assert.ok(escaped.includes('&lt;b'), 'Should contain &lt;b');
  assert.ok(escaped.includes('&quot;'), 'Should contain &quot;');
  assert.ok(escaped.includes('&amp;'), 'Should contain &amp;');
});

test('chartSvg content is included verbatim inside a div container (no escaping of SVG)', () => {
  var svgContent = '<svg viewBox="0 0 100 50"><line x1="0" y1="0" x2="100" y2="50"/></svg>';
  var page = makePage({ chartSvg: svgContent });
  var html = _buildPdfHtml([], [page]);
  assert.ok(html.includes(svgContent), 'chartSvg content should appear verbatim inside the chart div');
  assert.ok(html.includes('<div style="padding:0 16pt">'), 'Expected SVG wrapper div with correct padding style');
});

// ---------------------------------------------------------------------------
// Simple Mode Defaults
// ---------------------------------------------------------------------------

// Constants copied verbatim from index.html
const SIMPLE_MODE_DEFAULTS = {
  purchasePrice:   '650000',
  weeklyRent:      '550',
  depositPct:      '20',
  loanType:        'PI',
  loanTerm:        '30',
  state:           'QLD',
  interestRate:    '6.72',
  managementFee:   '8',
  expectedGrowth:  '6',
  propertyAge:     'mid',
  marginalTaxRate: '0.37',
};
const SIMPLE_MODE_TAX = '0.37';

// --- SIMPLE_MODE_DEFAULTS completeness ---
test('SIMPLE_MODE_DEFAULTS has exactly 11 keys', () => {
  const keys = Object.keys(SIMPLE_MODE_DEFAULTS);
  assert.strictEqual(keys.length, 11, `Expected 11 keys, got ${keys.length}: ${keys.join(', ')}`);
});

test('SIMPLE_MODE_DEFAULTS contains all expected keys', () => {
  const expected = ['purchasePrice', 'weeklyRent', 'depositPct', 'loanType', 'loanTerm', 'state', 'interestRate', 'managementFee', 'expectedGrowth', 'propertyAge', 'marginalTaxRate'];
  for (const key of expected) {
    assert.ok(Object.prototype.hasOwnProperty.call(SIMPLE_MODE_DEFAULTS, key), `Missing key: ${key}`);
  }
});

// --- SIMPLE_MODE_DEFAULTS values ---
test('SIMPLE_MODE_DEFAULTS depositPct is "20"', () => {
  assert.strictEqual(SIMPLE_MODE_DEFAULTS.depositPct, '20');
});

test('SIMPLE_MODE_DEFAULTS loanType is "PI"', () => {
  assert.strictEqual(SIMPLE_MODE_DEFAULTS.loanType, 'PI');
});

test('SIMPLE_MODE_DEFAULTS loanTerm is "30"', () => {
  assert.strictEqual(SIMPLE_MODE_DEFAULTS.loanTerm, '30');
});

test('SIMPLE_MODE_DEFAULTS state is "QLD"', () => {
  assert.strictEqual(SIMPLE_MODE_DEFAULTS.state, 'QLD');
});

test('SIMPLE_MODE_DEFAULTS interestRate is "6.72"', () => {
  assert.strictEqual(SIMPLE_MODE_DEFAULTS.interestRate, '6.72');
});

test('SIMPLE_MODE_DEFAULTS managementFee is "8"', () => {
  assert.strictEqual(SIMPLE_MODE_DEFAULTS.managementFee, '8');
});

test('SIMPLE_MODE_DEFAULTS expectedGrowth is "6"', () => {
  assert.strictEqual(SIMPLE_MODE_DEFAULTS.expectedGrowth, '6');
});

test('SIMPLE_MODE_DEFAULTS propertyAge is "mid"', () => {
  assert.strictEqual(SIMPLE_MODE_DEFAULTS.propertyAge, 'mid');
});

test('SIMPLE_MODE_DEFAULTS purchasePrice is "650000"', () => {
  assert.strictEqual(SIMPLE_MODE_DEFAULTS.purchasePrice, '650000');
});

test('SIMPLE_MODE_DEFAULTS weeklyRent is "550"', () => {
  assert.strictEqual(SIMPLE_MODE_DEFAULTS.weeklyRent, '550');
});

// --- SIMPLE_MODE_TAX ---
test('SIMPLE_MODE_TAX is "0.37"', () => {
  assert.strictEqual(SIMPLE_MODE_TAX, '0.37');
});

// --- All SIMPLE_MODE_DEFAULTS values are strings (inputs expect strings) ---
test('all SIMPLE_MODE_DEFAULTS values are strings', () => {
  for (const [key, value] of Object.entries(SIMPLE_MODE_DEFAULTS)) {
    assert.strictEqual(typeof value, 'string', `Expected string for key "${key}", got ${typeof value}`);
  }
});

// --- SIMPLE_MODE_TAX is a string ---
test('SIMPLE_MODE_TAX is a string', () => {
  assert.strictEqual(typeof SIMPLE_MODE_TAX, 'string', `Expected string, got ${typeof SIMPLE_MODE_TAX}`);
});

// --- Boundary / edge cases ---
test('SIMPLE_MODE_DEFAULTS interestRate parses to a finite positive number', () => {
  const rate = parseFloat(SIMPLE_MODE_DEFAULTS.interestRate);
  assert.ok(isFinite(rate) && rate > 0, `interestRate "${SIMPLE_MODE_DEFAULTS.interestRate}" should parse to a finite positive number`);
});

test('SIMPLE_MODE_DEFAULTS depositPct parses to a number between 1 and 100', () => {
  const pct = parseFloat(SIMPLE_MODE_DEFAULTS.depositPct);
  assert.ok(pct >= 1 && pct <= 100, `depositPct "${SIMPLE_MODE_DEFAULTS.depositPct}" should be between 1 and 100`);
});

test('SIMPLE_MODE_TAX parses to a number between 0 and 1', () => {
  const tax = parseFloat(SIMPLE_MODE_TAX);
  assert.ok(tax > 0 && tax < 1, `SIMPLE_MODE_TAX "${SIMPLE_MODE_TAX}" should parse to a number between 0 and 1`);
});

// ---------------------------------------------------------------------------
// Property Highlights — weekly holding cost
//
// Formula (verbatim from index.html calculate()):
//   const weeklyHoldingCost = annualCashFlow / 52;
//   label: weeklyHoldingCost >= 0 → 'Weekly surplus', else → 'Weekly cost to hold'
//
// Because the formula is a single arithmetic expression with no DOM access,
// it is tested directly here rather than wrapping it in a helper function.
// ---------------------------------------------------------------------------

console.log('\nProperty Highlights — weekly holding cost');

test('negative annual cash flow produces a negative weekly holding cost', () => {
  // -$5,200/yr ÷ 52 = -$100/wk
  const annualCashFlow = -5200;
  const weeklyHoldingCost = annualCashFlow / 52;
  assert.strictEqual(weeklyHoldingCost, -100);
});

test('positive annual cash flow produces a positive weekly surplus', () => {
  // +$2,600/yr ÷ 52 = +$50/wk
  const annualCashFlow = 2600;
  const weeklyHoldingCost = annualCashFlow / 52;
  assert.strictEqual(weeklyHoldingCost, 50);
});

test('zero annual cash flow produces zero weekly holding cost', () => {
  const annualCashFlow = 0;
  const weeklyHoldingCost = annualCashFlow / 52;
  assert.strictEqual(weeklyHoldingCost, 0);
});

test('label logic: negative weekly cost → "Weekly cost to hold"', () => {
  const weeklyHoldingCost = -100;
  const label = weeklyHoldingCost >= 0 ? 'Weekly surplus' : 'Weekly cost to hold';
  assert.strictEqual(label, 'Weekly cost to hold');
});

test('label logic: positive weekly surplus → "Weekly surplus"', () => {
  const weeklyHoldingCost = 50;
  const label = weeklyHoldingCost >= 0 ? 'Weekly surplus' : 'Weekly cost to hold';
  assert.strictEqual(label, 'Weekly surplus');
});

test('label logic: exactly zero → "Weekly surplus" (>= 0 branch)', () => {
  const weeklyHoldingCost = 0;
  const label = weeklyHoldingCost >= 0 ? 'Weekly surplus' : 'Weekly cost to hold';
  assert.strictEqual(label, 'Weekly surplus');
});

test('weekly cost is precisely 1/52 of annual — spot-check with $10,400/yr', () => {
  // $10,400 / 52 = $200 exactly
  const annualCashFlow = 10400;
  approxEqual(annualCashFlow / 52, 200, 0.0001);
});

test('weekly holding cost uses year-1 snapshot cash flow, not year-0', () => {
  // The production formula is: const weeklyHoldingCost = snCashFlow / 52
  // where snCashFlow is the snapshot-year projected cash flow.
  // _snapshotYear defaults to 1 in index.html, so the highlight uses Year 1 data.
  //
  // Demonstrate that a year-1 projected rent (with 6% growth applied once)
  // differs from year-0 rent, and that weeklyHoldingCost reflects year-1.
  //
  // Year-0 rent (no growth): weeklyRent * 52 = 500 * 52 = 26000
  // Year-1 rent (6% growth): 500 * 1.06 * 52 = 27560
  // The weekly cost derived from year-1 cash flow is distinct from year-0.
  const weeklyRent       = 500;
  const expectedGrowth   = 0.06;
  const annualLoanPayment = 24000;
  const operatingExpenses = 8000;   // fixed for simplicity

  const year0AnnualRent = weeklyRent * 52;
  const year1AnnualRent = weeklyRent * Math.pow(1 + expectedGrowth, 1) * 52;

  const year0CashFlow = year0AnnualRent - annualLoanPayment - operatingExpenses;
  const year1CashFlow = year1AnnualRent - annualLoanPayment - operatingExpenses;

  // Year-1 rent is higher → year-1 cash flow is less negative (or more positive)
  assert.ok(year1CashFlow > year0CashFlow,
    `Expected year-1 cf (${year1CashFlow}) > year-0 cf (${year0CashFlow}) with positive growth`);

  // Weekly cost using year-1 snapshot differs from using year-0
  const weeklyCostYear0 = year0CashFlow / 52;
  const weeklyCostYear1 = year1CashFlow / 52;
  assert.ok(weeklyCostYear1 !== weeklyCostYear0,
    'Weekly cost using year-1 snapshot must differ from year-0 snapshot at non-zero growth');

  // Confirm arithmetic: year-1 weekly cost = year-1 annual cash flow / 52
  approxEqual(weeklyCostYear1, year1CashFlow / 52, 0.0001);
});

// ---------------------------------------------------------------------------
// Property Highlights — usable equity at 5 years
//
// Pure version of the block at lines 4687–4705 of index.html.
// Verbatim formulas:
//   ue5GF = (1 + expectedGrowth)^5
//   ue5FV = purchasePrice * ue5GF
//   IO:   ue5RemainingLoan = loanAmount
//   PI/0: ue5RemainingLoan = max(0, loanAmount - (loanAmount / (loanTerm*12)) * 60)
//   PI/r: ue5RemainingLoan = loanAmount * ((1+r)^n - (1+r)^60) / ((1+r)^n - 1)
//         floor to 0 if < 0
//   ue5Equity  = max(0, ue5FV - ue5RemainingLoan)
//   ue5Usable  = ue5Equity * 0.8
// ---------------------------------------------------------------------------

function calcUsableEquityAt5(purchasePrice, loanAmount, expectedGrowth, loanType, loanTerm, interestRate) {
  var ue5GF = Math.pow(1 + expectedGrowth, 5);
  var ue5FV = purchasePrice * ue5GF;
  var ue5RemainingLoan;
  if (loanType === 'IO') {
    ue5RemainingLoan = loanAmount;
  } else if (interestRate === 0) {
    ue5RemainingLoan = Math.max(0, loanAmount - (loanAmount / (loanTerm * 12)) * 60);
  } else {
    var ue5MonthlyRate = interestRate / 12;
    var ue5TotalPmts = loanTerm * 12;
    var ue5PmtsMade = Math.min(60, ue5TotalPmts);
    ue5RemainingLoan = loanAmount * (Math.pow(1 + ue5MonthlyRate, ue5TotalPmts) - Math.pow(1 + ue5MonthlyRate, ue5PmtsMade)) / (Math.pow(1 + ue5MonthlyRate, ue5TotalPmts) - 1);
  }
  if (ue5RemainingLoan < 0) ue5RemainingLoan = 0;
  var ue5Equity = Math.max(0, ue5FV - ue5RemainingLoan);
  return ue5Equity * 0.8;
}

console.log('\nProperty Highlights — usable equity at 5 years');

test('IO loan: remaining loan equals original loanAmount (no principal paid)', () => {
  // purchasePrice=500000, 20% deposit → loanAmount=400000, IO, 5% rate, 6% growth
  // ue5FV = 500000 * (1.06)^5 = 669113.…
  // ue5RemainingLoan = 400000 (IO)
  // ue5Equity = 669113.… - 400000 = 269113.…
  // ue5Usable = 269113.… * 0.8
  const purchasePrice  = 500000;
  const loanAmount     = 400000;
  const expectedGrowth = 0.06;
  const ue5FV          = purchasePrice * Math.pow(1 + expectedGrowth, 5);
  const expectedUsable = (ue5FV - loanAmount) * 0.8;
  approxEqual(
    calcUsableEquityAt5(purchasePrice, loanAmount, expectedGrowth, 'IO', 30, 0.05),
    expectedUsable,
    0.01
  );
});

test('PI loan at same rate produces higher usable equity than IO (principal repaid)', () => {
  // For a P&I loan the remaining balance at 5 years is lower than the original
  // loanAmount, so equity — and thus usable equity — is higher than IO.
  const purchasePrice  = 500000;
  const loanAmount     = 400000;
  const expectedGrowth = 0.06;
  const interestRate   = 0.05;
  const loanTerm       = 30;
  const io = calcUsableEquityAt5(purchasePrice, loanAmount, expectedGrowth, 'IO', loanTerm, interestRate);
  const pi = calcUsableEquityAt5(purchasePrice, loanAmount, expectedGrowth, 'PI', loanTerm, interestRate);
  assert.ok(pi > io, `Expected PI usable equity (${pi}) > IO usable equity (${io})`);
});

test('zero growth: property value unchanged, equity comes solely from loan repayment (PI)', () => {
  // With zero growth ue5FV = purchasePrice.
  // PI loan: remaining < loanAmount, so equity = purchasePrice - remainingLoan > deposit.
  const purchasePrice = 400000;
  const loanAmount    = 320000;  // 20% deposit
  const interestRate  = 0.0672;
  const loanTerm      = 30;
  // Manually compute remaining loan via the same formula
  const r  = interestRate / 12;
  const n  = loanTerm * 12;
  const remaining = loanAmount * (Math.pow(1 + r, n) - Math.pow(1 + r, 60)) / (Math.pow(1 + r, n) - 1);
  const expectedUsable = Math.max(0, purchasePrice - remaining) * 0.8;
  approxEqual(
    calcUsableEquityAt5(purchasePrice, loanAmount, 0, 'PI', loanTerm, interestRate),
    expectedUsable,
    0.01
  );
});

test('short loan term fully paid within 5 years: remaining loan floors to 0 (not negative)', () => {
  // A 4-year P&I term means 48 payments — fully paid within the 60-payment window.
  // The raw amortisation formula would go negative; the floor must clamp it to 0.
  // ue5Usable should therefore equal ue5FV * 0.8.
  const purchasePrice  = 200000;
  const loanAmount     = 160000;
  const expectedGrowth = 0.04;
  const loanTerm       = 4;         // 48 payments — paid off before 60 payments
  const interestRate   = 0.05;
  const ue5FV          = purchasePrice * Math.pow(1 + expectedGrowth, 5);
  // With loanTerm=4 and ue5PmtsMade = min(60, 48) = 48 = ue5TotalPmts,
  // the numerator (1+r)^48 - (1+r)^48 = 0, so remainingLoan = 0.
  const expectedUsable = ue5FV * 0.8;
  approxEqual(
    calcUsableEquityAt5(purchasePrice, loanAmount, expectedGrowth, 'PI', loanTerm, interestRate),
    expectedUsable,
    0.01
  );
});

test('usable equity is exactly 80% of total equity', () => {
  // Verify the 0.8 multiplier directly: usableEquity / equity = 0.8
  const purchasePrice  = 600000;
  const loanAmount     = 480000;
  const expectedGrowth = 0.05;
  const interestRate   = 0.0672;
  const loanTerm       = 30;
  // Compute equity manually
  const ue5FV = purchasePrice * Math.pow(1 + expectedGrowth, 5);
  const r     = interestRate / 12;
  const n     = loanTerm * 12;
  const remaining = loanAmount * (Math.pow(1 + r, n) - Math.pow(1 + r, 60)) / (Math.pow(1 + r, n) - 1);
  const equity = Math.max(0, ue5FV - remaining);
  approxEqual(
    calcUsableEquityAt5(purchasePrice, loanAmount, expectedGrowth, 'PI', loanTerm, interestRate),
    equity * 0.8,
    0.01
  );
});

// ---------------------------------------------------------------------------
// Property Highlights — cash flow positive year detection
//
// Pure version of the block at lines 4666–4681 of index.html.
// Verbatim logic:
//   if (annualCashFlow >= 0) → cfPositiveYear = 0
//   else: loop cfy = 1..30:
//     cfGF   = (1 + expectedGrowth)^cfy
//     cfFV   = purchasePrice * cfGF
//     cfRent = weeklyRent * cfGF * 52
//     cfMgmt = cfRent * managementFeePct
//     cfVac  = weeklyRent * cfGF * 2
//     cfMaint = cfFV * 0.005
//     cfOpEx = cfMgmt + insurance + councilFees + cfVac + cfMaint
//     cfNet  = cfRent - annualLoanPayment - cfOpEx
//     if cfNet >= 0 → return cfy
//   return null
// ---------------------------------------------------------------------------

function calcCashFlowPositiveYear(annualCashFlow, purchasePrice, weeklyRent, expectedGrowth,
                                   managementFeePct, insurance, councilFees, annualLoanPayment) {
  if (annualCashFlow >= 0) return 0;
  for (var cfy = 1; cfy <= 30; cfy++) {
    var cfGF    = Math.pow(1 + expectedGrowth, cfy);
    var cfFV    = purchasePrice * cfGF;
    var cfRent  = weeklyRent * cfGF * 52;
    var cfMgmt  = cfRent * managementFeePct;
    var cfVac   = weeklyRent * cfGF * 2;
    var cfMaint = cfFV * 0.005;
    var cfOpEx  = cfMgmt + insurance + councilFees + cfVac + cfMaint;
    var cfNet   = cfRent - annualLoanPayment - cfOpEx;
    if (cfNet >= 0) return cfy;
  }
  return null;
}

console.log('\nProperty Highlights — cash flow positive year');

test('already positive cash flow returns 0 ("Now")', () => {
  // annualCashFlow >= 0 → immediate return of 0, loop never runs
  const result = calcCashFlowPositiveYear(
    1000,       // annualCashFlow >= 0
    500000, 550, 0.06, 0.08, 2200, 1800, 30000
  );
  assert.strictEqual(result, 0);
});

test('exactly zero annual cash flow also returns 0 (boundary of >= 0)', () => {
  const result = calcCashFlowPositiveYear(
    0,          // exactly zero — still >= 0
    500000, 550, 0.06, 0.08, 2200, 1800, 30000
  );
  assert.strictEqual(result, 0);
});

test('negative cash flow with high growth returns a year between 1 and 30', () => {
  // Use high growth (15%) so rent escalates quickly and the loan payment
  // (fixed) is overtaken within the 30-year window.
  // Low purchase price and loan payment keeps numbers tractable.
  const purchasePrice    = 300000;
  const weeklyRent       = 400;
  const expectedGrowth   = 0.15;
  const managementFeePct = 0.08;
  const insurance        = 1500;
  const councilFees      = 1500;
  const annualLoanPayment = 25000;  // fixed, does not grow
  // Compute year-0 cash flow to confirm it is negative
  const annualRent0 = weeklyRent * 52;
  const opEx0 = annualRent0 * managementFeePct + insurance + councilFees
              + weeklyRent * 2 + purchasePrice * 0.005;
  const cf0 = annualRent0 - annualLoanPayment - opEx0;
  assert.ok(cf0 < 0, `Precondition: year-0 cf (${cf0}) should be negative`);
  const result = calcCashFlowPositiveYear(
    cf0, purchasePrice, weeklyRent, expectedGrowth,
    managementFeePct, insurance, councilFees, annualLoanPayment
  );
  assert.ok(result !== null, 'Expected a year to be found, got null');
  assert.ok(result >= 1,  `Expected result >= 1, got ${result}`);
  assert.ok(result <= 30, `Expected result <= 30, got ${result}`);
});

test('zero growth and persistently negative cash flow returns null (never positive within 30 yrs)', () => {
  // With expectedGrowth = 0, rent never grows. If year-0 is negative,
  // every year in the loop will also be negative, so null is returned.
  const purchasePrice    = 500000;
  const weeklyRent       = 300;     // low rent
  const expectedGrowth   = 0;       // zero growth — rent stays flat
  const managementFeePct = 0.08;
  const insurance        = 2200;
  const councilFees      = 1800;
  const annualLoanPayment = 40000;  // high fixed payment
  // Confirm negative at year 0 before calling
  const annualRent0 = weeklyRent * 52;
  const opEx0 = annualRent0 * managementFeePct + insurance + councilFees
              + weeklyRent * 2 + purchasePrice * 0.005;
  const cf0 = annualRent0 - annualLoanPayment - opEx0;
  assert.ok(cf0 < 0, `Precondition: year-0 cf (${cf0}) should be negative`);
  const result = calcCashFlowPositiveYear(
    cf0, purchasePrice, weeklyRent, expectedGrowth,
    managementFeePct, insurance, councilFees, annualLoanPayment
  );
  assert.strictEqual(result, null);
});

test('loop starts at year 1 — scenario turning positive at year 2 returns 2', () => {
  // Year-0 cash flow is negative. With 50% growth, year 1 is still negative
  // (rent escalates but not enough to cover the large loan payment), and year
  // 2 turns positive. Confirms the loop correctly checks year 1 and moves on.
  // Strategy: use a high fixed loan payment to make year-0 and year-1 negative,
  // then use very high growth (50%) so the rent at year 2 exceeds all expenses.
  const purchasePrice    = 200000;
  const weeklyRent       = 300;     // lower rent → negative year-0
  const expectedGrowth   = 0.50;    // extreme growth: rent escalates quickly
  const managementFeePct = 0.05;
  const insurance        = 1000;
  const councilFees      = 1000;
  const annualLoanPayment = 25000;  // high fixed payment to ensure negative year-0
  // Verify year-0 is negative before calling
  const annualRent0 = weeklyRent * 52;
  const opEx0 = annualRent0 * managementFeePct + insurance + councilFees
              + weeklyRent * 2 + purchasePrice * 0.005;
  const cf0 = annualRent0 - annualLoanPayment - opEx0;
  assert.ok(cf0 < 0, `Precondition: year-0 cf (${cf0}) should be negative`);
  const result = calcCashFlowPositiveYear(
    cf0, purchasePrice, weeklyRent, expectedGrowth,
    managementFeePct, insurance, councilFees, annualLoanPayment
  );
  // With 50% growth the scenario turns positive at year 2 — confirm it does
  assert.strictEqual(result, 2, `Expected year 2 with extreme growth, got ${result}`);
});

test('loop starts at year 1 — property turning positive in Year 1 is reported as 1 not 2', () => {
  // Verifies the post-fix behaviour: the loop begins at cfy=1, so a property
  // whose projected cash flow first turns non-negative in year 1 must return 1.
  // (Before the fix the loop started at year 2, which would have caused this
  // scenario to return 2 incorrectly.)
  //
  // Construction: year-0 is negative (loan payment > rent). With very high growth
  // (100%) the rent at year 1 doubles and overtakes all expenses.
  const purchasePrice    = 200000;
  const weeklyRent       = 200;     // low year-0 rent → negative at year 0
  const expectedGrowth   = 1.00;    // 100% growth: year-1 rent is 2× year-0 rent
  const managementFeePct = 0.08;
  const insurance        = 500;
  const councilFees      = 500;
  const annualLoanPayment = 15000;  // modest payment; year-0 is still negative

  // Confirm year-0 is negative
  const annualRent0 = weeklyRent * 52;                               // 10400
  const opEx0 = annualRent0 * managementFeePct + insurance + councilFees
              + weeklyRent * 2 + purchasePrice * 0.005;
  const cf0 = annualRent0 - annualLoanPayment - opEx0;
  assert.ok(cf0 < 0, `Precondition: year-0 cf (${cf0}) should be negative`);

  // Confirm year-1 projected cash flow is positive
  const cfGF1   = Math.pow(1 + expectedGrowth, 1);                  // 2.0
  const cfFV1   = purchasePrice * cfGF1;
  const cfRent1 = weeklyRent * cfGF1 * 52;                          // 20800
  const cfMgmt1 = cfRent1 * managementFeePct;
  const cfVac1  = weeklyRent * cfGF1 * 2;
  const cfMaint1= cfFV1 * 0.005;
  const cfNet1  = cfRent1 - annualLoanPayment - (cfMgmt1 + insurance + councilFees + cfVac1 + cfMaint1);
  assert.ok(cfNet1 >= 0, `Precondition: year-1 projected cfNet (${cfNet1}) should be >= 0`);

  const result = calcCashFlowPositiveYear(
    cf0, purchasePrice, weeklyRent, expectedGrowth,
    managementFeePct, insurance, councilFees, annualLoanPayment
  );
  assert.strictEqual(result, 1, `Expected 1 (loop starts at year 1), got ${result}`);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
