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
  'January 2026': {
    overallSlaPercent: '92.7',
    ttfrSlaPercent: '92.7', // Estimated from monthly PDF
    ttrSlaPercent: '92.7', // Estimated from monthly PDF
    csat: {
      avgScore: '5.00',
      totalResponses: 84, // From CSAT_Feedback export
      scores: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 82 }
    },
    notes: {
      sla: 'Validated from monthly IT Ops Metrics PDF (Jan 2026). Jira SLA fields not using business hours (9-6 M-F) correctly.',
      csat: 'Validated from CSAT_Feedback_ISD_2026-01-01_to_2026-04-02.csv. Jira CSAT API pagination unreliable.'
    }
  },
  'February 2026': {
    overallSlaPercent: '90.6',
    ttfrSlaPercent: '90.6', // Estimated from monthly PDF
    ttrSlaPercent: '90.6', // Estimated from monthly PDF
    csat: {
      avgScore: '4.98',
      totalResponses: 68, // From CSAT_Feedback export
      scores: { 1: 1, 2: 0, 3: 0, 4: 1, 5: 66 }
    },
    notes: {
      sla: 'Validated from monthly IT Ops Metrics PDF (Feb 2026). Jira SLA fields not using business hours (9-6 M-F) correctly.',
      csat: 'Validated from CSAT_Feedback_ISD_2026-01-01_to_2026-04-02.csv. Jira CSAT API pagination unreliable.'
    }
  },
  'March 2026': {
    avgTTFR: 49 / 60, // 0h 49m
    avgTTR: 94.88 / 60, // 1h 35m
    overallSlaPercent: '92.6',
    ttfrSlaPercent: '92.6', // Estimated from monthly PDF
    ttrSlaPercent: '92.6', // Estimated from monthly PDF
    csat: {
      avgScore: '5.00',
      totalResponses: 89, // From CSAT_Feedback export (Jan-Mar only, excludes 6 April responses)
      scores: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 87 }
    },
    notes: {
      ttfr: 'Validated from Jira Service Management custom report export (Mar 1, 2026 to Apr 1, 2026; 97 rows reviewed).',
      ttr: 'Validated from corrected no-clone ticket export TTR_NO_Clone_TTR_-_No_Clone_2026-03-01_to_2026-04-01_month (1).csv (34 rows reviewed).',
      sla: 'Validated from monthly IT Ops Metrics PDF (Mar 2026). Jira SLA fields not using business hours (9-6 M-F) correctly.',
      csat: 'Validated from CSAT_Feedback_ISD_2026-01-01_to_2026-04-02.csv. Jira CSAT API pagination unreliable.'
    }
  }
};

function applyValidatedMetricOverrides(metrics, periodLabel) {
  const override = OVERRIDES[periodLabel];
  if (!override) {
    return metrics;
  }

  const corrected = { ...metrics };
  let overridesApplied = [];

  // Apply TTFR override if present
  if (override.avgTTFR !== undefined) {
    corrected.rawAvgTTFR = metrics.avgTTFR;
    corrected.avgTTFR = override.avgTTFR;
    overridesApplied.push('avgTTFR');
  }

  // Apply TTR override if present
  if (override.avgTTR !== undefined) {
    corrected.rawAvgTTR = metrics.avgTTR;
    corrected.avgTTR = override.avgTTR;
    overridesApplied.push('avgTTR');
  }

  // Apply SLA overrides if present
  if (override.overallSlaPercent !== undefined) {
    corrected.rawOverallSlaPercent = metrics.overallSlaPercent;
    corrected.overallSlaPercent = override.overallSlaPercent;
    overridesApplied.push('overallSlaPercent');
  }

  if (override.ttfrSlaPercent !== undefined) {
    corrected.rawTtfrSlaPercent = metrics.ttfrSlaPercent;
    corrected.ttfrSlaPercent = override.ttfrSlaPercent;
    overridesApplied.push('ttfrSlaPercent');
  }

  if (override.ttrSlaPercent !== undefined) {
    corrected.rawTtrSlaPercent = metrics.ttrSlaPercent;
    corrected.ttrSlaPercent = override.ttrSlaPercent;
    overridesApplied.push('ttrSlaPercent');
  }

  // Apply CSAT override if present
  if (override.csat !== undefined) {
    corrected.rawCsat = metrics.csat;
    corrected.csat = override.csat;
    overridesApplied.push('csat');
  }

  corrected.validatedOverrideApplied = true;
  corrected.validatedOverridesApplied = overridesApplied;
  corrected.validatedMetricNotes = override.notes;

  return corrected;
}

module.exports = {
  OVERRIDES,
  applyValidatedMetricOverrides
};
