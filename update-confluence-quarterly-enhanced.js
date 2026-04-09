#!/usr/bin/env node

/**
 * ISD Quarterly Metrics Automation - Enhanced
 * Fetches quarterly metrics from Jira including department breakdown and SaaS app tracking
 * Generates reports for Q1 2026 (Jan-Mar) vs Q4 2025 (Oct-Dec)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { saveQuarterlyMetrics } = require('./save-metrics-to-json');
const { fetchMonthlySlackInsights } = require('./slack-insights');
const { getDataQualityIssues, calculateAdjustedMetrics } = require('./shared-metrics');
const { applyValidatedMetricOverrides, OVERRIDES } = require('./validated-metric-overrides');
const { aggregateMonthlyToQuarterly } = require('./aggregate-quarterly-metrics');

// Configuration
const JIRA_BASE_URL = 'attentivemobile.atlassian.net';
const CONFLUENCE_PAGE_ID = '6528729090'; // ISD Quarterly Metrics
const CONFLUENCE_SPACE_KEY = 'ISD';
const ASSETS_WORKSPACE_ID = '0e0847de-b6ef-45db-b74f-45e404e34d0c';

// Custom field IDs
const FIELD_SERVICE_CATALOG = 'customfield_14446';
const FIELD_EMPLOYEE_DEPT = 'customfield_12617';
const FIELD_REQUEST_TYPE = 'customfield_10021';
const FIELD_SATISFACTION = 'customfield_10048';
const FIELD_SATISFACTION_DATE = 'customfield_10128';
const FIELD_TTFR = 'customfield_10130'; // Time to first response (business hours)
const FIELD_TTR = 'customfield_10129'; // Time to resolution (business hours)

// Environment variables
const ATLASSIAN_EMAIL = process.env.ATLASSIAN_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || process.env.ATLASSIAN_API_TOKEN;
const CONFLUENCE_API_TOKEN = process.env.CONFLUENCE_API_TOKEN || process.env.ATLASSIAN_API_TOKEN;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;

if (!ATLASSIAN_EMAIL || !JIRA_API_TOKEN) {
  console.error('Error: ATLASSIAN_EMAIL and JIRA_API_TOKEN (or ATLASSIAN_API_TOKEN) environment variables are required');
  process.exit(1);
}

if (!SLACK_BOT_TOKEN) {
  console.warn('Warning: SLACK_BOT_TOKEN not set - Slack insights will be skipped');
}

const JIRA_AUTH_HEADER = 'Basic ' + Buffer.from(`${ATLASSIAN_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
const CONFLUENCE_AUTH_HEADER = 'Basic ' + Buffer.from(`${ATLASSIAN_EMAIL}:${CONFLUENCE_API_TOKEN}`).toString('base64');

/**
 * Make an HTTPS request
 */
function makeRequest(hostname, path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Fetch Service Catalog object label from Assets API
 */
async function getServiceCatalogLabel(objectId) {
  try {
    const path = `/gateway/api/jsm/assets/workspace/${ASSETS_WORKSPACE_ID}/v1/object/${objectId}`;
    const response = await makeRequest(JIRA_BASE_URL, path, 'GET', null, {
      'Authorization': JIRA_AUTH_HEADER
    });
    return response.label || null;
  } catch (error) {
    console.warn(`Warning: Could not fetch Service Catalog label for object ${objectId}:`, error.message);
    return null;
  }
}

/**
 * Build Service Catalog mapping cache
 */
async function buildServiceCatalogCache(issues) {
  console.log('\nBuilding Service Catalog mapping cache...');
  const cache = {};
  const objectIds = new Set();

  // Collect all unique object IDs
  for (const issue of issues) {
    const serviceCatalog = issue.fields[FIELD_SERVICE_CATALOG];
    if (serviceCatalog && Array.isArray(serviceCatalog)) {
      for (const obj of serviceCatalog) {
        if (obj.objectId) {
          objectIds.add(obj.objectId);
        }
      }
    }
  }

  console.log(`Found ${objectIds.size} unique Service Catalog objects`);

  // Fetch labels for all object IDs
  for (const objectId of objectIds) {
    const label = await getServiceCatalogLabel(objectId);
    if (label) {
      cache[objectId] = label;
    }
  }

  console.log(`Cached ${Object.keys(cache).length} Service Catalog labels`);
  return cache;
}

/**
 * Get date range for current and previous quarter
 * Q1 2026 (Jan-Mar) vs Q4 2025 (Oct-Dec)
 */
function getQuarterRanges() {
  // Q1 2026: January 1 - March 31, 2026
  const currentQuarterStart = new Date(2026, 0, 1); // Jan 1, 2026
  const currentQuarterEnd = new Date(2026, 2, 31, 23, 59, 59, 999); // Mar 31, 2026

  // Q4 2025: October 1 - December 31, 2025
  const previousQuarterStart = new Date(2025, 9, 1); // Oct 1, 2025
  const previousQuarterEnd = new Date(2025, 11, 31, 23, 59, 59, 999); // Dec 31, 2025

  const currentStartStr = currentQuarterStart.toISOString().split('T')[0];
  const currentEndStr = currentQuarterEnd.toISOString().split('T')[0];
  const previousStartStr = previousQuarterStart.toISOString().split('T')[0];
  const previousEndStr = previousQuarterEnd.toISOString().split('T')[0];

  return {
    currentQuarter: {
      jqlFilter: `>= "${currentStartStr}" AND resolutiondate <= "${currentEndStr}"`,
      createdFilter: `created >= "${currentStartStr}" AND created <= "${currentEndStr}"`,
      start: currentQuarterStart,
      end: currentQuarterEnd,
      label: 'Q1 2026 (Jan-Mar)',
      shortLabel: 'Q1 2026'
    },
    previousQuarter: {
      jqlFilter: `>= "${previousStartStr}" AND resolutiondate <= "${previousEndStr}"`,
      createdFilter: `created >= "${previousStartStr}" AND created <= "${previousEndStr}"`,
      start: previousQuarterStart,
      end: previousQuarterEnd,
      label: 'Q4 2025 (Oct-Dec)',
      shortLabel: 'Q4 2025'
    }
  };
}

/**
 * Get individual month ranges for Q1 2026 and Q4 2025
 * Used for monthly aggregation with validated overrides
 */
function getIndividualMonthRanges() {
  // Q1 2026: January, February, March
  const q1Months = [
    {
      start: new Date(2026, 0, 1),
      end: new Date(2026, 0, 31, 23, 59, 59, 999),
      label: 'January 2026',
      shortLabel: 'Jan'
    },
    {
      start: new Date(2026, 1, 1),
      end: new Date(2026, 1, 28, 23, 59, 59, 999), // Feb 2026 has 28 days
      label: 'February 2026',
      shortLabel: 'Feb'
    },
    {
      start: new Date(2026, 2, 1),
      end: new Date(2026, 2, 31, 23, 59, 59, 999),
      label: 'March 2026',
      shortLabel: 'Mar'
    }
  ];

  // Q4 2025: October, November, December
  const q4Months = [
    {
      start: new Date(2025, 9, 1),
      end: new Date(2025, 9, 31, 23, 59, 59, 999),
      label: 'October 2025',
      shortLabel: 'Oct'
    },
    {
      start: new Date(2025, 10, 1),
      end: new Date(2025, 10, 30, 23, 59, 59, 999),
      label: 'November 2025',
      shortLabel: 'Nov'
    },
    {
      start: new Date(2025, 11, 1),
      end: new Date(2025, 11, 31, 23, 59, 59, 999),
      label: 'December 2025',
      shortLabel: 'Dec'
    }
  ];

  // Add JQL filters to each month
  q1Months.forEach(month => {
    const startStr = month.start.toISOString().split('T')[0];
    const endStr = month.end.toISOString().split('T')[0];
    month.jqlFilter = `>= "${startStr}" AND resolutiondate <= "${endStr}"`;
    month.createdFilter = `created >= "${startStr}" AND created <= "${endStr}"`;
  });

  q4Months.forEach(month => {
    const startStr = month.start.toISOString().split('T')[0];
    const endStr = month.end.toISOString().split('T')[0];
    month.jqlFilter = `>= "${startStr}" AND resolutiondate <= "${endStr}"`;
    month.createdFilter = `created >= "${startStr}" AND created <= "${endStr}"`;
  });

  return {
    q1: q1Months,
    q4: q4Months
  };
}

/**
 * Count created tickets using JQL filter
 */
async function countCreatedTickets(jqlFilter, label) {
  const jql = `project = ISD AND ${jqlFilter}`;
  console.log(`  Counting created for ${label}`);

  let allIssues = [];
  let nextPageToken = null;
  let isLast = false;

  while (!isLast) {
    let path = `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=1000&fields=key`;
    if (nextPageToken) {
      path += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;
    }

    const response = await makeRequest(JIRA_BASE_URL, path, 'GET', null, {
      'Authorization': JIRA_AUTH_HEADER
    });

    allIssues = allIssues.concat(response.issues || []);
    isLast = response.isLast !== false;
    nextPageToken = response.nextPageToken;
  }

  console.log(`  Found ${allIssues.length} created tickets`);
  return allIssues.length;
}

/**
 * Count workforce changes (onboarding and offboarding tickets)
 */
async function countWorkforceChanges(jqlFilter, label) {
  console.log(`  Counting workforce changes for ${label}`);

  const dateFilter = `resolutiondate ${jqlFilter}`;

  // FTE Onboarding: CLONE - IT Support Onboarding from Greenhouse or Sapling
  const fteOnboardingJql = `project = ISD AND summary ~ "CLONE - IT Support Onboarding" AND reporter in ("jira-greenhouse@attentivemobile.com", "jira-sapling@attentivemobile.com") AND ${dateFilter}`;

  // Contractor Onboarding: CLONE - Contractor Onboarding
  const contractorOnboardingJql = `project = ISD AND summary ~ "CLONE - Contractor Onboarding" AND ${dateFilter}`;

  // FTE Offboarding: CLONE - Device IT Offboarding from Sapling
  const fteOffboardingJql = `project = ISD AND summary ~ "CLONE - Device" AND reporter = "jira-sapling@attentivemobile.com" AND ${dateFilter}`;

  // Contractor Offboarding: CLONE - Contractor Offboarding
  const contractorOffboardingJql = `project = ISD AND summary ~ "CLONE - Contractor Offboarding" AND ${dateFilter}`;

  // Fetch all workforce change tickets
  let fteOnboardingIssues = [];
  let contractorOnboardingIssues = [];
  let fteOffboardingIssues = [];
  let contractorOffboardingIssues = [];

  // Helper to fetch with pagination
  const fetchAll = async (jql) => {
    let allIssues = [];
    let nextPageToken = null;
    let isLast = false;

    while (!isLast) {
      let path = `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=1000&fields=key`;
      if (nextPageToken) {
        path += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;
      }

      const response = await makeRequest(JIRA_BASE_URL, path, 'GET', null, {
        'Authorization': JIRA_AUTH_HEADER
      });

      allIssues = allIssues.concat(response.issues || []);
      isLast = response.isLast !== false;
      nextPageToken = response.nextPageToken;
    }

    return allIssues;
  };

  fteOnboardingIssues = await fetchAll(fteOnboardingJql);
  contractorOnboardingIssues = await fetchAll(contractorOnboardingJql);
  fteOffboardingIssues = await fetchAll(fteOffboardingJql);
  contractorOffboardingIssues = await fetchAll(contractorOffboardingJql);

  const totalOnboarding = fteOnboardingIssues.length + contractorOnboardingIssues.length;
  const totalOffboarding = fteOffboardingIssues.length + contractorOffboardingIssues.length;

  console.log(`  Found ${fteOnboardingIssues.length} FTE onboardings, ${contractorOnboardingIssues.length} contractor onboardings`);
  console.log(`  Found ${fteOffboardingIssues.length} FTE offboardings, ${contractorOffboardingIssues.length} contractor offboardings`);

  return {
    fteOnboarding: fteOnboardingIssues.length,
    contractorOnboarding: contractorOnboardingIssues.length,
    totalOnboarding: totalOnboarding,
    fteOffboarding: fteOffboardingIssues.length,
    contractorOffboarding: contractorOffboardingIssues.length,
    offboarding: totalOffboarding,
    netChange: totalOnboarding - totalOffboarding
  };
}

/**
 * Fetch CSAT scores for a date range
 */
async function fetchCSAT(startDate, endDate, quarterLabel) {
  console.log(`\nFetching CSAT scores for ${quarterLabel}...`);

  try {
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Query for tickets that have CSAT ratings within the date range
    const jql = `project = ISD AND "${FIELD_SATISFACTION_DATE}" >= "${startStr}" AND "${FIELD_SATISFACTION_DATE}" <= "${endStr}" AND "${FIELD_SATISFACTION}" is not EMPTY`;

    // Fetch all CSAT responses with pagination
    let allIssues = [];
    let startAt = 0;
    const maxResults = 100; // Jira's typical page size

    while (true) {
      const path = `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=${maxResults}&fields=summary,assignee,${FIELD_SATISFACTION},${FIELD_SATISFACTION_DATE}`;
      const response = await makeRequest(JIRA_BASE_URL, path, 'GET', null, {
        'Authorization': JIRA_AUTH_HEADER
      });

      const issues = response.issues || [];

      // Break if no more issues returned
      if (issues.length === 0) {
        break;
      }

      allIssues = allIssues.concat(issues);
      startAt += issues.length;

      if (allIssues.length % 100 === 0) {
        console.log(`  Fetched ${allIssues.length} CSAT responses...`);
      }

      // Break if we got fewer results than requested (last page)
      if (issues.length < maxResults) {
        break;
      }
    }

    console.log(`Found ${allIssues.length} CSAT responses`);

    if (allIssues.length === 0) {
      return {
        avgScore: 'N/A',
        totalResponses: 0,
        scores: {}
      };
    }

    let totalScore = 0;
    let validRatings = 0;
    const scoreBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    for (const issue of allIssues) {
      const satisfaction = issue.fields[FIELD_SATISFACTION];
      if (satisfaction && satisfaction.rating) {
        const rating = parseInt(satisfaction.rating);
        if (rating >= 1 && rating <= 5) {
          totalScore += rating;
          validRatings++;
          scoreBreakdown[rating]++;
        }
      }
    }

    const avgScore = validRatings > 0 ? (totalScore / validRatings).toFixed(2) : 'N/A';

    return {
      avgScore,
      totalResponses: validRatings,
      scores: scoreBreakdown
    };

  } catch (error) {
    console.error(`Error fetching CSAT: ${error.message}`);
    return {
      avgScore: 'Error',
      totalResponses: 0,
      scores: {}
    };
  }
}

/**
 * Check if a ticket was resolved without human intervention
 */
function isFullyAutomated(issue, automationAccounts) {
  const assignee = issue.fields.assignee?.displayName;

  if (!automationAccounts.includes(assignee)) {
    return false;
  }

  const changelog = issue.changelog;
  if (!changelog || !changelog.histories) {
    return true;
  }

  for (const history of changelog.histories) {
    const actor = history.author?.displayName;
    if (actor && !automationAccounts.includes(actor)) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate quarterly metrics from Jira issues
 */
async function calculateQuarterlyMetrics(jql, quarterLabel, serviceCatalogCache) {
  console.log(`\nFetching issues for ${quarterLabel}...`);

  const fields = [
    'created', 'resolutiondate', 'comment', 'assignee', 'labels',
    'issuetype', 'status', 'updated', 'summary',
    FIELD_SERVICE_CATALOG, FIELD_EMPLOYEE_DEPT, FIELD_REQUEST_TYPE,
    FIELD_TTFR, FIELD_TTR
  ];

  let allIssues = [];
  let nextPageToken = null;
  let isLast = false;

  while (!isLast) {
    let path = `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=1000&fields=${fields.join(',')}&expand=changelog`;
    if (nextPageToken) {
      path += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;
    }

    const response = await makeRequest(JIRA_BASE_URL, path, 'GET', null, {
      'Authorization': JIRA_AUTH_HEADER
    });

    allIssues = allIssues.concat(response.issues || []);
    isLast = response.isLast !== false;
    nextPageToken = response.nextPageToken;
  }

  const issues = allIssues;
  console.log(`Found ${issues.length} issues`);

  const AUTOMATION_ACCOUNTS = [
    'Attentive Jira OKTA Workflow Automation Account',
    'Automation for Jira'
  ];

  let ttfrSum = 0;
  let ttfrCount = 0;
  let ttfrSlaMetCount = 0;
  let ttfrGoalSum = 0;
  let ttfrGoalCount = 0;
  let ttrSum = 0;
  let ttrCount = 0;
  let ttrSlaMetCount = 0;
  let ttrGoalSum = 0;
  let ttrGoalCount = 0;
  let resolvedCount = 0;

  let automatedCount = 0;
  let automatedTtrSum = 0;
  let automatedTtrCount = 0;
  let humanTtrSum = 0;
  let humanTtrCount = 0;

  const departmentBreakdown = {};
  const saasAppCounts = {};
  let accessRequestCount = 0;
  let slaBreachCount = 0;
  const breachReasons = {
    'approval_bottleneck': 0,
    'manual_setup': 0,
    'complex_request': 0,
    'other': 0
  };

  const issueTypeBreakdown = {};
  const engineerBreakdown = {};

  for (const issue of issues) {
    const issueType = issue.fields.issuetype?.name || 'Other';

    // Track department
    const department = issue.fields[FIELD_EMPLOYEE_DEPT] || 'Unknown';
    if (!departmentBreakdown[department]) {
      departmentBreakdown[department] = 0;
    }
    departmentBreakdown[department]++;

    // Track access requests and SaaS applications
    const requestType = issue.fields[FIELD_REQUEST_TYPE];
    const isAccessRequest = requestType &&
      (requestType.requestType?.name?.toLowerCase().includes('access') ||
       issueType.toLowerCase().includes('access'));

    if (isAccessRequest) {
      accessRequestCount++;

      const serviceCatalog = issue.fields[FIELD_SERVICE_CATALOG];
      if (serviceCatalog && Array.isArray(serviceCatalog) && serviceCatalog.length > 0) {
        let primaryApp = null;

        for (const obj of serviceCatalog) {
          const appName = serviceCatalogCache[obj.objectId];
          if (appName) {
            primaryApp = appName;
            break;
          }
        }

        if (primaryApp) {
          if (!saasAppCounts[primaryApp]) {
            saasAppCounts[primaryApp] = 0;
          }
          saasAppCounts[primaryApp]++;
        }
      }
    }

    // Calculate TTFR
    const ttfrField = issue.fields[FIELD_TTFR];
    if (ttfrField && ttfrField.completedCycles && ttfrField.completedCycles.length > 0) {
      const cycle = ttfrField.completedCycles[0];
      const ttfrHours = cycle.elapsedTime.millis / (1000 * 60 * 60);

      ttfrSum += ttfrHours;
      ttfrCount++;
      if (cycle.goalDuration && typeof cycle.goalDuration.millis === 'number') {
        ttfrGoalSum += cycle.goalDuration.millis / (1000 * 60 * 60);
        ttfrGoalCount++;
      }

      if (!cycle.breached) {
        ttfrSlaMetCount++;
      } else {
        breachReasons.approval_bottleneck++;
      }
    }

    // Count resolved tickets
    if (issue.fields.resolutiondate) {
      resolvedCount++;

      if (!issueTypeBreakdown[issueType]) {
        issueTypeBreakdown[issueType] = 0;
      }
      issueTypeBreakdown[issueType]++;

      const assigneeName = issue.fields.assignee?.displayName || 'Unassigned';
      if (!engineerBreakdown[assigneeName]) {
        engineerBreakdown[assigneeName] = 0;
      }
      engineerBreakdown[assigneeName]++;

      const fullyAutomated = isFullyAutomated(issue, AUTOMATION_ACCOUNTS);
      if (fullyAutomated) {
        automatedCount++;
      }
    }

    // Calculate TTR
    const ttrField = issue.fields[FIELD_TTR];
    if (ttrField && ttrField.completedCycles && ttrField.completedCycles.length > 0) {
      const cycle = ttrField.completedCycles[0];
      const ttrHours = cycle.elapsedTime.millis / (1000 * 60 * 60);

      ttrSum += ttrHours;
      ttrCount++;
      if (cycle.goalDuration && typeof cycle.goalDuration.millis === 'number') {
        ttrGoalSum += cycle.goalDuration.millis / (1000 * 60 * 60);
        ttrGoalCount++;
      }

      if (!cycle.breached) {
        ttrSlaMetCount++;
      } else {
        slaBreachCount++;
        if (isAccessRequest) {
          breachReasons.approval_bottleneck++;
        } else {
          breachReasons.other++;
        }
      }

      const fullyAutomated = isFullyAutomated(issue, AUTOMATION_ACCOUNTS);
      if (fullyAutomated) {
        automatedTtrSum += ttrHours;
        automatedTtrCount++;
      } else {
        humanTtrSum += ttrHours;
        humanTtrCount++;
      }
    }
  }

  const avgTTFR = ttfrCount > 0 ? (ttfrSum / ttfrCount).toFixed(2) : 'N/A';
  const avgTTR = ttrCount > 0 ? (ttrSum / ttrCount).toFixed(2) : 'N/A';
  const ttfrSlaPercent = ttfrCount > 0 ? ((ttfrSlaMetCount / ttfrCount) * 100).toFixed(1) : 'N/A';
  const ttrSlaPercent = ttrCount > 0 ? ((ttrSlaMetCount / ttrCount) * 100).toFixed(1) : 'N/A';
  const avgTTFRGoalHours = ttfrGoalCount > 0 ? (ttfrGoalSum / ttfrGoalCount).toFixed(2) : 'N/A';
  const avgTTRGoalHours = ttrGoalCount > 0 ? (ttrGoalSum / ttrGoalCount).toFixed(2) : 'N/A';

  let overallSlaPercent = 'N/A';
  if (ttfrSlaPercent !== 'N/A' && ttrSlaPercent !== 'N/A') {
    overallSlaPercent = (((parseFloat(ttfrSlaPercent) + parseFloat(ttrSlaPercent)) / 2)).toFixed(1);
  }

  const slaBreachPercent = ttrCount > 0 ? ((slaBreachCount / ttrCount) * 100).toFixed(1) : 'N/A';
  const automationPercent = resolvedCount > 0 ? ((automatedCount / resolvedCount) * 100).toFixed(1) : 'N/A';
  const avgAutomatedTTR = automatedTtrCount > 0 ? (automatedTtrSum / automatedTtrCount).toFixed(2) : 'N/A';
  const avgHumanTTR = humanTtrCount > 0 ? (humanTtrSum / humanTtrCount).toFixed(2) : 'N/A';

  let humanTimeReclaimed = 'N/A';
  if (avgAutomatedTTR !== 'N/A' && avgHumanTTR !== 'N/A' && automatedCount > 0) {
    const hoursSaved = (parseFloat(avgHumanTTR) - parseFloat(avgAutomatedTTR)) * automatedCount;
    humanTimeReclaimed = hoursSaved > 0 ? hoursSaved.toFixed(1) : '0.0';
  }

  const sortedDepartments = Object.entries(departmentBreakdown)
    .sort((a, b) => b[1] - a[1]);

  const sortedSaasApps = Object.entries(saasAppCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const sortedIssueTypes = Object.entries(issueTypeBreakdown)
    .sort((a, b) => b[1] - a[1]);

  const sortedEngineers = Object.entries(engineerBreakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  return {
    totalIssues: issues.length,
    resolvedCount,
    avgTTFR,
    avgTTR,
    avgTTFRGoalHours,
    avgTTRGoalHours,
    ttfrCount,
    ttrCount,
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
    humanTimeReclaimed,
    engineerBreakdown: sortedEngineers,
    csat: {
      avgScore: 'N/A',
      totalResponses: 0,
      scores: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    }
  };
}

/**
 * Generate Confluence HTML output
 */
function generateConfluenceHTML(currentMetrics, previousMetrics, currentQuarter, previousQuarter) {
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'long', timeStyle: 'short' });

  // Calculate changes (QoQ = Quarter over Quarter)
  const resolvedChange = calculateQoQChange(previousMetrics.resolvedCount, currentMetrics.resolvedCount);
  const ttfrChange = calculateQoQChange(previousMetrics.avgTTFR, currentMetrics.avgTTFR, true);
  const ttrChange = calculateQoQChange(previousMetrics.avgTTR, currentMetrics.avgTTR, true);
  const slaChange = calculateQoQChange(previousMetrics.overallSlaPercent, currentMetrics.overallSlaPercent);
  const automationChange = calculateQoQChange(previousMetrics.automationPercent, currentMetrics.automationPercent);

  const currentHumanCount = currentMetrics.resolvedCount - currentMetrics.automatedCount;
  const previousHumanCount = previousMetrics.resolvedCount - previousMetrics.automatedCount;

  let html = `
<h1>IT Ops Quarterly Metrics - ${currentQuarter.label}</h1>
<p><em>Last updated: ${timestamp}</em></p>

<h2>Executive Summary</h2>
<ul>
  <li><strong>Volume:</strong> ${currentMetrics.resolvedCount} tickets resolved (${currentMetrics.createdCount} created) in Q1 2026</li>
  <li><strong>SLA Performance:</strong> ${currentMetrics.overallSlaPercent}% overall SLA achievement</li>
  <li><strong>Customer Satisfaction:</strong> ${currentMetrics.csat.avgScore}/5.0 CSAT from ${currentMetrics.csat.totalResponses} reviews</li>
  <li><strong>Automation Impact:</strong> ${currentMetrics.automationPercent}% automation rate (${currentMetrics.automatedCount} automated tickets)</li>
  <li><strong>Workforce Changes:</strong> ${currentMetrics.workforce?.totalOnboarding || 0} onboarded, ${currentMetrics.workforce?.offboarding || 0} offboarded (Net: ${currentMetrics.workforce?.netChange > 0 ? '+' : ''}${currentMetrics.workforce?.netChange || 0})</li>
</ul>

<h2>Key Metrics Summary</h2>

<h3>A. Demand & Volume</h3>
<table data-layout="default">
  <tbody>
    <tr>
      <th><p><strong>Metric</strong></p></th>
      <th><p><strong>${currentQuarter.shortLabel}</strong></p></th>
      <th><p><strong>${previousQuarter.shortLabel}</strong></p></th>
      <th><p><strong>QoQ Change</strong></p></th>
    </tr>
    <tr>
      <td><p>Tickets Created</p></td>
      <td><p>${currentMetrics.createdCount}</p></td>
      <td><p>${previousMetrics.createdCount}</p></td>
      <td><p>${calculateQoQChange(previousMetrics.createdCount, currentMetrics.createdCount)}</p></td>
    </tr>
    <tr>
      <td><p>Tickets Resolved</p></td>
      <td><p>${currentMetrics.resolvedCount}</p></td>
      <td><p>${previousMetrics.resolvedCount}</p></td>
      <td><p>${resolvedChange}</p></td>
    </tr>
    <tr>
      <td><p>Workforce Onboarded</p></td>
      <td><p>${currentMetrics.workforce?.totalOnboarding || 0}</p></td>
      <td><p>${previousMetrics.workforce?.totalOnboarding || 0}</p></td>
      <td><p>-</p></td>
    </tr>
  </tbody>
</table>

<h3>B. Speed & Performance</h3>
<table data-layout="default">
  <tbody>
    <tr>
      <th><p><strong>Metric</strong></p></th>
      <th><p><strong>${currentQuarter.shortLabel}</strong></p></th>
      <th><p><strong>${previousQuarter.shortLabel}</strong></p></th>
      <th><p><strong>QoQ Change</strong></p></th>
    </tr>
    <tr>
      <td><p>Time to First Response</p></td>
      <td><p>${formatTime(currentMetrics.avgTTFR)}</p></td>
      <td><p>${formatTime(previousMetrics.avgTTFR)}</p></td>
      <td><p>${ttfrChange}</p></td>
    </tr>
    <tr>
      <td><p>Time to Resolution</p></td>
      <td><p>${formatTime(currentMetrics.avgTTR)}</p></td>
      <td><p>${formatTime(previousMetrics.avgTTR)}</p></td>
      <td><p>${ttrChange}</p></td>
    </tr>
    <tr>
      <td><p>SLA Performance</p></td>
      <td><p>${currentMetrics.overallSlaPercent}%</p></td>
      <td><p>${previousMetrics.overallSlaPercent}%</p></td>
      <td><p>${slaChange}</p></td>
    </tr>
    <tr>
      <td><p>Customer Satisfaction (CSAT)</p></td>
      <td><p>${currentMetrics.csat.avgScore} (${currentMetrics.csat.totalResponses} reviews)</p></td>
      <td><p>${previousMetrics.csat.avgScore} (${previousMetrics.csat.totalResponses} reviews)</p></td>
      <td><p>-</p></td>
    </tr>
  </tbody>
</table>
<p><em><strong>Note:</strong> Time metrics use validated data with known data quality adjustments applied (see Data Quality section below).</em></p>

<h3>C. Efficiency & Scale</h3>
<table data-layout="default">
  <tbody>
    <tr>
      <th><p><strong>Metric</strong></p></th>
      <th><p><strong>${currentQuarter.shortLabel}</strong></p></th>
      <th><p><strong>${previousQuarter.shortLabel}</strong></p></th>
      <th><p><strong>QoQ Change</strong></p></th>
    </tr>
    <tr>
      <td><p>Automation Rate</p></td>
      <td><p>${currentMetrics.automationPercent}%</p></td>
      <td><p>${previousMetrics.automationPercent}%</p></td>
      <td><p>${automationChange}</p></td>
    </tr>
    <tr>
      <td><p>Automated Tickets</p></td>
      <td><p>${currentMetrics.automatedCount}</p></td>
      <td><p>${previousMetrics.automatedCount}</p></td>
      <td><p>-</p></td>
    </tr>
    <tr>
      <td><p>Human-Handled Tickets</p></td>
      <td><p>${currentHumanCount}</p></td>
      <td><p>${previousHumanCount}</p></td>
      <td><p>-</p></td>
    </tr>
  </tbody>
</table>

<h2>Workforce Changes (${currentQuarter.shortLabel})</h2>
<table data-layout="default">
  <tbody>
    <tr>
      <th><p><strong>Change Type</strong></p></th>
      <th><p><strong>${currentQuarter.shortLabel}</strong></p></th>
      <th><p><strong>${previousQuarter.shortLabel}</strong></p></th>
    </tr>
    <tr>
      <td><p>FTE Onboarded</p></td>
      <td><p>${currentMetrics.workforce?.fteOnboarding || 0} employees</p></td>
      <td><p>${previousMetrics.workforce?.fteOnboarding || 0} employees</p></td>
    </tr>
    <tr>
      <td><p>Contractors Onboarded</p></td>
      <td><p>${currentMetrics.workforce?.contractorOnboarding || 0} contractors</p></td>
      <td><p>${previousMetrics.workforce?.contractorOnboarding || 0} contractors</p></td>
    </tr>
    <tr>
      <td><p>Offboarded</p></td>
      <td><p>${currentMetrics.workforce?.offboarding || 0}</p></td>
      <td><p>${previousMetrics.workforce?.offboarding || 0}</p></td>
    </tr>
    <tr>
      <td><p>Net Headcount Change</p></td>
      <td><p>${currentMetrics.workforce?.netChange > 0 ? '+' : ''}${currentMetrics.workforce?.netChange || 0}</p></td>
      <td><p>${previousMetrics.workforce?.netChange > 0 ? '+' : ''}${previousMetrics.workforce?.netChange || 0}</p></td>
    </tr>
  </tbody>
</table>

<h2>Department Breakdown (Top 5)</h2>
<table data-layout="default">
  <tbody>
    <tr>
      <th><p><strong>Department</strong></p></th>
      <th><p><strong>Tickets</strong></p></th>
      <th><p><strong>% of Total</strong></p></th>
    </tr>
`;

  const topDepartments = currentMetrics.departmentBreakdown.slice(0, 5);
  for (const [dept, count] of topDepartments) {
    const percent = ((count / currentMetrics.totalIssues) * 100).toFixed(1);
    html += `
    <tr>
      <td><p>${dept}</p></td>
      <td><p>${count}</p></td>
      <td><p>${percent}%</p></td>
    </tr>`;
  }

  html += `
  </tbody>
</table>

<h2>Top SaaS Applications (Access Requests)</h2>
<p><strong>Total Access Requests:</strong> ${currentMetrics.accessRequestCount}</p>

<table data-layout="default">
  <tbody>
    <tr>
      <th><p><strong>Application</strong></p></th>
      <th><p><strong>Requests</strong></p></th>
    </tr>
`;

  for (const [app, count] of currentMetrics.saasAppCounts) {
    html += `
    <tr>
      <td><p>${app}</p></td>
      <td><p>${count}</p></td>
    </tr>`;
  }

  html += `
  </tbody>
</table>

<h2>Resolved Ticket Type Breakdown</h2>
<table data-layout="default">
  <tbody>
    <tr>
      <th><p><strong>Issue Type</strong></p></th>
      <th><p><strong>Count</strong></p></th>
      <th><p><strong>% of Total</strong></p></th>
    </tr>
`;

  for (const [type, count] of currentMetrics.issueTypeBreakdown) {
    const percent = ((count / currentMetrics.resolvedCount) * 100).toFixed(1);
    html += `
    <tr>
      <td><p>${type}</p></td>
      <td><p>${count}</p></td>
      <td><p>${percent}%</p></td>
    </tr>`;
  }

  html += `
  </tbody>
</table>

<h2>Data Quality & Methodology</h2>
<ac:structured-macro ac:name="info">
  <ac:rich-text-body>
    <p><strong>📊 Data Quality Note:</strong> This quarterly report uses validated metric overrides to ensure accuracy. Specifically:</p>
    <ul>
      <li><strong>March 2026:</strong> Time metrics (TTFR/TTR) use validated data from Jira Service Management custom reports due to the March 17 ticket clock cleanup event (221 old tickets with running timers were corrected)</li>
      <li><strong>Aggregation:</strong> Quarterly totals are calculated from individual monthly data with validated overrides applied, ensuring consistency with monthly reports shown to leadership</li>
      <li><strong>Consistency:</strong> All metrics align with the monthly IT Ops Metrics PDFs (Jan, Feb, Mar 2026) previously reviewed</li>
    </ul>
    <p>Raw system-of-record data remains available in Jira for audit purposes, but validated figures better represent actual operational performance.</p>
  </ac:rich-text-body>
</ac:structured-macro>

<hr />
<p><em>🤖 Generated automatically for MBR quarterly review with validated metric overrides for data quality</em></p>
`;

  return html;
}

/**
 * Calculate QoQ change percentage
 */
function calculateQoQChange(oldValue, newValue, isLowerBetter = false) {
  if (oldValue === 'N/A' || newValue === 'N/A' || oldValue === 0) return 'N/A';

  const old = parseFloat(oldValue);
  const curr = parseFloat(newValue);
  const change = ((curr - old) / old * 100).toFixed(1);
  const absChange = Math.abs(change);

  let arrow;
  if (change > 0) {
    arrow = '↑';
  } else if (change < 0) {
    arrow = '↓';
  } else {
    arrow = '→';
  }

  return `${arrow} ${absChange}% QoQ`;
}

/**
 * Format hours into human-readable time
 */
function formatTime(hours) {
  if (!hours || hours === 'N/A') return 'N/A';

  const totalMinutes = Math.round(parseFloat(hours) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h > 0 && m > 0) {
    return `${h}h ${m}m`;
  } else if (h > 0) {
    return `${h}h`;
  } else {
    return `${m}m`;
  }
}

/**
 * Update Confluence page with new content
 */
async function updateConfluencePage(pageId, htmlContent, pageTitle) {
  try {
    // Get current page version (using v1 API)
    const getPath = `/wiki/rest/api/content/${pageId}?expand=version`;
    const pageData = await makeRequest(JIRA_BASE_URL, getPath, 'GET', null, {
      'Authorization': CONFLUENCE_AUTH_HEADER
    });

    if (!pageData || !pageData.version) {
      throw new Error('Failed to get current page version');
    }

    const currentVersion = pageData.version.number;
    console.log(`Current page version: ${currentVersion}`);

    // Update page with new content (using v1 API)
    const updatePath = `/wiki/rest/api/content/${pageId}`;
    const updateBody = {
      version: {
        number: currentVersion + 1
      },
      title: pageTitle,
      type: 'page',
      body: {
        storage: {
          value: htmlContent,
          representation: 'storage'
        }
      }
    };

    const result = await makeRequest(JIRA_BASE_URL, updatePath, 'PUT', updateBody, {
      'Authorization': CONFLUENCE_AUTH_HEADER
    });

    if (result && result.id) {
      console.log(`✓ Confluence page updated successfully`);
      console.log(`  Page ID: ${result.id}`);
      console.log(`  New version: ${result.version.number}`);
      console.log(`  URL: https://${JIRA_BASE_URL}/wiki/spaces/${CONFLUENCE_SPACE_KEY}/pages/${pageId}`);
      return true;
    } else {
      throw new Error('Update response missing expected fields');
    }
  } catch (error) {
    console.error(`✗ Error updating Confluence page: ${error.message}`);
    return false;
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('=== ISD Quarterly Metrics Automation (WITH VALIDATED OVERRIDES) ===');
    console.log('Period: Q1 2026 (Jan-Mar) vs Q4 2025 (Oct-Dec)\n');
    console.log('🔧 Using monthly aggregation with validated metric overrides for data quality\n');

    const quarters = getQuarterRanges();
    const monthRanges = getIndividualMonthRanges();

    // Fetch current quarter resolved issues first to build cache
    const resolvedStatuses = '"13. Done", Canceled, Closed, Completed, Declined, Resolved';
    const currentJQL = `project = ISD AND resolutiondate ${quarters.currentQuarter.jqlFilter} AND status in (${resolvedStatuses})`;
    console.log('\nFetching current quarter issues for cache building...');
    const path = `/rest/api/3/search/jql?jql=${encodeURIComponent(currentJQL)}&maxResults=1000&fields=${FIELD_SERVICE_CATALOG}`;
    const response = await makeRequest(JIRA_BASE_URL, path, 'GET', null, {
      'Authorization': JIRA_AUTH_HEADER
    });

    // Build Service Catalog cache
    const serviceCatalogCache = await buildServiceCatalogCache(response.issues);

    // Calculate metrics MONTHLY for Q1 2026 (with validated overrides)
    console.log('\n=== Calculating Q1 2026 Metrics (Monthly Aggregation) ===');
    const q1MonthlyMetrics = [];

    for (const month of monthRanges.q1) {
      const monthJQL = `project = ISD AND resolutiondate ${month.jqlFilter} AND status in (${resolvedStatuses})`;
      console.log(`\n📅 ${month.label}...`);

      const rawMetrics = await calculateQuarterlyMetrics(monthJQL, month.label, serviceCatalogCache);

      // Apply validated overrides if they exist for this month
      const correctedMetrics = applyValidatedMetricOverrides(rawMetrics, month.label);

      if (correctedMetrics.validatedOverrideApplied) {
        console.log(`  ✅ Applied validated override for ${month.label}`);
        if (correctedMetrics.validatedOverridesApplied.includes('avgTTFR')) {
          console.log(`     Raw TTFR: ${formatTime(rawMetrics.avgTTFR)} → Corrected: ${formatTime(correctedMetrics.avgTTFR)}`);
        }
        if (correctedMetrics.validatedOverridesApplied.includes('avgTTR')) {
          console.log(`     Raw TTR: ${formatTime(rawMetrics.avgTTR)} → Corrected: ${formatTime(correctedMetrics.avgTTR)}`);
        }
        if (correctedMetrics.validatedOverridesApplied.includes('overallSlaPercent')) {
          console.log(`     Raw SLA: ${rawMetrics.overallSlaPercent}% → Corrected: ${correctedMetrics.overallSlaPercent}%`);
        }
      }

      q1MonthlyMetrics.push(correctedMetrics);
    }

    // Aggregate Q1 months into quarterly totals
    console.log('\n🔄 Aggregating Q1 monthly metrics into quarterly totals...');
    const currentMetrics = aggregateMonthlyToQuarterly(q1MonthlyMetrics);
    console.log(`  ✓ Q1 Aggregated: ${currentMetrics.resolvedCount} tickets, TTFR ${formatTime(currentMetrics.avgTTFR)}, TTR ${formatTime(currentMetrics.avgTTR)}`);

    // Calculate metrics MONTHLY for Q4 2025 (with validated overrides)
    console.log('\n=== Calculating Q4 2025 Metrics (Monthly Aggregation) ===');
    const q4MonthlyMetrics = [];

    for (const month of monthRanges.q4) {
      const monthJQL = `project = ISD AND resolutiondate ${month.jqlFilter} AND status in (${resolvedStatuses})`;
      console.log(`\n📅 ${month.label}...`);

      const rawMetrics = await calculateQuarterlyMetrics(monthJQL, month.label, serviceCatalogCache);
      const correctedMetrics = applyValidatedMetricOverrides(rawMetrics, month.label);

      if (correctedMetrics.validatedOverrideApplied) {
        console.log(`  ✅ Applied validated override for ${month.label}`);
        if (correctedMetrics.validatedOverridesApplied.includes('overallSlaPercent')) {
          console.log(`     Raw SLA: ${rawMetrics.overallSlaPercent}% → Corrected: ${correctedMetrics.overallSlaPercent}%`);
        }
      }

      q4MonthlyMetrics.push(correctedMetrics);
    }

    // Aggregate Q4 months into quarterly totals
    console.log('\n🔄 Aggregating Q4 monthly metrics into quarterly totals...');
    const previousMetrics = aggregateMonthlyToQuarterly(q4MonthlyMetrics);
    console.log(`  ✓ Q4 Aggregated: ${previousMetrics.resolvedCount} tickets, TTFR ${formatTime(previousMetrics.avgTTFR)}, TTR ${formatTime(previousMetrics.avgTTR)}`);


    // Count created tickets for both quarters
    console.log('\nCounting created tickets...');
    const currentCreated = await countCreatedTickets(quarters.currentQuarter.createdFilter, quarters.currentQuarter.label);
    const previousCreated = await countCreatedTickets(quarters.previousQuarter.createdFilter, quarters.previousQuarter.label);
    console.log(`Current quarter created: ${currentCreated}, Previous quarter created: ${previousCreated}`);

    currentMetrics.createdCount = currentCreated;
    previousMetrics.createdCount = previousCreated;

    // CSAT is now aggregated from monthly metrics (with validated overrides)
    // Skip separate CSAT fetching to avoid API pagination issues

    // Count workforce changes
    console.log('\nCounting workforce changes...');
    const currentWorkforce = await countWorkforceChanges(quarters.currentQuarter.jqlFilter, quarters.currentQuarter.label);
    const previousWorkforce = await countWorkforceChanges(quarters.previousQuarter.jqlFilter, quarters.previousQuarter.label);

    currentMetrics.workforce = currentWorkforce;
    previousMetrics.workforce = previousWorkforce;

    // Save metrics to JSON for analyst report consumption
    try {
      saveQuarterlyMetrics(currentMetrics, previousMetrics, quarters);
    } catch (error) {
      console.warn('⚠️  Warning: Failed to save metrics cache:', error.message);
    }

    // Generate HTML
    const html = generateConfluenceHTML(currentMetrics, previousMetrics, quarters.currentQuarter, quarters.previousQuarter);

    console.log('\n=== Quarterly Metrics Summary ===');
    console.log(`${quarters.currentQuarter.label}:`);
    console.log(`  Created: ${currentMetrics.createdCount}`);
    console.log(`  Resolved: ${currentMetrics.resolvedCount}`);
    console.log(`  Avg TTFR: ${formatTime(currentMetrics.avgTTFR)}`);
    console.log(`  Avg TTR: ${formatTime(currentMetrics.avgTTR)}`);
    console.log(`  SLA Performance: ${currentMetrics.overallSlaPercent}%`);
    console.log(`  CSAT: ${currentMetrics.csat.avgScore} (${currentMetrics.csat.totalResponses} reviews)`);
    console.log(`  Automation: ${currentMetrics.automationPercent}% (${currentMetrics.automatedCount} tickets)`);
    console.log(`  Workforce: ${currentMetrics.workforce.totalOnboarding} onboarded, ${currentMetrics.workforce.offboarding} offboarded`);

    // Output to file for review (only when running locally, not in CI)
    if (!process.env.CI && !process.env.GITHUB_ACTIONS) {
      const outputPath = `/Users/arlynngalang/Desktop/ISD_Quarterly_Metrics_Q1_2026.html`;
      try {
        fs.writeFileSync(outputPath, html);
        console.log(`\n✓ HTML output written to ${outputPath}`);
      } catch (err) {
        console.log(`\n⚠️  Could not write HTML to file: ${err.message}`);
      }
    } else {
      console.log(`\n✓ Running in CI - skipping local HTML file output`);
    }

    // Update Confluence page
    console.log('\n🔄 Updating Confluence page...');
    const updated = await updateConfluencePage(CONFLUENCE_PAGE_ID, html, 'ISD Quarterly Metrics - Q1 2026');

    if (!updated) {
      console.log('\n📋 Manual fallback: Copy HTML from Desktop and paste into Confluence');
      console.log(`  URL: https://${JIRA_BASE_URL}/wiki/spaces/${CONFLUENCE_SPACE_KEY}/pages/${CONFLUENCE_PAGE_ID}`);
    }

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
