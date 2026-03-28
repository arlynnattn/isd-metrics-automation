#!/usr/bin/env node

/**
 * Generate comprehensive documentation for IT Ops Metrics Overview page
 * Publishes to: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/5471371324
 */

const https = require('https');

const JIRA_BASE_URL = 'attentivemobile.atlassian.net';
const CONFLUENCE_PAGE_ID = '5471371324'; // IT Ops Metrics Overview page
const CONFLUENCE_SPACE_KEY = 'ISD';

const ATLASSIAN_EMAIL = process.env.ATLASSIAN_EMAIL;
const ATLASSIAN_API_TOKEN = process.env.ATLASSIAN_API_TOKEN;

if (!ATLASSIAN_EMAIL || !ATLASSIAN_API_TOKEN) {
  console.error('Error: ATLASSIAN_EMAIL and ATLASSIAN_API_TOKEN environment variables required');
  process.exit(1);
}

const AUTH_HEADER = 'Basic ' + Buffer.from(`${ATLASSIAN_EMAIL}:${ATLASSIAN_API_TOKEN}`).toString('base64');

function makeRequest(hostname, path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': AUTH_HEADER
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

function generateDocumentationHTML() {
  const timestamp = new Date().toLocaleString();

  return `
<h1>IT Ops Metrics Automation - Documentation</h1>
<p><em>Last updated: ${timestamp}</em></p>
<p><strong>Status:</strong> ✅ Automated Reporting Pipeline with Validation & Data Quality Controls | <strong>Version:</strong> 2.1 (Hardened March 2026)</p>

<ac:structured-macro ac:name="info">
  <ac:rich-text-body>
    <p><strong>What's New (March 2026 - Version 2.1):</strong></p>
    <ul>
      <li>✅ Added raw vs adjusted metrics view when data anomalies exist</li>
      <li>✅ Narrative confidence guardrails automatically adjust based on data quality</li>
      <li>✅ Validation status visible in every report</li>
      <li>✅ Fixed analyst reports to use real data (no more sample data)</li>
      <li>✅ Fixed target comparison logic (24m now correctly shows "within 2h target")</li>
      <li>✅ Added prominent data quality warnings with adjusted metrics</li>
      <li>✅ Added validation layer to ensure cross-report consistency</li>
      <li>✅ Enhanced Slack messages with emoji formatting</li>
    </ul>
  </ac:rich-text-body>
</ac:structured-macro>

<hr />

<h2>📊 Available Reports</h2>

<table data-layout="default">
  <tbody>
    <tr>
      <th><p><strong>Report Type</strong></p></th>
      <th><p><strong>Frequency</strong></p></th>
      <th><p><strong>Purpose</strong></p></th>
      <th><p><strong>Link</strong></p></th>
    </tr>
    <tr>
      <td><p><strong>Weekly Dashboard</strong></p></td>
      <td><p>Every Monday 9 AM ET</p></td>
      <td><p>Last 7 days metrics, charts, and breakdowns</p></td>
      <td><p><a href="https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6423805982">View Report</a></p></td>
    </tr>
    <tr>
      <td><p><strong>Weekly Analyst</strong></p></td>
      <td><p>Every Monday 9 AM ET</p></td>
      <td><p>Executive analysis, trends, and action items</p></td>
      <td><p><a href="https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6424363046">View Report</a></p></td>
    </tr>
    <tr>
      <td><p><strong>Monthly Dashboard</strong></p></td>
      <td><p>1st of month 9 AM ET</p></td>
      <td><p>Month-to-date metrics with team capacity</p></td>
      <td><p><a href="https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6415089689">View Report</a></p></td>
    </tr>
    <tr>
      <td><p><strong>Monthly Analyst</strong></p></td>
      <td><p>1st of month 9 AM ET</p></td>
      <td><p>Strategic insights and leadership recommendations</p></td>
      <td><p><a href="https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6422003766">View Report</a></p></td>
    </tr>
  </tbody>
</table>

<hr />

<h2>🤖 Automation Schedule</h2>

<h3>Weekly Reports - Every Monday at 9:00 AM ET</h3>
<p><strong>Automated Process:</strong></p>
<ol>
  <li>Dashboard generates with last 7 days data from Jira & Slack APIs</li>
  <li>Confluence pages auto-update (Dashboard + Analyst Report)</li>
  <li>Slack summary posts to <strong>#itops-metric-reporting</strong></li>
  <li>Backup HTML files saved to Desktop</li>
  <li>Validation runs automatically and results embedded in reports</li>
  <li>Data quality checks detect anomalies and compute adjusted metrics</li>
</ol>

<h3>Monthly Reports - 1st of Every Month at 9:00 AM ET</h3>
<p><strong>Automated Process:</strong></p>
<ol>
  <li>Dashboard generates with month-to-date data from Jira & Slack APIs</li>
  <li>Confluence pages auto-update (Dashboard + Analyst Report)</li>
  <li>Slack summary posts to <strong>#itops-metric-reporting</strong></li>
  <li>Backup HTML files saved to Desktop</li>
  <li>Validation runs automatically and results embedded in reports</li>
  <li>Data quality checks detect anomalies and compute adjusted metrics</li>
  <li>Narrative confidence automatically adjusts based on data quality</li>
</ol>

<ac:structured-macro ac:name="tip">
  <ac:rich-text-body>
    <p><strong>Next Runs:</strong></p>
    <ul>
      <li>Weekly: Every Monday at 9:00 AM ET</li>
      <li>Monthly: 1st of each month at 9:00 AM ET</li>
    </ul>
    <p>Reports publish automatically - no manual work required!</p>
  </ac:rich-text-body>
</ac:structured-macro>

<hr />

<h2>💬 Slack Notifications</h2>

<p>Automated summaries post to <strong>#itops-metric-reporting</strong> channel.</p>

<h3>Message Format</h3>
<p>Messages include:</p>
<ul>
  <li>📊 <strong>Performance</strong> - SLA, TTFR, TTR, CSAT with status emojis (✅ or ⚠️)</li>
  <li>📈 <strong>Volume</strong> - Resolved/Created tickets with backlog status</li>
  <li>🤖 <strong>Automation</strong> - Automation rate and SLA breaches</li>
  <li>👥 <strong>Workforce</strong> - Onboarding/offboarding with net change (🟢/🔴)</li>
  <li>📋 <strong>Links</strong> - Clickable links to full Confluence reports</li>
</ul>

<h3>Smart Status Indicators</h3>
<table data-layout="default">
  <tbody>
    <tr>
      <th><p><strong>Metric</strong></p></th>
      <th><p><strong>Target</strong></p></th>
      <th><p><strong>Good</strong></p></th>
      <th><p><strong>Needs Attention</strong></p></th>
    </tr>
    <tr>
      <td><p>SLA Achievement</p></td>
      <td><p>≥ 95%</p></td>
      <td><p>✅ 95.3%</p></td>
      <td><p>⚠️ 92.2%</p></td>
    </tr>
    <tr>
      <td><p>TTFR (Time to First Response)</p></td>
      <td><p>≤ 2 hours</p></td>
      <td><p>✅ 24m</p></td>
      <td><p>⚠️ 3h 15m</p></td>
    </tr>
    <tr>
      <td><p>TTR (Time to Resolution)</p></td>
      <td><p>≤ 16 hours</p></td>
      <td><p>✅ 8h 26m</p></td>
      <td><p>⚠️ 20h 15m</p></td>
    </tr>
    <tr>
      <td><p>CSAT</p></td>
      <td><p>≥ 4.5/5.0</p></td>
      <td><p>✅ 5.00</p></td>
      <td><p>⚠️ 4.20</p></td>
    </tr>
    <tr>
      <td><p>Automation Rate</p></td>
      <td><p>≥ 5%</p></td>
      <td><p>✅ 6.2%</p></td>
      <td><p>⚠️ 1.5%</p></td>
    </tr>
  </tbody>
</table>

<hr />

<h2>📊 Metrics Included</h2>

<h3>Key Performance Indicators</h3>
<ul>
  <li><strong>SLA Performance</strong> - Overall SLA achievement percentage</li>
  <li><strong>TTFR</strong> - Time to First Response (business hours, target: 2 hours)</li>
  <li><strong>TTR</strong> - Time to Resolution (business hours, target: 16 hours)</li>
  <li><strong>CSAT</strong> - Customer Satisfaction score (1-5 scale)</li>
  <li><strong>SLA Breaches</strong> - Count and percentage of breached tickets</li>
</ul>

<h3>Volume Metrics</h3>
<ul>
  <li><strong>Tickets Resolved</strong> - Completed tickets in period</li>
  <li><strong>Tickets Created</strong> - New tickets in period</li>
  <li><strong>Backlog Status</strong> - Growing or reducing</li>
  <li><strong>Department Breakdown</strong> - Top 5 departments by volume</li>
  <li><strong>Issue Type Breakdown</strong> - Distribution by ticket type</li>
</ul>

<h3>Automation & Efficiency</h3>
<ul>
  <li><strong>Automation Rate</strong> - Percentage of tickets resolved without human intervention</li>
  <li><strong>Automated vs Human TTR</strong> - Resolution time comparison</li>
  <li><strong>Human Time Reclaimed</strong> - Hours saved through automation</li>
</ul>

<h3>Workforce & Access</h3>
<ul>
  <li><strong>Onboarding</strong> - FTE and contractor onboarding completed</li>
  <li><strong>Offboarding</strong> - Employee offboarding completed</li>
  <li><strong>Net Headcount Change</strong> - Overall workforce delta</li>
  <li><strong>Access Requests</strong> - SaaS application access provisioning</li>
  <li><strong>Top SaaS Apps</strong> - Most requested applications</li>
</ul>

<h3>Team Activity</h3>
<ul>
  <li><strong>#ask-it Slack Channel</strong> - Message count and unique users</li>
  <li><strong>Engineer Workload</strong> - Distribution across team members</li>
  <li><strong>Team Availability</strong> - Active vs OOO status</li>
</ul>

<hr />

<h2>🔧 How It Works</h2>

<h3>Data Sources</h3>
<table data-layout="default">
  <tbody>
    <tr>
      <th><p><strong>Source</strong></p></th>
      <th><p><strong>What We Collect</strong></p></th>
      <th><p><strong>API</strong></p></th>
    </tr>
    <tr>
      <td><p>Jira Service Desk</p></td>
      <td><p>Tickets, SLA data, CSAT scores, departments, access requests</p></td>
      <td><p>Jira REST API v3</p></td>
    </tr>
    <tr>
      <td><p>Jira Assets</p></td>
      <td><p>SaaS application names (Service Catalog)</p></td>
      <td><p>Assets API</p></td>
    </tr>
    <tr>
      <td><p>Slack</p></td>
      <td><p>#ask-it channel activity (messages, unique users)</p></td>
      <td><p>Slack API</p></td>
    </tr>
  </tbody>
</table>

<h3>SLA Calculation</h3>
<p>Uses Jira's built-in SLA fields which automatically calculate business hours:</p>
<ul>
  <li><strong>Business Hours:</strong> 9:00 AM - 6:00 PM Eastern Time, Monday-Friday</li>
  <li><strong>TTFR Field:</strong> customfield_10130 (Time to first response in business hours)</li>
  <li><strong>TTR Field:</strong> customfield_10129 (Time to resolution in business hours)</li>
</ul>

<h3>Automation Detection</h3>
<p>Tickets are classified as "automated" if:</p>
<ul>
  <li>Assigned to automation accounts (Attentive Jira OKTA Workflow Automation Account, Automation for Jira)</li>
  <li>No human intervention in the changelog (no changes by human users after creation)</li>
</ul>

<hr />

<h2>✅ Data Quality & Validation</h2>

<h3>Validation Status Visibility</h3>
<p><strong>Every report now includes a prominent validation status block showing:</strong></p>
<ul>
  <li>✅ Validation Passed - All consistency checks passed</li>
  <li>⚠️ Validation Passed with Data Quality Notice - Checks passed but anomaly detected</li>
  <li>❌ Validation Warning - Inconsistencies detected that need review</li>
</ul>

<h3>Automated Validation Checks</h3>
<p>Every report run includes automatic validation:</p>
<ul>
  <li>✅ All critical metrics present (no missing data)</li>
  <li>✅ Target comparison logic correct (e.g., 24m = within 2h target)</li>
  <li>✅ Breach rate matches breach count calculations</li>
  <li>✅ Automation rate matches automated count calculations</li>
  <li>✅ Dashboard and analyst reports have matching numbers</li>
</ul>

<h3>Data Quality Exception Handling</h3>
<p><strong>When anomalies are detected, reports automatically:</strong></p>
<ul>
  <li>📊 Display both raw (system-of-record) and adjusted (anomaly-excluded) metrics</li>
  <li>📊 Adjust narrative confidence level to avoid misleading insights</li>
  <li>📊 Provide clear explanation of what changed and why</li>
  <li>📊 Use adjusted metrics for operational insights while preserving raw values for transparency</li>
</ul>

<h3>Known Data Quality Issues</h3>
<ac:structured-macro ac:name="warning">
  <ac:rich-text-body>
    <p><strong>March 2026 Data Quality Notice:</strong></p>
    <p>On March 17, 2026, a ticket clock cleanup affected 221+ old tickets with running time clocks. This skewed TTR and TTFR averages for March.</p>
    <p><strong>Impact:</strong> March time tracking metrics (TTFR, TTR) show inflated raw values.</p>
    <p><strong>Mitigation:</strong> Reports automatically compute adjusted metrics excluding anomaly-affected tickets. Both raw and adjusted values are shown with clear labeling.</p>
    <p><strong>Narrative Handling:</strong> Analyst reports automatically use adjusted metrics for insights and qualify any time-based interpretations.</p>
  </ac:rich-text-body>
</ac:structured-macro>

<hr />

<h2>🛠️ Manual Override</h2>

<p>If you need to run reports manually (outside of schedule):</p>

<h3>Weekly Reports</h3>
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">bash</ac:parameter>
  <ac:plain-text-body><![CDATA[cd ~/isd-metrics-automation
./run-weekly.sh           # Dashboard + Slack
./run-weekly-analyst.sh   # Analyst report
./validate-metrics.js     # Verify consistency]]></ac:plain-text-body>
</ac:structured-macro>

<h3>Monthly Reports</h3>
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">bash</ac:parameter>
  <ac:plain-text-body><![CDATA[cd ~/isd-metrics-automation
./run-monthly.sh          # Dashboard + Slack
./run-monthly-analyst.sh  # Analyst report
./validate-metrics.js     # Verify consistency]]></ac:plain-text-body>
</ac:structured-macro>

<hr />

<h2>⚠️ Troubleshooting</h2>

<h3>Reports Not Generated</h3>
<p><strong>Check automation logs:</strong></p>
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">bash</ac:parameter>
  <ac:plain-text-body><![CDATA[# View today's logs
cat ~/isd-metrics-automation/logs/weekly-$(date +%Y%m%d).log
cat ~/isd-metrics-automation/logs/monthly-$(date +%Y%m%d).log]]></ac:plain-text-body>
</ac:structured-macro>

<h3>Slack Message Not Posted</h3>
<p><strong>Common causes:</strong></p>
<ul>
  <li>SLACK_BOT_TOKEN expired - Update in run scripts</li>
  <li>Bot not in channel - Invite bot to #itops-metric-reporting</li>
  <li>Check logs for error messages</li>
</ul>

<h3>Confluence Pages Not Updated</h3>
<p><strong>Common causes:</strong></p>
<ul>
  <li>ATLASSIAN_API_TOKEN expired - Refresh at <a href="https://id.atlassian.com/manage-profile/security/api-tokens">id.atlassian.com</a></li>
  <li>Token lacks write permissions - Generate new token with Confluence write access</li>
  <li>Check logs for HTTP error codes</li>
</ul>

<h3>Numbers Don't Match Between Reports</h3>
<p><strong>Run validation:</strong></p>
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">bash</ac:parameter>
  <ac:plain-text-body><![CDATA[cd ~/isd-metrics-automation
./validate-metrics.js]]></ac:plain-text-body>
</ac:structured-macro>
<p>If validation fails, re-run dashboard scripts to regenerate metrics.</p>

<hr />

<h2>📞 Support & Documentation</h2>

<h3>Repository</h3>
<p>All code and scripts: <code>~/isd-metrics-automation</code></p>

<h3>Documentation Files</h3>
<ul>
  <li><strong>QUICK_START.md</strong> - Simple workflow guide</li>
  <li><strong>FIXES_APPLIED.md</strong> - Comprehensive fix documentation (March 2026)</li>
  <li><strong>AUTOMATED_SCHEDULE.md</strong> - Cron job and automation details</li>
  <li><strong>SLACK_MESSAGE_PREVIEW.md</strong> - Emoji message examples</li>
  <li><strong>AUDIT_REPORT.md</strong> - Original audit findings</li>
  <li><strong>README.md</strong> - Full user documentation</li>
</ul>

<h3>Contact</h3>
<ul>
  <li><strong>For API token issues:</strong> #ask-security</li>
  <li><strong>For script modifications:</strong> @arlynn</li>
  <li><strong>For automation failures:</strong> Check logs first, then contact @arlynn</li>
</ul>

<hr />

<h2>🎯 Success Metrics</h2>

<p>The automated reporting pipeline is successful when:</p>
<ul>
  <li>✅ Reports publish automatically every Monday and 1st of month</li>
  <li>✅ Slack notifications appear in #itops-metric-reporting with accurate summaries</li>
  <li>✅ Confluence pages show updated data with validation status</li>
  <li>✅ Validation status is visible in all reports</li>
  <li>✅ Numbers match between dashboard and analyst reports (cross-report consistency)</li>
  <li>✅ Data quality anomalies are detected and handled automatically</li>
  <li>✅ Adjusted metrics provided when anomalies affect raw data</li>
  <li>✅ Narrative confidence adjusts appropriately based on data quality</li>
  <li>✅ Leadership can trust the metrics and understand any caveats without manual verification</li>
</ul>

<hr />

<p><em>🤖 This documentation page is maintained manually. Contact @arlynn for updates.</em></p>
<p><em>📊 Last system update: March 28, 2026 - Version 2.1: Enhanced with adjusted metrics, validation visibility, and narrative guardrails for defensible reporting under data anomalies</em></p>
`;
}

async function updateConfluencePage() {
  try {
    console.log('Fetching current Confluence page...');
    const getPath = `/wiki/rest/api/content/${CONFLUENCE_PAGE_ID}?expand=version`;
    const page = await makeRequest(JIRA_BASE_URL, getPath);

    const currentVersion = page.version.number;
    console.log(`Current page version: ${currentVersion}`);

    const html = generateDocumentationHTML();

    console.log('Updating Confluence page with comprehensive documentation...');
    const updatePath = `/wiki/rest/api/content/${CONFLUENCE_PAGE_ID}`;
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

    await makeRequest(JIRA_BASE_URL, updatePath, 'PUT', updateData);

    console.log('✅ Confluence page updated successfully!');
    console.log(`  Page ID: ${CONFLUENCE_PAGE_ID}`);
    console.log(`  New version: ${currentVersion + 1}`);
    console.log(`  URL: https://${JIRA_BASE_URL}/wiki/spaces/${CONFLUENCE_SPACE_KEY}/pages/${CONFLUENCE_PAGE_ID}`);

  } catch (error) {
    console.error('✗ Error updating Confluence page:', error.message);
    process.exit(1);
  }
}

console.log('=== Publishing IT Ops Metrics Documentation ===\n');
updateConfluencePage();
