// engine.js — TrueReturn pure calculation engine.
// Loaded by index.html as a classic script (declarations land in the global
// lexical scope) and require()'d by node tests via the module.exports guard.
// No DOM access in this file.

// ── Legacy pure functions (moved verbatim from index.html) ──────────────
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
    const BUILDING_PEST      = 600;
    const LOAN_ESTABLISHMENT = 800;

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

    function calcDepreciation(ageBracket, purchasePrice) {
      const buildingValue = purchasePrice * 0.75;
      if (ageBracket === 'new') return buildingValue * 0.025;
      if (ageBracket === 'mid') return buildingValue * 0.0125;
      return buildingValue * 0.0075;
    }

// ── Node export guard ────────────────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    stateDefaults, BUILDING_PEST, LOAN_ESTABLISHMENT,
    formatCurrency, calcStampDuty, calcDepreciation,
  };
}
