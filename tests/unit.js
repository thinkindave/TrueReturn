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
// buildPortfolioDataset(propertyDatasets, metric)
//   PURE — accepts two plain JS arguments, performs arithmetic aggregation, and
//   returns a plain object. Testable without any DOM. Copied verbatim below.
//
// buildChartOptions(metric, isDark, isChart2)
//   STRUCTURALLY PURE — all three arguments are primitives. Returns a plain
//   configuration object. The only non-primitive dependency is formatCurrency,
//   which is already inlined above. Testable without any DOM. Copied verbatim below.

// ---------------------------------------------------------------------------
// Pure functions copied verbatim from index.html (graph section)
// ---------------------------------------------------------------------------

const GRAPH_PORTFOLIO_COLOR = '#9CA3AF';
const GRAPH_YEARS = 15;

function buildPortfolioDataset(propertyDatasets, metric) {
  const labels = propertyDatasets.labels;
  const allData = propertyDatasets.datasets.map(d => d.data);
  const portfolioData = [];

  for (let y = 0; y <= GRAPH_YEARS; y++) {
    const vals = allData.map(d => d[y]).filter(v => v !== null && v !== undefined);
    if (vals.length === 0) {
      portfolioData.push(null);
    } else if (metric === 'annualisedReturn') {
      portfolioData.push(vals.reduce((a, b) => a + b, 0) / vals.length);
    } else {
      portfolioData.push(vals.reduce((a, b) => a + b, 0));
    }
  }

  return {
    label: 'Portfolio',
    data: portfolioData,
    borderColor: GRAPH_PORTFOLIO_COLOR,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderDash: [6, 4],
    pointRadius: 2,
    pointHoverRadius: 4,
    tension: 0.3,
    spanGaps: false
  };
}

function buildChartOptions(metric, isDark, isChart2) {
  const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const tickColor = isDark ? '#9CA3AF' : '#6B7280';
  const tooltipBg = isDark ? '#1F2937' : '#FFFFFF';
  const tooltipBorder = isDark ? '#374151' : '#E5E7EB';
  const tooltipText = isDark ? '#F9FAFB' : '#1F2937';
  const isCurrency = metric === 'value' || metric === 'equity' || metric === 'cumulativeCashFlow';

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

  if (isChart2) {
    options.plugins.annotation = {
      annotations: {
        zeroLine: {
          type: 'line',
          yMin: 0,
          yMax: 0,
          borderColor: 'rgba(239,68,68,0.5)',
          borderWidth: 1,
          borderDash: [4, 4]
        }
      }
    };
  }

  return options;
}

// ---------------------------------------------------------------------------
// Helper: build a minimal propertyDatasets stub for buildPortfolioDataset tests.
// Each dataset must have a .data array of length GRAPH_YEARS + 1 (16 entries).
// ---------------------------------------------------------------------------

function makeDatasets(dataArrays) {
  return {
    labels: Array.from({ length: GRAPH_YEARS + 1 }, (_, i) => 'Yr ' + i),
    datasets: dataArrays.map((data, i) => ({
      label: 'Property ' + (i + 1),
      data
    }))
  };
}

function makeUniformData(value) {
  return Array.from({ length: GRAPH_YEARS + 1 }, () => value);
}

// ---------------------------------------------------------------------------
// buildPortfolioDataset — metadata / shape
// ---------------------------------------------------------------------------

console.log('\nbuildPortfolioDataset — shape and metadata');

test('returns an object with label "Portfolio"', () => {
  const result = buildPortfolioDataset(makeDatasets([makeUniformData(100)]), 'value');
  assert.strictEqual(result.label, 'Portfolio');
});

test('returns data array of length GRAPH_YEARS + 1', () => {
  const result = buildPortfolioDataset(makeDatasets([makeUniformData(50)]), 'value');
  assert.strictEqual(result.data.length, GRAPH_YEARS + 1);
});

test('uses GRAPH_PORTFOLIO_COLOR as borderColor', () => {
  const result = buildPortfolioDataset(makeDatasets([makeUniformData(0)]), 'value');
  assert.strictEqual(result.borderColor, GRAPH_PORTFOLIO_COLOR);
});

test('backgroundColor is transparent', () => {
  const result = buildPortfolioDataset(makeDatasets([makeUniformData(0)]), 'value');
  assert.strictEqual(result.backgroundColor, 'transparent');
});

test('borderDash is [6, 4]', () => {
  const result = buildPortfolioDataset(makeDatasets([makeUniformData(0)]), 'value');
  assert.deepStrictEqual(result.borderDash, [6, 4]);
});

// ---------------------------------------------------------------------------
// buildPortfolioDataset — value / equity / cumulativeCashFlow (summing)
// ---------------------------------------------------------------------------

console.log('\nbuildPortfolioDataset — summing metrics');

test('sums two properties for metric "value" at year 0', () => {
  const d1 = makeUniformData(100000);
  const d2 = makeUniformData(200000);
  const result = buildPortfolioDataset(makeDatasets([d1, d2]), 'value');
  assert.strictEqual(result.data[0], 300000);
});

test('sums three properties for metric "equity" at every year', () => {
  const d1 = makeUniformData(50);
  const d2 = makeUniformData(50);
  const d3 = makeUniformData(50);
  const result = buildPortfolioDataset(makeDatasets([d1, d2, d3]), 'equity');
  result.data.forEach(v => assert.strictEqual(v, 150));
});

test('sums for metric "cumulativeCashFlow"', () => {
  const d1 = makeUniformData(-1000);
  const d2 = makeUniformData(2000);
  const result = buildPortfolioDataset(makeDatasets([d1, d2]), 'cumulativeCashFlow');
  assert.strictEqual(result.data[0], 1000);
});

test('single property — portfolio equals that property\'s value', () => {
  const d1 = makeUniformData(750000);
  const result = buildPortfolioDataset(makeDatasets([d1]), 'value');
  result.data.forEach(v => assert.strictEqual(v, 750000));
});

// ---------------------------------------------------------------------------
// buildPortfolioDataset — annualisedReturn (averaging)
// ---------------------------------------------------------------------------

console.log('\nbuildPortfolioDataset — annualisedReturn averaging');

test('averages two properties for metric "annualisedReturn"', () => {
  const d1 = makeUniformData(8);
  const d2 = makeUniformData(12);
  const result = buildPortfolioDataset(makeDatasets([d1, d2]), 'annualisedReturn');
  assert.strictEqual(result.data[0], 10);
});

test('averages three properties for metric "annualisedReturn"', () => {
  const d1 = makeUniformData(6);
  const d2 = makeUniformData(9);
  const d3 = makeUniformData(12);
  const result = buildPortfolioDataset(makeDatasets([d1, d2, d3]), 'annualisedReturn');
  assert.strictEqual(result.data[5], 9);
});

test('single property annualisedReturn equals that property\'s value', () => {
  const d1 = makeUniformData(7.5);
  const result = buildPortfolioDataset(makeDatasets([d1]), 'annualisedReturn');
  result.data.forEach(v => assert.strictEqual(v, 7.5));
});

// ---------------------------------------------------------------------------
// buildPortfolioDataset — null / undefined filtering
// ---------------------------------------------------------------------------

console.log('\nbuildPortfolioDataset — null and undefined filtering');

test('null values are excluded from sum', () => {
  // d1 has null at year 0, d2 has 500 everywhere
  const d1 = makeUniformData(500);
  d1[0] = null;
  const d2 = makeUniformData(500);
  const result = buildPortfolioDataset(makeDatasets([d1, d2]), 'value');
  // year 0: only d2 contributes → 500
  assert.strictEqual(result.data[0], 500);
  // year 1: both contribute → 1000
  assert.strictEqual(result.data[1], 1000);
});

test('all-null year produces null in portfolio', () => {
  const d1 = makeUniformData(null);
  const d2 = makeUniformData(null);
  const result = buildPortfolioDataset(makeDatasets([d1, d2]), 'value');
  result.data.forEach(v => assert.strictEqual(v, null));
});

test('undefined values are treated the same as null (excluded)', () => {
  const d1 = makeUniformData(300);
  d1[3] = undefined;
  const d2 = makeUniformData(300);
  const result = buildPortfolioDataset(makeDatasets([d1, d2]), 'value');
  // year 3: only d2 → 300
  assert.strictEqual(result.data[3], 300);
});

test('empty datasets array produces all-null portfolio', () => {
  const result = buildPortfolioDataset(makeDatasets([]), 'value');
  assert.strictEqual(result.data.length, GRAPH_YEARS + 1);
  result.data.forEach(v => assert.strictEqual(v, null));
});

// ---------------------------------------------------------------------------
// buildChartOptions — structural properties
// ---------------------------------------------------------------------------

console.log('\nbuildChartOptions — structure');

test('returns responsive:true and maintainAspectRatio:false', () => {
  const opts = buildChartOptions('value', false, false);
  assert.strictEqual(opts.responsive, true);
  assert.strictEqual(opts.maintainAspectRatio, false);
});

test('interaction mode is "index" with intersect:false', () => {
  const opts = buildChartOptions('value', false, false);
  assert.strictEqual(opts.interaction.mode, 'index');
  assert.strictEqual(opts.interaction.intersect, false);
});

test('legend display is false', () => {
  const opts = buildChartOptions('value', false, false);
  assert.strictEqual(opts.plugins.legend.display, false);
});

test('x and y scale objects are present', () => {
  const opts = buildChartOptions('value', false, false);
  assert.ok(opts.scales.x, 'scales.x should exist');
  assert.ok(opts.scales.y, 'scales.y should exist');
});

// ---------------------------------------------------------------------------
// buildChartOptions — isDark colour switching
// ---------------------------------------------------------------------------

console.log('\nbuildChartOptions — isDark colour switching');

test('dark mode sets tooltip background to #1F2937', () => {
  const opts = buildChartOptions('value', true, false);
  assert.strictEqual(opts.plugins.tooltip.backgroundColor, '#1F2937');
});

test('light mode sets tooltip background to #FFFFFF', () => {
  const opts = buildChartOptions('value', false, false);
  assert.strictEqual(opts.plugins.tooltip.backgroundColor, '#FFFFFF');
});

test('dark mode sets tooltip border to #374151', () => {
  const opts = buildChartOptions('value', true, false);
  assert.strictEqual(opts.plugins.tooltip.borderColor, '#374151');
});

test('light mode sets tooltip border to #E5E7EB', () => {
  const opts = buildChartOptions('value', false, false);
  assert.strictEqual(opts.plugins.tooltip.borderColor, '#E5E7EB');
});

test('dark mode tick colour is #9CA3AF', () => {
  const opts = buildChartOptions('value', true, false);
  assert.strictEqual(opts.plugins.tooltip.bodyColor, '#9CA3AF');
});

test('light mode tick colour is #6B7280', () => {
  const opts = buildChartOptions('value', false, false);
  assert.strictEqual(opts.plugins.tooltip.bodyColor, '#6B7280');
});

// ---------------------------------------------------------------------------
// buildChartOptions — isChart2 annotation
// ---------------------------------------------------------------------------

console.log('\nbuildChartOptions — isChart2 annotation');

test('isChart2:true adds annotation.annotations.zeroLine', () => {
  const opts = buildChartOptions('annualisedReturn', false, true);
  assert.ok(opts.plugins.annotation, 'annotation plugin should be present');
  assert.ok(opts.plugins.annotation.annotations.zeroLine, 'zeroLine annotation should be present');
});

test('isChart2:false does NOT add annotation plugin', () => {
  const opts = buildChartOptions('value', false, false);
  assert.strictEqual(opts.plugins.annotation, undefined);
});

test('zeroLine annotation has yMin:0 and yMax:0', () => {
  const opts = buildChartOptions('equity', true, true);
  const zl = opts.plugins.annotation.annotations.zeroLine;
  assert.strictEqual(zl.yMin, 0);
  assert.strictEqual(zl.yMax, 0);
});

test('zeroLine borderDash is [4, 4]', () => {
  const opts = buildChartOptions('equity', false, true);
  assert.deepStrictEqual(opts.plugins.annotation.annotations.zeroLine.borderDash, [4, 4]);
});

// ---------------------------------------------------------------------------
// buildChartOptions — isCurrency detection in callbacks
// ---------------------------------------------------------------------------

console.log('\nbuildChartOptions — tooltip label callback');

test('currency metric: tooltip label callback formats with $', () => {
  const opts = buildChartOptions('value', false, false);
  const cb = opts.plugins.tooltip.callbacks.label;
  const result = cb({ parsed: { y: 500000 }, dataset: { label: 'Prop A' } });
  assert.ok(result.includes('$'), 'should contain $ sign for currency metric');
  assert.ok(result.includes('Prop A'), 'should include dataset label');
});

test('currency metric "equity": tooltip label callback formats with $', () => {
  const opts = buildChartOptions('equity', false, false);
  const cb = opts.plugins.tooltip.callbacks.label;
  const result = cb({ parsed: { y: 150000 }, dataset: { label: 'P1' } });
  assert.ok(result.includes('$'));
});

test('non-currency metric "annualisedReturn": tooltip label uses % not $', () => {
  const opts = buildChartOptions('annualisedReturn', false, false);
  const cb = opts.plugins.tooltip.callbacks.label;
  const result = cb({ parsed: { y: 7.53 }, dataset: { label: 'P1' } });
  assert.ok(result.includes('%'), 'should contain % for non-currency metric');
  assert.ok(!result.includes('$'), 'should not contain $ for non-currency metric');
});

test('tooltip label callback returns null when val is null', () => {
  const opts = buildChartOptions('value', false, false);
  const cb = opts.plugins.tooltip.callbacks.label;
  const result = cb({ parsed: { y: null }, dataset: { label: 'P1' } });
  assert.strictEqual(result, null);
});

test('y-axis tick callback uses % for annualisedReturn', () => {
  const opts = buildChartOptions('annualisedReturn', false, false);
  const tickCb = opts.scales.y.ticks.callback;
  const result = tickCb(8.5);
  assert.ok(result.includes('%'));
  assert.ok(!result.includes('$'));
});

test('y-axis tick callback uses $ for value metric', () => {
  const opts = buildChartOptions('value', false, false);
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
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
