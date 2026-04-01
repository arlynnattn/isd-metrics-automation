#!/usr/bin/env node

/**
 * Update IT Ops Metrics - Visual Slide Deck
 * Auto-updates the executive slide deck with current month's metrics
 */

const https = require('https');
const { loadMonthlyMetrics } = require('./save-metrics-to-json');

// Configuration
const JIRA_BASE_URL = 'attentivemobile.atlassian.net';
const CONFLUENCE_PAGE_ID = '6440288277'; // IT Ops Metrics - Visual Slide Deck
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

    if (data && method !== 'GET') {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(responseData));
          } catch (e) {
            resolve(responseData);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', reject);
    if (data && method !== 'GET') {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

/**
 * Format hours to "Xh Ym" format
 */
function formatHours(hours) {
  if (!hours) return '0h 0m';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

/**
 * Get current and previous month names
 */
function getMonthNames() {
  const now = new Date();
  const currentMonth = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonth = prev.toLocaleString('en-US', { month: 'long' });

  return { current: currentMonth, previous: previousMonth };
}

/**
 * Update the Visual Slide Deck page
 */
async function updateVisualSlideDeck() {
  console.log('📊 Updating IT Ops Metrics - Visual Slide Deck...\n');

  // Load metrics from JSON
  const metrics = loadMonthlyMetrics();
  if (!metrics || !metrics.currentMonth) {
    throw new Error('No metrics data found. Run update-confluence-monthly-enhanced.js first.');
  }

  const { currentMonth: current, previousMonth: previous } = metrics;
  const months = getMonthNames();

  // Extract key metrics
  const currentTickets = current.resolvedCount || 0;
  const ttfr = formatHours(current.avgTTFR);
  const ttr = formatHours(current.avgTTR);
  const csatScore = current.csat?.avgScore;
  const csat = typeof csatScore === 'number' ? csatScore.toFixed(1) : (csatScore || 'N/A');
  const csatResponses = current.csat?.totalResponses || 0;
  const automationRate = ((current.automatedCount / currentTickets) * 100).toFixed(1);
  const automatedTickets = current.automatedCount || 0;
  const humanTickets = currentTickets - automatedTickets;

  // Workforce data
  const fteOnboarding = current.workforce?.fteOnboarding || 0;
  const contractorOnboarding = current.workforce?.contractorOnboarding || 0;
  const fteOffboarding = current.workforce?.fteOffboarding || 0;
  const contractorOffboarding = current.workforce?.contractorOffboarding || 0;
  const totalOnboarding = fteOnboarding + contractorOnboarding;
  const totalOffboarding = fteOffboarding + contractorOffboarding;
  const netChange = totalOnboarding - totalOffboarding;

  // Previous month for comparison
  const prevOnboarding = (previous.workforce?.fteOnboarding || 0) + (previous.workforce?.contractorOnboarding || 0);
  const prevOffboarding = previous.workforce?.offboarding || 0;

  // Get current page
  console.log('  Fetching current page...');
  const page = await makeRequest(
    JIRA_BASE_URL,
    `/wiki/api/v2/pages/${CONFLUENCE_PAGE_ID}?body-format=storage`,
    'GET',
    null,
    { 'Authorization': AUTH_HEADER }
  );

  let body = page.body.storage.value;

  // Update metrics in the page
  console.log('  Updating metrics...');

  // Update ticket volume
  body = body.replace(/Total Tickets:[^<]*\d+/g, `Total Tickets: ${currentTickets}`);

  // Update response and resolution times
  body = body.replace(/TTFR:[^<]*\d+h \d+m/g, `TTFR: ${ttfr}`);
  body = body.replace(/TTR:[^<]*\d+h \d+m/g, `TTR: ${ttr}`);

  // Update CSAT
  body = body.replace(/CSAT:[^<]*\d+\.\d+\/5\.0/g, `CSAT: ${csat}/5.0`);
  body = body.replace(/from \d+ reviews/g, `from ${csatResponses} reviews`);

  // Update automation
  body = body.replace(/\d+\.\d+% automation rate/g, `${automationRate}% automation rate`);
  body = body.replace(/\d+ tickets.*?\d+ automated/g, `${currentTickets} tickets: ${humanTickets} human, ${automatedTickets} automated`);

  // Update workforce section - find and replace the workforce data
  const workforcePattern = new RegExp(
    `${months.previous}:[^<]*?\\d+ Onboard[^<]*?\\d+ Offboard[^<]*?${months.current}:[^<]*?\\d+ Onboard[^<]*?\\d+ Offboard[^<]*?Net Growth:[^<]*?[+-]\\d+`,
    'gs'
  );

  const workforceReplacement = `${months.previous}: ${prevOnboarding} Onboard   ${prevOffboarding} Offboard   ${months.current}: ${totalOnboarding} Onboard (${fteOnboarding} FTE, ${contractorOnboarding} contractors)   ${totalOffboarding} Offboard (${fteOffboarding} FTE, ${contractorOffboarding} contractors)   Net Growth: ${netChange > 0 ? '+' : ''}${netChange}`;

  if (body.match(workforcePattern)) {
    body = body.replace(workforcePattern, workforceReplacement);
  } else {
    console.log('  ⚠️  Warning: Could not find workforce pattern to update');
  }

  // Update page title to include current month
  const newTitle = `IT Ops Metrics - Visual Slide Deck (${months.current})`;

  // Update the page
  console.log('  Publishing updated page...');
  const updateData = {
    id: CONFLUENCE_PAGE_ID,
    status: 'current',
    title: newTitle,
    body: {
      representation: 'storage',
      value: body
    },
    version: {
      number: page.version.number + 1,
      message: `Auto-updated with ${months.current} metrics: ${currentTickets} tickets, ${ttfr} TTFR, ${ttr} TTR, ${csat}/5.0 CSAT, ${automationRate}% automation, workforce: ${totalOnboarding} onboard/${totalOffboarding} offboard (net ${netChange > 0 ? '+' : ''}${netChange})`
    }
  };

  await makeRequest(
    JIRA_BASE_URL,
    `/wiki/api/v2/pages/${CONFLUENCE_PAGE_ID}`,
    'PUT',
    updateData,
    { 'Authorization': AUTH_HEADER }
  );

  console.log('✅ Visual Slide Deck updated successfully!');
  console.log(`   Version: ${page.version.number + 1}`);
  console.log(`   URL: https://${JIRA_BASE_URL}/wiki/spaces/${CONFLUENCE_SPACE_KEY}/pages/${CONFLUENCE_PAGE_ID}`);
  console.log('');
  console.log('Updated metrics:');
  console.log(`   Total Tickets: ${currentTickets}`);
  console.log(`   TTFR: ${ttfr}`);
  console.log(`   TTR: ${ttr}`);
  console.log(`   CSAT: ${csat}/5.0 (${csatResponses} responses)`);
  console.log(`   Automation: ${automationRate}% (${automatedTickets}/${currentTickets})`);
  console.log(`   Workforce: ${totalOnboarding} onboard (${fteOnboarding} FTE, ${contractorOnboarding} contractors)`);
  console.log(`              ${totalOffboarding} offboard (${fteOffboarding} FTE, ${contractorOffboarding} contractors)`);
  console.log(`              Net: ${netChange > 0 ? '+' : ''}${netChange}`);
}

// Run
updateVisualSlideDeck().catch(error => {
  console.error('❌ Error updating Visual Slide Deck:', error.message);
  process.exit(1);
});
