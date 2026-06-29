#!/usr/bin/env node

/**
 * Weekly Top Apps Running Report
 * Updates Confluence page:
 * https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6669565981
 */

const https = require('https');
const { loadWeeklyMetrics } = require('./save-metrics-to-json');

const JIRA_BASE_URL = 'attentivemobile.atlassian.net';
const CONFLUENCE_PAGE_ID = '6669565981';
const CONFLUENCE_SPACE_KEY = 'ISD';

const ATLASSIAN_EMAIL = process.env.ATLASSIAN_EMAIL;
const ATLASSIAN_API_TOKEN = process.env.ATLASSIAN_API_TOKEN;

if (!ATLASSIAN_EMAIL || !ATLASSIAN_API_TOKEN) {
  console.error('Error: ATLASSIAN_EMAIL and ATLASSIAN_API_TOKEN environment variables are required');
  process.exit(1);
}

const AUTH_HEADER = 'Basic ' + Buffer.from(`${ATLASSIAN_EMAIL}:${ATLASSIAN_API_TOKEN}`).toString('base64');

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
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function buildAppMap(entries = []) {
  return new Map(entries.map(([app, count]) => [app, count]));
}

function calculateMovers(currentApps = [], previousApps = []) {
  const previousMap = buildAppMap(previousApps);

  return currentApps
    .map(([app, count]) => {
      const previous = previousMap.get(app) || 0;
      return {
        app,
        count,
        previous,
        delta: count - previous
      };
    })
    .sort((a, b) => {
      if (Math.abs(b.delta) !== Math.abs(a.delta)) {
        return Math.abs(b.delta) - Math.abs(a.delta);
      }
      return b.count - a.count;
    })
    .slice(0, 5);
}

function renderAppRows(entries = [], emptyLabel) {
  if (entries.length === 0) {
    return `
    <tr>
      <td colspan="3"><p>${emptyLabel}</p></td>
    </tr>`;
  }

  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  return entries.map(([app, count], index) => {
    const share = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
    return `
    <tr>
      <td><p>${index + 1}</p></td>
      <td><p>${app}</p></td>
      <td><p>${count} (${share}%)</p></td>
    </tr>`;
  }).join('');
}

function renderMoverRows(movers = []) {
  if (movers.length === 0) {
    return `
    <tr>
      <td colspan="4"><p>No application movement available for this week.</p></td>
    </tr>`;
  }

  return movers.map(({ app, count, previous, delta }) => `
    <tr>
      <td><p>${app}</p></td>
      <td><p>${count}</p></td>
      <td><p>${previous}</p></td>
      <td><p>${delta > 0 ? '+' : ''}${delta}</p></td>
    </tr>
  `).join('');
}

function generateTopAppsHTML(currentMetrics, previousMetrics) {
  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'long',
    timeStyle: 'short'
  });

  const currentApps = currentMetrics.saasAppCounts || [];
  const previousApps = previousMetrics.saasAppCounts || [];
  const movers = calculateMovers(currentApps, previousApps);
  const topApp = currentApps[0]?.[0] || 'N/A';
  const topAppCount = currentApps[0]?.[1] || 0;

  return `
<h1>ISD Weekly Top Apps Running Report</h1>
<p><em>Last updated: ${timestamp} ET</em></p>
<p><strong>Reporting window:</strong> ${currentMetrics.period}</p>

<ac:structured-macro ac:name="info">
  <ac:rich-text-body>
    <p><strong>Summary:</strong> ${currentMetrics.accessRequestCount || 0} access requests this week. Top requested application was <strong>${topApp}</strong> with <strong>${topAppCount}</strong> requests.</p>
    <p>This page is updated automatically every Monday at 9:00 AM ET from the weekly metrics workflow.</p>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>This Week's Top Applications</h2>
<p><strong>Total Access Requests:</strong> ${currentMetrics.accessRequestCount || 0}</p>

<table data-layout="default">
  <tbody>
    <tr>
      <th><p><strong>Rank</strong></p></th>
      <th><p><strong>Application</strong></p></th>
      <th><p><strong>Requests</strong></p></th>
    </tr>
    ${renderAppRows(currentApps, 'No top application requests were captured for this week.')}
  </tbody>
</table>

<h2>Week-over-Week Change</h2>
<p><strong>Prior week:</strong> ${previousMetrics.period}</p>
<p><strong>Prior Access Requests:</strong> ${previousMetrics.accessRequestCount || 0}</p>

<table data-layout="default">
  <tbody>
    <tr>
      <th><p><strong>Application</strong></p></th>
      <th><p><strong>This Week</strong></p></th>
      <th><p><strong>Last Week</strong></p></th>
      <th><p><strong>Delta</strong></p></th>
    </tr>
    ${renderMoverRows(movers)}
  </tbody>
</table>

<h2>Previous Week Top Applications</h2>
<table data-layout="default">
  <tbody>
    <tr>
      <th><p><strong>Rank</strong></p></th>
      <th><p><strong>Application</strong></p></th>
      <th><p><strong>Requests</strong></p></th>
    </tr>
    ${renderAppRows(previousApps, 'No prior-week application requests were captured.')}
  </tbody>
</table>

<p><em>Source: Weekly metrics cache generated by the Monday ISD metrics workflow from Jira service catalog request data.</em></p>
<p><em>Related dashboard: <a href="https://${JIRA_BASE_URL}/wiki/spaces/${CONFLUENCE_SPACE_KEY}/pages/6423805982">ISD Weekly Metrics</a></em></p>
`;
}

async function getConfluencePage() {
  const path = `/wiki/rest/api/content/${CONFLUENCE_PAGE_ID}?expand=body.storage,version`;
  return await makeRequest(JIRA_BASE_URL, path, 'GET', null, {
    'Authorization': AUTH_HEADER
  });
}

async function updateConfluencePage(html) {
  const page = await getConfluencePage();
  const currentVersion = page.version.number;

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

  console.log('✓ Weekly Top Apps Running Report updated successfully');
  console.log(`  Page ID: ${CONFLUENCE_PAGE_ID}`);
  console.log(`  New version: ${currentVersion + 1}`);
  console.log(`  URL: https://${JIRA_BASE_URL}/wiki/spaces/${CONFLUENCE_SPACE_KEY}/pages/${CONFLUENCE_PAGE_ID}`);
}

function loadMetrics() {
  try {
    const data = loadWeeklyMetrics();
    return {
      current: data.currentWeek,
      previous: data.previousWeek
    };
  } catch (error) {
    console.error('✗ Error loading weekly metrics cache:', error.message);
    process.exit(1);
  }
}

async function main() {
  console.log('=== Weekly Top Apps Running Report Generator ===\n');
  const metrics = loadMetrics();
  const html = generateTopAppsHTML(metrics.current, metrics.previous);
  await updateConfluencePage(html);
}

main().catch((error) => {
  console.error('✗ Failed to update Weekly Top Apps Running Report:', error.message);
  process.exit(1);
});
