#!/usr/bin/env node

/**
 * Aggregate Monthly Metrics into Quarterly Totals
 * Properly combines 3 months of data with validated overrides applied
 */

/**
 * Aggregate three months of metrics into quarterly totals
 * @param {Array} monthlyMetrics - Array of 3 monthly metric objects [jan, feb, mar]
 * @returns {object} Aggregated quarterly metrics
 */
function aggregateMonthlyToQuarterly(monthlyMetrics) {
  if (!Array.isArray(monthlyMetrics) || monthlyMetrics.length !== 3) {
    throw new Error('aggregateMonthlyToQuarterly requires exactly 3 monthly metric objects');
  }

  const [month1, month2, month3] = monthlyMetrics;

  // Sum totals
  const totalIssues = month1.totalIssues + month2.totalIssues + month3.totalIssues;
  const resolvedCount = month1.resolvedCount + month2.resolvedCount + month3.resolvedCount;
  const createdCount = (month1.createdCount || 0) + (month2.createdCount || 0) + (month3.createdCount || 0);
  const automatedCount = month1.automatedCount + month2.automatedCount + month3.automatedCount;

  // Weighted average for TTFR (weighted by ticket count with TTFR data)
  const totalTtfrCount = month1.ttfrCount + month2.ttfrCount + month3.ttfrCount;
  const weightedTtfrSum =
    (parseFloat(month1.avgTTFR) || 0) * month1.ttfrCount +
    (parseFloat(month2.avgTTFR) || 0) * month2.ttfrCount +
    (parseFloat(month3.avgTTFR) || 0) * month3.ttfrCount;
  const avgTTFR = totalTtfrCount > 0 ? (weightedTtfrSum / totalTtfrCount).toFixed(2) : 'N/A';

  // Weighted average for TTR (weighted by ticket count with TTR data)
  const totalTtrCount = month1.ttrCount + month2.ttrCount + month3.ttrCount;
  const weightedTtrSum =
    (parseFloat(month1.avgTTR) || 0) * month1.ttrCount +
    (parseFloat(month2.avgTTR) || 0) * month2.ttrCount +
    (parseFloat(month3.avgTTR) || 0) * month3.ttrCount;
  const avgTTR = totalTtrCount > 0 ? (weightedTtrSum / totalTtrCount).toFixed(2) : 'N/A';

  // Weighted average for SLA goal hours
  const totalTtfrGoalCount = month1.ttfrGoalCount + month2.ttfrGoalCount + month3.ttfrGoalCount;
  const weightedTtfrGoalSum =
    (parseFloat(month1.avgTTFRGoalHours) || 0) * month1.ttfrGoalCount +
    (parseFloat(month2.avgTTFRGoalHours) || 0) * month2.ttfrGoalCount +
    (parseFloat(month3.avgTTFRGoalHours) || 0) * month3.ttfrGoalCount;
  const avgTTFRGoalHours = totalTtfrGoalCount > 0 ? (weightedTtfrGoalSum / totalTtfrGoalCount).toFixed(2) : 'N/A';

  const totalTtrGoalCount = month1.ttrGoalCount + month2.ttrGoalCount + month3.ttrGoalCount;
  const weightedTtrGoalSum =
    (parseFloat(month1.avgTTRGoalHours) || 0) * month1.ttrGoalCount +
    (parseFloat(month2.avgTTRGoalHours) || 0) * month2.ttrGoalCount +
    (parseFloat(month3.avgTTRGoalHours) || 0) * month3.ttrGoalCount;
  const avgTTRGoalHours = totalTtrGoalCount > 0 ? (weightedTtrGoalSum / totalTtrGoalCount).toFixed(2) : 'N/A';

  // SLA percentages (use validated overrides if present, otherwise calculate from counts)
  let ttfrSlaPercent;
  let ttrSlaPercent;
  let overallSlaPercent;
  let ttfrSlaMetCount;
  let ttrSlaMetCount;

  // Check if all months have validated SLA overrides
  const allMonthsHaveSlaOverrides =
    month1.validatedOverrideApplied && month1.overallSlaPercent &&
    month2.validatedOverrideApplied && month2.overallSlaPercent &&
    month3.validatedOverrideApplied && month3.overallSlaPercent;

  if (allMonthsHaveSlaOverrides) {
    // Use validated SLA percentages directly (weighted average by ticket count)
    const totalTickets = month1.resolvedCount + month2.resolvedCount + month3.resolvedCount;
    const weightedSlaSum =
      parseFloat(month1.overallSlaPercent) * month1.resolvedCount +
      parseFloat(month2.overallSlaPercent) * month2.resolvedCount +
      parseFloat(month3.overallSlaPercent) * month3.resolvedCount;
    overallSlaPercent = totalTickets > 0 ? (weightedSlaSum / totalTickets).toFixed(1) : 'N/A';

    // Use the validated individual percentages too
    const weightedTtfrSlaSum =
      parseFloat(month1.ttfrSlaPercent || month1.overallSlaPercent) * month1.resolvedCount +
      parseFloat(month2.ttfrSlaPercent || month2.overallSlaPercent) * month2.resolvedCount +
      parseFloat(month3.ttfrSlaPercent || month3.overallSlaPercent) * month3.resolvedCount;
    ttfrSlaPercent = totalTickets > 0 ? (weightedTtfrSlaSum / totalTickets).toFixed(1) : 'N/A';

    const weightedTtrSlaSum =
      parseFloat(month1.ttrSlaPercent || month1.overallSlaPercent) * month1.resolvedCount +
      parseFloat(month2.ttrSlaPercent || month2.overallSlaPercent) * month2.resolvedCount +
      parseFloat(month3.ttrSlaPercent || month3.overallSlaPercent) * month3.resolvedCount;
    ttrSlaPercent = totalTickets > 0 ? (weightedTtrSlaSum / totalTickets).toFixed(1) : 'N/A';

    // Calculate counts for reference (even though we're using percentages)
    ttfrSlaMetCount = (month1.ttfrSlaMetCount || 0) + (month2.ttfrSlaMetCount || 0) + (month3.ttfrSlaMetCount || 0);
    ttrSlaMetCount = (month1.ttrSlaMetCount || 0) + (month2.ttrSlaMetCount || 0) + (month3.ttrSlaMetCount || 0);
  } else {
    // Calculate from counts (original method)
    ttfrSlaMetCount = (month1.ttfrSlaMetCount || 0) + (month2.ttfrSlaMetCount || 0) + (month3.ttfrSlaMetCount || 0);
    ttfrSlaPercent = totalTtfrCount > 0 ? ((ttfrSlaMetCount / totalTtfrCount) * 100).toFixed(1) : 'N/A';

    ttrSlaMetCount = (month1.ttrSlaMetCount || 0) + (month2.ttrSlaMetCount || 0) + (month3.ttrSlaMetCount || 0);
    ttrSlaPercent = totalTtrCount > 0 ? ((ttrSlaMetCount / totalTtrCount) * 100).toFixed(1) : 'N/A';

    overallSlaPercent = (ttfrSlaPercent !== 'N/A' && ttrSlaPercent !== 'N/A')
      ? (((parseFloat(ttfrSlaPercent) + parseFloat(ttrSlaPercent)) / 2)).toFixed(1)
      : 'N/A';
  }

  // Automation metrics
  const automationPercent = resolvedCount > 0 ? ((automatedCount / resolvedCount) * 100).toFixed(1) : 'N/A';

  // Human time reclaimed
  const totalHumanTimeReclaimed =
    (parseFloat(month1.humanTimeReclaimed) || 0) +
    (parseFloat(month2.humanTimeReclaimed) || 0) +
    (parseFloat(month3.humanTimeReclaimed) || 0);

  // Weighted average for automated TTR
  const automatedTtrCount = (month1.automatedTtrCount || 0) + (month2.automatedTtrCount || 0) + (month3.automatedTtrCount || 0);
  const weightedAutomatedTtrSum =
    (parseFloat(month1.avgAutomatedTTR) || 0) * (month1.automatedTtrCount || 0) +
    (parseFloat(month2.avgAutomatedTTR) || 0) * (month2.automatedTtrCount || 0) +
    (parseFloat(month3.avgAutomatedTTR) || 0) * (month3.automatedTtrCount || 0);
  const avgAutomatedTTR = automatedTtrCount > 0 ? (weightedAutomatedTtrSum / automatedTtrCount).toFixed(2) : 'N/A';

  // Weighted average for human TTR
  const humanTtrCount = (month1.humanTtrCount || 0) + (month2.humanTtrCount || 0) + (month3.humanTtrCount || 0);
  const weightedHumanTtrSum =
    (parseFloat(month1.avgHumanTTR) || 0) * (month1.humanTtrCount || 0) +
    (parseFloat(month2.avgHumanTTR) || 0) * (month2.humanTtrCount || 0) +
    (parseFloat(month3.avgHumanTTR) || 0) * (month3.humanTtrCount || 0);
  const avgHumanTTR = humanTtrCount > 0 ? (weightedHumanTtrSum / humanTtrCount).toFixed(2) : 'N/A';

  // Aggregate department breakdown
  const departmentBreakdown = {};
  [month1, month2, month3].forEach(month => {
    month.departmentBreakdown.forEach(([dept, count]) => {
      departmentBreakdown[dept] = (departmentBreakdown[dept] || 0) + count;
    });
  });
  const sortedDepartments = Object.entries(departmentBreakdown).sort((a, b) => b[1] - a[1]);

  // Aggregate SaaS app counts
  const saasAppCounts = {};
  [month1, month2, month3].forEach(month => {
    month.saasAppCounts.forEach(([app, count]) => {
      saasAppCounts[app] = (saasAppCounts[app] || 0) + count;
    });
  });
  const sortedSaasApps = Object.entries(saasAppCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Aggregate issue type breakdown
  const issueTypeBreakdown = {};
  [month1, month2, month3].forEach(month => {
    month.issueTypeBreakdown.forEach(([type, count]) => {
      issueTypeBreakdown[type] = (issueTypeBreakdown[type] || 0) + count;
    });
  });
  const sortedIssueTypes = Object.entries(issueTypeBreakdown).sort((a, b) => b[1] - a[1]);

  // Aggregate engineer breakdown
  const engineerBreakdown = {};
  [month1, month2, month3].forEach(month => {
    month.engineerBreakdown.forEach(engineer => {
      engineerBreakdown[engineer.name] = (engineerBreakdown[engineer.name] || 0) + engineer.count;
    });
  });
  const sortedEngineers = Object.entries(engineerBreakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  // Sum access requests and breaches
  const accessRequestCount = month1.accessRequestCount + month2.accessRequestCount + month3.accessRequestCount;
  const slaBreachCount = month1.slaBreachCount + month2.slaBreachCount + month3.slaBreachCount;
  const slaBreachPercent = totalTtrCount > 0 ? ((slaBreachCount / totalTtrCount) * 100).toFixed(1) : 'N/A';

  // Aggregate breach reasons
  const breachReasons = {
    approval_bottleneck: (month1.breachReasons?.approval_bottleneck || 0) + (month2.breachReasons?.approval_bottleneck || 0) + (month3.breachReasons?.approval_bottleneck || 0),
    manual_setup: (month1.breachReasons?.manual_setup || 0) + (month2.breachReasons?.manual_setup || 0) + (month3.breachReasons?.manual_setup || 0),
    complex_request: (month1.breachReasons?.complex_request || 0) + (month2.breachReasons?.complex_request || 0) + (month3.breachReasons?.complex_request || 0),
    other: (month1.breachReasons?.other || 0) + (month2.breachReasons?.other || 0) + (month3.breachReasons?.other || 0)
  };

  // Aggregate CSAT (weighted by response count)
  const totalCsatResponses =
    (month1.csat?.totalResponses || 0) +
    (month2.csat?.totalResponses || 0) +
    (month3.csat?.totalResponses || 0);

  const weightedCsatSum =
    (parseFloat(month1.csat?.avgScore) || 0) * (month1.csat?.totalResponses || 0) +
    (parseFloat(month2.csat?.avgScore) || 0) * (month2.csat?.totalResponses || 0) +
    (parseFloat(month3.csat?.avgScore) || 0) * (month3.csat?.totalResponses || 0);

  const avgCsatScore = totalCsatResponses > 0 ? (weightedCsatSum / totalCsatResponses).toFixed(2) : 'N/A';

  const csatScores = {
    1: (month1.csat?.scores?.[1] || 0) + (month2.csat?.scores?.[1] || 0) + (month3.csat?.scores?.[1] || 0),
    2: (month1.csat?.scores?.[2] || 0) + (month2.csat?.scores?.[2] || 0) + (month3.csat?.scores?.[2] || 0),
    3: (month1.csat?.scores?.[3] || 0) + (month2.csat?.scores?.[3] || 0) + (month3.csat?.scores?.[3] || 0),
    4: (month1.csat?.scores?.[4] || 0) + (month2.csat?.scores?.[4] || 0) + (month3.csat?.scores?.[4] || 0),
    5: (month1.csat?.scores?.[5] || 0) + (month2.csat?.scores?.[5] || 0) + (month3.csat?.scores?.[5] || 0)
  };

  // Aggregate workforce
  const workforce = {
    fteOnboarding: (month1.workforce?.fteOnboarding || 0) + (month2.workforce?.fteOnboarding || 0) + (month3.workforce?.fteOnboarding || 0),
    contractorOnboarding: (month1.workforce?.contractorOnboarding || 0) + (month2.workforce?.contractorOnboarding || 0) + (month3.workforce?.contractorOnboarding || 0),
    totalOnboarding: (month1.workforce?.totalOnboarding || 0) + (month2.workforce?.totalOnboarding || 0) + (month3.workforce?.totalOnboarding || 0),
    fteOffboarding: (month1.workforce?.fteOffboarding || 0) + (month2.workforce?.fteOffboarding || 0) + (month3.workforce?.fteOffboarding || 0),
    contractorOffboarding: (month1.workforce?.contractorOffboarding || 0) + (month2.workforce?.contractorOffboarding || 0) + (month3.workforce?.contractorOffboarding || 0),
    offboarding: (month1.workforce?.offboarding || 0) + (month2.workforce?.offboarding || 0) + (month3.workforce?.offboarding || 0),
    netChange: (month1.workforce?.netChange || 0) + (month2.workforce?.netChange || 0) + (month3.workforce?.netChange || 0)
  };

  return {
    totalIssues,
    resolvedCount,
    createdCount,
    avgTTFR,
    avgTTR,
    avgTTFRGoalHours,
    avgTTRGoalHours,
    ttfrCount: totalTtfrCount,
    ttrCount: totalTtrCount,
    ttfrSlaMetCount,
    ttrSlaMetCount,
    overallSlaPercent,
    ttfrSlaPercent,
    ttrSlaPercent,
    departmentBreakdown: sortedDepartments,
    accessRequestCount,
    saasAppCounts: sortedSaasApps,
    issueTypeBreakdown: sortedIssueTypes,
    slaBreachCount,
    slaBreachPercent,
    breachReasons,
    automatedCount,
    automationPercent,
    avgAutomatedTTR,
    avgHumanTTR,
    humanTimeReclaimed: totalHumanTimeReclaimed.toFixed(1),
    engineerBreakdown: sortedEngineers,
    csat: {
      avgScore: avgCsatScore,
      totalResponses: totalCsatResponses,
      scores: csatScores
    },
    workforce,
    // Keep individual monthly data for reference
    monthlyBreakdown: [
      { period: 'Month 1', ...month1 },
      { period: 'Month 2', ...month2 },
      { period: 'Month 3', ...month3 }
    ],
    dataQualityNote: 'Aggregated from 3 monthly periods with validated metric overrides applied'
  };
}

module.exports = {
  aggregateMonthlyToQuarterly
};
