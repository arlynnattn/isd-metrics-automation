#!/usr/bin/env node

/**
 * Weekly Top Apps Running Report
 * Rebuilds a weekly top-apps history from Jira starting with the first
 * full Monday-Sunday week of January 2026 and updates Confluence page:
 * https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6669565981
 */

const https = require('https');

const JIRA_BASE_URL = 'attentivemobile.atlassian.net';
const CONFLUENCE_PAGE_ID = '6669565981';
const CONFLUENCE_SPACE_KEY = 'ISD';
const ASSETS_WORKSPACE_ID = '0e0847de-b6ef-45db-b74f-45e404e34d0c';

const FIELD_SERVICE_CATALOG = 'customfield_14446';
const FIELD_EMPLOYEE_DEPT = 'customfield_12617';
const FIELD_REQUEST_TYPE = 'customfield_10021';
const HISTORY_START_MONDAY = '2026-01-05';
const RESOLVED_STATUSES = '"13. Done", Canceled, Closed, Completed, Declined, Resolved';

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

function formatEtDate(date, opts = {}) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...opts
  }).format(date);
}

function getTimeZoneDate(timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const year = Number.parseInt(parts.find((part) => part.type === 'year').value, 10);
  const month = Number.parseInt(parts.find((part) => part.type === 'month').value, 10);
  const day = Number.parseInt(parts.find((part) => part.type === 'day').value, 10);

  return new Date(Date.UTC(year, month - 1, day));
}

function parseDateOnly(value) {
  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getMondayUtc(date) {
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

function getSundayUtc(monday) {
  return addDays(monday, 6);
}

function formatDateOnlyUtc(date) {
  return date.toISOString().slice(0, 10);
}

function getHistoryWindow() {
  const todayEt = getTimeZoneDate('America/New_York');
  const currentWeekMonday = getMondayUtc(todayEt);
  const lastCompletedSunday = addDays(currentWeekMonday, -1);
  const startMonday = parseDateOnly(HISTORY_START_MONDAY);

  return {
    startMonday,
    lastCompletedSunday
  };
}

async function getServiceCatalogLabel(objectId) {
  const path = `/gateway/api/jsm/assets/workspace/${ASSETS_WORKSPACE_ID}/v1/object/${objectId}`;
  const response = await makeRequest(JIRA_BASE_URL, path, 'GET', null, {
    'Authorization': AUTH_HEADER
  });
  return response.label || null;
}

async function buildServiceCatalogCache(issues) {
  const objectIds = new Set();

  for (const issue of issues) {
    const serviceCatalog = issue.fields[FIELD_SERVICE_CATALOG];
    if (!Array.isArray(serviceCatalog)) {
      continue;
    }

    for (const entry of serviceCatalog) {
      if (entry.objectId) {
        objectIds.add(entry.objectId);
      }
    }
  }

  const cache = {};
  for (const objectId of objectIds) {
    try {
      const label = await getServiceCatalogLabel(objectId);
      if (label) {
        cache[objectId] = label;
      }
    } catch (error) {
      console.warn(`Warning: Could not fetch Service Catalog label for object ${objectId}: ${error.message}`);
    }
  }

  return cache;
}

async function fetchHistoricalIssues(startMonday, endSunday) {
  const fields = ['resolutiondate', 'issuetype', FIELD_REQUEST_TYPE, FIELD_SERVICE_CATALOG, FIELD_EMPLOYEE_DEPT];
  const jql = `project = ISD AND resolutiondate >= "${formatDateOnlyUtc(startMonday)}" AND resolutiondate <= "${formatDateOnlyUtc(endSunday)}" AND status in (${RESOLVED_STATUSES})`;

  let allIssues = [];
  let nextPageToken = null;
  let isLast = false;

  while (!isLast) {
    let path = `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=1000&fields=${fields.join(',')}`;
    if (nextPageToken) {
      path += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;
    }

    const response = await makeRequest(JIRA_BASE_URL, path, 'GET', null, {
      'Authorization': AUTH_HEADER
    });

    allIssues = allIssues.concat(response.issues || []);
    isLast = response.isLast !== false;
    nextPageToken = response.nextPageToken;
  }

  return allIssues;
}

function isAccessRequest(issue) {
  const requestType = issue.fields[FIELD_REQUEST_TYPE];
  const issueType = issue.fields.issuetype?.name || '';

  return Boolean(
    requestType &&
    (requestType.requestType?.name?.toLowerCase().includes('access') ||
      issueType.toLowerCase().includes('access'))
  );
}

function initWeeklyBucket(monday) {
  return {
    weekStart: monday,
    weekEnd: getSundayUtc(monday),
    totalAccessRequests: 0,
    appCounts: {},
    departmentCounts: {}
  };
}

function buildWeekBuckets(startMonday, lastCompletedSunday) {
  const weeks = [];
  const weekMap = new Map();

  for (let monday = new Date(startMonday); monday <= lastCompletedSunday; monday = addDays(monday, 7)) {
    const key = formatDateOnlyUtc(monday);
    const bucket = initWeeklyBucket(monday);
    weeks.push(bucket);
    weekMap.set(key, bucket);
  }

  return { weeks, weekMap };
}

function aggregateWeeklyData(issues, serviceCatalogCache, startMonday, lastCompletedSunday) {
  const { weeks, weekMap } = buildWeekBuckets(startMonday, lastCompletedSunday);

  for (const issue of issues) {
    if (!isAccessRequest(issue) || !issue.fields.resolutiondate) {
      continue;
    }

    const resolvedDate = new Date(issue.fields.resolutiondate);
    const weekStart = getMondayUtc(new Date(Date.UTC(
      resolvedDate.getUTCFullYear(),
      resolvedDate.getUTCMonth(),
      resolvedDate.getUTCDate()
    )));
    const weekKey = formatDateOnlyUtc(weekStart);
    const bucket = weekMap.get(weekKey);

    if (!bucket) {
      continue;
    }

    bucket.totalAccessRequests++;

    const department = issue.fields[FIELD_EMPLOYEE_DEPT] || 'Unknown';
    bucket.departmentCounts[department] = (bucket.departmentCounts[department] || 0) + 1;

    const serviceCatalog = issue.fields[FIELD_SERVICE_CATALOG];
    if (!Array.isArray(serviceCatalog)) {
      continue;
    }

    for (const entry of serviceCatalog) {
      const appName = serviceCatalogCache[entry.objectId];
      if (!appName) {
        continue;
      }

      bucket.appCounts[appName] = (bucket.appCounts[appName] || 0) + 1;
    }
  }

  return weeks.map((bucket) => ({
    ...bucket,
    topApps: Object.entries(bucket.appCounts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10),
    topDepartments: Object.entries(bucket.departmentCounts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10)
  }));
}

function buildCumulativeLeaderboard(weeklyRows, key) {
  const totals = new Map();

  for (const row of weeklyRows) {
    for (const [name, count] of Object.entries(row[key] || {})) {
      totals.set(name, (totals.get(name) || 0) + count);
    }
  }

  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 15);
}

function renderCumulativeRows(entries) {
  if (!entries.length) {
    return `
    <tr>
      <td colspan="3"><p>No cumulative app activity found for the selected history window.</p></td>
    </tr>`;
  }

  return entries.map(([app, count], index) => `
    <tr>
      <td><p>${index + 1}</p></td>
      <td><p>${app}</p></td>
      <td><p>${count}</p></td>
    </tr>
  `).join('');
}

function formatRankedApp(apps, index) {
  const entry = apps[index];
  if (!entry) {
    return '—';
  }

  return `${entry[0]} (${entry[1]})`;
}

function renderWeeklyRows(weeklyRows) {
  return weeklyRows.map((row) => `
    <tr>
      <td><p>${formatEtDate(row.weekStart, { month: 'short', day: 'numeric' })} - ${formatEtDate(row.weekEnd, { month: 'short', day: 'numeric', year: 'numeric' })}</p></td>
      <td><p>${row.totalAccessRequests}</p></td>
      <td><p>${formatRankedApp(row.topApps, 0)}</p></td>
      <td><p>${formatRankedApp(row.topApps, 1)}</p></td>
      <td><p>${formatRankedApp(row.topApps, 2)}</p></td>
      <td><p>${formatRankedApp(row.topApps, 3)}</p></td>
      <td><p>${formatRankedApp(row.topApps, 4)}</p></td>
    </tr>
  `).join('');
}

function renderWeeklyDepartmentRows(weeklyRows) {
  return weeklyRows.map((row) => `
    <tr>
      <td><p>${formatEtDate(row.weekStart, { month: 'short', day: 'numeric' })} - ${formatEtDate(row.weekEnd, { month: 'short', day: 'numeric', year: 'numeric' })}</p></td>
      <td><p>${row.totalAccessRequests}</p></td>
      <td><p>${formatRankedApp(row.topDepartments, 0)}</p></td>
      <td><p>${formatRankedApp(row.topDepartments, 1)}</p></td>
      <td><p>${formatRankedApp(row.topDepartments, 2)}</p></td>
    </tr>
  `).join('');
}

function generateHistoricalHtml(weeklyRows) {
  const generatedAt = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'long',
    timeStyle: 'short'
  });
  const cumulativeApps = buildCumulativeLeaderboard(weeklyRows, 'appCounts');
  const cumulativeDepartments = buildCumulativeLeaderboard(weeklyRows, 'departmentCounts');
  const latestWeek = weeklyRows[weeklyRows.length - 1] || {
    weekStart: parseDateOnly(HISTORY_START_MONDAY),
    weekEnd: getSundayUtc(parseDateOnly(HISTORY_START_MONDAY))
  };
  const totalRequests = weeklyRows.reduce((sum, row) => sum + row.totalAccessRequests, 0);

  return `
<h1>ISD Weekly Top Apps Running Report</h1>
<p><em>Last updated: ${generatedAt} ET</em></p>
<p><strong>History window:</strong> first full Monday-Sunday week of January 2026 through the latest completed week</p>

<ac:structured-macro ac:name="info">
  <ac:rich-text-body>
    <p><strong>Coverage:</strong> ${weeklyRows.length} completed weeks since January 2026.</p>
    <p><strong>Total access requests in history:</strong> ${totalRequests}</p>
    <p><strong>Latest completed week:</strong> ${formatEtDate(latestWeek.weekStart, { month: 'short', day: 'numeric' })} - ${formatEtDate(latestWeek.weekEnd, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
    <p>This page updates automatically every Monday at 9:00 AM ET as part of the weekly metrics workflow.</p>
  </ac:rich-text-body>
</ac:structured-macro>

<h2>Cumulative Top Applications Since January 2026</h2>
<table data-layout="default">
  <tbody>
    <tr>
      <th><p><strong>Rank</strong></p></th>
      <th><p><strong>Application</strong></p></th>
      <th><p><strong>Total Requests</strong></p></th>
    </tr>
    ${renderCumulativeRows(cumulativeApps)}
  </tbody>
</table>

<h2>Cumulative Top Departments Since January 2026</h2>
<table data-layout="default">
  <tbody>
    <tr>
      <th><p><strong>Rank</strong></p></th>
      <th><p><strong>Department</strong></p></th>
      <th><p><strong>Total Requests</strong></p></th>
    </tr>
    ${renderCumulativeRows(cumulativeDepartments)}
  </tbody>
</table>

<h2>Weekly Top Apps Timeline</h2>
<p><em>One row per completed week, ordered from January 2026 forward so week-to-week app demand shifts are easy to scan.</em></p>
<table data-layout="wide">
  <tbody>
    <tr>
      <th><p><strong>Week</strong></p></th>
      <th><p><strong>Access Requests</strong></p></th>
      <th><p><strong>Top 1</strong></p></th>
      <th><p><strong>Top 2</strong></p></th>
      <th><p><strong>Top 3</strong></p></th>
      <th><p><strong>Top 4</strong></p></th>
      <th><p><strong>Top 5</strong></p></th>
    </tr>
    ${renderWeeklyRows(weeklyRows)}
  </tbody>
</table>

<h2>Weekly Top Departments Timeline</h2>
<p><em>Departments are grouped from the same access-request tickets so the department and app timelines can be compared week by week.</em></p>
<table data-layout="wide">
  <tbody>
    <tr>
      <th><p><strong>Week</strong></p></th>
      <th><p><strong>Access Requests</strong></p></th>
      <th><p><strong>Top Dept 1</strong></p></th>
      <th><p><strong>Top Dept 2</strong></p></th>
      <th><p><strong>Top Dept 3</strong></p></th>
    </tr>
    ${renderWeeklyDepartmentRows(weeklyRows)}
  </tbody>
</table>

<p><em>Source: Jira resolved access-request tickets grouped into completed Monday-Sunday weeks using Service Catalog application labels and employee department metadata.</em></p>
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

async function main() {
  console.log('=== Weekly Top Apps Running Report Generator ===\n');

  const { startMonday, lastCompletedSunday } = getHistoryWindow();
  console.log(`History start week: ${formatDateOnlyUtc(startMonday)}`);
  console.log(`Latest completed week end: ${formatDateOnlyUtc(lastCompletedSunday)}`);

  const issues = await fetchHistoricalIssues(startMonday, lastCompletedSunday);
  console.log(`Fetched ${issues.length} resolved issues in history window`);

  const serviceCatalogCache = await buildServiceCatalogCache(issues);
  console.log(`Cached ${Object.keys(serviceCatalogCache).length} service catalog labels`);

  const weeklyRows = aggregateWeeklyData(issues, serviceCatalogCache, startMonday, lastCompletedSunday);
  console.log(`Built ${weeklyRows.length} weekly history rows`);

  const html = generateHistoricalHtml(weeklyRows);
  await updateConfluencePage(html);
}

main().catch((error) => {
  console.error('✗ Failed to update Weekly Top Apps Running Report:', error.message);
  process.exit(1);
});
