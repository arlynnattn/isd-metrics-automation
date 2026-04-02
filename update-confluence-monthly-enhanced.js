#!/usr/bin/env node

/**
 * ISD Monthly Metrics Automation - Enhanced
 * Fetches monthly metrics from Jira including department breakdown and SaaS app tracking
 * Matches IT Ops Metrics dashboard format from Feb 2026 presentation
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { saveMonthlyMetrics } = require('./save-metrics-to-json');
const { fetchMonthlySlackInsights } = require('./slack-insights');

// Configuration
const JIRA_BASE_URL = 'attentivemobile.atlassian.net';
const CONFLUENCE_PAGE_ID = '6415089689'; // ISD Monthly Metrics page
const CONFLUENCE_SPACE_KEY = 'ISD';
const ASSETS_WORKSPACE_ID = '0e0847de-b6ef-45db-b74f-45e404e34d0c';

// SLA Targets
const TTFR_SLA_HOURS = 2;
const TTR_SLA_HOURS = 16;

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
 * Fetch CSAT (Customer Satisfaction) scores for a date range
 */
async function fetchCSAT(startDate, endDate, monthLabel) {
  console.log(`\nFetching CSAT scores for ${monthLabel}...`);

  try {
    // Format dates for JQL
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Query for tickets with satisfaction ratings in the date range
    const jql = `project = ISD AND "${FIELD_SATISFACTION_DATE}" >= "${startStr}" AND "${FIELD_SATISFACTION_DATE}" <= "${endStr}"`;

    const path = `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=1000&fields=${FIELD_SATISFACTION},${FIELD_SATISFACTION_DATE}`;
    const response = await makeRequest(JIRA_BASE_URL, path, 'GET', null, {
      'Authorization': JIRA_AUTH_HEADER
    });

    const issues = response.issues || [];
    console.log(`Found ${issues.length} CSAT responses`);

    if (issues.length === 0) {
      return {
        avgScore: 'N/A',
        totalResponses: 0,
        scores: {}
      };
    }

    // Calculate average and count by score
    let totalScore = 0;
    let validRatings = 0;
    const scoreBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    for (const issue of issues) {
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
 * Get date range for current and previous month
 */
function getMonthRanges() {
  const now = new Date();

  // Monthly reports show the PREVIOUS completed month, not partial current month
  // Current = last month (complete), Previous = month before that (for comparison)
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  // Previous month: full month before current
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];

  const currentStartStr = currentMonthStart.toISOString().split('T')[0];
  const currentEndStr = currentMonthEnd.toISOString().split('T')[0];
  const previousStartStr = previousMonthStart.toISOString().split('T')[0];
  const previousEndStr = previousMonthEnd.toISOString().split('T')[0];

  return {
    currentMonth: {
      jqlFilter: `>= "${currentStartStr}" AND resolutiondate <= "${currentEndStr}"`,
      createdFilter: `created >= "${currentStartStr}" AND created <= "${currentEndStr}"`,
      start: currentMonthStart,
      end: currentMonthEnd,
      label: `${monthNames[currentMonthStart.getMonth()]} ${currentMonthStart.getFullYear()}`,
      shortLabel: monthNames[currentMonthStart.getMonth()].substring(0, 3)
    },
    previousMonth: {
      jqlFilter: `>= "${previousStartStr}" AND resolutiondate <= "${previousEndStr}"`,
      createdFilter: `created >= "${previousStartStr}" AND created <= "${previousEndStr}"`,
      start: previousMonthStart,
      end: previousMonthEnd,
      label: `${monthNames[previousMonthStart.getMonth()]} ${previousMonthStart.getFullYear()}`,
      shortLabel: monthNames[previousMonthStart.getMonth()].substring(0, 3)
    }
  };
}

/**
 * Count created tickets using JQL filter
 */
async function countCreatedTickets(jqlFilter, label, isRange = false) {
  // If isRange is true, jqlFilter already contains the full condition (e.g., "created >= -14d AND created < -7d")
  // Otherwise, it's a simple filter like "-7d"
  const jql = isRange
    ? `project = ISD AND ${jqlFilter}`
    : `project = ISD AND created >= ${jqlFilter}`;

  console.log(`  Counting created for ${label}`);

  // Fetch all issues and count them (search/jql doesn't return total)
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
 * by resolved date (showing IT's completed work)
 */
async function countWorkforceChanges(jqlFilter, label, isRange = false) {
  console.log(`  Counting workforce changes for ${label}`);

  // Build base resolution date filter (always prepend "resolutiondate")
  const dateFilter = `resolutiondate ${jqlFilter}`;

  // FTE Onboarding: CLONE - IT Support Onboarding from Greenhouse or Sapling (PRIMARY SOURCE)
  // These are automated tickets from HR systems, more reliable than manual calendar events
  const fteOnboardingJql = `project = ISD AND summary ~ "CLONE - IT Support Onboarding" AND reporter in ("jira-greenhouse@attentivemobile.com", "jira-sapling@attentivemobile.com") AND ${dateFilter}`;

  // FTE Onboarding Verification: Calendar event requests (for data quality check)
  const fteOnboardingVerificationJql = `project = ISD AND type = Onboarding AND summary !~ "CLONE" AND summary !~ "Contractor" AND ${dateFilter}`;

  // Contractor Onboarding: CLONE - Contractor Onboarding (automated tickets, no calendar events)
  const contractorOnboardingJql = `project = ISD AND summary ~ "CLONE - Contractor Onboarding" AND ${dateFilter}`;

  // FTE Offboarding: CLONE - Device IT Offboarding from Sapling
  const fteOffboardingJql = `project = ISD AND summary ~ "CLONE - Device" AND reporter = "jira-sapling@attentivemobile.com" AND ${dateFilter}`;

  // Contractor Offboarding: CLONE - Contractor Offboarding (human reporters, not automation)
  const contractorOffboardingJql = `project = ISD AND summary ~ "CLONE - Contractor Offboarding" AND ${dateFilter}`;

  // Fetch FTE onboarding tickets
  let fteOnboardingIssues = [];
  let nextPageToken = null;
  let isLast = false;

  while (!isLast) {
    let path = `/rest/api/3/search/jql?jql=${encodeURIComponent(fteOnboardingJql)}&maxResults=1000&fields=key`;
    if (nextPageToken) {
      path += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;
    }

    const response = await makeRequest(JIRA_BASE_URL, path, 'GET', null, {
      'Authorization': JIRA_AUTH_HEADER
    });

    fteOnboardingIssues = fteOnboardingIssues.concat(response.issues || []);
    isLast = response.isLast !== false;
    nextPageToken = response.nextPageToken;
  }

  // Fetch FTE onboarding verification (calendar events) for data quality check
  let fteOnboardingVerificationIssues = [];
  nextPageToken = null;
  isLast = false;

  while (!isLast) {
    let path = `/rest/api/3/search/jql?jql=${encodeURIComponent(fteOnboardingVerificationJql)}&maxResults=1000&fields=key`;
    if (nextPageToken) {
      path += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;
    }

    const response = await makeRequest(JIRA_BASE_URL, path, 'GET', null, {
      'Authorization': JIRA_AUTH_HEADER
    });

    fteOnboardingVerificationIssues = fteOnboardingVerificationIssues.concat(response.issues || []);
    isLast = response.isLast !== false;
    nextPageToken = response.nextPageToken;
  }

  // Verify FTE onboarding count against calendar events
  const cloneCount = fteOnboardingIssues.length;
  const calendarCount = fteOnboardingVerificationIssues.length;
  const discrepancy = Math.abs(cloneCount - calendarCount);
  const discrepancyPct = cloneCount > 0 ? (discrepancy / cloneCount * 100).toFixed(1) : 0;

  if (discrepancy > 0) {
    console.log(`  ⚠️  FTE Onboarding verification: CLONE=${cloneCount}, Calendar=${calendarCount} (diff: ${discrepancy}, ${discrepancyPct}%)`);
    if (discrepancyPct > 10) {
      console.log(`  ⚠️  WARNING: Discrepancy exceeds 10% - may indicate data quality issue`);
    }
  } else {
    console.log(`  ✅ FTE Onboarding verification: CLONE and Calendar match (${cloneCount})`);
  }

  // Fetch contractor onboarding tickets
  let contractorOnboardingIssues = [];
  nextPageToken = null;
  isLast = false;

  while (!isLast) {
    let path = `/rest/api/3/search/jql?jql=${encodeURIComponent(contractorOnboardingJql)}&maxResults=1000&fields=key`;
    if (nextPageToken) {
      path += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;
    }

    const response = await makeRequest(JIRA_BASE_URL, path, 'GET', null, {
      'Authorization': JIRA_AUTH_HEADER
    });

    contractorOnboardingIssues = contractorOnboardingIssues.concat(response.issues || []);
    isLast = response.isLast !== false;
    nextPageToken = response.nextPageToken;
  }

  // Fetch FTE offboarding tickets
  let fteOffboardingIssues = [];
  nextPageToken = null;
  isLast = false;

  while (!isLast) {
    let path = `/rest/api/3/search/jql?jql=${encodeURIComponent(fteOffboardingJql)}&maxResults=1000&fields=key`;
    if (nextPageToken) {
      path += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;
    }

    const response = await makeRequest(JIRA_BASE_URL, path, 'GET', null, {
      'Authorization': JIRA_AUTH_HEADER
    });

    fteOffboardingIssues = fteOffboardingIssues.concat(response.issues || []);
    isLast = response.isLast !== false;
    nextPageToken = response.nextPageToken;
  }

  // Fetch contractor offboarding tickets
  let contractorOffboardingIssues = [];
  nextPageToken = null;
  isLast = false;

  while (!isLast) {
    let path = `/rest/api/3/search/jql?jql=${encodeURIComponent(contractorOffboardingJql)}&maxResults=1000&fields=key`;
    if (nextPageToken) {
      path += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;
    }

    const response = await makeRequest(JIRA_BASE_URL, path, 'GET', null, {
      'Authorization': JIRA_AUTH_HEADER
    });

    contractorOffboardingIssues = contractorOffboardingIssues.concat(response.issues || []);
    isLast = response.isLast !== false;
    nextPageToken = response.nextPageToken;
  }

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
 * Check if a ticket was resolved without human intervention
 * Returns true if the ticket was fully automated (no human touched it after creation)
 */
function isFullyAutomated(issue, automationAccounts) {
  const assignee = issue.fields.assignee?.displayName;

  // Must be assigned to one of the automation accounts
  if (!automationAccounts.includes(assignee)) {
    return false;
  }

  // Check changelog for human intervention
  const changelog = issue.changelog;
  if (!changelog || !changelog.histories) {
    // No changelog means no changes after creation - could be automated
    return true;
  }

  // Check each history entry for human actors
  for (const history of changelog.histories) {
    const actor = history.author?.displayName;

    // If a human (not in automation accounts list) made any change, it's not fully automated
    if (actor && !automationAccounts.includes(actor)) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate weekly metrics from Jira issues (resolved tickets)
 */
async function calculateMonthlyMetrics(jql, monthLabel, serviceCatalogCache) {
  console.log(`\nFetching issues for ${monthLabel}...`);

  // Fetch issues with all needed fields (including changelog for automation detection)
  const fields = [
    'created', 'resolutiondate', 'comment', 'assignee', 'labels',
    'issuetype', 'status', 'updated', 'summary',
    FIELD_SERVICE_CATALOG, FIELD_EMPLOYEE_DEPT, FIELD_REQUEST_TYPE,
    FIELD_TTFR, FIELD_TTR
  ];

  // Fetch all issues with pagination (expand changelog to detect human intervention)
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
  const now = new Date();

  let ttfrSum = 0;
  let ttfrCount = 0;
  let ttfrSlaMetCount = 0;
  let ttrSum = 0;
  let ttrCount = 0;
  let ttrSlaMetCount = 0;
  let resolvedCount = 0;

  // Automation tracking
  let automatedCount = 0;
  let automatedTtrSum = 0;
  let automatedTtrCount = 0;
  let humanTtrSum = 0;
  let humanTtrCount = 0;

  // Department tracking
  const departmentBreakdown = {};

  // SaaS application tracking
  const saasAppCounts = {};
  let accessRequestCount = 0;

  // SLA breach tracking
  let slaBreachCount = 0;
  const breachReasons = {
    'approval_bottleneck': 0,
    'manual_setup': 0,
    'complex_request': 0,
    'other': 0
  };

  // Issue type tracking for resolved tickets
  const issueTypeBreakdown = {};

  // Engineer tracking for workload distribution
  const engineerBreakdown = {};

  for (const issue of issues) {
    const created = new Date(issue.fields.created);
    const issueType = issue.fields.issuetype?.name || 'Other';
    const status = issue.fields.status?.name || 'Unknown';

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

      // Extract SaaS app from Service Catalog
      const serviceCatalog = issue.fields[FIELD_SERVICE_CATALOG];
      if (serviceCatalog && Array.isArray(serviceCatalog) && serviceCatalog.length > 0) {
        for (const obj of serviceCatalog) {
          const appName = serviceCatalogCache[obj.objectId];
          if (appName) {
            if (!saasAppCounts[appName]) {
              saasAppCounts[appName] = 0;
            }
            saasAppCounts[appName]++;
          }
        }
      }
    }

    // Calculate TTFR using Jira's business-hours SLA field
    const ttfrField = issue.fields[FIELD_TTFR];
    if (ttfrField && ttfrField.completedCycles && ttfrField.completedCycles.length > 0) {
      const cycle = ttfrField.completedCycles[0];
      const ttfrHours = cycle.elapsedTime.millis / (1000 * 60 * 60); // Convert millis to hours

      ttfrSum += ttfrHours;
      ttfrCount++;

      // Check if SLA was met (based on Jira's business-hours calculation)
      if (!cycle.breached) {
        ttfrSlaMetCount++;
      } else {
        // TTFR breach - likely approval bottleneck
        breachReasons.approval_bottleneck++;
      }
    }

    // Count resolved tickets (all tickets in query since we filtered by resolutiondate)
    if (issue.fields.resolutiondate) {
      resolvedCount++;

      // Track resolved issue types
      if (!issueTypeBreakdown[issueType]) {
        issueTypeBreakdown[issueType] = 0;
      }
      issueTypeBreakdown[issueType]++;

      // Track engineer workload
      const assigneeName = issue.fields.assignee?.displayName || 'Unassigned';
      if (!engineerBreakdown[assigneeName]) {
        engineerBreakdown[assigneeName] = 0;
      }
      engineerBreakdown[assigneeName]++;

      // Track automation metrics for ALL resolved tickets
      const fullyAutomated = isFullyAutomated(issue, AUTOMATION_ACCOUNTS);
      if (fullyAutomated) {
        automatedCount++;
      }
    }

    // Calculate TTR using Jira's business-hours SLA field
    const ttrField = issue.fields[FIELD_TTR];
    if (ttrField && ttrField.completedCycles && ttrField.completedCycles.length > 0) {
      const cycle = ttrField.completedCycles[0];
      const ttrHours = cycle.elapsedTime.millis / (1000 * 60 * 60); // Convert millis to hours

      ttrSum += ttrHours;
      ttrCount++;

      // Check if SLA was met (based on Jira's business-hours calculation)
      if (!cycle.breached) {
        ttrSlaMetCount++;
      } else {
        slaBreachCount++;
        // Categorize breach reason based on ticket attributes
        if (isAccessRequest) {
          breachReasons.approval_bottleneck++;
        } else {
          breachReasons.other++;
        }
      }

      // Track TTR separately for automated vs human (only for tickets with TTR data)
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

  // Calculate overall SLA met %
  let overallSlaPercent = 'N/A';
  if (ttfrSlaPercent !== 'N/A' && ttrSlaPercent !== 'N/A') {
    overallSlaPercent = (((parseFloat(ttfrSlaPercent) + parseFloat(ttrSlaPercent)) / 2)).toFixed(1);
  }

  const slaBreachPercent = ttrCount > 0 ? ((slaBreachCount / ttrCount) * 100).toFixed(1) : 'N/A';

  // Calculate automation metrics
  const automationPercent = resolvedCount > 0 ? ((automatedCount / resolvedCount) * 100).toFixed(1) : 'N/A';
  const avgAutomatedTTR = automatedTtrCount > 0 ? (automatedTtrSum / automatedTtrCount).toFixed(2) : 'N/A';
  const avgHumanTTR = humanTtrCount > 0 ? (humanTtrSum / humanTtrCount).toFixed(2) : 'N/A';

  // Calculate human time reclaimed (hours saved by automation)
  let humanTimeReclaimed = 'N/A';
  if (avgAutomatedTTR !== 'N/A' && avgHumanTTR !== 'N/A' && automatedCount > 0) {
    const hoursSaved = (parseFloat(avgHumanTTR) - parseFloat(avgAutomatedTTR)) * automatedCount;
    humanTimeReclaimed = hoursSaved > 0 ? hoursSaved.toFixed(1) : '0.0';
  }

  // Sort departments, SaaS apps, and issue types by count
  const sortedDepartments = Object.entries(departmentBreakdown)
    .sort((a, b) => b[1] - a[1]);

  const sortedSaasApps = Object.entries(saasAppCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10); // Top 10

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
    // Automation metrics
    automatedCount,
    automationPercent,
    avgAutomatedTTR,
    avgHumanTTR,
    humanTimeReclaimed,
    // Engineer workload distribution
    engineerBreakdown: sortedEngineers
  };
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
 * Generate Confluence HTML output
 */
function generateConfluenceHTML(currentMetrics, previousMetrics, currentMonth, previousMonth) {
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'long', timeStyle: 'short' });

  // Calculate changes
  const resolvedChange = calculateMoMChange(previousMetrics.resolvedCount, currentMetrics.resolvedCount);
  const ttfrChange = calculateMoMChange(previousMetrics.avgTTFR, currentMetrics.avgTTFR, true);
  const ttrChange = calculateMoMChange(previousMetrics.avgTTR, currentMetrics.avgTTR, true);
  const slaChange = calculateMoMChange(previousMetrics.overallSlaPercent, currentMetrics.overallSlaPercent);
  const automationChange = calculateMoMChange(previousMetrics.automationPercent, currentMetrics.automationPercent);

  // Calculate human ticket counts
  const currentHumanCount = currentMetrics.resolvedCount - currentMetrics.automatedCount;
  const previousHumanCount = previousMetrics.resolvedCount - previousMetrics.automatedCount;

  // Calculate FTE capacity (1 month period)
  const fteSaved = calculateFTE(currentMetrics.humanTimeReclaimed, 1);
  const currentAskIt = getSlackChannelSummary(currentMetrics.slack, '#ask-it');
  const currentTeamSupport = getSlackChannelSummary(currentMetrics.slack, '#team-it-support');
  const previousAskIt = getSlackChannelSummary(previousMetrics.slack, '#ask-it');
  const previousTeamSupport = getSlackChannelSummary(previousMetrics.slack, '#team-it-support');

  let html = `
<h1>IT Ops Metrics - ${currentMonth.label}</h1>
<p><em>Last updated: ${timestamp}</em></p>

<h2>Summary</h2>
<ul>
  <li><strong>Operational Resilience:</strong> Team maintained ${currentMetrics.overallSlaPercent}% SLA performance despite operating at reduced capacity—automation provided continuity when engineers were unavailable, demonstrating system reliability under staffing constraints</li>
  <li><strong>Scalable Operations:</strong> IT Ops delivered ${currentMetrics.resolvedCount} ticket resolutions with ${currentMetrics.automationPercent}% automation rate—demonstrating ability to scale service delivery without proportional headcount growth</li>
  <li><strong>Next Optimization Target:</strong> Approval-dependent workflows (Snowflake, GitHub, Gong access) represent primary opportunity for further efficiency gains through governance process streamlining</li>
</ul>

<h2>Key Metrics Summary</h2>

<h3>A. Demand & Volume</h3>
<table data-layout="default">
  <tbody>
    <tr>
      <th><p><strong>Metric</strong></p></th>
      <th><p><strong>${currentMonth.shortLabel}</strong></p></th>
      <th><p><strong>${previousMonth.shortLabel}</strong></p></th>
      <th><p><strong>Change</strong></p></th>
    </tr>
    <tr>
      <td><p>Tickets Resolved</p></td>
      <td><p>${currentMetrics.resolvedCount}</p></td>
      <td><p>${previousMetrics.resolvedCount}</p></td>
      <td><p>${resolvedChange}</p></td>
    </tr>
    <tr>
      <td><p>Slack Support Signals</p></td>
      <td><p>${formatSlackMetricSummary(currentMetrics.slack)}</p></td>
      <td><p>${formatSlackMetricSummary(previousMetrics.slack)}</p></td>
      <td><p>-</p></td>
    </tr>
    <tr>
      <td><p>#ask-it Activity</p></td>
      <td><p>${formatSlackChannelSummary(currentAskIt)}</p></td>
      <td><p>${formatSlackChannelSummary(previousAskIt)}</p></td>
      <td><p>-</p></td>
    </tr>
    <tr>
      <td><p>#team-it-support Activity</p></td>
      <td><p>${formatSlackChannelSummary(currentTeamSupport)}</p></td>
      <td><p>${formatSlackChannelSummary(previousTeamSupport)}</p></td>
      <td><p>-</p></td>
    </tr>
  </tbody>
</table>

<h3>B. Speed & Performance</h3>
<table data-layout="default">
  <tbody>
    <tr>
      <th><p><strong>Metric</strong></p></th>
      <th><p><strong>${currentMonth.shortLabel}</strong></p></th>
      <th><p><strong>${previousMonth.shortLabel}</strong></p></th>
      <th><p><strong>Change</strong></p></th>
    </tr>
    <tr>
      <td><p>Time to First Response (SLA: 2 hrs)</p></td>
      <td><p>${formatTime(currentMetrics.avgTTFR)}</p></td>
      <td><p>${formatTime(previousMetrics.avgTTFR)}</p></td>
      <td><p>${ttfrChange}</p></td>
    </tr>
    <tr>
      <td><p>Time to Resolution (SLA: 16 hrs)</p></td>
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
      <td><p>${calculateCSATChange(previousMetrics.csat.avgScore, currentMetrics.csat.avgScore)}</p></td>
    </tr>
  </tbody>
</table>

<h3>C. Efficiency & Scale</h3>
<table data-layout="default">
  <tbody>
    <tr>
      <th><p><strong>Metric</strong></p></th>
      <th><p><strong>${currentMonth.shortLabel}</strong></p></th>
      <th><p><strong>${previousMonth.shortLabel}</strong></p></th>
      <th><p><strong>Change</strong></p></th>
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

<h2>Team Capacity & Availability</h2>
<p><strong>Active Round Robin Engineers:</strong> Artie Byers, Carlos Ramirez (2 of 3 Support Engineers)</p>
<p><strong>Out of Office:</strong> JP Dulude (partial month)</p>

<table data-layout="default">
  <tbody>
    <tr>
      <th><p><strong>Engineer</strong></p></th>
      <th><p><strong>Status</strong></p></th>
      <th><p><strong>Tickets Resolved</strong></p></th>
      <th><p><strong>% of Team Load</strong></p></th>
    </tr>
    <tr>
      <td><p>Carlos Ramirez</p></td>
      <td><p>Active</p></td>
      <td><p>${currentMetrics.engineerBreakdown?.find(e => e.name === 'Carlos Ramirez')?.count || 'N/A'}</p></td>
      <td><p>${currentMetrics.engineerBreakdown?.find(e => e.name === 'Carlos Ramirez')?.count ? ((currentMetrics.engineerBreakdown.find(e => e.name === 'Carlos Ramirez').count / currentMetrics.resolvedCount) * 100).toFixed(1) : 'N/A'}%</p></td>
    </tr>
    <tr>
      <td><p>Artie Byers</p></td>
      <td><p>Active</p></td>
      <td><p>${currentMetrics.engineerBreakdown?.find(e => e.name === 'Artie Byers')?.count || 'N/A'}</p></td>
      <td><p>${currentMetrics.engineerBreakdown?.find(e => e.name === 'Artie Byers')?.count ? ((currentMetrics.engineerBreakdown.find(e => e.name === 'Artie Byers').count / currentMetrics.resolvedCount) * 100).toFixed(1) : 'N/A'}%</p></td>
    </tr>
    <tr>
      <td><p>JP Dulude</p></td>
      <td><p>Partial Availability</p></td>
      <td><p>${currentMetrics.engineerBreakdown?.find(e => e.name === 'JP Dulude')?.count || 'N/A'}</p></td>
      <td><p>${currentMetrics.engineerBreakdown?.find(e => e.name === 'JP Dulude')?.count ? ((currentMetrics.engineerBreakdown.find(e => e.name === 'JP Dulude').count / currentMetrics.resolvedCount) * 100).toFixed(1) : 'N/A'}%</p></td>
    </tr>
    <tr>
      <td><p>Automation</p></td>
      <td><p>Always Available</p></td>
      <td><p>${currentMetrics.automatedCount}</p></td>
      <td><p>${currentMetrics.automationPercent}%</p></td>
    </tr>
  </tbody>
</table>

<p><strong>Resilience Impact:</strong> Automation absorbed workload gaps when team members were unavailable—demonstrating operational continuity without requiring overtime or degraded service quality.</p>

<h2>Workforce Changes</h2>
<p><strong>IT Ops completed onboarding and offboarding for the following workforce changes this period:</strong></p>

<table data-layout="default">
  <tbody>
    <tr>
      <th><p><strong>Change Type</strong></p></th>
      <th><p><strong>${currentMonth.shortLabel}</strong></p></th>
      <th><p><strong>${previousMonth.shortLabel}</strong></p></th>
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
      <td><p>Employees Offboarded</p></td>
      <td><p>${currentMetrics.workforce?.offboarding || 0} employees</p></td>
      <td><p>${previousMetrics.workforce?.offboarding || 0} employees</p></td>
    </tr>
    <tr>
      <td><p>Net Headcount Change</p></td>
      <td><p>${currentMetrics.workforce?.netChange > 0 ? '+' : ''}${currentMetrics.workforce?.netChange || 0}</p></td>
      <td><p>${previousMetrics.workforce?.netChange > 0 ? '+' : ''}${previousMetrics.workforce?.netChange || 0}</p></td>
    </tr>
  </tbody>
</table>

<h2>Leadership Insights</h2>
<ul>
  <li><strong>Automation Provides Operational Resilience:</strong> Team maintained ${currentMetrics.overallSlaPercent}% SLA performance despite reduced availability (JP partial OOO)—automation ensured service continuity and demonstrates that automation isn't just efficiency, it's business continuity insurance against PTO, illness, and turnover</li>
  <li><strong>2 Active Engineers + Automation = Full Team Capacity:</strong> ${currentMetrics.resolvedCount} tickets resolved this month with primary workload carried by Artie and Carlos—automation absorbed gaps without requiring overtime or degraded quality, proving the scalability model works under real-world staffing constraints</li>
  <li><strong>SLA Performance Constrained by Approvals, Not IT:</strong> ${currentMetrics.overallSlaPercent}% SLA achievement with ${formatTime(currentMetrics.avgTTR)} resolution speed confirms IT execution is fast—remaining gaps driven by approval workflow delays outside IT's control, representing next optimization opportunity</li>
</ul>

<h2>Strategic Focus Areas</h2>

<h3>What's Working</h3>
<ul>
  <li><strong>Automation Infrastructure:</strong> ${currentMetrics.automationPercent}% of tickets resolved without human touch—proven scalability model that enables growth without linear cost increases</li>
  <li><strong>Execution Speed:</strong> ${formatTime(currentMetrics.avgTTR)} average resolution with ${currentMetrics.overallSlaPercent}% SLA performance—IT execution is not the constraint</li>
  <li><strong>Service Consistency:</strong> ${currentMetrics.csat.avgScore} CSAT reflects reliable, predictable service delivery enabled by automated workflows</li>
</ul>

<h3>Next Opportunities</h3>
<ul>
  <li><strong>Approval Workflow Optimization:</strong> ${currentMetrics.slaBreachCount} SLA breaches (${currentMetrics.slaBreachPercent}% rate) primarily driven by approval delays—streamlining governance processes represents largest efficiency gain opportunity</li>
  <li><strong>Automation Coverage Expansion:</strong> ${100 - parseFloat(currentMetrics.automationPercent)}% of tickets still require human handling—expanding automation to additional categories will unlock further capacity and improve consistency</li>
</ul>

<h2>Department Breakdown (Top Contributors)</h2>
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

<h2>Access Requests & Top SaaS Applications</h2>
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
<p><strong>Total Resolved:</strong> ${currentMetrics.resolvedCount} tickets</p>

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

<h2>SLA Performance</h2>
<p><strong>SLA Breach Rate:</strong> ${currentMetrics.slaBreachPercent}%</p>
<p><strong>Breach Count:</strong> ${currentMetrics.slaBreachCount} tickets</p>

${renderSlackInsightsHTML(currentMetrics.slack)}

<hr />
`;

  return html;
}

function getSlackChannelSummary(slackMetrics, channelName) {
  if (!slackMetrics || !Array.isArray(slackMetrics.channels)) {
    return null;
  }

  return slackMetrics.channels.find((channel) => channel.channel === channelName) || null;
}

function formatSlackMetricSummary(slackMetrics) {
  if (!slackMetrics || slackMetrics.available === false) {
    return 'N/A';
  }

  return `${slackMetrics.messageCount} msgs, ${slackMetrics.uniqueUsers} user touches`;
}

function formatSlackChannelSummary(channelSummary) {
  if (!channelSummary) {
    return 'Not available';
  }

  if (channelSummary.error) {
    return channelSummary.error;
  }

  return `${channelSummary.messageCount} msgs, ${channelSummary.uniqueUsers} users`;
}

function renderSlackInsightsHTML(slackMetrics) {
  if (!slackMetrics || slackMetrics.available === false) {
    return '';
  }

  const channelRows = (slackMetrics.channels || []).map((channel) => {
    const summary = channel.error
      ? channel.error
      : `${channel.messageCount} messages, ${channel.uniqueUsers} users, ${channel.activeDays} active days, ${channel.incidentSignals} incident signals`;

    return `
    <tr>
      <td><p>${channel.channel}</p></td>
      <td><p>${summary}</p></td>
    </tr>`;
  }).join('');

  const themeItems = (slackMetrics.overall?.topThemes || [])
    .slice(0, 4)
    .map((theme) => `<li><strong>${theme.label}:</strong> ${theme.count} signal matches across support channels</li>`)
    .join('');

  const notableItems = (slackMetrics.overall?.notableItems || [])
    .slice(0, 4)
    .map((item) => `<li><strong>${item.channel}:</strong> ${item.text} <em>(${item.reason})</em></li>`)
    .join('');

  return `
<h2>Slack Support Signals</h2>
<p><strong>Combined Activity:</strong> ${slackMetrics.messageCount} human-authored messages across ${slackMetrics.uniqueUsers} user touches for the month.</p>

<table data-layout="default">
  <tbody>
    <tr>
      <th><p><strong>Channel</strong></p></th>
      <th><p><strong>Summary</strong></p></th>
    </tr>
${channelRows}
  </tbody>
</table>

${themeItems ? `<h3>Top Themes</h3><ul>${themeItems}</ul>` : ''}
${notableItems ? `<h3>Notable Threads / Signals</h3><ul>${notableItems}</ul>` : ''}
`;
}

/**
 * Calculate MoM change percentage with correct arrow direction
 * For lower-is-better metrics (TTFR, TTR): ↓ is good (green), ↑ is bad (red)
 * For higher-is-better metrics (SLA%, CSAT): ↑ is good (green), ↓ is bad (red)
 */
function calculateMoMChange(oldValue, newValue, isLowerBetter = false) {
  if (oldValue === 'N/A' || newValue === 'N/A' || oldValue === 0) return 'N/A';

  const old = parseFloat(oldValue);
  const curr = parseFloat(newValue);
  const change = ((curr - old) / old * 100).toFixed(1);
  const absChange = Math.abs(change);

  let arrow;
  if (change > 0) {
    // Value increased: ↑ for lower-is-better shows direction (bad), ↑ for higher-is-better shows direction (good)
    arrow = '↑';
  } else if (change < 0) {
    // Value decreased: ↓ for lower-is-better shows direction (good), ↓ for higher-is-better shows direction (bad)
    arrow = '↓';
  } else {
    arrow = '→';
  }

  return `${arrow} ${absChange}% MoM`;
}

/**
 * Calculate CSAT change
 */
function calculateCSATChange(oldValue, newValue) {
  if (oldValue === 'N/A' || newValue === 'N/A' || oldValue === 'Error' || newValue === 'Error') return 'N/A';

  const old = parseFloat(oldValue);
  const curr = parseFloat(newValue);
  const change = (curr - old).toFixed(2);

  if (change > 0) {
    return `↑ ${change}`;
  } else if (change < 0) {
    return `↓ ${Math.abs(change)}`;
  } else {
    return '→ 0.00';
  }
}

/**
 * Format hours into human-readable time (e.g., "2h 30m" or "45m")
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
 * Calculate FTE capacity from hours saved
 * Assumes 160-hour work month (4 weeks @ 40 hours/week)
 */
function calculateFTE(hours, periodInMonths = 1) {
  if (!hours || hours === 'N/A' || hours === 0) return 'N/A';

  const hoursPerMonth = 160;
  const totalHours = parseFloat(hours);
  const fte = totalHours / (hoursPerMonth * periodInMonths);

  return fte.toFixed(2);
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('=== ISD Monthly Metrics Automation ===');

    const months = getMonthRanges();

    // Fetch current month resolved issues first to build cache
    const resolvedStatuses = '"13. Done", Canceled, Closed, Completed, Declined, Resolved';
    const currentJQL = `project = ISD AND resolutiondate ${months.currentMonth.jqlFilter} AND status in (${resolvedStatuses})`;
    console.log('\nFetching current month issues for cache building...');
    const path = `/rest/api/3/search/jql?jql=${encodeURIComponent(currentJQL)}&maxResults=1000&fields=${FIELD_SERVICE_CATALOG}`;
    const response = await makeRequest(JIRA_BASE_URL, path, 'GET', null, {
      'Authorization': JIRA_AUTH_HEADER
    });

    // Build Service Catalog cache
    const serviceCatalogCache = await buildServiceCatalogCache(response.issues);

    // Calculate metrics for both months using resolutiondate + status filter
    const currentResolvedJQL = `project = ISD AND resolutiondate ${months.currentMonth.jqlFilter} AND status in (${resolvedStatuses})`;
    const previousResolvedJQL = `project = ISD AND resolutiondate ${months.previousMonth.jqlFilter} AND status in (${resolvedStatuses})`;

    const currentMetrics = await calculateMonthlyMetrics(currentResolvedJQL, months.currentMonth.label, serviceCatalogCache);
    const previousMetrics = await calculateMonthlyMetrics(previousResolvedJQL, months.previousMonth.label, serviceCatalogCache);

    // Count created tickets for both months
    console.log('\nCounting created tickets...');
    const currentCreated = await countCreatedTickets(months.currentMonth.createdFilter, months.currentMonth.label, true);
    const previousCreated = await countCreatedTickets(months.previousMonth.createdFilter, months.previousMonth.label, true);
    console.log(`Current month created: ${currentCreated}, Previous month created: ${previousCreated}`);

    currentMetrics.createdCount = currentCreated;
    previousMetrics.createdCount = previousCreated;

    // Fetch Slack insights
    const currentSlack = await fetchMonthlySlackInsights(months.currentMonth.start, months.currentMonth.end, months.currentMonth.label, SLACK_BOT_TOKEN);
    const previousSlack = await fetchMonthlySlackInsights(months.previousMonth.start, months.previousMonth.end, months.previousMonth.label, SLACK_BOT_TOKEN);

    currentMetrics.slack = currentSlack;
    previousMetrics.slack = previousSlack;

    // Fetch CSAT scores
    const currentCSAT = await fetchCSAT(months.currentMonth.start, months.currentMonth.end, months.currentMonth.label);
    const previousCSAT = await fetchCSAT(months.previousMonth.start, months.previousMonth.end, months.previousMonth.label);

    currentMetrics.csat = currentCSAT;
    previousMetrics.csat = previousCSAT;

    // Count workforce changes (onboarding/offboarding by resolved date)
    console.log('\nCounting workforce changes...');
    const currentWorkforce = await countWorkforceChanges(months.currentMonth.jqlFilter, months.currentMonth.label, false);
    const previousWorkforce = await countWorkforceChanges(months.previousMonth.jqlFilter, months.previousMonth.label, true);
    console.log(`Current month: ${currentWorkforce.fteOnboarding} FTE + ${currentWorkforce.contractorOnboarding} contractors onboarded, ${currentWorkforce.fteOffboarding} FTE + ${currentWorkforce.contractorOffboarding} contractors offboarded`);
    console.log(`Previous month: ${previousWorkforce.fteOnboarding} FTE + ${previousWorkforce.contractorOnboarding} contractors onboarded, ${previousWorkforce.fteOffboarding} FTE + ${previousWorkforce.contractorOffboarding} contractors offboarded`);

    currentMetrics.workforce = currentWorkforce;
    previousMetrics.workforce = previousWorkforce;

    // Save metrics to JSON for analyst report consumption
    try {
      saveMonthlyMetrics(currentMetrics, previousMetrics, months);
    } catch (error) {
      console.warn('⚠️  Warning: Failed to save metrics cache:', error.message);
    }

    // Generate HTML
    const html = generateConfluenceHTML(currentMetrics, previousMetrics, months.currentMonth, months.previousMonth);

    console.log('\n=== Metrics Summary ===');
    console.log(`${months.currentMonth.label}:`);
    console.log(`  Created: ${currentMetrics.createdCount}`);
    console.log(`  Resolved: ${currentMetrics.resolvedCount}`);
    console.log(`  Total Issues: ${currentMetrics.totalIssues}`);
    console.log(`  Avg TTFR: ${formatTime(currentMetrics.avgTTFR)}`);
    console.log(`  Avg TTR: ${formatTime(currentMetrics.avgTTR)}`);
    console.log(`  SLA met: ${currentMetrics.overallSlaPercent}%`);
    console.log(`  Access Requests: ${currentMetrics.accessRequestCount}`);
    console.log(`  Top Department: ${currentMetrics.departmentBreakdown[0]?.[0]} (${currentMetrics.departmentBreakdown[0]?.[1]} tickets)`);
    console.log(`  Top SaaS App: ${currentMetrics.saasAppCounts[0]?.[0]} (${currentMetrics.saasAppCounts[0]?.[1]} requests)`);
    console.log(`  Slack Support Signals: ${formatSlackMetricSummary(currentMetrics.slack)}`);
    for (const channel of currentMetrics.slack?.channels || []) {
      console.log(`    ${channel.channel}: ${formatSlackChannelSummary(channel)}`);
    }
    console.log(`  CSAT: ${currentMetrics.csat.avgScore} (${currentMetrics.csat.totalResponses} reviews)`);
    console.log(`  Automation: ${currentMetrics.automationPercent}% (${currentMetrics.automatedCount} tickets)`);
    console.log(`  Avg TTR (Automated vs Human): ${formatTime(currentMetrics.avgAutomatedTTR)} vs ${formatTime(currentMetrics.avgHumanTTR)}`);
    console.log(`  Human Time Reclaimed: ${currentMetrics.humanTimeReclaimed} hours`);

    // Output to file for review (only when running locally, not in CI)
    if (!process.env.CI && !process.env.GITHUB_ACTIONS) {
      const now = new Date();
      const outputPath = `/Users/arlynngalang/Desktop/ISD_Monthly_Metrics_${months.currentMonth.shortLabel}_${now.getFullYear()}.html`;
      try {
        fs.writeFileSync(outputPath, html);
        console.log(`\n✓ HTML output written to ${outputPath}`);
        console.log('  Copy this HTML and paste into Confluence page editor');
      } catch (err) {
        console.log(`\n⚠️  Could not write HTML to file: ${err.message}`);
        console.log('  (This is expected in CI environments)');
      }
    } else {
      console.log(`\n✓ Running in CI - skipping local HTML file output`);
    }

    // Try to update Confluence page (optional)
    console.log('\nAttempting Confluence update...');
    const pageTitle = 'ISD Monthly Metrics';
    const updated = await updateConfluencePage(CONFLUENCE_PAGE_ID, html, pageTitle);
    if (!updated) {
      console.log(`\n📋 Manual steps:`);
      console.log(`  1. Open: https://${JIRA_BASE_URL}/wiki/spaces/${CONFLUENCE_SPACE_KEY}/pages/${CONFLUENCE_PAGE_ID}`);
      console.log(`  2. Edit the page`);
      console.log(`  3. Paste HTML from: ${outputPath}`);
    }

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();
