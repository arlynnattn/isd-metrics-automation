#!/usr/bin/env node

/**
 * Manual validated metric overrides for known-reporting exceptions.
 *
 * Why this exists:
 * Some historical monthly metrics were reconciled against validated exports that
 * do not match the raw Jira SLA-field averages used by the automation cache.
 * This registry prevents a rerun from overwriting those reconciled numbers.
 */

const OVERRIDES = {
  'March 2026': {
    avgTTFR: 49 / 60, // 0h 49m
    avgTTR: 94.88 / 60, // 1h 35m
    notes: {
      ttfr: 'Validated from Jira Service Management custom report export (Mar 1, 2026 to Apr 1, 2026; 97 rows reviewed).',
      ttr: 'Validated from corrected no-clone ticket export TTR_NO_Clone_TTR_-_No_Clone_2026-03-01_to_2026-04-01_month (1).csv (34 rows reviewed).'
    }
  }
};

function applyValidatedMetricOverrides(metrics, periodLabel) {
  const override = OVERRIDES[periodLabel];
  if (!override) {
    return metrics;
  }

  return {
    ...metrics,
    rawAvgTTFR: metrics.avgTTFR,
    rawAvgTTR: metrics.avgTTR,
    avgTTFR: override.avgTTFR,
    avgTTR: override.avgTTR,
    validatedOverrideApplied: true,
    validatedMetricNotes: override.notes
  };
}

module.exports = {
  OVERRIDES,
  applyValidatedMetricOverrides
};
