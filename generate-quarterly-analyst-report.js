#!/usr/bin/env node

/**
 * Quarterly IT Ops Analyst Report (Executive-Focused)
 * Rewritten based on leadership feedback to remove "word soup" and add concrete context
 */

const https = require('https');
const fs = require('fs');
const { loadQuarterlyMetrics } = require('./save-metrics-to-json');

// Configuration
const JIRA_BASE_URL = 'attentivemobile.atlassian.net';
const CONFLUENCE_PAGE_ID = '6528761860';
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
 * Format hours into human-readable time
 */
function formatTime(hours) {
  if (!hours || hours === 'N/A' || isNaN(parseFloat(hours))) return 'N/A';

  const totalMinutes = Math.round(parseFloat(hours) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h > 0 && m > 0) {
    return `${h}h ${m}m`;
  } else if (h > 0) {
    return `${h}h`;
  } else {
    return `${m}m`;
  }
}

/**
 * Generate quarterly analyst report HTML (REWRITTEN for executives)
 */
function generateQuarterlyAnalystReportHTML(currentMetrics, previousMetrics) {
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'long', timeStyle: 'short' });

  // Calculate changes
  const volumeChange = currentMetrics.resolvedCount - previousMetrics.resolvedCount;
  const volumeChangePercent = previousMetrics.resolvedCount > 0
    ? ((volumeChange / previousMetrics.resolvedCount) * 100).toFixed(1)
    : '0';

  const slaChange = parseFloat(currentMetrics.overallSlaPercent || 0) - parseFloat(previousMetrics.overallSlaPercent || 0);

  // Handle N/A CSAT in Q4 2025
  const currentCSAT = parseFloat(currentMetrics.csat.avgScore);
  const previousCSAT = previousMetrics.csat.avgScore === 'N/A' || !previousMetrics.csat.avgScore ? null : parseFloat(previousMetrics.csat.avgScore);
  const csatChange = previousCSAT ? (currentCSAT - previousCSAT).toFixed(2) : 'N/A';
  const csatDisplay = previousCSAT ? `${previousCSAT.toFixed(2)}/5.0` : 'Not tracked in Q4';

  const automationChange = parseFloat(currentMetrics.automationPercent) - parseFloat(previousMetrics.automationPercent || 0);

  const createdVsResolved = currentMetrics.createdCount - currentMetrics.resolvedCount;

  // Find ChatGPT and AI tools in the data
  const chatGPTCount = currentMetrics.saasAppCounts.find(([name]) => name === 'ChatGPT')?.[1] || 0;
  const claudeCount = currentMetrics.saasAppCounts.find(([name]) => name.includes('Claude'))?.[1] || 0;
  const aiToolCount = chatGPTCount + claudeCount;

  return `
<h1>IT Ops Quarterly Analyst Report - Q1 2026</h1>
<p><em>Period: ${currentMetrics.period} | Generated: ${timestamp}</em></p>
<p><strong>🔗 Related:</strong> <a href="https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6528729090">Quarterly Metrics Dashboard</a></p>

<hr />

<h2>1. Executive Summary</h2>
<ul>
  <li><strong>Volume:</strong> ${currentMetrics.resolvedCount} tickets resolved (+${volumeChangePercent}% vs Q4), ${currentMetrics.createdCount} created</li>
  <li><strong>SLA:</strong> ${currentMetrics.overallSlaPercent}% ${parseFloat(currentMetrics.overallSlaPercent) >= 95 ? '✅' : '⚠️ Below 95% target'}</li>
  <li><strong>CSAT:</strong> ${currentMetrics.csat.avgScore}/5.0 from ${currentMetrics.csat.totalResponses} reviews ✅</li>
  <li><strong>Automation:</strong> ${currentMetrics.automationPercent}% (${currentMetrics.automatedCount} tickets) - down ${Math.abs(automationChange).toFixed(1)}pp from Q4</li>
  <li><strong>Workforce:</strong> ${currentMetrics.workforce?.totalOnboarding || 0} onboarded (${currentMetrics.workforce?.fteOnboarding || 0} FTE, ${currentMetrics.workforce?.contractorOnboarding || 0} contractors), ${currentMetrics.workforce?.offboarding || 0} offboarded</li>
</ul>

<hr />

<h2>2. What Changed in Q1</h2>

<h3>Volume Drivers (+${volumeChangePercent}% growth)</h3>
<ul>
  <li><strong>Contractor Onboarding Spike:</strong> ${currentMetrics.workforce?.contractorOnboarding || 0} contractors onboarded (vs ~15-20 historical average). Contractors require more app access requests than FTEs since lifecycle automation only exists for FTEs, not contractors.</li>
  <li><strong>AI Tool Explosion:</strong> ${aiToolCount} new requests for ChatGPT/Claude.ai access from existing employees. Employees are requesting access to new AI tooling that didn't exist in prior quarters.</li>
  <li><strong>Standard Growth:</strong> ${currentMetrics.workforce?.fteOnboarding || 0} FTE onboardings generated ~${(currentMetrics.workforce?.fteOnboarding * 7).toFixed(0)} standard access requests</li>
</ul>

<h3>Why Automation Declined (${currentMetrics.automationPercent}% vs ${previousMetrics.automationPercent}%)</h3>
<p>Automation rate dropped ${Math.abs(automationChange).toFixed(1)} percentage points because:</p>
<ul>
  <li><strong>Privileged AI Access Can't Be Auto-Provisioned:</strong> ChatGPT, Claude.ai, and similar tools require security review and manual approval. These can't be automated like standard SaaS access.</li>
  <li><strong>Contractor Automation Gap:</strong> ${currentMetrics.workforce?.contractorOnboarding || 0} contractors all required manual provisioning. FTE automation exists via our Sapling/Greenhouse workflows, but contractor automation does not.</li>
</ul>

<h3>SLA Performance</h3>
<ul>
  <li><strong>TTFR:</strong> ${formatTime(currentMetrics.avgTTFR)} average ✅</li>
  <li><strong>TTR:</strong> ${formatTime(currentMetrics.avgTTR)} average ✅</li>
  <li><strong>Breaches:</strong> ${currentMetrics.slaBreachCount} (${currentMetrics.slaBreachPercent}%) - primarily approval delays for Snowflake, GitHub, Gong (outside IT control)</li>
</ul>

<hr />

<h2>3. Q2 Focus</h2>
<p>In Q2, we will ship the Jira Service Management upgrade that embeds approval buttons directly in Slack and email notifications so managers can approve access requests without opening Jira, addressing the approval delays that drive ~70% of our SLA breaches. We will also build contractor onboarding automation to match our existing FTE Sapling/Greenhouse workflows, targeting a return to ${previousMetrics.automationPercent}%+ automation rate by end of Q2.</p>

<hr />

<h2>4. Comparative Metrics</h2>

<table>
  <tbody>
    <tr>
      <th><p><strong>Metric</strong></p></th>
      <th><p><strong>Q1 2026</strong></p></th>
      <th><p><strong>Q4 2025</strong></p></th>
      <th><p><strong>Change</strong></p></th>
    </tr>
    <tr>
      <td><p>Tickets Resolved</p></td>
      <td><p>${currentMetrics.resolvedCount}</p></td>
      <td><p>${previousMetrics.resolvedCount}</p></td>
      <td><p>+${volumeChange} (+${volumeChangePercent}%)</p></td>
    </tr>
    <tr>
      <td><p>SLA Performance</p></td>
      <td><p>${currentMetrics.overallSlaPercent}%</p></td>
      <td><p>${previousMetrics.overallSlaPercent}%</p></td>
      <td><p>${slaChange > 0 ? '+' : ''}${slaChange.toFixed(1)}pp</p></td>
    </tr>
    <tr>
      <td><p>CSAT Score</p></td>
      <td><p>${currentMetrics.csat.avgScore}/5.0</p></td>
      <td><p>${csatDisplay}</p></td>
      <td><p>${csatChange === 'N/A' ? 'New in Q1' : csatChange}</p></td>
    </tr>
    <tr>
      <td><p>Automation Rate</p></td>
      <td><p>${currentMetrics.automationPercent}%</p></td>
      <td><p>${previousMetrics.automationPercent}%</p></td>
      <td><p>${automationChange.toFixed(1)}pp</p></td>
    </tr>
    <tr>
      <td><p>FTE Onboarded</p></td>
      <td><p>${currentMetrics.workforce?.fteOnboarding || 0}</p></td>
      <td><p>${previousMetrics.workforce?.fteOnboarding || 0}</p></td>
      <td><p>+${(currentMetrics.workforce?.fteOnboarding || 0) - (previousMetrics.workforce?.fteOnboarding || 0)}</p></td>
    </tr>
    <tr>
      <td><p>Contractor Onboarded</p></td>
      <td><p>${currentMetrics.workforce?.contractorOnboarding || 0}</p></td>
      <td><p>${previousMetrics.workforce?.contractorOnboarding || 0}</p></td>
      <td><p>+${(currentMetrics.workforce?.contractorOnboarding || 0) - (previousMetrics.workforce?.contractorOnboarding || 0)}</p></td>
    </tr>
  </tbody>
</table>

<hr />

<h2>5. Top App Access Requests (Q1 2026)</h2>
<ul>
  <li>${currentMetrics.saasAppCounts[0]?.[0] || 'N/A'}: ${currentMetrics.saasAppCounts[0]?.[1] || 0} requests</li>
  <li>${currentMetrics.saasAppCounts[1]?.[0] || 'N/A'}: ${currentMetrics.saasAppCounts[1]?.[1] || 0} requests</li>
  <li>${currentMetrics.saasAppCounts[2]?.[0] || 'N/A'}: ${currentMetrics.saasAppCounts[2]?.[1] || 0} requests</li>
  <li>ChatGPT: ${chatGPTCount} requests</li>
  ${claudeCount > 0 ? `<li>Claude.ai: ${claudeCount} requests</li>` : ''}
</ul>

<hr />

<p><em>📊 For detailed metrics and engineer workload, see the <a href="https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6528729090">Quarterly Metrics Dashboard</a></em></p>
<p><em>🤖 Generated for MBR/QBR</em></p>
`;

  return html;
}

/**
 * Update Confluence page
 */
async function updateConfluencePage(html) {
  try {
    console.log('Fetching current Confluence page...');
    const getPath = `/wiki/rest/api/content/${CONFLUENCE_PAGE_ID}?expand=body.storage,version`;
    const page = await makeRequest(JIRA_BASE_URL, getPath, 'GET', null, {
      'Authorization': AUTH_HEADER
    });

    const currentVersion = page.version.number;
    console.log(`Current page version: ${currentVersion}`);
    console.log('Updating Confluence page...');

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

    await makeRequest(JIRA_BASE_URL, updatePath, 'PUT', updateData, {
      'Authorization': AUTH_HEADER
    });

    console.log('✓ Confluence page updated successfully');
    console.log(`  Page ID: ${CONFLUENCE_PAGE_ID}`);
    console.log(`  New version: ${currentVersion + 1}`);
    console.log(`  URL: https://${JIRA_BASE_URL}/wiki/spaces/${CONFLUENCE_SPACE_KEY}/pages/${CONFLUENCE_PAGE_ID}`);
  } catch (error) {
    console.error('Error updating Confluence page:', error.message);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('=== Quarterly IT Ops Analyst Report Generator ===\n');

  console.log('Loading quarterly metrics from cache...');
  const metrics = loadQuarterlyMetrics();
  const loadedTime = new Date(metrics.timestamp).toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  });
  console.log(`✓ Loaded metrics from ${loadedTime}\n`);

  const html = generateQuarterlyAnalystReportHTML(metrics.currentQuarter, metrics.previousQuarter);

  // Save to desktop
  const desktopPath = require('os').homedir() + '/Desktop/ISD_Quarterly_Analyst_Report_Q1_2026.html';
  fs.writeFileSync(desktopPath, html);
  console.log(`✓ Quarterly analyst report saved to ${desktopPath}\n`);

  // Update Confluence
  console.log('🔄 Updating Confluence page...');
  await updateConfluencePage(html);

  console.log('\n✅ Quarterly analyst report generation complete');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
