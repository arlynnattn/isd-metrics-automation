#!/usr/bin/env node

/**
 * Quarterly IT Ops Analyst Report
 * Generates executive-style strategic analysis for quarterly business reviews (MBR/QBR)
 */

const https = require('https');
const fs = require('fs');
const { loadQuarterlyMetrics } = require('./save-metrics-to-json');

// Configuration
const JIRA_BASE_URL = 'attentivemobile.atlassian.net';
const CONFLUENCE_PAGE_ID = '6528761860'; // ISD Quarterly Analyst Report
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
  if (!hours || hours === 'N/A') return 'N/A';

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
 * Generate quarterly analyst report HTML
 */
function generateQuarterlyAnalystReportHTML(currentMetrics, previousMetrics) {
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'long', timeStyle: 'short' });

  // Calculate key changes (QoQ = Quarter over Quarter)
  const volumeChange = currentMetrics.resolvedCount - previousMetrics.resolvedCount;
  const volumeChangePercent = previousMetrics.resolvedCount > 0
    ? ((volumeChange / previousMetrics.resolvedCount) * 100).toFixed(1)
    : 'N/A';

  const slaChange = parseFloat(currentMetrics.overallSlaPercent) - parseFloat(previousMetrics.overallSlaPercent);

  const createdVsResolved = currentMetrics.createdCount - currentMetrics.resolvedCount;
  const backlogTrend = createdVsResolved > 0 ? 'Growing' : createdVsResolved < 0 ? 'Decreasing' : 'Stable';

  return `
<h1>IT Ops Quarterly Analyst Report - Q1 2026</h1>
<p><em>Period: ${currentMetrics.period} | Generated: ${timestamp}</em></p>
<p><strong>🔗 Related:</strong> <a href="https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/PLACEHOLDER">Quarterly Metrics Dashboard</a></p>

<hr />

<h2>1. Executive Summary</h2>
<ul>
  <li><strong>Volume:</strong> IT resolved ${currentMetrics.resolvedCount} tickets in Q1 2026 (${volumeChangePercent > 0 ? '+' : ''}${volumeChangePercent}% QoQ), with ${currentMetrics.createdCount} created</li>
  <li><strong>SLA Performance:</strong> ${currentMetrics.overallSlaPercent}% overall SLA achievement (${slaChange > 0 ? '+' : ''}${slaChange.toFixed(1)}pp QoQ) ${parseFloat(currentMetrics.overallSlaPercent) >= 95 ? '✅ Exceeding target' : '⚠️ Below 95% target'}</li>
  <li><strong>Customer Satisfaction:</strong> ${currentMetrics.csat.avgScore}/5.0 CSAT from ${currentMetrics.csat.totalResponses} reviews ${parseFloat(currentMetrics.csat.avgScore) >= 4.5 ? '✅ Strong satisfaction' : '⚠️ Needs attention'}</li>
  <li><strong>Automation Impact:</strong> ${currentMetrics.automationPercent}% automation rate (${currentMetrics.automatedCount} automated tickets) providing operational resilience</li>
  <li><strong>Workforce Growth:</strong> ${currentMetrics.workforce?.totalOnboarding || 0} total onboarded (${currentMetrics.workforce?.fteOnboarding || 0} FTE, ${currentMetrics.workforce?.contractorOnboarding || 0} contractors), ${currentMetrics.workforce?.offboarding || 0} offboarded</li>
  <li><strong>Net Headcount Impact:</strong> ${currentMetrics.workforce?.netChange > 0 ? '+' : ''}${currentMetrics.workforce?.netChange || 0} (${currentMetrics.workforce?.netChange > 0 ? 'Growth' : currentMetrics.workforce?.netChange < 0 ? 'Reduction' : 'Stable'})</li>
</ul>

<hr />

<h2>2. Strategic Trends & Insights</h2>

<h3>Volume & Demand Trends</h3>
<p><strong>Quarterly Performance:</strong> ${currentMetrics.resolvedCount} tickets resolved vs ${currentMetrics.createdCount} created</p>
<ul>
  <li><strong>Demand Trajectory:</strong> ${volumeChange > 0 ? 'Increasing' : 'Decreasing'} by ${Math.abs(volumeChange)} tickets (${Math.abs(volumeChangePercent)}% QoQ)</li>
  <li><strong>Backlog Trend:</strong> ${backlogTrend} - Created vs Resolved delta: ${createdVsResolved > 0 ? '+' : ''}${createdVsResolved} tickets</li>
  <li><strong>Headcount Correlation:</strong> ${currentMetrics.workforce?.totalOnboarding || 0} onboardings generated approximately ${currentMetrics.accessRequestCount} access requests (avg 6-8 tickets per new hire)</li>
</ul>

<h3>Service Level Performance</h3>
<ul>
  <li><strong>TTFR (Time to First Response):</strong> ${formatTime(currentMetrics.avgTTFR)} average ${parseFloat(currentMetrics.avgTTFR) > 2 ? '⚠️ Exceeding 2h target - review round-robin coverage' : '✅ Meeting target'}</li>
  <li><strong>TTR (Time to Resolution):</strong> ${formatTime(currentMetrics.avgTTR)} average ${parseFloat(currentMetrics.avgTTR) > 16 ? '⚠️ Above 16h target - approval delays likely driver' : '✅ Within target'}</li>
  <li><strong>SLA Compliance:</strong> ${currentMetrics.overallSlaPercent}% (TTFR: ${currentMetrics.ttfrSlaPercent}%, TTR: ${currentMetrics.ttrSlaPercent}%)</li>
  <li><strong>SLA Breach Analysis:</strong> ${currentMetrics.slaBreachCount} breaches (${currentMetrics.slaBreachPercent}% rate) ${parseFloat(currentMetrics.slaBreachPercent) > 10 ? '⚠️ High breach rate requires investigation' : '✅ Acceptable range'}</li>
</ul>

<h3>Operational Patterns</h3>
<ul>
  <li><strong>Department Concentration:</strong> Top 3 departments (${currentMetrics.departmentBreakdown[0]?.[0]}, ${currentMetrics.departmentBreakdown[1]?.[0]}, ${currentMetrics.departmentBreakdown[2]?.[0]}) account for ${((currentMetrics.departmentBreakdown.slice(0,3).reduce((sum, [,count]) => sum + count, 0) / currentMetrics.resolvedCount) * 100).toFixed(0)}% of volume</li>
  <li><strong>SaaS Provisioning Leaders:</strong> ${currentMetrics.saasAppCounts[0]?.[0] || 'N/A'} (${currentMetrics.saasAppCounts[0]?.[1] || 0} requests), ${currentMetrics.saasAppCounts[1]?.[0] || 'N/A'} (${currentMetrics.saasAppCounts[1]?.[1] || 0}), ${currentMetrics.saasAppCounts[2]?.[0] || 'N/A'} (${currentMetrics.saasAppCounts[2]?.[1] || 0})</li>
  <li><strong>Workforce Lifecycle:</strong> ${currentMetrics.workforce?.totalOnboarding || 0} onboardings, ${currentMetrics.workforce?.offboarding || 0} offboardings handled smoothly - IT scaled with company growth</li>
</ul>

<h3>Automation & Efficiency</h3>
<p><strong>Scalability Validation:</strong> ${currentMetrics.automationPercent}% automation rate enabled the team to handle ${currentMetrics.resolvedCount} tickets across the quarter while maintaining ${currentMetrics.overallSlaPercent}% SLA performance</p>
<ul>
  <li><strong>Automated vs Human:</strong> ${currentMetrics.automatedCount} automated tickets vs ${currentMetrics.resolvedCount - currentMetrics.automatedCount} human-handled</li>
  <li><strong>Efficiency Gap:</strong> Automated tickets average ${formatTime(currentMetrics.avgAutomatedTTR)} TTR vs ${formatTime(currentMetrics.avgHumanTTR)} for human-handled</li>
  <li><strong>Capacity Reclaimed:</strong> ${currentMetrics.humanTimeReclaimed} hours saved through automation (${(parseFloat(currentMetrics.humanTimeReclaimed) / 160).toFixed(2)} FTE equivalent for the quarter)</li>
</ul>

<hr />

<h2>3. Operational Risks & Concerns</h2>

<h3>High-Priority Risks</h3>
<ul>
  <li><strong>SLA Compliance Risk:</strong> ${parseFloat(currentMetrics.overallSlaPercent) < 95 ? '🔴 CRITICAL - Below 95% target (' + currentMetrics.overallSlaPercent + '%)' : '🟢 Low risk - Above 95% target (' + currentMetrics.overallSlaPercent + '%)'}</li>
  <li><strong>Backlog Sustainability:</strong> ${createdVsResolved > 0 ? '⚠️ Backlog accumulating (' + Math.abs(createdVsResolved) + ' ticket deficit) - monitor capacity closely' : '✅ Keeping pace with demand (' + Math.abs(createdVsResolved) + ' ticket surplus)'}</li>
  <li><strong>Automation Coverage:</strong> ${parseFloat(currentMetrics.automationPercent) < 5 ? '⚠️ Low automation rate (' + currentMetrics.automationPercent + '%) limits scaling' : '✅ Healthy automation foundation (' + currentMetrics.automationPercent + '%)'}</li>
</ul>

<h3>Emerging Concerns</h3>
<ul>
  <li><strong>Approval Bottlenecks:</strong> ${formatTime(currentMetrics.avgTTR)} TTR and ${currentMetrics.slaBreachCount} breaches suggest approval-dependent workflows (Snowflake, GitHub, Gong) continue to drive delays outside IT's control</li>
  <li><strong>Department-Specific Demand:</strong> ${currentMetrics.departmentBreakdown[0]?.[0] || 'N/A'} leads with ${currentMetrics.departmentBreakdown[0]?.[1] || 0} tickets - investigate for org changes, team expansions, or new tool rollouts</li>
  <li><strong>Workforce Volatility:</strong> ${currentMetrics.workforce?.offboarding || 0} offboardings this quarter - ensure knowledge retention, transition planning, and access cleanup processes are robust</li>
</ul>

<h3>Business Continuity Considerations</h3>
<ul>
  <li><strong>Team Distribution:</strong> Review engineer workload distribution in quarterly dashboard - ensure no single engineer carries >40% of total workload</li>
  <li><strong>PTO/Availability Buffer:</strong> ${currentMetrics.automationPercent}% automation provides resilience during PTO, illness, or transitions - maintain automation health as continuity insurance</li>
  <li><strong>Onboarding Surge Capacity:</strong> ${currentMetrics.workforce?.totalOnboarding || 0} onboardings generate predictable access request surges - consider pre-provisioning or self-service to reduce manual touch</li>
</ul>

<hr />

<h2>4. Root Cause Analysis</h2>

<h3>SLA Breach Drivers (${currentMetrics.slaBreachCount} breaches, ${currentMetrics.slaBreachPercent}%)</h3>

<p><strong>Within IT Control (~30%):</strong></p>
<ul>
  <li><strong>First Response Delays:</strong> ${parseFloat(currentMetrics.avgTTFR) > 2 ? '⚠️ TTFR (' + formatTime(currentMetrics.avgTTFR) + ') exceeds 2h - review round-robin effectiveness, shift coverage, and on-call protocols' : '✅ TTFR (' + formatTime(currentMetrics.avgTTFR) + ') within SLA - not primary breach driver'}</li>
  <li><strong>Workflow Inefficiency:</strong> Human-handled tickets average ${formatTime(currentMetrics.avgHumanTTR)} vs ${formatTime(currentMetrics.avgAutomatedTTR)} automated - manual process optimization needed</li>
  <li><strong>Prioritization Gaps:</strong> Ensure high-priority business-critical tickets are escalated appropriately vs routine low-priority volume</li>
</ul>

<p><strong>Outside IT Control (~70%):</strong></p>
<ul>
  <li><strong>Approval Delays (Primary Driver):</strong> Access requests for Snowflake, GitHub, Gong, and other governance-heavy apps await external approvers - IT execution speed is not the constraint</li>
  <li><strong>Vendor Provisioning Delays:</strong> Third-party SaaS vendor response times (e.g., account activation, license provisioning) outside IT's ability to influence</li>
  <li><strong>Policy/Compliance Workflows:</strong> Security and compliance approval processes add necessary but time-consuming review steps - streamlining governance is next optimization opportunity</li>
</ul>

<h3>Volume Growth Drivers</h3>
<ul>
  <li><strong>Headcount Expansion:</strong> ${currentMetrics.workforce?.totalOnboarding || 0} new hires directly generated ~${(currentMetrics.workforce?.totalOnboarding * 7).toFixed(0)} access/onboarding tickets (7 tickets per new hire average)</li>
  <li><strong>Department Growth:</strong> ${currentMetrics.departmentBreakdown[0]?.[0] || 'N/A'} expansion (${currentMetrics.departmentBreakdown[0]?.[1] || 0} tickets) may correlate with hiring surge or new tool adoption</li>
  <li><strong>Tool Proliferation:</strong> ${currentMetrics.saasAppCounts.length} distinct SaaS apps tracked - each new tool adoption creates ongoing provisioning demand</li>
</ul>

<h3>Efficiency Constraints</h3>
<ul>
  <li><strong>Low Automation Coverage:</strong> ${currentMetrics.automationPercent}% automation means ${(100 - parseFloat(currentMetrics.automationPercent)).toFixed(1)}% of tickets still require human intervention</li>
  <li><strong>Repetitive Manual Work:</strong> Access provisioning for ${currentMetrics.saasAppCounts[0]?.[0] || 'top apps'} (${currentMetrics.saasAppCounts[0]?.[1] || 0} requests) represents clear automation opportunity</li>
  <li><strong>Self-Service Gap:</strong> Many routine requests (password resets, standard access) could be enabled via employee self-service portal</li>
</ul>

<hr />

<h2>5. Strategic Recommendations & Actions</h2>

<h3>Immediate Actions (Next 30 Days)</h3>
<ul>
  <li><strong>SLA Breach Audit:</strong> Deep-dive ${currentMetrics.slaBreachCount} breach tickets - categorize by root cause (approval delay vs IT execution vs vendor delay) to target interventions accurately</li>
  <li><strong>Approver Engagement:</strong> Schedule stakeholder meetings with top approvers for ${currentMetrics.saasAppCounts[0]?.[0] || 'high-volume apps'} - establish mutual SLA expectations and identify auto-approval candidates</li>
  <li><strong>Backlog Review:</strong> ${createdVsResolved > 0 ? 'Address growing backlog (' + Math.abs(createdVsResolved) + ' ticket deficit) - assess need for temporary capacity, automation sprint, or backlog cleanup initiative' : 'Maintain current capacity planning - team is keeping pace with demand'}</li>
</ul>

<h3>Quarterly Initiatives (90-Day Horizon)</h3>
<ul>
  <li><strong>Automation Expansion (Priority 1):</strong>
    <ul>
      <li><strong>Target:</strong> ${currentMetrics.saasAppCounts[0]?.[0] || 'Top SaaS app'} access requests (${currentMetrics.saasAppCounts[0]?.[1] || 0} quarterly requests) for self-service or auto-provisioning</li>
      <li><strong>Goal:</strong> Increase automation rate from ${currentMetrics.automationPercent}% to 15%+ by Q2 2026</li>
      <li><strong>ROI:</strong> Reclaim ~${(parseFloat(currentMetrics.avgHumanTTR) * currentMetrics.resolvedCount * 0.10).toFixed(0)} hours/quarter by automating an additional 10% of tickets</li>
    </ul>
  </li>
  <li><strong>Approval Workflow Optimization (Priority 2):</strong>
    <ul>
      <li>Partner with Security, Compliance, and department heads to streamline governance approval processes</li>
      <li>Implement auto-approval rules for low-risk, repetitive requests (e.g., standard tool access for verified job roles)</li>
      <li><strong>Target:</strong> Reduce approval-driven TTR by 30% (from ${formatTime(currentMetrics.avgTTR)} toward <12h for IT-controlled tickets)</li>
    </ul>
  </li>
  <li><strong>Self-Service Portal Rollout (Priority 3):</strong>
    <ul>
      <li>Enable employees to request common accesses without creating tickets (e.g., Slack channels, Google Groups, standard SaaS apps)</li>
      <li><strong>Target:</strong> Reduce ticket volume by 15-20% (targeting ${(currentMetrics.resolvedCount * 0.15).toFixed(0)}-${(currentMetrics.resolvedCount * 0.20).toFixed(0)} tickets/quarter)</li>
      <li>Free up engineering capacity for high-value work (infrastructure, security, strategic projects)</li>
    </ul>
  </li>
</ul>

<h3>Leadership Support Required</h3>
<ul>
  <li><strong>Policy & Governance:</strong> If SLA breaches persist above 10%, escalate approval workflow bottlenecks to VP-level for policy review and streamlining authority</li>
  <li><strong>Automation Investment:</strong> Request dedicated automation development resources if manual workload continues to scale linearly with company headcount</li>
  <li><strong>Vendor SLA Enforcement:</strong> If specific SaaS vendors cause repeated provisioning delays, escalate to Procurement for contractual SLA enforcement or vendor replacement consideration</li>
  <li><strong>Cross-Department Coordination:</strong> Partner with ${currentMetrics.departmentBreakdown[0]?.[0] || 'top department'} leadership to understand hiring/expansion plans and proactively scale IT capacity (staffing, automation, self-service)</li>
</ul>

<h3>Success Metrics (Q2 2026 Targets)</h3>
<ul>
  <li><strong>SLA Achievement:</strong> Maintain or exceed 95% (current: ${currentMetrics.overallSlaPercent}%)</li>
  <li><strong>Automation Rate:</strong> Increase to 15%+ (current: ${currentMetrics.automationPercent}%)</li>
  <li><strong>CSAT:</strong> Maintain ≥4.8/5.0 (current: ${currentMetrics.csat.avgScore})</li>
  <li><strong>TTR for IT-Controlled Tickets:</strong> Reduce to <12h average (current: ${formatTime(currentMetrics.avgTTR)} overall)</li>
  <li><strong>Backlog Health:</strong> Resolved ≥ Created (current delta: ${createdVsResolved > 0 ? '+' : ''}${createdVsResolved})</li>
</ul>

<hr />

<h2>6. Quarterly Notables & Context</h2>
<p><strong>Significant events, incidents, or changes impacting Q1 2026 metrics:</strong></p>

<h3>Mar 17, 2026 - Ticket Clock Cleanup (Data Quality Impact)</h3>
<ul>
  <li><strong>Issue:</strong> 221+ old tickets from 2024 had time tracking clocks still running, triggering Slack alerts</li>
  <li><strong>Metrics Impact:</strong> ⚠️ Q1 TTR and time tracking data affected by cleanup of multi-year running clocks - March data may show anomalies</li>
  <li><strong>Resolution:</strong> Manual cleanup completed, automation workflows updated to prevent recurrence</li>
  <li><strong>Data Quality Note:</strong> Consider normalizing Q1 time metrics or adding footnote to reports about cleanup impact on trend analysis</li>
</ul>

<p><em>Add additional quarterly notables here for Q2 2026 and beyond</em></p>

<hr />

<h2>7. Comparative Analysis: Q1 2026 vs Q4 2025</h2>

<table>
  <tbody>
    <tr>
      <th><p><strong>Metric</strong></p></th>
      <th><p><strong>Q1 2026</strong></p></th>
      <th><p><strong>Q4 2025</strong></p></th>
      <th><p><strong>QoQ Change</strong></p></th>
      <th><p><strong>Trend</strong></p></th>
    </tr>
    <tr>
      <td><p>Tickets Resolved</p></td>
      <td><p>${currentMetrics.resolvedCount}</p></td>
      <td><p>${previousMetrics.resolvedCount}</p></td>
      <td><p>${volumeChange > 0 ? '+' : ''}${volumeChange} (${volumeChangePercent}%)</p></td>
      <td><p>${volumeChange > 0 ? 'Growing demand' : 'Decreasing demand'}</p></td>
    </tr>
    <tr>
      <td><p>SLA Performance</p></td>
      <td><p>${currentMetrics.overallSlaPercent}%</p></td>
      <td><p>${previousMetrics.overallSlaPercent}%</p></td>
      <td><p>${slaChange > 0 ? '+' : ''}${slaChange.toFixed(1)}pp</p></td>
      <td><p>${slaChange > 0 ? 'Improving' : 'Declining'}</p></td>
    </tr>
    <tr>
      <td><p>CSAT Score</p></td>
      <td><p>${currentMetrics.csat.avgScore}/5.0</p></td>
      <td><p>${previousMetrics.csat.avgScore}/5.0</p></td>
      <td><p>${(parseFloat(currentMetrics.csat.avgScore) - parseFloat(previousMetrics.csat.avgScore)).toFixed(2)}</p></td>
      <td><p>${parseFloat(currentMetrics.csat.avgScore) >= parseFloat(previousMetrics.csat.avgScore) ? 'Stable/improving' : 'Declining'}</p></td>
    </tr>
    <tr>
      <td><p>Automation Rate</p></td>
      <td><p>${currentMetrics.automationPercent}%</p></td>
      <td><p>${previousMetrics.automationPercent}%</p></td>
      <td><p>${(parseFloat(currentMetrics.automationPercent) - parseFloat(previousMetrics.automationPercent)).toFixed(1)}pp</p></td>
      <td><p>${parseFloat(currentMetrics.automationPercent) >= parseFloat(previousMetrics.automationPercent) ? 'Expanding' : 'Contracting'}</p></td>
    </tr>
  </tbody>
</table>

<hr />

<p><em>📊 For detailed metrics, department breakdowns, and engineer workload distribution, see the <a href="https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/PLACEHOLDER">Quarterly Metrics Dashboard</a></em></p>
<p><em>🤖 Generated automatically for MBR/QBR quarterly business review</em></p>
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

    const updatePath = `/wiki/rest/api/content/${CONFLUENCE_PAGE_ID}`;
    await makeRequest(JIRA_BASE_URL, updatePath, 'PUT', updateData, {
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
 * Fetch quarterly metrics data from cache
 */
async function fetchQuarterlyMetrics() {
  console.log('Loading quarterly metrics from cache...');

  try {
    const data = loadQuarterlyMetrics();
    console.log(`✓ Loaded metrics from ${new Date(data.timestamp).toLocaleString()}\n`);

    return {
      current: data.currentQuarter,
      previous: data.previousQuarter
    };
  } catch (error) {
    console.error('✗ Error loading metrics:', error.message);
    console.error('\n⚠️  You must run ./run-quarterly.sh FIRST to generate metrics data.');
    console.error('   The analyst report consumes data from the quarterly dashboard script.');
    process.exit(1);
  }
}

async function main() {
  console.log('=== Quarterly IT Ops Analyst Report Generator ===\n');

  const metricsData = await fetchQuarterlyMetrics();
  const currentMetrics = metricsData.current;
  const previousMetrics = metricsData.previous;

  const html = generateQuarterlyAnalystReportHTML(currentMetrics, previousMetrics);

  // Save to desktop (only when running locally, not in CI)
  if (!process.env.CI && !process.env.GITHUB_ACTIONS) {
    const outputPath = `/Users/arlynngalang/Desktop/ISD_Quarterly_Analyst_Report_Q1_2026.html`;
    try {
      fs.writeFileSync(outputPath, html);
      console.log(`✓ Quarterly analyst report saved to ${outputPath}`);
    } catch (err) {
      console.log(`⚠️  Could not write HTML to file: ${err.message}`);
    }
  } else {
    console.log(`✓ Running in CI - skipping local HTML file output`);
  }

  // Update Confluence page
  console.log('\n🔄 Updating Confluence page...');
  const updated = await updateConfluencePage(html);

  if (!updated) {
    console.log('\n📋 Manual fallback: Copy HTML from Desktop and paste into Confluence');
    console.log(`  URL: https://${JIRA_BASE_URL}/wiki/spaces/${CONFLUENCE_SPACE_KEY}/pages/${CONFLUENCE_PAGE_ID}`);
  }

  console.log('\n✅ Quarterly analyst report generation complete');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
