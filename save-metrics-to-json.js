#!/usr/bin/env node

/**
 * Save Metrics to JSON
 * Extracts metrics from dashboard scripts and saves to JSON files
 * Used by analyst report generators to ensure data consistency
 */

const fs = require('fs');
const path = require('path');

// You'll call this from the dashboard scripts after calculating metrics

/**
 * Save weekly metrics to JSON file
 */
function saveWeeklyMetrics(currentMetrics, previousMetrics, weekRanges) {
  const data = {
    timestamp: new Date().toISOString(),
    currentWeek: {
      ...currentMetrics,
      period: weekRanges.currentWeek.label,
      start: weekRanges.currentWeek.start,
      end: weekRanges.currentWeek.end
    },
    previousWeek: {
      ...previousMetrics,
      period: weekRanges.previousWeek.label,
      start: weekRanges.previousWeek.start,
      end: weekRanges.previousWeek.end
    }
  };

  const filePath = path.join(__dirname, 'metrics-cache-weekly.json');
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`✓ Weekly metrics saved to ${filePath}`);
  return filePath;
}

/**
 * Save monthly metrics to JSON file
 */
function saveMonthlyMetrics(currentMetrics, previousMetrics, monthRanges) {
  const data = {
    timestamp: new Date().toISOString(),
    currentMonth: {
      ...currentMetrics,
      period: monthRanges.currentMonth.label,
      start: monthRanges.currentMonth.start,
      end: monthRanges.currentMonth.end
    },
    previousMonth: {
      ...previousMetrics,
      period: monthRanges.previousMonth.label,
      start: monthRanges.previousMonth.start,
      end: monthRanges.previousMonth.end
    }
  };

  const filePath = path.join(__dirname, 'metrics-cache-monthly.json');
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`✓ Monthly metrics saved to ${filePath}`);
  return filePath;
}

/**
 * Load weekly metrics from JSON file
 */
function loadWeeklyMetrics() {
  const filePath = path.join(__dirname, 'metrics-cache-weekly.json');

  if (!fs.existsSync(filePath)) {
    throw new Error(`Weekly metrics cache not found. Run ./run-weekly.sh first to generate metrics.`);
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Check if data is stale (older than 7 days)
  const age = Date.now() - new Date(data.timestamp).getTime();
  const daysOld = age / (1000 * 60 * 60 * 24);

  if (daysOld > 7) {
    console.warn(`⚠️  Warning: Weekly metrics cache is ${daysOld.toFixed(1)} days old. Consider running ./run-weekly.sh to refresh.`);
  }

  return data;
}

/**
 * Load monthly metrics from JSON file
 */
function loadMonthlyMetrics() {
  const filePath = path.join(__dirname, 'metrics-cache-monthly.json');

  if (!fs.existsSync(filePath)) {
    throw new Error(`Monthly metrics cache not found. Run ./run-monthly.sh first to generate metrics.`);
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Check if data is stale (older than 30 days)
  const age = Date.now() - new Date(data.timestamp).getTime();
  const daysOld = age / (1000 * 60 * 60 * 24);

  if (daysOld > 30) {
    console.warn(`⚠️  Warning: Monthly metrics cache is ${daysOld.toFixed(1)} days old. Consider running ./run-monthly.sh to refresh.`);
  }

  return data;
}

module.exports = {
  saveWeeklyMetrics,
  saveMonthlyMetrics,
  loadWeeklyMetrics,
  loadMonthlyMetrics
};
