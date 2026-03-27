#!/usr/bin/env node

/**
 * Weekly IT Ops Analyst Report
 * Generates executive-style analysis and insights from weekly metrics
 */

const https = require('https');
const fs = require('fs');

// Configuration
const JIRA_BASE_URL = 'attentivemobile.atlassian.net';
const CONFLUENCE_PAGE_ID = '6424363046'; // Weekly Analyst Report page
const CONFLUENCE_SPACE_KEY = 'ISD';

// Environment variables
const ATLASSIAN_EMAIL = process.env.ATLASSIAN_EMAIL;
const ATLASSIAN_API_TOKEN = process.env.ATLASSIAN_API_TOKEN;

if (!ATLASSIAN_EMAIL || !ATLASSIAN_API_TOKEN) {
  console.error('Error: ATLASSIAN_EMAIL and ATLASSIAN_API_TOKEN environment variables are required');
  process.exit(1);
}

const AUTH_HEADER = 'Basic ' + Buffer.from(`${ATLASSIAN_EMAIL}:${ATLASSIAN_API_TOKEN}`).toString('base64');

/**
 * Make HTTPS request
 */
function makeRequest(hostname, path, method = 'GET', data = null, additionalHeaders = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...additionalHeaders
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(responseData));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

/**
 * Generate executive analyst report HTML
 */
function generateAnalystReportHTML(currentMetrics, previousMetrics) {
  const timestamp = new Date().toLocaleString();

  // Calculate key changes
  const volumeChange = currentMetrics.resolvedCount - previousMetrics.resolvedCount;
  const volumeChangePercent = previousMetrics.resolvedCount > 0
    ? ((volumeChange / previousMetrics.resolvedCount) * 100).toFixed(1)
    : 'N/A';

  const slaChange = parseFloat(currentMetrics.overallSlaPercent) - parseFloat(previousMetrics.overallSlaPercent);

  return `
<h1>IT Ops Weekly Analyst Report</h1>
<p><em>Period: ${currentMetrics.period} | Generated: ${timestamp}</em></p>
<p><strong>🔗 Related:</strong> <a href="https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6423805982">Weekly Metrics Dashboard</a></p>

<hr />

<h2>1. Executive Summary</h2>
<ul>
  <li><strong>Volume:</strong> IT resolved ${currentMetrics.resolvedCount} tickets this week (${volumeChangePercent > 0 ? '+' : ''}${volumeChangePercent}% WoW), ${currentMetrics.createdCount} created</li>
  <li><strong>SLA Performance:</strong> ${currentMetrics.overallSlaPercent}% SLA achievement (${slaChange > 0 ? '+' : ''}${slaChange.toFixed(1)}pp WoW)</li>
  <li><strong>Customer Satisfaction:</strong> CSAT ${currentMetrics.csat.avgScore}/5.0 from ${currentMetrics.csat.totalResponses} reviews</li>
  <li><strong>Automation:</strong> ${currentMetrics.automationPercent}% of tickets handled without human intervention</li>
  <li><strong>Workforce Impact:</strong> ${currentMetrics.workforce?.totalOnboarding || 0} onboarded (${currentMetrics.workforce?.fteOnboarding || 0} FTE, ${currentMetrics.workforce?.contractorOnboarding || 0} contractors), ${currentMetrics.workforce?.offboarding || 0} offboarded</li>
</ul>

<hr />

<h2>2. Key Trends & Insights</h2>

<h3>Volume Analysis</h3>
<p><strong>Current Week:</strong> ${currentMetrics.resolvedCount} resolved, ${currentMetrics.createdCount} created (${currentMetrics.createdCount > currentMetrics.resolvedCount ? 'backlog growing' : 'backlog reducing'})</p>
<p><strong>Week-over-Week:</strong> ${volumeChange > 0 ? 'Increased' : 'Decreased'} by ${Math.abs(volumeChange)} tickets (${Math.abs(volumeChangePercent)}%)</p>

<h3>Performance Trends</h3>
<ul>
  <li><strong>TTFR:</strong> ${currentMetrics.avgTTFR} avg (target: 2h) - ${parseFloat(currentMetrics.avgTTFR) <= 2 ? '✅ Within SLA' : '⚠️ Above target'}</li>
  <li><strong>TTR:</strong> ${currentMetrics.avgTTR} avg (target: 16h) - ${parseFloat(currentMetrics.avgTTR.replace(/[^0-9.]/g, '')) <= 16 ? '✅ Within SLA' : '⚠️ Above target'}</li>
  <li><strong>SLA Breaches:</strong> ${currentMetrics.slaBreachCount} tickets (${currentMetrics.slaBreachPercent}% breach rate)</li>
</ul>

<h3>Demand Patterns</h3>
<ul>
  <li><strong>Top Department:</strong> ${currentMetrics.departmentBreakdown[0]?.[0] || 'N/A'} (${currentMetrics.departmentBreakdown[0]?.[1] || 0} tickets)</li>
  <li><strong>Top SaaS App:</strong> ${currentMetrics.saasAppCounts[0]?.[0] || 'N/A'} (${currentMetrics.saasAppCounts[0]?.[1] || 0} requests)</li>
  <li><strong>Access Requests:</strong> ${currentMetrics.accessRequestCount} total</li>
</ul>

<hr />

<h2>3. Operational Risks</h2>

<h3>Current Risks</h3>
<ul>
  <li><strong>SLA Exposure:</strong> ${currentMetrics.slaBreachCount} breaches this week - review approval workflows and dependencies</li>
  <li><strong>Automation Rate:</strong> ${currentMetrics.automationPercent}% - ${parseFloat(currentMetrics.automationPercent) < 5 ? '⚠️ Below target, opportunity to expand coverage' : '✅ Healthy automation coverage'}</li>
  <li><strong>Volume vs Capacity:</strong> ${currentMetrics.createdCount > currentMetrics.resolvedCount ? '⚠️ Backlog growing - monitor capacity constraints' : '✅ Keeping pace with demand'}</li>
</ul>

<h3>Workforce Risks</h3>
<ul>
  <li><strong>Net Headcount:</strong> ${currentMetrics.workforce?.netChange > 0 ? '+' : ''}${currentMetrics.workforce?.netChange || 0} this week</li>
  <li><strong>Team Availability:</strong> Review engineer workload distribution in metrics dashboard</li>
</ul>

<hr />

<h2>4. Root Cause Analysis</h2>

<h3>SLA Breach Drivers</h3>
<p><strong>Within IT Control:</strong></p>
<ul>
  <li>Response time: ${currentMetrics.avgTTFR} (${parseFloat(currentMetrics.avgTTFR) > 2 ? 'above 2h target - review staffing and round robin' : 'meeting target'})</li>
  <li>Resolution efficiency: Automated tickets resolve faster (review manual workflow bottlenecks)</li>
</ul>

<p><strong>Outside IT Control:</strong></p>
<ul>
  <li>Approval-dependent workflows (Snowflake, GitHub, Gong access) - delays from approvers</li>
  <li>Vendor response times - external dependencies impacting TTR</li>
</ul>

<h3>Volume Drivers</h3>
<ul>
  <li><strong>Onboarding:</strong> ${currentMetrics.workforce?.totalOnboarding || 0} new employees this week driving access request volume</li>
  <li><strong>Department Concentration:</strong> ${currentMetrics.departmentBreakdown[0]?.[0] || 'N/A'} represents highest demand - review for automation opportunities</li>
</ul>

<hr />

<h2>5. Actions & Opportunities</h2>

<h3>Immediate Actions (This Week)</h3>
<ul>
  <li>Review ${currentMetrics.slaBreachCount} SLA breach tickets - identify common patterns</li>
  <li>Monitor backlog if created > resolved (${currentMetrics.createdCount} vs ${currentMetrics.resolvedCount})</li>
  <li>Verify round robin distribution is balanced across active engineers</li>
</ul>

<h3>Process Improvements (Next 2-4 Weeks)</h3>
<ul>
  <li><strong>Automation Expansion:</strong> Current ${currentMetrics.automationPercent}% - target repetitive workflows in ${currentMetrics.departmentBreakdown[0]?.[0] || 'top department'}</li>
  <li><strong>Approval Workflow Optimization:</strong> Partner with approvers to streamline governance for ${currentMetrics.saasAppCounts[0]?.[0] || 'top apps'}</li>
  <li><strong>Self-Service Enablement:</strong> Reduce ticket volume by creating documentation/automation for common requests</li>
</ul>

<h3>Leadership Support Required</h3>
<ul>
  <li>If SLA breaches persist: Review approval SLAs with department heads</li>
  <li>If automation rate < 5%: Investment in automation tooling/development time</li>
  <li>If workforce net change is negative: Monitor impact on service levels and capacity planning</li>
</ul>

<hr />

<h2>6. Weekly Notables</h2>
<p><strong>Significant incidents, issues, or events from this week:</strong></p>

<h3>Mar 17, 2026 - Ticket Clock Cleanup (Metrics Impact)</h3>
<p><strong>Issue:</strong> Slack alerts triggered for old 2024 tickets with time clocks still running</p>
<ul>
  <li><strong>Impact:</strong> 221+ canceled/old tickets had active time tracking, causing confusion and alerts</li>
  <li><strong>Metrics Impact:</strong> ⚠️ <strong>Skewed TTR and time tracking data</strong> - cleanup of old running clocks affected weekly/monthly averages</li>
  <li><strong>Root Cause:</strong> Time clocks not automatically stopped when tickets were canceled by automation or reporters</li>
  <li><strong>Resolution:</strong> Manual cleanup initiated - correcting time tracking on old tickets</li>
  <li><strong>Risk:</strong> Mass updates may trigger notifications to all ticket participants (reporters, watchers)</li>
  <li><strong>Action Item:</strong> Review automation workflows to ensure time tracking stops when tickets are canceled</li>
  <li><strong>Data Quality:</strong> Consider normalizing metrics for this period or adding footnote to reports about data cleanup impact</li>
</ul>

<p><em>Add new notables each week to track incidents, changes, and important events</em></p>

<hr />

<p><em>📊 For detailed metrics and breakdowns, see the <a href="https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6423805982">Weekly Metrics Dashboard</a></em></p>
`;
}

/**
 * Get current Confluence page
 */
async function getConfluencePage() {
  const path = `/wiki/rest/api/content/${CONFLUENCE_PAGE_ID}?expand=body.storage,version`;
  return await makeRequest(JIRA_BASE_URL, path, 'GET', null, {
    'Authorization': AUTH_HEADER
  });
}

/**
 * Update Confluence page
 */
async function updateConfluencePage(html) {
  try {
    console.log('Fetching current Confluence page...');
    const page = await getConfluencePage();
    const currentVersion = page.version.number;

    console.log(`Current page version: ${currentVersion}`);
    console.log('Updating Confluence page...');

    const updateData = {
      version: {
        number: currentVersion + 1
      },
      title: page.title,
      type: 'page',
      body: {
        storage: {
          value: html,
          representation: 'storage'
        }
      }
    };

    const path = `/wiki/rest/api/content/${CONFLUENCE_PAGE_ID}`;
    await makeRequest(JIRA_BASE_URL, path, 'PUT', updateData, {
      'Authorization': AUTH_HEADER
    });

    console.log('✓ Confluence page updated successfully');
    console.log(`  Page ID: ${CONFLUENCE_PAGE_ID}`);
    console.log(`  New version: ${currentVersion + 1}`);
    console.log(`  URL: https://${JIRA_BASE_URL}/wiki/spaces/${CONFLUENCE_SPACE_KEY}/pages/${CONFLUENCE_PAGE_ID}`);

    return true;
  } catch (error) {
    console.error('✗ Failed to update Confluence page:', error.message);
    return false;
  }
}

/**
 * Fetch weekly metrics data (simplified - reuse logic from weekly script)
 */
async function fetchWeeklyMetrics() {
  // This uses sample data for now
  // TODO: Integrate with actual weekly metrics collection
  console.log('⚠️  Note: Using sample data for now');
  console.log('Run ./run-weekly.sh first to collect latest metrics\n');

  return {
    period: 'Mar 20-27, 2026',
    resolvedCount: 137,
    createdCount: 145,
    overallSlaPercent: '95.4',
    avgTTFR: '24m',
    avgTTR: '8h 15m',
    slaBreachCount: 6,
    slaBreachPercent: '4.6',
    automationPercent: '1.5',
    accessRequestCount: 78,
    csat: { avgScore: '5.00', totalResponses: 19 },
    workforce: { fteOnboarding: 4, contractorOnboarding: 3, totalOnboarding: 7, offboarding: 6, netChange: 1 },
    departmentBreakdown: [['Engineering', 46], ['Sales', 20]],
    saasAppCounts: [['ChatGPT', 7], ['Snowflake', 5]]
  };
}

async function main() {
  console.log('=== Weekly IT Ops Analyst Report Generator ===\n');

  const currentMetrics = await fetchWeeklyMetrics();
  const previousMetrics = await fetchWeeklyMetrics(); // Would fetch previous week

  const html = generateAnalystReportHTML(currentMetrics, previousMetrics);

  // Save to desktop
  const outputPath = `/Users/arlynngalang/Desktop/ISD_Weekly_Analyst_Report_${new Date().toISOString().split('T')[0]}.html`;
  fs.writeFileSync(outputPath, html);
  console.log(`✓ Analyst report saved to ${outputPath}`);

  // Update Confluence page
  console.log('\nAttempting Confluence update...');
  const updated = await updateConfluencePage(html);

  if (!updated) {
    console.log('\n📋 Manual steps:');
    console.log(`  1. Open: https://${JIRA_BASE_URL}/wiki/spaces/${CONFLUENCE_SPACE_KEY}/pages/${CONFLUENCE_PAGE_ID}`);
    console.log(`  2. Edit the page`);
    console.log(`  3. Paste HTML from: ${outputPath}`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
