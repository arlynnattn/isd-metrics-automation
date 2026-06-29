#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

const JIRA_BASE_URL = 'attentivemobile.atlassian.net';
const FIELD_SERVICE_CATALOG = 'customfield_14446';
const FIELD_EMPLOYEE_DEPT = 'customfield_12617';
const FIELD_REQUEST_TYPE = 'customfield_10021';
const REPORT_START_DATE = '2026-01-01';
const OUTPUT_PATH = path.join(__dirname, 'app-support-site', 'data', 'report.json');

const ATLASSIAN_EMAIL = process.env.ATLASSIAN_EMAIL;
const ATLASSIAN_API_TOKEN = process.env.ATLASSIAN_API_TOKEN || process.env.JIRA_API_TOKEN;

if (!ATLASSIAN_EMAIL || !ATLASSIAN_API_TOKEN) {
  console.error('Error: ATLASSIAN_EMAIL and ATLASSIAN_API_TOKEN (or JIRA_API_TOKEN) are required');
  process.exit(1);
}

const AUTH_HEADER = 'Basic ' + Buffer.from(`${ATLASSIAN_EMAIL}:${ATLASSIAN_API_TOKEN}`).toString('base64');

const APP_CONFIGS = [
  {
    id: 'gong',
    label: 'Gong',
    serviceCatalogObjectIds: new Set(['2131']),
    phrases: ['gong'],
    queryTerms: ['"Gong"']
  },
  {
    id: 'zapier',
    label: 'Zapier',
    serviceCatalogObjectIds: new Set(['2000']),
    phrases: ['zapier'],
    queryTerms: ['"Zapier"']
  },
  {
    id: 'attentive-ui',
    label: 'Attentive UI',
    serviceCatalogObjectIds: new Set(['2034']),
    phrases: ['attentive ui', 'attentive-ui', 'ui-superuser-request', 'attentive-ui-prod', 'attentive-ui-stage', 'attentive-ui-devel'],
    queryTerms: ['"Attentive UI"', '"attentive-ui"', '"ui-superuser-request"']
  }
];

const THEME_RULES = [
  {
    id: 'auth-reset',
    label: 'Auth / MFA reset',
    keywords: ['mfa', 'fido', 'finger print', 'fingerprint', 'passkey', 'device trust', 'reset okta', 'reset my mfa']
  },
  {
    id: 'environment-access',
    label: 'Environment or role-specific access',
    keywords: ['admin center', 'superuser', 'prod', 'devel', 'stage', 'staging', 'account group', 'okta group', 'permanent access', 'temporary access', 'coverage']
  },
  {
    id: 'onboarding',
    label: 'Onboarding and new-hire setup',
    keywords: ['onboarding', 'new hire', 'intern']
  },
  {
    id: 'automation',
    label: 'Automation / workflow setup',
    keywords: ['automation', 'automations', 'workflow', 'connector', 'mcp', 'api', 'integration', 'zap']
  },
  {
    id: 'cannot-access',
    label: 'Cannot access / troubleshooting',
    keywords: ['cannot access', 'can’t access', "can't access", 'not allowing', 'error', 'no passkeys available', 'issue', 'unable to access', 'help']
  },
  {
    id: 'access-request',
    label: 'Basic access request',
    keywords: ['requesting', 'request access', 'need access', 'access to', 'grant access', 'access for']
  }
];

function makeRequest(hostname, requestPath, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path: requestPath,
      method,
      headers: {
        Accept: 'application/json',
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
          } catch (error) {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function ensureDirectoryFor(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function normalizeText(value) {
  return (value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function adfToText(node) {
  if (!node) {
    return '';
  }

  if (typeof node === 'string') {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map(adfToText).join(' ');
  }

  const text = typeof node.text === 'string' ? node.text : '';
  const content = Array.isArray(node.content) ? node.content.map(adfToText).join(' ') : '';
  return `${text} ${content}`.trim();
}

function getDescriptionText(description) {
  if (!description) {
    return '';
  }

  if (typeof description === 'string') {
    return description;
  }

  return adfToText(description);
}

function getMonthKey(date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function getMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-').map((part) => Number.parseInt(part, 10));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    year: 'numeric'
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function getMonthsBetween(startDate, endDate) {
  const months = [];
  const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  const limit = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));

  while (cursor <= limit) {
    months.push(getMonthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months;
}

function scoreMatch(text, phrase) {
  return text.includes(phrase) ? phrase.length : 0;
}

function findMatchingApps(issue) {
  const summary = issue.fields.summary || '';
  const description = getDescriptionText(issue.fields.description);
  const combinedText = normalizeText(`${summary} ${description}`);
  const serviceCatalog = Array.isArray(issue.fields[FIELD_SERVICE_CATALOG]) ? issue.fields[FIELD_SERVICE_CATALOG] : [];
  const objectIds = new Set(serviceCatalog.map((entry) => String(entry.objectId)).filter(Boolean));

  const matches = [];
  for (const app of APP_CONFIGS) {
    let matched = false;
    let strength = 0;

    for (const objectId of objectIds) {
      if (app.serviceCatalogObjectIds.has(objectId)) {
        matched = true;
        strength = Math.max(strength, 100);
      }
    }

    for (const phrase of app.phrases) {
      const phraseScore = scoreMatch(combinedText, normalizeText(phrase));
      if (phraseScore > 0) {
        matched = true;
        strength = Math.max(strength, phraseScore);
      }
    }

    if (matched) {
      matches.push({ appId: app.id, strength });
    }
  }

  if (matches.length <= 1) {
    return matches.map((match) => match.appId);
  }

  const strongest = Math.max(...matches.map((match) => match.strength));
  return matches.filter((match) => match.strength === strongest).map((match) => match.appId);
}

function classifyTheme(issue) {
  const summary = issue.fields.summary || '';
  const description = getDescriptionText(issue.fields.description);
  const requestTypeName = issue.fields[FIELD_REQUEST_TYPE]?.requestType?.name || '';
  const text = normalizeText(`${summary} ${description} ${requestTypeName}`);

  for (const rule of THEME_RULES) {
    if (rule.keywords.some((keyword) => text.includes(normalizeText(keyword)))) {
      return {
        id: rule.id,
        label: rule.label
      };
    }
  }

  return {
    id: 'other',
    label: 'Other support ask'
  };
}

function buildAppRecord(app, monthKeys) {
  return {
    id: app.id,
    label: app.label,
    totalTickets: 0,
    monthlyCounts: Object.fromEntries(monthKeys.map((key) => [key, 0])),
    departments: {},
    themes: {},
    tickets: []
  };
}

function updateCount(map, key) {
  map[key] = (map[key] || 0) + 1;
}

function compactTopMap(map, limit, valueLabel) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({
      label,
      count,
      shareLabel: `${count} ${valueLabel}`
    }));
}

function summarizeThemes(themeMap) {
  return Object.values(themeMap)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .map((theme) => ({
      id: theme.id,
      label: theme.label,
      count: theme.count,
      examples: theme.examples
        .sort((a, b) => new Date(b.resolutionDate) - new Date(a.resolutionDate))
        .slice(0, 3)
    }));
}

function buildRecommendations(appSummary) {
  const topThemes = appSummary.themes.slice(0, 2).map((theme) => theme.id);
  const recommendations = [];

  if (topThemes.includes('access-request') || topThemes.includes('onboarding')) {
    recommendations.push('Reduce repeat access tickets with role-based default access and manager self-service request presets.');
  }

  if (topThemes.includes('environment-access')) {
    recommendations.push('Clarify permanent vs temporary environment access rules and publish standard group mappings by role.');
  }

  if (topThemes.includes('auth-reset')) {
    recommendations.push('Move MFA and FIDO recovery into a short self-serve guide with a reset decision tree.');
  }

  if (topThemes.includes('automation')) {
    recommendations.push('Provide a lightweight intake template for automation use cases so approvals and connector questions are handled consistently.');
  }

  if (topThemes.includes('cannot-access')) {
    recommendations.push('Add troubleshooting steps at the point of request so users can rule out common access or device issues before filing a ticket.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Review the top examples for this app and convert the repeat pattern into a documented request path.');
  }

  return recommendations.slice(0, 3);
}

async function fetchRelevantIssues() {
  const today = new Date();
  const endDate = today.toISOString().slice(0, 10);
  const textQuery = APP_CONFIGS.flatMap((app) => app.queryTerms)
    .map((term) => `text ~ ${term}`)
    .join(' OR ');

  const jql = `project = ISD AND resolved >= "${REPORT_START_DATE}" AND resolved <= "${endDate}" AND (${textQuery}) ORDER BY resolved DESC`;
  const fields = ['summary', 'description', 'resolutiondate', 'status', FIELD_SERVICE_CATALOG, FIELD_EMPLOYEE_DEPT, FIELD_REQUEST_TYPE];

  let issues = [];
  let nextPageToken = null;

  do {
    let requestPath = `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=100&fields=${fields.join(',')}`;
    if (nextPageToken) {
      requestPath += `&nextPageToken=${encodeURIComponent(nextPageToken)}`;
    }

    const response = await makeRequest(JIRA_BASE_URL, requestPath, 'GET', null, {
      Authorization: AUTH_HEADER
    });

    issues = issues.concat(response.issues || []);
    nextPageToken = response.nextPageToken || null;
  } while (nextPageToken);

  return issues;
}

function buildReport(issues) {
  const startDate = new Date(`${REPORT_START_DATE}T00:00:00.000Z`);
  const endDate = new Date();
  const monthKeys = getMonthsBetween(startDate, endDate);
  const appRecords = new Map(APP_CONFIGS.map((app) => [app.id, buildAppRecord(app, monthKeys)]));

  for (const issue of issues) {
    const matchedApps = findMatchingApps(issue);
    if (matchedApps.length === 0 || !issue.fields.resolutiondate) {
      continue;
    }

    const resolutionDate = new Date(issue.fields.resolutiondate);
    const monthKey = getMonthKey(resolutionDate);
    const department = issue.fields[FIELD_EMPLOYEE_DEPT] || 'Unknown';
    const theme = classifyTheme(issue);
    const requestTypeName = issue.fields[FIELD_REQUEST_TYPE]?.requestType?.name || 'Unknown';
    const ticketSummary = {
      key: issue.key,
      summary: issue.fields.summary || '(no summary)',
      resolutionDate: issue.fields.resolutiondate,
      department,
      requestType: requestTypeName,
      webUrl: issue.webUrl
    };

    for (const appId of matchedApps) {
      const appRecord = appRecords.get(appId);
      appRecord.totalTickets += 1;
      updateCount(appRecord.monthlyCounts, monthKey);
      updateCount(appRecord.departments, department);

      if (!appRecord.themes[theme.id]) {
        appRecord.themes[theme.id] = {
          id: theme.id,
          label: theme.label,
          count: 0,
          examples: []
        };
      }

      appRecord.themes[theme.id].count += 1;
      if (appRecord.themes[theme.id].examples.length < 6) {
        appRecord.themes[theme.id].examples.push(ticketSummary);
      }

      if (appRecord.tickets.length < 30) {
        appRecord.tickets.push(ticketSummary);
      }
    }
  }

  const apps = Array.from(appRecords.values()).map((record) => {
    const monthlySeries = monthKeys.map((monthKey) => ({
      monthKey,
      label: getMonthLabel(monthKey),
      count: record.monthlyCounts[monthKey] || 0
    }));

    const themes = summarizeThemes(record.themes);
    return {
      id: record.id,
      label: record.label,
      totalTickets: record.totalTickets,
      monthlySeries,
      departmentBreakdown: compactTopMap(record.departments, 5, 'tickets'),
      themes,
      recommendations: buildRecommendations({ themes }),
      recentExamples: record.tickets
        .sort((a, b) => new Date(b.resolutionDate) - new Date(a.resolutionDate))
        .slice(0, 8)
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    reportWindow: {
      startDate: REPORT_START_DATE,
      endDate: new Date().toISOString().slice(0, 10)
    },
    methodology: [
      'Includes Jira tickets in project ISD resolved from January 1, 2026 through today.',
      'Matches tickets by app name in summary or description, plus known Service Catalog object IDs where available.',
      'Groups user asks into lightweight themes based on summary, description, and request type keywords.'
    ],
    apps
  };
}

async function main() {
  console.log('=== App Support Burden Report Generator ===');
  console.log(`Window start: ${REPORT_START_DATE}`);

  const issues = await fetchRelevantIssues();
  console.log(`Fetched ${issues.length} Jira issues mentioning target apps`);

  const report = buildReport(issues);
  ensureDirectoryFor(OUTPUT_PATH);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));

  console.log(`Saved report JSON to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(`Error generating app support burden report: ${error.message}`);
  process.exit(1);
});
