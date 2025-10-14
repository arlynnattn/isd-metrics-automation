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

  const path = `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=1000&fields=created,resolutiondate,comment`;
  const response = await makeRequest(JIRA_BASE_URL, path);

  const issues = response.issues || [];
  console.log(`Found ${issues.length} issues`);

  let ttfrSum = 0;
  let ttfrCount = 0;
  let ttrSum = 0;
  let ttrCount = 0;

  for (const issue of issues) {
    const created = new Date(issue.fields.created);

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
      const resolved = new Date(issue.fields.resolutiondate);
      const ttr = (resolved - created) / (1000 * 60 * 60); // hours
      if (ttr >= 0) {
        ttrSum += ttr;
        ttrCount++;
      }
    }
  }

  const avgTTFR = ttfrCount > 0 ? (ttfrSum / ttfrCount).toFixed(2) : 'N/A';
  const avgTTR = ttrCount > 0 ? (ttrSum / ttrCount).toFixed(2) : 'N/A';

  return {
    totalIssues: issues.length,
    avgTTFR,
    avgTTR,
    ttfrCount,
    ttrCount
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
  </tbody>
</table>

<hr />
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

    console.log(`\nPrevious Week (${metrics.previousWeek.label}):`);
    console.log(`  Total Issues: ${metrics.previousWeek.totalIssues}`);
    console.log(`  Avg TTFR: ${metrics.previousWeek.avgTTFR} hours (${metrics.previousWeek.ttfrCount} issues)`);
    console.log(`  Avg TTR: ${metrics.previousWeek.avgTTR} hours (${metrics.previousWeek.ttrCount} issues)`);

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
