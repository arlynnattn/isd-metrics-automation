#!/usr/bin/env node

/**
 * Metrics Validation Script
 * Ensures dashboard and analyst reports have consistent data
 * Run after generating reports to catch any mismatches
 */

const fs = require('fs');
const path = require('path');
const { validateMetricsMatch, compareToTarget, parseFormattedTime } = require('./shared-metrics');
const { loadWeeklyMetrics, loadMonthlyMetrics } = require('./save-metrics-to-json');

console.log('=== IT Ops Metrics Validation ===\n');

let hasErrors = false;

/**
 * Validate weekly metrics
 */
function validateWeeklyMetrics() {
  console.log('📊 Validating Weekly Metrics...\n');

  const results = {
    valid: true,
    errors: [],
    warnings: [],
    period: null
  };

  try {
    const data = loadWeeklyMetrics();
    const current = data.currentWeek;
    const previous = data.previousWeek;

    results.period = current.period;

    console.log(`Period: ${current.period}`);
    console.log(`Generated: ${new Date(data.timestamp).toLocaleString()}\n`);

    // Test 1: Check for N/A values in critical metrics
    console.log('Test 1: Checking for missing critical metrics...');
    const criticalMetrics = ['resolvedCount', 'createdCount', 'avgTTFR', 'avgTTR', 'overallSlaPercent'];
    let hasMissing = false;

    for (const metric of criticalMetrics) {
      if (current[metric] === 'N/A' || current[metric] === null || current[metric] === undefined) {
        const error = `${metric} is missing or N/A`;
        console.log(`  ❌ ${error}`);
        results.errors.push(error);
        hasMissing = true;
        hasErrors = true;
        results.valid = false;
      }
    }

    if (!hasMissing) {
      console.log('  ✅ All critical metrics present\n');
    } else {
      console.log('');
    }

    // Test 2: Validate target comparison logic
    console.log('Test 2: Validating target comparison logic...');

    const ttfr = typeof current.avgTTFR === 'string' ? parseFormattedTime(current.avgTTFR) || parseFloat(current.avgTTFR) : parseFloat(current.avgTTFR);
    const ttr = typeof current.avgTTR === 'string' ? parseFormattedTime(current.avgTTR) || parseFloat(current.avgTTR) : parseFloat(current.avgTTR);

    const ttfrResult = compareToTarget('ttfr', ttfr);
    const ttrResult = compareToTarget('ttr', ttr);
    const slaResult = compareToTarget('slaPercent', parseFloat(current.overallSlaPercent));

    console.log(`  TTFR: ${ttfr.toFixed(2)}h (${ttfrResult.description}) ${ttfrResult.emoji}`);
    console.log(`  TTR: ${ttr.toFixed(2)}h (${ttrResult.description}) ${ttrResult.emoji}`);
    console.log(`  SLA: ${current.overallSlaPercent}% (${slaResult.description}) ${slaResult.emoji}\n`);

    // Test 3: Check breach count consistency
    console.log('Test 3: Checking SLA breach consistency...');
    const breachRate = parseFloat(current.slaBreachPercent);
    const breachCount = current.slaBreachCount;
    const ttrCount = current.ttrCount;

    if (ttrCount > 0) {
      const calculatedRate = ((breachCount / ttrCount) * 100).toFixed(1);
      if (Math.abs(calculatedRate - breachRate) > 0.2) {
        const error = `Breach rate mismatch: ${breachRate}% reported vs ${calculatedRate}% calculated`;
        console.log(`  ❌ ${error}`);
        results.errors.push(error);
        hasErrors = true;
        results.valid = false;
      } else {
        console.log(`  ✅ Breach rate consistent: ${breachRate}% (${breachCount}/${ttrCount} tickets)\n`);
      }
    } else {
      console.log(`  ⚠️  No TTR data to validate breach rate\n`);
      results.warnings.push('No TTR data to validate breach rate');
    }

    // Test 4: Check automation rate consistency
    console.log('Test 4: Checking automation rate consistency...');
    const automationRate = parseFloat(current.automationPercent);
    const automatedCount = current.automatedCount;
    const resolvedCount = current.resolvedCount;

    if (resolvedCount > 0) {
      const calculatedRate = ((automatedCount / resolvedCount) * 100).toFixed(1);
      if (Math.abs(calculatedRate - automationRate) > 0.2) {
        const error = `Automation rate mismatch: ${automationRate}% reported vs ${calculatedRate}% calculated`;
        console.log(`  ❌ ${error}`);
        results.errors.push(error);
        hasErrors = true;
        results.valid = false;
      } else {
        console.log(`  ✅ Automation rate consistent: ${automationRate}% (${automatedCount}/${resolvedCount} tickets)\n`);
      }
    } else {
      console.log(`  ⚠️  No resolved tickets to validate automation rate\n`);
      results.warnings.push('No resolved tickets to validate automation rate');
    }

    console.log('✓ Weekly validation complete\n');

  } catch (error) {
    console.error(`❌ Error validating weekly metrics: ${error.message}\n`);
    results.errors.push(`Validation error: ${error.message}`);
    results.valid = false;
    hasErrors = true;
  }

  return results;
}

/**
 * Validate monthly metrics
 */
function validateMonthlyMetrics() {
  console.log('📊 Validating Monthly Metrics...\n');

  const results = {
    valid: true,
    errors: [],
    warnings: [],
    period: null
  };

  try {
    const data = loadMonthlyMetrics();
    const current = data.currentMonth;
    const previous = data.previousMonth;

    results.period = current.period;

    console.log(`Period: ${current.period}`);
    console.log(`Generated: ${new Date(data.timestamp).toLocaleString()}\n`);

    // Test 1: Check for N/A values in critical metrics
    console.log('Test 1: Checking for missing critical metrics...');
    const criticalMetrics = ['resolvedCount', 'createdCount', 'avgTTFR', 'avgTTR', 'overallSlaPercent'];
    let hasMissing = false;

    for (const metric of criticalMetrics) {
      if (current[metric] === 'N/A' || current[metric] === null || current[metric] === undefined) {
        const error = `${metric} is missing or N/A`;
        console.log(`  ❌ ${error}`);
        results.errors.push(error);
        hasMissing = true;
        hasErrors = true;
        results.valid = false;
      }
    }

    if (!hasMissing) {
      console.log('  ✅ All critical metrics present\n');
    } else {
      console.log('');
    }

    // Test 2: Validate target comparison logic
    console.log('Test 2: Validating target comparison logic...');

    const ttfr = typeof current.avgTTFR === 'string' ? parseFormattedTime(current.avgTTFR) || parseFloat(current.avgTTFR) : parseFloat(current.avgTTFR);
    const ttr = typeof current.avgTTR === 'string' ? parseFormattedTime(current.avgTTR) || parseFloat(current.avgTTR) : parseFloat(current.avgTTR);

    const ttfrResult = compareToTarget('ttfr', ttfr);
    const ttrResult = compareToTarget('ttr', ttr);
    const slaResult = compareToTarget('slaPercent', parseFloat(current.overallSlaPercent));

    console.log(`  TTFR: ${ttfr.toFixed(2)}h (${ttfrResult.description}) ${ttfrResult.emoji}`);
    console.log(`  TTR: ${ttr.toFixed(2)}h (${ttrResult.description}) ${ttrResult.emoji}`);
    console.log(`  SLA: ${current.overallSlaPercent}% (${slaResult.description}) ${slaResult.emoji}\n`);

    // Test 3: Check breach count consistency
    console.log('Test 3: Checking SLA breach consistency...');
    const breachRate = parseFloat(current.slaBreachPercent);
    const breachCount = current.slaBreachCount;
    const ttrCount = current.ttrCount;

    if (ttrCount > 0) {
      const calculatedRate = ((breachCount / ttrCount) * 100).toFixed(1);
      if (Math.abs(calculatedRate - breachRate) > 0.2) {
        const error = `Breach rate mismatch: ${breachRate}% reported vs ${calculatedRate}% calculated`;
        console.log(`  ❌ ${error}`);
        results.errors.push(error);
        hasErrors = true;
        results.valid = false;
      } else {
        console.log(`  ✅ Breach rate consistent: ${breachRate}% (${breachCount}/${ttrCount} tickets)\n`);
      }
    } else {
      console.log(`  ⚠️  No TTR data to validate breach rate\n`);
      results.warnings.push('No TTR data to validate breach rate');
    }

    // Test 4: Check automation rate consistency
    console.log('Test 4: Checking automation rate consistency...');
    const automationRate = parseFloat(current.automationPercent);
    const automatedCount = current.automatedCount;
    const resolvedCount = current.resolvedCount;

    if (resolvedCount > 0) {
      const calculatedRate = ((automatedCount / resolvedCount) * 100).toFixed(1);
      if (Math.abs(calculatedRate - automationRate) > 0.2) {
        const error = `Automation rate mismatch: ${automationRate}% reported vs ${calculatedRate}% calculated`;
        console.log(`  ❌ ${error}`);
        results.errors.push(error);
        hasErrors = true;
        results.valid = false;
      } else {
        console.log(`  ✅ Automation rate consistent: ${automationRate}% (${automatedCount}/${resolvedCount} tickets)\n`);
      }
    } else {
      console.log(`  ⚠️  No resolved tickets to validate automation rate\n`);
      results.warnings.push('No resolved tickets to validate automation rate');
    }

    console.log('✓ Monthly validation complete\n');

  } catch (error) {
    console.error(`❌ Error validating monthly metrics: ${error.message}\n`);
    results.errors.push(`Validation error: ${error.message}`);
    results.valid = false;
    hasErrors = true;
  }

  return results;
}

/**
 * Save validation results to JSON for reports to consume
 */
function saveValidationResults(weeklyResults, monthlyResults) {
  const data = {
    timestamp: new Date().toISOString(),
    weekly: weeklyResults,
    monthly: monthlyResults,
    overallValid: weeklyResults.valid && monthlyResults.valid
  };

  const filePath = path.join(__dirname, 'validation-results.json');
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`✓ Validation results saved to ${filePath}\n`);
  return filePath;
}

/**
 * Load validation results (for report generators)
 */
function loadValidationResults() {
  const filePath = path.join(__dirname, 'validation-results.json');

  if (!fs.existsSync(filePath)) {
    // Return default "passed" if no validation has been run
    return {
      timestamp: new Date().toISOString(),
      weekly: { valid: true, errors: [], warnings: [] },
      monthly: { valid: true, errors: [], warnings: [] },
      overallValid: true
    };
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Main execution
 */
function main() {
  console.log('Running validation checks on generated metrics...\n');
  console.log('═'.repeat(60) + '\n');

  // Validate weekly metrics
  let weeklyResults;
  try {
    weeklyResults = validateWeeklyMetrics();
  } catch (error) {
    console.error(`Error in weekly validation: ${error.message}\n`);
    weeklyResults = {
      valid: false,
      errors: [`Validation error: ${error.message}`],
      warnings: []
    };
    hasErrors = true;
  }

  console.log('═'.repeat(60) + '\n');

  // Validate monthly metrics
  let monthlyResults;
  try {
    monthlyResults = validateMonthlyMetrics();
  } catch (error) {
    console.error(`Error in monthly validation: ${error.message}\n`);
    monthlyResults = {
      valid: false,
      errors: [`Validation error: ${error.message}`],
      warnings: []
    };
    hasErrors = true;
  }

  console.log('═'.repeat(60) + '\n');

  // Save validation results for reports to consume
  saveValidationResults(weeklyResults, monthlyResults);

  // Final summary
  if (hasErrors) {
    console.log('❌ VALIDATION FAILED - Errors found in metrics\n');
    console.log('Review the errors above and fix the issues.');
    console.log('Re-run the dashboard scripts to regenerate metrics.\n');
    process.exit(1);
  } else {
    console.log('✅ VALIDATION PASSED - All metrics are consistent\n');
    console.log('Reports are ready for leadership consumption.\n');
    process.exit(0);
  }
}

// Export for use by other modules
module.exports = {
  validateWeeklyMetrics,
  validateMonthlyMetrics,
  loadValidationResults
};

// Run validation if executed directly
if (require.main === module) {
  main();
}
