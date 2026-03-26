#!/usr/bin/env node

/**
 * ISD Metrics Automation
 * Fetches TTFR (Time to First Response) and TTR (Time to Resolution) metrics
 * from Jira and updates the Confluence page weekly
 */

const https = require('https');

// Configuration
const JIRA_BASE_URL = 'attentivemobile.atlassian.net';
const CONFLUENCE_PAGE_ID = '5471371324';
const CONFLUENCE_SPACE_KEY = 'ISD';

// Environment variables (set these in your environment or CI/CD)
const ATLASSIAN_EMAIL = process.env.ATLASSIAN_EMAIL;
const ATLASSIAN_API_TOKEN = process.env.ATLASSIAN_API_TOKEN;

if (!ATLASSIAN_EMAIL || !ATLASSIAN_API_TOKEN) {
  console.error('Error: ATLASSIAN_EMAIL and ATLASSIAN_API_TOKEN environment variables are required');
  console.error('Set them with:');
  console.error('  export ATLASSIAN_EMAIL="your-email@attentivemobile.com"');
  console.error('  export ATLASSIAN_API_TOKEN="your-api-token"');
  console.error('\nCreate an API token at: https://id.atlassian.com/manage-profile/security/api-tokens');
  process.exit(1);
}

const AUTH_HEADER = 'Basic ' + Buffer.from(`${ATLASSIAN_EMAIL}:${ATLASSIAN_API_TOKEN}`).toString('base64');

/**
 * Make an HTTPS request to Atlassian API
 */
function makeRequest(hostname, path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method,
      headers: {
        'Authorization': AUTH_HEADER,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
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
 * Get date range for current and previous week
 */
function getWeekRanges() {
  const now = new Date();
  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
  currentWeekStart.setHours(0, 0, 0, 0);

  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setDate(currentWeekStart.getDate() - 7);

  const previousWeekEnd = new Date(currentWeekStart);
  previousWeekEnd.setMilliseconds(-1);

  return {
    currentWeek: {
      start: currentWeekStart,
      end: now,
      label: `Week of ${currentWeekStart.toLocaleDateString()}`
    },
    previousWeek: {
      start: previousWeekStart,
      end: previousWeekEnd,
      label: `Week of ${previousWeekStart.toLocaleDateString()}`
    }
  };
}

/**
 * Calculate TTFR and TTR from Jira issues
 */
async function calculateMetrics(jql, weekLabel) {
  console.log(`\nFetching issues for ${weekLabel}...`);

  const path = `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=1000&fields=created,resolutiondate,comment,assignee,labels,issuetype,status,updated`;
  const response = await makeRequest(JIRA_BASE_URL, path);

  const issues = response.issues || [];
  console.log(`Found ${issues.length} issues`);

  const AUTOMATION_ACCOUNT = 'Attentive Jira OKTA Workflow Automation Account';
  const now = new Date();

  let ttfrSum = 0;
  let ttfrCount = 0;
  let ttrSum = 0;
  let ttrCount = 0;

  // New metrics tracking
  let automatedResolvedCount = 0;
  let automatedTtrSum = 0;
  let automatedTtrCount = 0;
  let humanTtrSum = 0;
  let humanTtrCount = 0;
  let workflowAutomationCount = 0;

  // Additional dashboard metrics
  let aged7Days = 0;
  let aged14Days = 0;
  let aged30Days = 0;
  let createdCount = issues.length;
  let resolvedCount = 0;
  const issueTypeBreakdown = {};
  const assigneeBreakdown = {};
  let onboardingCount = 0;

  for (const issue of issues) {
    const created = new Date(issue.fields.created);
    const assigneeName = issue.fields.assignee?.displayName || 'Unassigned';
    const labels = issue.fields.labels || [];
    const isAutomated = assigneeName === AUTOMATION_ACCOUNT;
    const issueType = issue.fields.issuetype?.name || 'Other';
    const status = issue.fields.status?.name || 'Unknown';
    const updated = new Date(issue.fields.updated);

    // Check if workflow/automation related
    const isWorkflowAutomation = isAutomated ||
      labels.some(label => label.toLowerCase().includes('workflow') || label.toLowerCase().includes('automation'));

    if (isWorkflowAutomation) {
      workflowAutomationCount++;
    }

    // Track onboarding tickets
    if (issueType.toLowerCase().includes('onboarding')) {
      onboardingCount++;
    }

    // Track aged tickets (unresolved only)
    if (!issue.fields.resolutiondate) {
      const ageInDays = (now - created) / (1000 * 60 * 60 * 24);
      if (ageInDays >= 7) aged7Days++;
      if (ageInDays >= 14) aged14Days++;
      if (ageInDays >= 30) aged30Days++;
    }

    // Track assignee breakdown
    if (!assigneeBreakdown[assigneeName]) {
      assigneeBreakdown[assigneeName] = 0;
    }
    assigneeBreakdown[assigneeName]++;

    // Calculate TTFR (Time to First Response)
    // Find first comment after creation
    if (issue.fields.comment && issue.fields.comment.comments.length > 0) {
      const firstComment = issue.fields.comment.comments[0];
      const firstResponseTime = new Date(firstComment.created);
      const ttfr = (firstResponseTime - created) / (1000 * 60 * 60); // hours
      if (ttfr >= 0) {
        ttfrSum += ttfr;
        ttfrCount++;
      }
    }

    // Calculate TTR (Time to Resolution)
    if (issue.fields.resolutiondate) {
      resolvedCount++;
      const resolved = new Date(issue.fields.resolutiondate);
      const ttr = (resolved - created) / (1000 * 60 * 60); // hours
      if (ttr >= 0) {
        ttrSum += ttr;
        ttrCount++;

        // Track issue type breakdown for resolved tickets
        if (!issueTypeBreakdown[issueType]) {
          issueTypeBreakdown[issueType] = 0;
        }
        issueTypeBreakdown[issueType]++;

        // Track automated vs human TTR
        if (isAutomated) {
          automatedResolvedCount++;
          automatedTtrSum += ttr;
          automatedTtrCount++;
        } else {
          humanTtrSum += ttr;
          humanTtrCount++;
        }
      }
    }
  }

  const avgTTFR = ttfrCount > 0 ? (ttfrSum / ttfrCount).toFixed(2) : 'N/A';
  const avgTTR = ttrCount > 0 ? (ttrSum / ttrCount).toFixed(2) : 'N/A';
  const avgAutomatedTTR = automatedTtrCount > 0 ? (automatedTtrSum / automatedTtrCount).toFixed(2) : 'N/A';
  const avgHumanTTR = humanTtrCount > 0 ? (humanTtrSum / humanTtrCount).toFixed(2) : 'N/A';
  const automatedPercent = ttrCount > 0 ? ((automatedResolvedCount / ttrCount) * 100).toFixed(1) : 'N/A';

  // Calculate human time reclaimed
  let timeReclaimed = 'N/A';
  if (avgHumanTTR !== 'N/A' && avgAutomatedTTR !== 'N/A' && automatedResolvedCount > 0) {
    const timeSavedPerTicket = parseFloat(avgHumanTTR) - parseFloat(avgAutomatedTTR);
    if (timeSavedPerTicket > 0) {
      timeReclaimed = (timeSavedPerTicket * automatedResolvedCount).toFixed(2);
    }
  }

  return {
    totalIssues: issues.length,
    avgTTFR,
    avgTTR,
    ttfrCount,
    ttrCount,
    automatedResolvedCount,
    automatedPercent,
    avgAutomatedTTR,
    avgHumanTTR,
    workflowAutomationCount,
    timeReclaimed,
    aged7Days,
    aged14Days,
    aged30Days,
    createdCount,
    resolvedCount,
    issueTypeBreakdown,
    assigneeBreakdown,
    onboardingCount
  };
}

/**
 * Fetch metrics for ISD project
 */
async function fetchISDMetrics() {
  const weeks = getWeekRanges();

  // JQL to fetch ISD issues (adjust project key and filters as needed)
  const currentWeekJQL = `project = ISD AND created >= "${weeks.currentWeek.start.toISOString().split('T')[0]}"`;
  const previousWeekJQL = `project = ISD AND created >= "${weeks.previousWeek.start.toISOString().split('T')[0]}" AND created < "${weeks.currentWeek.start.toISOString().split('T')[0]}"`;

  const currentMetrics = await calculateMetrics(currentWeekJQL, weeks.currentWeek.label);
  const previousMetrics = await calculateMetrics(previousWeekJQL, weeks.previousWeek.label);

  return {
    currentWeek: { ...weeks.currentWeek, ...currentMetrics },
    previousWeek: { ...weeks.previousWeek, ...previousMetrics }
  };
}

/**
 * Get current Confluence page content and version
 */
async function getConfluencePage() {
  const path = `/wiki/rest/api/content/${CONFLUENCE_PAGE_ID}?expand=body.storage,version`;
  return await makeRequest(JIRA_BASE_URL, path);
}

/**
 * Generate metrics table HTML
 */
function generateMetricsHTML(metrics) {
  const currentWeek = metrics.currentWeek;
  const previousWeek = metrics.previousWeek;

  const ttfrChange = calculateChange(previousWeek.avgTTFR, currentWeek.avgTTFR);
  const ttrChange = calculateChange(previousWeek.avgTTR, currentWeek.avgTTR);
  const automatedTtrChange = calculateChange(previousWeek.avgAutomatedTTR, currentWeek.avgAutomatedTTR);
  const humanTtrChange = calculateChange(previousWeek.avgHumanTTR, currentWeek.avgHumanTTR);

  const timestamp = new Date().toLocaleString();

  return `
<h2>ISD Metrics - Week over Week</h2>
<p><em>Last updated: ${timestamp}</em></p>

<table data-layout="default">
  <tbody>
    <tr>
      <th><p><strong>Metric</strong></p></th>
      <th><p><strong>${currentWeek.label}</strong></p></th>
      <th><p><strong>${previousWeek.label}</strong></p></th>
      <th><p><strong>Change</strong></p></th>
    </tr>
    <tr>
      <td><p><strong>Total Issues</strong></p></td>
      <td><p>${currentWeek.totalIssues}</p></td>
      <td><p>${previousWeek.totalIssues}</p></td>
      <td><p>${calculatePercentChange(previousWeek.totalIssues, currentWeek.totalIssues)}</p></td>
    </tr>
    <tr>
      <td><p><strong>Avg TTFR (hours)</strong></p></td>
      <td><p>${currentWeek.avgTTFR}</p></td>
      <td><p>${previousWeek.avgTTFR}</p></td>
      <td><p>${ttfrChange}</p></td>
    </tr>
    <tr>
      <td><p><strong>Issues with Response</strong></p></td>
      <td><p>${currentWeek.ttfrCount}</p></td>
      <td><p>${previousWeek.ttfrCount}</p></td>
      <td><p>${calculatePercentChange(previousWeek.ttfrCount, currentWeek.ttfrCount)}</p></td>
    </tr>
    <tr>
      <td><p><strong>Avg TTR (hours)</strong></p></td>
      <td><p>${currentWeek.avgTTR}</p></td>
      <td><p>${previousWeek.avgTTR}</p></td>
      <td><p>${ttrChange}</p></td>
    </tr>
    <tr>
      <td><p><strong>Issues Resolved</strong></p></td>
      <td><p>${currentWeek.ttrCount}</p></td>
      <td><p>${previousWeek.ttrCount}</p></td>
      <td><p>${calculatePercentChange(previousWeek.ttrCount, currentWeek.ttrCount)}</p></td>
    </tr>
    <tr>
      <td><p><strong>% Resolved Without Human Intervention</strong></p></td>
      <td><p>${currentWeek.automatedPercent}%</p></td>
      <td><p>${previousWeek.automatedPercent}%</p></td>
      <td><p>${calculatePercentagePointChange(previousWeek.automatedPercent, currentWeek.automatedPercent)}</p></td>
    </tr>
    <tr>
      <td><p><strong>Avg TTR - Automated (hours)</strong></p></td>
      <td><p>${currentWeek.avgAutomatedTTR}</p></td>
      <td><p>${previousWeek.avgAutomatedTTR}</p></td>
      <td><p>${automatedTtrChange}</p></td>
    </tr>
    <tr>
      <td><p><strong>Avg TTR - Human (hours)</strong></p></td>
      <td><p>${currentWeek.avgHumanTTR}</p></td>
      <td><p>${previousWeek.avgHumanTTR}</p></td>
      <td><p>${humanTtrChange}</p></td>
    </tr>
    <tr>
      <td><p><strong>Workflows Fully Automated</strong></p></td>
      <td><p>${currentWeek.workflowAutomationCount}</p></td>
      <td><p>${previousWeek.workflowAutomationCount}</p></td>
      <td><p>${calculatePercentChange(previousWeek.workflowAutomationCount, currentWeek.workflowAutomationCount)}</p></td>
    </tr>
    <tr>
      <td><p><strong>Human Time Reclaimed (hours)</strong></p></td>
      <td><p>${currentWeek.timeReclaimed}</p></td>
      <td><p>${previousWeek.timeReclaimed}</p></td>
      <td><p>${calculateTimeReclaimedChange(previousWeek.timeReclaimed, currentWeek.timeReclaimed)}</p></td>
    </tr>
    <tr>
      <td><p><strong>Created vs Resolved</strong></p></td>
      <td><p>${currentWeek.createdCount} / ${currentWeek.resolvedCount}</p></td>
      <td><p>${previousWeek.createdCount} / ${previousWeek.resolvedCount}</p></td>
      <td><p>-</p></td>
    </tr>
    <tr>
      <td><p><strong>Aged Tickets (7+ days)</strong></p></td>
      <td><p>${currentWeek.aged7Days}</p></td>
      <td><p>${previousWeek.aged7Days}</p></td>
      <td><p>${calculatePercentChange(previousWeek.aged7Days, currentWeek.aged7Days)}</p></td>
    </tr>
    <tr>
      <td><p><strong>Aged Tickets (14+ days)</strong></p></td>
      <td><p>${currentWeek.aged14Days}</p></td>
      <td><p>${previousWeek.aged14Days}</p></td>
      <td><p>${calculatePercentChange(previousWeek.aged14Days, currentWeek.aged14Days)}</p></td>
    </tr>
    <tr>
      <td><p><strong>Aged Tickets (30+ days)</strong></p></td>
      <td><p>${currentWeek.aged30Days}</p></td>
      <td><p>${previousWeek.aged30Days}</p></td>
      <td><p>${calculatePercentChange(previousWeek.aged30Days, currentWeek.aged30Days)}</p></td>
    </tr>
    <tr>
      <td><p><strong>Onboarding Tickets</strong></p></td>
      <td><p>${currentWeek.onboardingCount}</p></td>
      <td><p>${previousWeek.onboardingCount}</p></td>
      <td><p>${calculatePercentChange(previousWeek.onboardingCount, currentWeek.onboardingCount)}</p></td>
    </tr>
  </tbody>
</table>

${generateIssueTypeBreakdownHTML(metrics)}
${generateAssigneeBreakdownHTML(metrics)}

<hr />
`;
}

/**
 * Generate issue type breakdown HTML
 */
function generateIssueTypeBreakdownHTML(metrics) {
  const currentTypes = metrics.currentWeek.issueTypeBreakdown;
  const previousTypes = metrics.previousWeek.issueTypeBreakdown;

  const allTypes = new Set([...Object.keys(currentTypes), ...Object.keys(previousTypes)]);

  if (allTypes.size === 0) return '';

  let rows = '';
  for (const type of allTypes) {
    const currentCount = currentTypes[type] || 0;
    const previousCount = previousTypes[type] || 0;
    const currentTotal = metrics.currentWeek.resolvedCount || 1;
    const previousTotal = metrics.previousWeek.resolvedCount || 1;
    const currentPercent = ((currentCount / currentTotal) * 100).toFixed(1);
    const previousPercent = ((previousCount / previousTotal) * 100).toFixed(1);

    rows += `
    <tr>
      <td><p>${type}</p></td>
      <td><p>${currentCount} (${currentPercent}%)</p></td>
      <td><p>${previousCount} (${previousPercent}%)</p></td>
      <td><p>${calculatePercentChange(previousCount, currentCount)}</p></td>
    </tr>`;
  }

  return `
<h3>Resolved Ticket Type Breakdown</h3>
<table data-layout="default">
  <tbody>
    <tr>
      <th><p><strong>Issue Type</strong></p></th>
      <th><p><strong>${metrics.currentWeek.label}</strong></p></th>
      <th><p><strong>${metrics.previousWeek.label}</strong></p></th>
      <th><p><strong>Change</strong></p></th>
    </tr>
    ${rows}
  </tbody>
</table>
`;
}

/**
 * Generate assignee breakdown HTML
 */
function generateAssigneeBreakdownHTML(metrics) {
  const currentAssignees = metrics.currentWeek.assigneeBreakdown;
  const previousAssignees = metrics.previousWeek.assigneeBreakdown;

  const allAssignees = new Set([...Object.keys(currentAssignees), ...Object.keys(previousAssignees)]);

  if (allAssignees.size === 0) return '';

  // Sort by current count descending
  const sortedAssignees = Array.from(allAssignees).sort((a, b) => {
    return (currentAssignees[b] || 0) - (currentAssignees[a] || 0);
  });

  let rows = '';
  for (const assignee of sortedAssignees) {
    const currentCount = currentAssignees[assignee] || 0;
    const previousCount = previousAssignees[assignee] || 0;
    const currentTotal = metrics.currentWeek.totalIssues || 1;
    const previousTotal = metrics.previousWeek.totalIssues || 1;
    const currentPercent = ((currentCount / currentTotal) * 100).toFixed(1);
    const previousPercent = ((previousCount / previousTotal) * 100).toFixed(1);

    rows += `
    <tr>
      <td><p>${assignee}</p></td>
      <td><p>${currentCount} (${currentPercent}%)</p></td>
      <td><p>${previousCount} (${previousPercent}%)</p></td>
      <td><p>${calculatePercentChange(previousCount, currentCount)}</p></td>
    </tr>`;
  }

  return `
<h3>Total Tickets by Assignee</h3>
<table data-layout="default">
  <tbody>
    <tr>
      <th><p><strong>Assignee</strong></p></th>
      <th><p><strong>${metrics.currentWeek.label}</strong></p></th>
      <th><p><strong>${metrics.previousWeek.label}</strong></p></th>
      <th><p><strong>Change</strong></p></th>
    </tr>
    ${rows}
  </tbody>
</table>
`;
}

/**
 * Calculate percentage change
 */
function calculatePercentChange(oldValue, newValue) {
  if (oldValue === 0 || oldValue === 'N/A') return 'N/A';
  if (newValue === 'N/A') return 'N/A';

  const change = ((newValue - oldValue) / oldValue * 100).toFixed(1);
  const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
  return `${arrow} ${Math.abs(change)}%`;
}

/**
 * Calculate change with arrow indicator
 */
function calculateChange(oldValue, newValue) {
  if (oldValue === 'N/A' || newValue === 'N/A') return 'N/A';

  const change = newValue - oldValue;
  const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
  return `${arrow} ${Math.abs(change).toFixed(2)} hrs`;
}

/**
 * Calculate percentage point change
 */
function calculatePercentagePointChange(oldValue, newValue) {
  if (oldValue === 'N/A' || newValue === 'N/A') return 'N/A';

  const oldNum = parseFloat(oldValue);
  const newNum = parseFloat(newValue);
  const change = newNum - oldNum;
  const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
  return `${arrow} ${Math.abs(change).toFixed(1)}pp`;
}

/**
 * Calculate time reclaimed change
 */
function calculateTimeReclaimedChange(oldValue, newValue) {
  if (oldValue === 'N/A' || newValue === 'N/A') return 'N/A';

  const oldNum = parseFloat(oldValue);
  const newNum = parseFloat(newValue);
  const change = newNum - oldNum;
  const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
  return `${arrow} ${Math.abs(change).toFixed(2)} hrs`;
}

/**
 * Update Confluence page with new metrics
 */
async function updateConfluencePage(metricsHTML) {
  console.log('\nFetching current Confluence page...');
  const page = await getConfluencePage();

  const currentBody = page.body.storage.value;
  const newVersion = page.version.number + 1;

  // Prepend new metrics to existing content
  const updatedBody = metricsHTML + currentBody;

  console.log('Updating Confluence page...');
  const path = `/wiki/rest/api/content/${CONFLUENCE_PAGE_ID}`;
  const updateData = {
    id: CONFLUENCE_PAGE_ID,
    type: 'page',
    title: page.title,
    space: { key: CONFLUENCE_SPACE_KEY },
    body: {
      storage: {
        value: updatedBody,
        representation: 'storage'
      }
    },
    version: {
      number: newVersion,
      message: 'Automated weekly metrics update'
    }
  };

  await makeRequest(JIRA_BASE_URL, path, 'PUT', updateData);
  console.log('✓ Confluence page updated successfully!');
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('=== ISD Metrics Automation ===');

    const metrics = await fetchISDMetrics();

    console.log('\n=== Metrics Summary ===');
    console.log(`Current Week (${metrics.currentWeek.label}):`);
    console.log(`  Total Issues: ${metrics.currentWeek.totalIssues}`);
    console.log(`  Avg TTFR: ${metrics.currentWeek.avgTTFR} hours (${metrics.currentWeek.ttfrCount} issues)`);
    console.log(`  Avg TTR: ${metrics.currentWeek.avgTTR} hours (${metrics.currentWeek.ttrCount} issues)`);
    console.log(`  % Resolved Without Human: ${metrics.currentWeek.automatedPercent}%`);
    console.log(`  Avg TTR - Automated: ${metrics.currentWeek.avgAutomatedTTR} hours`);
    console.log(`  Avg TTR - Human: ${metrics.currentWeek.avgHumanTTR} hours`);
    console.log(`  Workflows Automated: ${metrics.currentWeek.workflowAutomationCount}`);
    console.log(`  Human Time Reclaimed: ${metrics.currentWeek.timeReclaimed} hours`);

    console.log(`\nPrevious Week (${metrics.previousWeek.label}):`);
    console.log(`  Total Issues: ${metrics.previousWeek.totalIssues}`);
    console.log(`  Avg TTFR: ${metrics.previousWeek.avgTTFR} hours (${metrics.previousWeek.ttfrCount} issues)`);
    console.log(`  Avg TTR: ${metrics.previousWeek.avgTTR} hours (${metrics.previousWeek.ttrCount} issues)`);
    console.log(`  % Resolved Without Human: ${metrics.previousWeek.automatedPercent}%`);
    console.log(`  Avg TTR - Automated: ${metrics.previousWeek.avgAutomatedTTR} hours`);
    console.log(`  Avg TTR - Human: ${metrics.previousWeek.avgHumanTTR} hours`);
    console.log(`  Workflows Automated: ${metrics.previousWeek.workflowAutomationCount}`);
    console.log(`  Human Time Reclaimed: ${metrics.previousWeek.timeReclaimed} hours`);

    const metricsHTML = generateMetricsHTML(metrics);
    await updateConfluencePage(metricsHTML);

    console.log('\n✓ All done!');
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
