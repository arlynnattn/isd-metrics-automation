#!/usr/bin/env node

/**
 * ISD Monthly Metrics Automation
 * Fetches monthly metrics from Jira and Slack, updates Confluence page
 * Matches IT Ops Metrics dashboard format
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const JIRA_BASE_URL = 'attentivemobile.atlassian.net';
const CONFLUENCE_PAGE_ID = '6415089689';
const CONFLUENCE_SPACE_KEY = 'ISD';
const SLACK_CHANNEL_ID = 'CTHCKD6J2'; // #ask-it
const SLACK_API_BASE = 'slack.com';

// SLA Targets
const TTFR_SLA_HOURS = 2;
const TTR_SLA_HOURS = 16;

// Environment variables
const ATLASSIAN_EMAIL = process.env.ATLASSIAN_EMAIL;
const ATLASSIAN_API_TOKEN = process.env.ATLASSIAN_API_TOKEN;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;

if (!ATLASSIAN_EMAIL || !ATLASSIAN_API_TOKEN) {
  console.error('Error: ATLASSIAN_EMAIL and ATLASSIAN_API_TOKEN environment variables are required');
  process.exit(1);
}

if (!SLACK_BOT_TOKEN) {
  console.error('Error: SLACK_BOT_TOKEN environment variable is required');
  process.exit(1);
}

const AUTH_HEADER = 'Basic ' + Buffer.from(`${ATLASSIAN_EMAIL}:${ATLASSIAN_API_TOKEN}`).toString('base64');

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
 * Get date range for current and previous month
 */
function getMonthRanges() {
  const now = new Date();

  // Current month start
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = now;

  // Previous month start and end
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];

  return {
    currentMonth: {
      start: currentMonthStart,
      end: currentMonthEnd,
      label: `${monthNames[currentMonthStart.getMonth()]} ${currentMonthStart.getFullYear()}`
    },
    previousMonth: {
      start: previousMonthStart,
      end: previousMonthEnd,
      label: `${monthNames[previousMonthStart.getMonth()]} ${previousMonthStart.getFullYear()}`
    }
  };
}

/**
 * Calculate monthly metrics from Jira issues
 */
async function calculateMonthlyMetrics(jql, monthLabel) {
  console.log(`\nFetching issues for ${monthLabel}...`);

  const path = `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=1000&fields=created,resolutiondate,comment,assignee,labels,issuetype,status,updated`;
  const response = await makeRequest(JIRA_BASE_URL, path, 'GET', null, {
    'Authorization': AUTH_HEADER
  });

  const issues = response.issues || [];
  console.log(`Found ${issues.length} issues`);

  const AUTOMATION_ACCOUNT = 'Attentive Jira OKTA Workflow Automation Account';
  const now = new Date();

  let ttfrSum = 0;
  let ttfrCount = 0;
  let ttfrSlaMetCount = 0;
  let ttrSum = 0;
  let ttrCount = 0;
  let ttrSlaMetCount = 0;
  let automatedResolvedCount = 0;
  let automatedTtrSum = 0;
  let automatedTtrCount = 0;
  let humanTtrSum = 0;
  let humanTtrCount = 0;
  let workflowAutomationCount = 0;
  let totalResolved = 0;

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
    if (issue.fields.comment && issue.fields.comment.comments.length > 0) {
      const firstComment = issue.fields.comment.comments[0];
      const firstResponseTime = new Date(firstComment.created);
      const ttfr = (firstResponseTime - created) / (1000 * 60 * 60); // hours
      if (ttfr >= 0) {
        ttfrSum += ttfr;
        ttfrCount++;
        if (ttfr <= TTFR_SLA_HOURS) {
          ttfrSlaMetCount++;
        }
      }
    }

    // Calculate TTR (Time to Resolution)
    if (issue.fields.resolutiondate) {
      totalResolved++;
      resolvedCount++;
      const resolved = new Date(issue.fields.resolutiondate);
      const ttr = (resolved - created) / (1000 * 60 * 60); // hours
      if (ttr >= 0) {
        ttrSum += ttr;
        ttrCount++;
        if (ttr <= TTR_SLA_HOURS) {
          ttrSlaMetCount++;
        }

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
  const ttfrSlaPercent = ttfrCount > 0 ? ((ttfrSlaMetCount / ttfrCount) * 100).toFixed(1) : 'N/A';
  const ttrSlaPercent = ttrCount > 0 ? ((ttrSlaMetCount / ttrCount) * 100).toFixed(1) : 'N/A';

  // Calculate overall SLA met % (average of TTFR and TTR SLA)
  let overallSlaPercent = 'N/A';
  if (ttfrSlaPercent !== 'N/A' && ttrSlaPercent !== 'N/A') {
    overallSlaPercent = (((parseFloat(ttfrSlaPercent) + parseFloat(ttrSlaPercent)) / 2)).toFixed(1);
  }

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
    totalResolved,
    avgTTFR,
    avgTTR,
    ttfrCount,
    ttrCount,
    ttfrSlaPercent,
    ttrSlaPercent,
    overallSlaPercent,
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
 * Fetch Slack metrics for #ask-it
 */
async function fetchSlackMetrics(startDate, endDate, monthLabel) {
  console.log(`\nFetching Slack metrics for ${monthLabel}...`);

  const oldest = Math.floor(startDate.getTime() / 1000);
  const latest = Math.floor(endDate.getTime() / 1000);

  const path = `/api/conversations.history?channel=${SLACK_CHANNEL_ID}&oldest=${oldest}&latest=${latest}&limit=1000`;

  try {
    const response = await makeRequest(SLACK_API_BASE, path, 'GET', null, {
      'Authorization': `Bearer ${SLACK_BOT_TOKEN}`
    });

    if (!response.ok) {
      console.error(`Slack API error: ${response.error}`);
      return { messageCount: 'N/A', uniqueUsers: 'N/A' };
    }

    const messages = response.messages || [];
    const users = new Set();

    for (const msg of messages) {
      if (msg.user && msg.type === 'message' && !msg.subtype) {
        users.add(msg.user);
      }
    }

    console.log(`  Messages: ${messages.length}`);
    console.log(`  Unique users: ${users.size}`);

    return {
      messageCount: messages.length,
      uniqueUsers: users.size
    };
  } catch (error) {
    console.error(`Error fetching Slack metrics: ${error.message}`);
    return { messageCount: 'N/A', uniqueUsers: 'N/A' };
  }
}

/**
 * Read CSAT from config file
 */
function readCSAT() {
  try {
    const configPath = path.join(__dirname, 'csat-config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    return config.monthly_csat || 'N/A';
  } catch (error) {
    console.warn('Warning: Could not read CSAT config file:', error.message);
    return 'N/A';
  }
}

/**
 * Fetch metrics for ISD project
 */
async function fetchISDMonthlyMetrics() {
  const months = getMonthRanges();

  // JQL to fetch ISD issues
  const currentMonthJQL = `project = ISD AND created >= "${months.currentMonth.start.toISOString().split('T')[0]}"`;
  const previousMonthJQL = `project = ISD AND created >= "${months.previousMonth.start.toISOString().split('T')[0]}" AND created < "${months.currentMonth.start.toISOString().split('T')[0]}"`;

  const currentMetrics = await calculateMonthlyMetrics(currentMonthJQL, months.currentMonth.label);
  const previousMetrics = await calculateMonthlyMetrics(previousMonthJQL, months.previousMonth.label);

  const currentSlack = await fetchSlackMetrics(months.currentMonth.start, months.currentMonth.end, months.currentMonth.label);
  const previousSlack = await fetchSlackMetrics(months.previousMonth.start, months.previousMonth.end, months.previousMonth.label);

  // Add CSAT from config
  const csat = readCSAT();

  return {
    currentMonth: { ...months.currentMonth, ...currentMetrics, ...currentSlack, csat },
    previousMonth: { ...months.previousMonth, ...previousMetrics, ...previousSlack, csat }
  };
}

/**
 * Get current Confluence page content and version
 */
async function getConfluencePage() {
  const path = `/wiki/rest/api/content/${CONFLUENCE_PAGE_ID}?expand=body.storage,version`;
  return await makeRequest(JIRA_BASE_URL, path, 'GET', null, {
    'Authorization': AUTH_HEADER
  });
}

/**
 * Calculate percentage change with MoM indicator
 */
function calculateMoMChange(oldValue, newValue) {
  if (oldValue === 0 || oldValue === 'N/A') return 'N/A';
  if (newValue === 'N/A') return 'N/A';

  const change = ((newValue - oldValue) / oldValue * 100).toFixed(1);
  const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
  const sign = change > 0 ? '+' : '';
  return `<span style="color: ${change < 0 ? 'green' : change > 0 ? 'red' : 'gray'};">${sign}${change}% MoM</span>`;
}

/**
 * Generate metrics HTML matching IT Ops dashboard format
 */
function generateMonthlyMetricsHTML(metrics) {
  const current = metrics.currentMonth;
  const previous = metrics.previousMonth;

  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

  const resolvedChange = calculateMoMChange(previous.totalResolved, current.totalResolved);
  const ttfrChange = calculateMoMChange(previous.avgTTFR, current.avgTTFR);
  const ttrChange = calculateMoMChange(previous.avgTTR, current.avgTTR);
  const slaChange = calculateMoMChange(previous.overallSlaPercent, current.overallSlaPercent);
  const slackMsgsChange = calculateMoMChange(previous.messageCount, current.messageCount);

  return `
<h2>ISD Metrics - ${current.label}</h2>
<p><em>Last updated: ${timestamp}</em></p>

<table data-layout="default" style="width: 100%;">
  <tbody>
    <tr>
      <th style="background-color: #f4f5f7;"><p><strong>Metric</strong></p></th>
      <th style="background-color: #f4f5f7;"><p><strong>${current.label}</strong></p></th>
      <th style="background-color: #f4f5f7;"><p><strong>${previous.label}</strong></p></th>
      <th style="background-color: #f4f5f7;"><p><strong>Change</strong></p></th>
    </tr>
    <tr>
      <td><p><strong>Resolved</strong></p></td>
      <td><p>${current.totalResolved}</p></td>
      <td><p>${previous.totalResolved}</p></td>
      <td><p>${resolvedChange}</p></td>
    </tr>
    <tr>
      <td><p><strong>TTFR (SLA ${TTFR_SLA_HOURS} hrs)</strong></p></td>
      <td><p>${current.avgTTFR} hrs<br/><em>${current.ttfrSlaPercent}% met SLA</em></p></td>
      <td><p>${previous.avgTTFR} hrs<br/><em>${previous.ttfrSlaPercent}% met SLA</em></p></td>
      <td><p>${ttfrChange}</p></td>
    </tr>
    <tr>
      <td><p><strong>Avg TTR (SLA ${TTR_SLA_HOURS} hrs)</strong></p></td>
      <td><p>${current.avgTTR} hrs<br/><em>${current.ttrSlaPercent}% met SLA</em></p></td>
      <td><p>${previous.avgTTR} hrs<br/><em>${previous.ttrSlaPercent}% met SLA</em></p></td>
      <td><p>${ttrChange}</p></td>
    </tr>
    <tr>
      <td><p><strong>SLA met</strong></p></td>
      <td><p>${current.overallSlaPercent}%</p></td>
      <td><p>${previous.overallSlaPercent}%</p></td>
      <td><p>${slaChange}</p></td>
    </tr>
    <tr>
      <td><p><strong>#ask-it</strong></p></td>
      <td><p>${current.messageCount} msgs<br/>${current.uniqueUsers} users</p></td>
      <td><p>${previous.messageCount} msgs<br/>${previous.uniqueUsers} users</p></td>
      <td><p>${slackMsgsChange}</p></td>
    </tr>
    <tr>
      <td><p><strong>Team CSAT</strong></p></td>
      <td><p>${current.csat}</p></td>
      <td><p>${previous.csat}</p></td>
      <td><p>-</p></td>
    </tr>
    <tr style="background-color: #e3fcef;">
      <td><p><strong>% Resolved Without Human</strong></p></td>
      <td><p>${current.automatedPercent}%</p></td>
      <td><p>${previous.automatedPercent}%</p></td>
      <td><p>${calculateMoMChange(previous.automatedPercent, current.automatedPercent)}</p></td>
    </tr>
    <tr style="background-color: #e3fcef;">
      <td><p><strong>Avg TTR - Automated</strong></p></td>
      <td><p>${current.avgAutomatedTTR} hrs</p></td>
      <td><p>${previous.avgAutomatedTTR} hrs</p></td>
      <td><p>${calculateMoMChange(previous.avgAutomatedTTR, current.avgAutomatedTTR)}</p></td>
    </tr>
    <tr style="background-color: #e3fcef;">
      <td><p><strong>Avg TTR - Human</strong></p></td>
      <td><p>${current.avgHumanTTR} hrs</p></td>
      <td><p>${previous.avgHumanTTR} hrs</p></td>
      <td><p>${calculateMoMChange(previous.avgHumanTTR, current.avgHumanTTR)}</p></td>
    </tr>
    <tr style="background-color: #e3fcef;">
      <td><p><strong>Workflows Automated</strong></p></td>
      <td><p>${current.workflowAutomationCount}</p></td>
      <td><p>${previous.workflowAutomationCount}</p></td>
      <td><p>${calculateMoMChange(previous.workflowAutomationCount, current.workflowAutomationCount)}</p></td>
    </tr>
    <tr style="background-color: #e3fcef;">
      <td><p><strong>Human Time Reclaimed</strong></p></td>
      <td><p>${current.timeReclaimed} hrs</p></td>
      <td><p>${previous.timeReclaimed} hrs</p></td>
      <td><p>${calculateMoMChange(previous.timeReclaimed, current.timeReclaimed)}</p></td>
    </tr>
    <tr>
      <td><p><strong>Created vs Resolved</strong></p></td>
      <td><p>${current.createdCount} / ${current.resolvedCount}</p></td>
      <td><p>${previous.createdCount} / ${previous.resolvedCount}</p></td>
      <td><p>-</p></td>
    </tr>
    <tr>
      <td><p><strong>Aged Tickets (7+ days)</strong></p></td>
      <td><p>${current.aged7Days}</p></td>
      <td><p>${previous.aged7Days}</p></td>
      <td><p>${calculateMoMChange(previous.aged7Days, current.aged7Days)}</p></td>
    </tr>
    <tr>
      <td><p><strong>Aged Tickets (14+ days)</strong></p></td>
      <td><p>${current.aged14Days}</p></td>
      <td><p>${previous.aged14Days}</p></td>
      <td><p>${calculateMoMChange(previous.aged14Days, current.aged14Days)}</p></td>
    </tr>
    <tr>
      <td><p><strong>Aged Tickets (30+ days)</strong></p></td>
      <td><p>${current.aged30Days}</p></td>
      <td><p>${previous.aged30Days}</p></td>
      <td><p>${calculateMoMChange(previous.aged30Days, current.aged30Days)}</p></td>
    </tr>
    <tr>
      <td><p><strong>Onboarding Tickets</strong></p></td>
      <td><p>${current.onboardingCount}</p></td>
      <td><p>${previous.onboardingCount}</p></td>
      <td><p>${calculateMoMChange(previous.onboardingCount, current.onboardingCount)}</p></td>
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
  const currentTypes = metrics.currentMonth.issueTypeBreakdown;
  const previousTypes = metrics.previousMonth.issueTypeBreakdown;

  const allTypes = new Set([...Object.keys(currentTypes), ...Object.keys(previousTypes)]);

  if (allTypes.size === 0) return '';

  let rows = '';
  for (const type of allTypes) {
    const currentCount = currentTypes[type] || 0;
    const previousCount = previousTypes[type] || 0;
    const currentTotal = metrics.currentMonth.resolvedCount || 1;
    const previousTotal = metrics.previousMonth.resolvedCount || 1;
    const currentPercent = ((currentCount / currentTotal) * 100).toFixed(1);
    const previousPercent = ((previousCount / previousTotal) * 100).toFixed(1);

    rows += `
    <tr>
      <td><p>${type}</p></td>
      <td><p>${currentCount} (${currentPercent}%)</p></td>
      <td><p>${previousCount} (${previousPercent}%)</p></td>
      <td><p>${calculateMoMChange(previousCount, currentCount)}</p></td>
    </tr>`;
  }

  return `
<h3>Resolved Ticket Type Breakdown</h3>
<table data-layout="default">
  <tbody>
    <tr>
      <th style="background-color: #f4f5f7;"><p><strong>Issue Type</strong></p></th>
      <th style="background-color: #f4f5f7;"><p><strong>${metrics.currentMonth.label}</strong></p></th>
      <th style="background-color: #f4f5f7;"><p><strong>${metrics.previousMonth.label}</strong></p></th>
      <th style="background-color: #f4f5f7;"><p><strong>Change</strong></p></th>
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
  const currentAssignees = metrics.currentMonth.assigneeBreakdown;
  const previousAssignees = metrics.previousMonth.assigneeBreakdown;

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
    const currentTotal = metrics.currentMonth.totalIssues || 1;
    const previousTotal = metrics.previousMonth.totalIssues || 1;
    const currentPercent = ((currentCount / currentTotal) * 100).toFixed(1);
    const previousPercent = ((previousCount / previousTotal) * 100).toFixed(1);

    rows += `
    <tr>
      <td><p>${assignee}</p></td>
      <td><p>${currentCount} (${currentPercent}%)</p></td>
      <td><p>${previousCount} (${previousPercent}%)</p></td>
      <td><p>${calculateMoMChange(previousCount, currentCount)}</p></td>
    </tr>`;
  }

  return `
<h3>Total Tickets by Assignee</h3>
<table data-layout="default">
  <tbody>
    <tr>
      <th style="background-color: #f4f5f7;"><p><strong>Assignee</strong></p></th>
      <th style="background-color: #f4f5f7;"><p><strong>${metrics.currentMonth.label}</strong></p></th>
      <th style="background-color: #f4f5f7;"><p><strong>${metrics.previousMonth.label}</strong></p></th>
      <th style="background-color: #f4f5f7;"><p><strong>Change</strong></p></th>
    </tr>
    ${rows}
  </tbody>
</table>
`;
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
      message: 'Automated monthly metrics update'
    }
  };

  await makeRequest(JIRA_BASE_URL, path, 'PUT', updateData, {
    'Authorization': AUTH_HEADER
  });
  console.log('✓ Confluence page updated successfully!');
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('=== ISD Monthly Metrics Automation ===');

    const metrics = await fetchISDMonthlyMetrics();

    console.log('\n=== Monthly Metrics Summary ===');
    console.log(`Current Month (${metrics.currentMonth.label}):`);
    console.log(`  Total Issues: ${metrics.currentMonth.totalIssues}`);
    console.log(`  Resolved: ${metrics.currentMonth.totalResolved}`);
    console.log(`  Avg TTFR: ${metrics.currentMonth.avgTTFR} hours (${metrics.currentMonth.ttfrSlaPercent}% met SLA)`);
    console.log(`  Avg TTR: ${metrics.currentMonth.avgTTR} hours (${metrics.currentMonth.ttrSlaPercent}% met SLA)`);
    console.log(`  Overall SLA Met: ${metrics.currentMonth.overallSlaPercent}%`);
    console.log(`  #ask-it: ${metrics.currentMonth.messageCount} msgs, ${metrics.currentMonth.uniqueUsers} users`);
    console.log(`  % Resolved Without Human: ${metrics.currentMonth.automatedPercent}%`);
    console.log(`  Avg TTR - Automated: ${metrics.currentMonth.avgAutomatedTTR} hours`);
    console.log(`  Avg TTR - Human: ${metrics.currentMonth.avgHumanTTR} hours`);
    console.log(`  Workflows Automated: ${metrics.currentMonth.workflowAutomationCount}`);
    console.log(`  Human Time Reclaimed: ${metrics.currentMonth.timeReclaimed} hours`);

    console.log(`\nPrevious Month (${metrics.previousMonth.label}):`);
    console.log(`  Total Issues: ${metrics.previousMonth.totalIssues}`);
    console.log(`  Resolved: ${metrics.previousMonth.totalResolved}`);
    console.log(`  Avg TTFR: ${metrics.previousMonth.avgTTFR} hours (${metrics.previousMonth.ttfrSlaPercent}% met SLA)`);
    console.log(`  Avg TTR: ${metrics.previousMonth.avgTTR} hours (${metrics.previousMonth.ttrSlaPercent}% met SLA)`);
    console.log(`  Overall SLA Met: ${metrics.previousMonth.overallSlaPercent}%`);
    console.log(`  #ask-it: ${metrics.previousMonth.messageCount} msgs, ${metrics.previousMonth.uniqueUsers} users`);
    console.log(`  % Resolved Without Human: ${metrics.previousMonth.automatedPercent}%`);
    console.log(`  Avg TTR - Automated: ${metrics.previousMonth.avgAutomatedTTR} hours`);
    console.log(`  Avg TTR - Human: ${metrics.previousMonth.avgHumanTTR} hours`);
    console.log(`  Workflows Automated: ${metrics.previousMonth.workflowAutomationCount}`);
    console.log(`  Human Time Reclaimed: ${metrics.previousMonth.timeReclaimed} hours`);

    const metricsHTML = generateMonthlyMetricsHTML(metrics);
    await updateConfluencePage(metricsHTML);

    console.log('\n✓ All done!');
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
