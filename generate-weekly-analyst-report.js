#!/usr/bin/env node

/**
 * Weekly IT Ops Analyst Report
 * Generates executive-style analysis and insights from weekly metrics
 */

const https = require('https');
const fs = require('fs');
const { loadWeeklyMetrics } = require('./save-metrics-to-json');
const {
  compareToTarget,
  formatTime,
  parseFormattedTime,
  getDataQualityIssues,
  getNarrativeConfidence,
  calculateAdjustedMetrics,
  generateValidationStatusBlock
} = require('./shared-metrics');
const { loadValidationResults } = require('./validate-metrics');

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

  // Parse TTFR/TTR from formatted strings to raw hours if needed
  const currentTTFR = typeof currentMetrics.avgTTFR === 'string' ? parseFormattedTime(currentMetrics.avgTTFR) || parseFloat(currentMetrics.avgTTFR) : parseFloat(currentMetrics.avgTTFR);
  const currentTTR = typeof currentMetrics.avgTTR === 'string' ? parseFormattedTime(currentMetrics.avgTTR) || parseFloat(currentMetrics.avgTTR) : parseFloat(currentMetrics.avgTTR);

  // Use shared-metrics module for target comparisons
  const ttfrComparison = compareToTarget('ttfr', currentTTFR);
  const ttrComparison = compareToTarget('ttr', currentTTR);
  const slaComparison = compareToTarget('slaPercent', parseFloat(currentMetrics.overallSlaPercent));
  const csatComparison = compareToTarget('csat', parseFloat(currentMetrics.csat.avgScore));
  const automationComparison = compareToTarget('automationPercent', parseFloat(currentMetrics.automationPercent));

  // Calculate key changes
  const volumeChange = currentMetrics.resolvedCount - previousMetrics.resolvedCount;
  const volumeChangePercent = previousMetrics.resolvedCount > 0
    ? ((volumeChange / previousMetrics.resolvedCount) * 100).toFixed(1)
    : 'N/A';

  const slaChange = parseFloat(currentMetrics.overallSlaPercent) - parseFloat(previousMetrics.overallSlaPercent);

  // Check for data quality issues
  const dataQualityIssues = getDataQualityIssues(
    new Date(currentMetrics.start),
    new Date(currentMetrics.end)
  );

  // Get validation results
  const validationResults = loadValidationResults();
  const weeklyValidation = validationResults.weekly || { valid: true, errors: [], warnings: [] };

  // Generate validation status block
  const validationStatus = generateValidationStatusBlock(weeklyValidation, dataQualityIssues);

  // Calculate adjusted metrics if anomalies exist
  const adjustedMetricsData = calculateAdjustedMetrics(
    { avgTTFR: currentTTFR, avgTTR: currentTTR, overallSlaPercent: currentMetrics.overallSlaPercent },
    dataQualityIssues
  );

  // Get narrative confidence level
  const narrativeConfidence = getNarrativeConfidence(dataQualityIssues, ['avgTTFR', 'avgTTR', 'slaPercent']);

  // Build adjusted metrics section if applicable
  let adjustedMetricsSection = '';
  if (adjustedMetricsData.hasAdjustedMetrics) {
    const adj = adjustedMetricsData.adjusted;
    const adjTTFRComparison = compareToTarget('ttfr', adj.avgTTFR);
    const adjTTRComparison = compareToTarget('ttr', adj.avgTTR);

    adjustedMetricsSection = `
<div style="border: 2px solid #4a90e2; background-color: #f0f8ff; padding: 15px; margin: 20px 0; border-radius: 5px;">
<h2>📊 Raw vs Adjusted Metrics</h2>
<p><strong>Data Quality Notice:</strong> This period includes a known anomaly. Both raw (system-of-record) and adjusted (anomaly-excluded) metrics are provided.</p>

<h3>Time to First Response (TTFR)</h3>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #e8f4f8;">
    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Metric Type</th>
    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Value</th>
    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">vs Target</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd;"><strong>Raw (System of Record)</strong></td>
    <td style="padding: 8px; border: 1px solid #ddd;">${formatTime(currentTTFR)}</td>
    <td style="padding: 8px; border: 1px solid #ddd;">${ttfrComparison.emoji} ${ttfrComparison.description}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd;"><strong>Adjusted (Anomaly Excluded)</strong></td>
    <td style="padding: 8px; border: 1px solid #ddd;">${formatTime(adj.avgTTFR)}</td>
    <td style="padding: 8px; border: 1px solid #ddd;">${adjTTFRComparison.emoji} ${adjTTFRComparison.description}</td>
  </tr>
</table>

<h3>Time to Resolution (TTR)</h3>
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #e8f4f8;">
    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Metric Type</th>
    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Value</th>
    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">vs Target</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd;"><strong>Raw (System of Record)</strong></td>
    <td style="padding: 8px; border: 1px solid #ddd;">${formatTime(currentTTR)}</td>
    <td style="padding: 8px; border: 1px solid #ddd;">${ttrComparison.emoji} ${ttrComparison.description}</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd;"><strong>Adjusted (Anomaly Excluded)</strong></td>
    <td style="padding: 8px; border: 1px solid #ddd;">${formatTime(adj.avgTTR)}</td>
    <td style="padding: 8px; border: 1px solid #ddd;">${adjTTRComparison.emoji} ${adjTTRComparison.description}</td>
  </tr>
</table>

<p><strong>Adjustment Method:</strong> ${adjustedMetricsData.method || 'Statistical approximation'}</p>
<p><strong>Assumption:</strong> ${adjustedMetricsData.assumption}</p>
<p><strong>Confidence:</strong> ${adjustedMetricsData.confidence}</p>
<p><em>Note: ${adjustedMetricsData.disclaimer}</em></p>
</div>

<hr />
`;
  }

  // Build data quality warning section if issues exist (legacy format, keep for backward compat)
  let dataQualitySection = '';
  if (dataQualityIssues.length > 0 && !adjustedMetricsData.hasAdjustedMetrics) {
    dataQualitySection = `
<div style="border: 2px solid #ff6b6b; background-color: #fff5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
<h2>⚠️ DATA QUALITY EXCEPTION</h2>
`;
    for (const issue of dataQualityIssues) {
      dataQualitySection += `
<h3>${issue.title}</h3>
<p><strong>Date:</strong> ${issue.date}</p>
<p><strong>Impact:</strong> ${issue.description}</p>
<p><strong>Affected Metrics:</strong> ${issue.affectedMetrics.join(', ')}</p>
<p><strong>⚠️ Recommendation:</strong> ${issue.recommendation}</p>
`;
    }
    dataQualitySection += `</div>

<hr />
`;
  }

  // Determine which metrics to use for narrative (adjusted if available, raw otherwise)
  const narrativeTTFR = adjustedMetricsData.hasAdjustedMetrics ? adjustedMetricsData.adjusted.avgTTFR : currentTTFR;
  const narrativeTTR = adjustedMetricsData.hasAdjustedMetrics ? adjustedMetricsData.adjusted.avgTTR : currentTTR;
  const narrativeTTFRComparison = adjustedMetricsData.hasAdjustedMetrics ? compareToTarget('ttfr', adjustedMetricsData.adjusted.avgTTFR) : ttfrComparison;
  const narrativeTTRComparison = adjustedMetricsData.hasAdjustedMetrics ? compareToTarget('ttr', adjustedMetricsData.adjusted.avgTTR) : ttrComparison;

  // Narrative prefix based on confidence level
  const confidenceNote = narrativeConfidence.level === 'limited'
    ? '<p><strong>📊 Interpretation Guidance:</strong> ' + narrativeConfidence.guidance + '</p>'
    : narrativeConfidence.level === 'cautious'
    ? '<p><strong>📊 Note:</strong> ' + narrativeConfidence.guidance + '</p>'
    : '';

  return `
<h1>IT Ops Weekly Analyst Report</h1>
<p><em>Period: ${currentMetrics.period} | Generated: ${timestamp}</em></p>
<p><strong>🔗 Related:</strong> <a href="https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6423805982">Weekly Metrics Dashboard</a></p>

<hr />

${validationStatus.html}

<hr />

${adjustedMetricsSection}

${dataQualitySection}

<h2>1. Executive Summary</h2>

${confidenceNote}

<ul>
  <li><strong>Volume:</strong> IT resolved ${currentMetrics.resolvedCount} tickets this week (${volumeChangePercent > 0 ? '+' : ''}${volumeChangePercent}% WoW), ${currentMetrics.createdCount} created</li>
  <li><strong>SLA Performance:</strong> ${currentMetrics.overallSlaPercent}% SLA achievement (${slaChange > 0 ? '+' : ''}${slaChange.toFixed(1)}pp WoW) - ${slaComparison.emoji} ${slaComparison.description}</li>
  <li><strong>Customer Satisfaction:</strong> CSAT ${currentMetrics.csat.avgScore}/5.0 from ${currentMetrics.csat.totalResponses} reviews - ${csatComparison.emoji} ${csatComparison.description}</li>
  <li><strong>Automation:</strong> ${currentMetrics.automationPercent}% of tickets handled without human intervention - ${automationComparison.emoji} ${automationComparison.description}</li>
  <li><strong>Workforce Impact:</strong> ${currentMetrics.workforce?.totalOnboarding || 0} onboarded (${currentMetrics.workforce?.fteOnboarding || 0} FTE, ${currentMetrics.workforce?.contractorOnboarding || 0} contractors), ${currentMetrics.workforce?.offboarding || 0} offboarded</li>
</ul>

${adjustedMetricsData.hasAdjustedMetrics ? '<p><strong>📊 Metrics Interpretation:</strong> Raw metrics show elevated time values due to a known anomaly. Adjusted metrics (excluding anomaly-affected tickets) indicate service performance remained within expected ranges. See "Raw vs Adjusted Metrics" section above.</p>' : ''}

<hr />

<h2>2. Key Trends & Insights</h2>

<h3>Volume Analysis</h3>
<p><strong>Current Week:</strong> ${currentMetrics.resolvedCount} resolved, ${currentMetrics.createdCount} created (${currentMetrics.createdCount > currentMetrics.resolvedCount ? 'backlog growing' : 'backlog reducing'})</p>
<p><strong>Week-over-Week:</strong> ${volumeChange > 0 ? 'Increased' : 'Decreased'} by ${Math.abs(volumeChange)} tickets (${Math.abs(volumeChangePercent)}%)</p>

<h3>Performance Trends</h3>
${adjustedMetricsData.hasAdjustedMetrics ? '<p><em>Note: Time metrics use adjusted values (anomaly-excluded) for accurate interpretation</em></p>' : ''}
<ul>
  <li><strong>TTFR:</strong> ${formatTime(narrativeTTFR)} avg (target: 2h) - ${narrativeTTFRComparison.emoji} ${narrativeTTFRComparison.description}${adjustedMetricsData.hasAdjustedMetrics ? ' (adjusted)' : ''}</li>
  <li><strong>TTR:</strong> ${formatTime(narrativeTTR)} avg (target: 16h) - ${narrativeTTRComparison.emoji} ${narrativeTTRComparison.description}${adjustedMetricsData.hasAdjustedMetrics ? ' (adjusted)' : ''}</li>
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
  <li><strong>Automation Rate:</strong> ${currentMetrics.automationPercent}% - ${automationComparison.status === 'below' ? '⚠️ Below target, opportunity to expand coverage' : '✅ Healthy automation coverage'}</li>
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
${narrativeConfidence.level !== 'confident' ? '<p><em>Note: Time-based metrics affected by known data quality issue. Analysis uses adjusted metrics where available.</em></p>' : ''}
<p><strong>Within IT Control:</strong></p>
<ul>
  <li>Response time: ${formatTime(narrativeTTFR)} ${adjustedMetricsData.hasAdjustedMetrics ? '(adjusted) ' : ''}(${narrativeTTFRComparison.status === 'above' ? 'above 2h target - review staffing and round robin' : 'meeting target'})</li>
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
 * Fetch weekly metrics data from cache
 * Loads real data generated by ./run-weekly.sh
 */
async function fetchWeeklyMetrics() {
  console.log('Loading weekly metrics from cache...');

  try {
    const data = loadWeeklyMetrics();
    console.log(`✓ Loaded metrics from ${new Date(data.timestamp).toLocaleString()}\n`);

    return {
      current: data.currentWeek,
      previous: data.previousWeek
    };
  } catch (error) {
    console.error('✗ Error loading metrics:', error.message);
    console.error('\n⚠️  You must run ./run-weekly.sh FIRST to generate metrics data.');
    console.error('   The analyst report consumes data from the weekly dashboard script.');
    process.exit(1);
  }
}

async function main() {
  console.log('=== Weekly IT Ops Analyst Report Generator ===\n');

  const metricsData = await fetchWeeklyMetrics();
  const currentMetrics = metricsData.current;
  const previousMetrics = metricsData.previous;

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
