// tests/harness.js — shared micro test harness.
const assert = require('assert');

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

function summary() {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

module.exports = { assert, test, approxEqual, summary };
