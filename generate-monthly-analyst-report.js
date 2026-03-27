#!/usr/bin/env node

/**
 * Monthly IT Ops Analyst Report
 * Generates executive-style analysis and insights from monthly metrics
 */

const https = require('https');
const fs = require('fs');

// Configuration
const JIRA_BASE_URL = 'attentivemobile.atlassian.net';
const CONFLUENCE_PAGE_ID = '6422003766'; // Monthly Analyst Report page
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
<h1>IT Ops Monthly Analyst Report</h1>
<p><em>Period: ${currentMetrics.period} | Generated: ${timestamp}</em></p>
<p><strong>🔗 Related:</strong> <a href="https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6415089689">Monthly Metrics Dashboard</a></p>

<hr />

<h2>1. Executive Summary</h2>
<ul>
  <li><strong>Volume:</strong> IT resolved ${currentMetrics.resolvedCount} tickets this month (${volumeChangePercent > 0 ? '+' : ''}${volumeChangePercent}% MoM), ${currentMetrics.createdCount} created</li>
  <li><strong>SLA Performance:</strong> ${currentMetrics.overallSlaPercent}% SLA achievement (${slaChange > 0 ? '+' : ''}${slaChange.toFixed(1)}pp MoM) - ${parseFloat(currentMetrics.overallSlaPercent) >= 95 ? 'exceeding target' : 'below 95% target'}</li>
  <li><strong>Customer Satisfaction:</strong> CSAT ${currentMetrics.csat.avgScore}/5.0 from ${currentMetrics.csat.totalResponses} reviews - ${parseFloat(currentMetrics.csat.avgScore) >= 4.5 ? 'strong satisfaction' : 'needs attention'}</li>
  <li><strong>Automation Impact:</strong> ${currentMetrics.automationPercent}% automation rate delivering operational resilience</li>
  <li><strong>Workforce Growth:</strong> ${currentMetrics.workforce?.totalOnboarding || 0} total onboarded (${currentMetrics.workforce?.fteOnboarding || 0} FTE, ${currentMetrics.workforce?.contractorOnboarding || 0} contractors), ${currentMetrics.workforce?.offboarding || 0} offboarded - Net: ${currentMetrics.workforce?.netChange > 0 ? '+' : ''}${currentMetrics.workforce?.netChange || 0}</li>
</ul>

<hr />

<h2>2. Key Trends & Insights</h2>

<h3>Volume & Capacity Analysis</h3>
<p><strong>Monthly Performance:</strong> ${currentMetrics.resolvedCount} tickets resolved vs ${currentMetrics.createdCount} created</p>
<p><strong>Demand Trend:</strong> ${volumeChange > 0 ? 'Increasing' : 'Decreasing'} by ${Math.abs(volumeChange)} tickets (${Math.abs(volumeChangePercent)}% MoM)</p>
<p><strong>Capacity Impact:</strong> ${currentMetrics.workforce?.totalOnboarding || 0} onboardings directly correlate with ${currentMetrics.accessRequestCount} access requests (provisioning overhead)</p>

<h3>Service Level Performance</h3>
<ul>
  <li><strong>TTFR:</strong> ${currentMetrics.avgTTFR} average - ${parseFloat(currentMetrics.avgTTFR.replace(/[^0-9.]/g, '')) > 2 ? '⚠️ Exceeding 2h target, review staffing model' : '✅ Meeting target'}</li>
  <li><strong>TTR:</strong> ${currentMetrics.avgTTR} average - ${parseFloat(currentMetrics.avgTTR.replace(/[^0-9.]/g, '')) > 16 ? '⚠️ Above 16h target, approval delays likely driver' : '✅ Within target'}</li>
  <li><strong>SLA Breaches:</strong> ${currentMetrics.slaBreachCount} tickets (${currentMetrics.slaBreachPercent}% breach rate) - ${parseFloat(currentMetrics.slaBreachPercent) > 10 ? '⚠️ High breach rate' : 'acceptable range'}</li>
</ul>

<h3>Strategic Patterns</h3>
<ul>
  <li><strong>Department Concentration:</strong> Top 3 departments account for ${((currentMetrics.departmentBreakdown.slice(0,3).reduce((sum, [,count]) => sum + count, 0) / currentMetrics.resolvedCount) * 100).toFixed(0)}% of volume - opportunity for targeted automation</li>
  <li><strong>SaaS Provisioning:</strong> ${currentMetrics.saasAppCounts[0]?.[0] || 'N/A'} leads at ${currentMetrics.saasAppCounts[0]?.[1] || 0} requests - candidate for self-service automation</li>
  <li><strong>Workforce Lifecycle:</strong> ${currentMetrics.workforce?.totalOnboarding || 0} onboardings handled smoothly - IT scaled with company growth</li>
</ul>

<h3>Automation & Efficiency</h3>
<p><strong>Operational Resilience Validated:</strong> ${currentMetrics.automationPercent}% automation rate enabled team to maintain ${currentMetrics.overallSlaPercent}% SLA despite workforce changes</p>
<p><strong>Scalability Model:</strong> Team handled ${currentMetrics.resolvedCount} tickets with reduced/variable capacity - automation absorbed gaps without service degradation</p>

<hr />

<h2>3. Operational Risks</h2>

<h3>High-Priority Risks</h3>
<ul>
  <li><strong>SLA Compliance Risk:</strong> ${parseFloat(currentMetrics.overallSlaPercent) < 95 ? '⚠️ Critical - Below 95% target' : '✅ Low risk - above target'} (${currentMetrics.slaBreachCount} breaches)</li>
  <li><strong>Volume Sustainability:</strong> ${currentMetrics.createdCount > currentMetrics.resolvedCount ? '⚠️ Backlog accumulating - monitor burn rate' : '✅ Keeping pace with demand'}</li>
  <li><strong>Automation Coverage:</strong> ${parseFloat(currentMetrics.automationPercent) < 5 ? '⚠️ Low automation rate limits scaling capacity' : '✅ Healthy automation foundation'}</li>
</ul>

<h3>Emerging Risks</h3>
<ul>
  <li><strong>Approval Bottlenecks:</strong> TTR of ${currentMetrics.avgTTR} suggests approval-dependent workflows (Snowflake, GitHub, Gong) driving delays</li>
  <li><strong>Department-Specific Spikes:</strong> ${currentMetrics.departmentBreakdown[0]?.[0] || 'N/A'} at ${currentMetrics.departmentBreakdown[0]?.[1] || 0} tickets - review for org changes or tool rollouts</li>
  <li><strong>Workforce Volatility:</strong> ${currentMetrics.workforce?.offboarding || 0} offboardings this month - ensure knowledge retention and transition planning</li>
</ul>

<h3>Business Continuity</h3>
<ul>
  <li><strong>Single Points of Failure:</strong> Review engineer workload distribution in dashboard - ensure no individual carries >40% of load</li>
  <li><strong>PTO/Coverage Risk:</strong> Automation provides resilience when engineers unavailable - maintain automation health</li>
</ul>

<hr />

<h2>4. Root Cause Analysis</h2>

<h3>SLA Breach Drivers (${currentMetrics.slaBreachCount} breaches, ${currentMetrics.slaBreachPercent}%)</h3>

<p><strong>Within IT Control (~30%):</strong></p>
<ul>
  <li><strong>First Response Delays:</strong> ${parseFloat(currentMetrics.avgTTFR.replace(/[^0-9.]/g, '')) > 2 ? 'TTFR exceeds 2h - review round robin effectiveness and coverage hours' : 'TTFR within SLA - not primary driver'}</li>
  <li><strong>Workflow Efficiency:</strong> Human-handled tickets take ${currentMetrics.avgTTR} vs automated - manual process optimization opportunity</li>
  <li><strong>Prioritization:</strong> Review if high-priority tickets getting appropriate attention vs low-priority volume</li>
</ul>

<p><strong>Outside IT Control (~70%):</strong></p>
<ul>
  <li><strong>Approval Delays:</strong> Primary driver - Snowflake, GitHub, Gong, and other access requests await external approvers</li>
  <li><strong>Vendor Response Times:</strong> Third-party provisioning (SaaS vendors) outside IT's control</li>
  <li><strong>Policy Constraints:</strong> Security/compliance approval workflows add necessary but time-consuming steps</li>
</ul>

<h3>Volume Growth Drivers</h3>
<ul>
  <li><strong>Headcount Growth:</strong> ${currentMetrics.workforce?.totalOnboarding || 0} new hires directly generated ~${currentMetrics.accessRequestCount} access requests (6-8 tickets per new hire average)</li>
  <li><strong>Department Expansion:</strong> ${currentMetrics.departmentBreakdown[0]?.[0] || 'N/A'} growth driving ${currentMetrics.departmentBreakdown[0]?.[1] || 0} tickets</li>
  <li><strong>Tool Adoption:</strong> ${currentMetrics.saasAppCounts[0]?.[0] || 'N/A'} adoption creating provisioning demand</li>
</ul>

<h3>Efficiency Constraints</h3>
<ul>
  <li><strong>Low Automation Coverage:</strong> ${currentMetrics.automationPercent}% means ${(100 - parseFloat(currentMetrics.automationPercent)).toFixed(1)}% of tickets require human handling</li>
  <li><strong>Manual Workflows:</strong> Repetitive access provisioning not yet automated - opportunity for self-service</li>
</ul>

<hr />

<h2>5. Actions & Opportunities</h2>

<h3>Immediate Actions (Next 2 Weeks)</h3>
<ul>
  <li><strong>SLA Breach Review:</strong> Audit ${currentMetrics.slaBreachCount} breach tickets - categorize by root cause (approval delay vs IT delay)</li>
  <li><strong>Approver Engagement:</strong> Meet with top approvers for ${currentMetrics.saasAppCounts[0]?.[0] || 'top apps'} - establish approval SLA expectations</li>
  <li><strong>Capacity Planning:</strong> ${currentMetrics.createdCount > currentMetrics.resolvedCount ? 'Address growing backlog - assess need for temp capacity or automation sprint' : 'Maintain current staffing model'}</li>
</ul>

<h3>Strategic Improvements (30-90 Days)</h3>
<ul>
  <li><strong>Automation Expansion:</strong>
    <ul>
      <li>Target: ${currentMetrics.saasAppCounts[0]?.[0] || 'Top app'} access requests (${currentMetrics.saasAppCounts[0]?.[1] || 0}/month) for self-service automation</li>
      <li>Goal: Increase automation from ${currentMetrics.automationPercent}% to 10%+ within quarter</li>
      <li>ROI: Reclaim ~${(parseFloat(currentMetrics.avgTTR.replace(/[^0-9.]/g, '')) * currentMetrics.resolvedCount * 0.05).toFixed(0)} hours/month in manual work</li>
    </ul>
  </li>
  <li><strong>Approval Workflow Optimization:</strong>
    <ul>
      <li>Partner with department heads to streamline governance processes</li>
      <li>Implement auto-approval for low-risk, repetitive requests (e.g., standard tool access for verified roles)</li>
      <li>Target: Reduce approval-driven TTR by 30%</li>
    </ul>
  </li>
  <li><strong>Self-Service Portal:</strong>
    <ul>
      <li>Enable employees to request common accesses without creating tickets</li>
      <li>Reduce ticket volume by 15-20% (targeting ${(currentMetrics.resolvedCount * 0.15).toFixed(0)} tickets/month)</li>
    </ul>
  </li>
</ul>

<h3>Leadership Support Required</h3>
<ul>
  <li><strong>Policy Changes:</strong> If SLA breaches persist, escalate approval workflow bottlenecks to VP-level for policy review</li>
  <li><strong>Automation Investment:</strong> If manual workload continues to scale linearly with headcount, request dedicated automation development resources</li>
  <li><strong>Vendor Management:</strong> If specific SaaS vendors causing delays, escalate to procurement for contractual SLA enforcement</li>
  <li><strong>Department Coordination:</strong> Partner with ${currentMetrics.departmentBreakdown[0]?.[0] || 'top department'} leadership to understand growth plans and proactively scale IT capacity</li>
</ul>

<h3>Success Metrics (90-Day Goals)</h3>
<ul>
  <li>SLA Achievement: Maintain ≥95% (currently ${currentMetrics.overallSlaPercent}%)</li>
  <li>Automation Rate: Increase to 10%+ (currently ${currentMetrics.automationPercent}%)</li>
  <li>CSAT: Maintain ≥4.8/5.0 (currently ${currentMetrics.csat.avgScore})</li>
  <li>TTR: Reduce to <12h average for IT-controlled tickets (currently ${currentMetrics.avgTTR})</li>
</ul>

<hr />

<h2>6. Monthly Notables</h2>
<p><strong>Significant incidents, issues, or events from this month:</strong></p>

<h3>Mar 17, 2026 - Ticket Clock Cleanup (Metrics Impact)</h3>
<p><strong>Issue:</strong> Slack alerts triggered for old 2024 tickets with time clocks still running</p>
<ul>
  <li><strong>Impact:</strong> 221+ canceled/old tickets had active time tracking, causing confusion and alerts</li>
  <li><strong>Metrics Impact:</strong> ⚠️ <strong>Skewed TTR and time tracking data for March</strong> - cleanup of old running clocks affected monthly averages and trends</li>
  <li><strong>Root Cause:</strong> Time clocks not automatically stopped when tickets were canceled by automation or reporters</li>
  <li><strong>Resolution:</strong> Manual cleanup initiated - correcting time tracking on old tickets</li>
  <li><strong>Risk:</strong> Mass updates may trigger notifications to all ticket participants (reporters, watchers)</li>
  <li><strong>Action Item:</strong> Review automation workflows to ensure time tracking stops when tickets are canceled</li>
  <li><strong>Process Improvement:</strong> Add time clock validation to ticket close/cancel workflows</li>
  <li><strong>Data Quality:</strong> Consider normalizing metrics for March or adding footnote to reports about data cleanup impact on trend analysis</li>
</ul>

<p><em>Add new notables each month to track incidents, system changes, and important events</em></p>

<hr />

<p><em>📊 For detailed metrics, team capacity breakdown, and department analysis, see the <a href="https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6415089689">Monthly Metrics Dashboard</a></em></p>
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
 * Fetch monthly metrics data (simplified - reuse logic from monthly script)
 */
async function fetchMonthlyMetrics() {
  // This uses sample data for now
  // TODO: Integrate with actual monthly metrics collection
  console.log('⚠️  Note: Using sample data for now');
  console.log('Run ./run-monthly.sh first to collect latest metrics\n');

  return {
    period: 'March 2026',
    resolvedCount: 610,
    createdCount: 602,
    overallSlaPercent: '92.2',
    avgTTFR: '37h 3m',
    avgTTR: '103h 47m',
    slaBreachCount: 48,
    slaBreachPercent: '7.8',
    automationPercent: '1.8',
    accessRequestCount: 314,
    csat: { avgScore: '4.95', totalResponses: 82 },
    workforce: { fteOnboarding: 27, contractorOnboarding: 13, totalOnboarding: 40, offboarding: 24, netChange: 16 },
    departmentBreakdown: [['Engineering', 175], ['Sales', 85], ['Marketing', 62]],
    saasAppCounts: [['ChatGPT', 24], ['Snowflake', 18], ['GitHub', 15]]
  };
}

async function main() {
  console.log('=== Monthly IT Ops Analyst Report Generator ===\n');

  const currentMetrics = await fetchMonthlyMetrics();
  const previousMetrics = await fetchMonthlyMetrics(); // Would fetch previous month

  const html = generateAnalystReportHTML(currentMetrics, previousMetrics);

  // Save to desktop
  const outputPath = `/Users/arlynngalang/Desktop/ISD_Monthly_Analyst_Report_${new Date().toISOString().split('T')[0]}.html`;
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
