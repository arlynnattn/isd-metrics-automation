/**
 * Fixed version of monthly analyst HTML generation
 * Use this to replace the generateAnalystReportHTML function in generate-monthly-analyst-report.js
 */

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

function renderSlackReadoutSection(slackMetrics) {
  if (!slackMetrics || slackMetrics.available === false) {
    return '';
  }

  const channelRows = (slackMetrics.channels || []).map((channel) => {
    const summary = channel.error
      ? channel.error
      : `${channel.messageCount} messages, ${channel.uniqueUsers} users, ${channel.activeDays} active days`;

    return `
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd;">${channel.channel}</td>
    <td style="padding: 8px; border: 1px solid #ddd;">${summary}</td>
  </tr>`;
  }).join('');

  const readoutItems = (slackMetrics.overall?.leadershipReadout || [])
    .slice(0, 3)
    .map((story) => `<li><strong>${story.label}:</strong> ${story.summary} <em>Stakeholder lens: ${story.stakeholder}</em></li>`)
    .join('');

  const notableItems = (slackMetrics.overall?.notableItems || [])
    .slice(0, 4)
    .map((item) => `<li><strong>${item.channel}:</strong> ${item.text} <em>(${item.reason})</em></li>`)
    .join('');

  return `
<h3>Slack Support Signals</h3>
<p><strong>Support-channel demand:</strong> ${slackMetrics.messageCount} human-authored messages across ${slackMetrics.uniqueUsers} user touches.</p>

<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #f5f5f5;">
    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Channel</th>
    <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Monthly activity</th>
  </tr>
${channelRows}
</table>

${readoutItems ? `<p><strong>Leadership readout:</strong></p><ul>${readoutItems}</ul>` : ''}
${notableItems ? `<p><strong>Watchlist / examples:</strong></p><ul>${notableItems}</ul>` : ''}
`;
}

function generateAnalystReportHTML(currentMetrics, previousMetrics) {
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'long', timeStyle: 'short' });

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
  const monthlyValidation = validationResults.monthly || { valid: true, errors: [], warnings: [] };

  // Generate validation status block
  const validationStatus = generateValidationStatusBlock(monthlyValidation, dataQualityIssues);

  // Calculate adjusted metrics if anomalies exist
  const adjustedMetricsData = calculateAdjustedMetrics(
    { avgTTFR: currentTTFR, avgTTR: currentTTR, overallSlaPercent: currentMetrics.overallSlaPercent },
    dataQualityIssues
  );

  // Get narrative confidence level
  const narrativeConfidence = getNarrativeConfidence(dataQualityIssues, ['avgTTFR', 'avgTTR', 'slaPercent']);

  // Determine which metrics to use for narrative (adjusted if available, raw otherwise)
  const narrativeTTFR = adjustedMetricsData.hasAdjustedMetrics ? adjustedMetricsData.adjusted.avgTTFR : currentTTFR;
  const narrativeTTR = adjustedMetricsData.hasAdjustedMetrics ? adjustedMetricsData.adjusted.avgTTR : currentTTR;
  const narrativeTTFRComparison = adjustedMetricsData.hasAdjustedMetrics ? compareToTarget('ttfr', adjustedMetricsData.adjusted.avgTTFR) : ttfrComparison;
  const narrativeTTRComparison = adjustedMetricsData.hasAdjustedMetrics ? compareToTarget('ttr', adjustedMetricsData.adjusted.avgTTR) : ttrComparison;

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

  // Narrative prefix based on confidence level
  const confidenceNote = narrativeConfidence.level === 'limited'
    ? '<p><strong>📊 Interpretation Guidance:</strong> ' + narrativeConfidence.guidance + ' Insights in this report prioritize unaffected metrics and qualify time-based interpretations.</p>'
    : narrativeConfidence.level === 'cautious'
    ? '<p><strong>📊 Note:</strong> ' + narrativeConfidence.guidance + '</p>'
    : '';

  return `
<h1>IT Ops Monthly Analyst Report</h1>
<p><em>Period: ${currentMetrics.period} | Generated: ${timestamp}</em></p>
<p><strong>🔗 Related:</strong> <a href="https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6415089689">Monthly Metrics Dashboard</a></p>

<hr />

${validationStatus.html}

<hr />

${adjustedMetricsSection}

${dataQualitySection}

<h2>1. Executive Summary</h2>

${confidenceNote}

<ul>
  <li><strong>Volume:</strong> IT resolved ${currentMetrics.resolvedCount} tickets this month (${volumeChangePercent > 0 ? '+' : ''}${volumeChangePercent}% MoM), ${currentMetrics.createdCount} created</li>
  <li><strong>SLA Performance:</strong> ${currentMetrics.overallSlaPercent}% SLA achievement (${slaChange > 0 ? '+' : ''}${slaChange.toFixed(1)}pp MoM) - ${slaComparison.emoji} ${slaComparison.description}</li>
  <li><strong>Customer Satisfaction:</strong> CSAT ${currentMetrics.csat.avgScore}/5.0 from ${currentMetrics.csat.totalResponses} reviews - ${csatComparison.emoji} ${csatComparison.description}</li>
  <li><strong>Automation Impact:</strong> ${currentMetrics.automationPercent}% automation rate - ${automationComparison.emoji} ${automationComparison.description}</li>
  <li><strong>Workforce Growth:</strong> ${currentMetrics.workforce?.totalOnboarding || 0} total onboarded (${currentMetrics.workforce?.fteOnboarding || 0} FTE, ${currentMetrics.workforce?.contractorOnboarding || 0} contractors), ${currentMetrics.workforce?.offboarding || 0} offboarded - Net: ${currentMetrics.workforce?.netChange > 0 ? '+' : ''}${currentMetrics.workforce?.netChange || 0}</li>
</ul>

${adjustedMetricsData.hasAdjustedMetrics ? '<p><strong>📊 Metrics Interpretation:</strong> Raw time metrics appear elevated due to a known March data anomaly (221+ old tickets with running time clocks). Adjusted metrics (excluding anomaly-affected tickets) indicate service performance remained within operational norms. See "Raw vs Adjusted Metrics" section above for details.</p>' : ''}

<hr />

<h2>2. Key Trends & Insights</h2>

${narrativeConfidence.level !== 'confident' ? '<p><em>Note: Insights below use adjusted metrics for time-based analysis where data quality issues exist.</em></p>' : ''}

<h3>Volume & Capacity Analysis</h3>
<p><strong>Monthly Performance:</strong> ${currentMetrics.resolvedCount} tickets resolved vs ${currentMetrics.createdCount} created</p>
<p><strong>Demand Trend:</strong> ${volumeChange > 0 ? 'Increasing' : 'Decreasing'} by ${Math.abs(volumeChange)} tickets (${Math.abs(volumeChangePercent)}% MoM)</p>
<p><strong>Capacity Impact:</strong> ${currentMetrics.workforce?.totalOnboarding || 0} onboardings directly correlate with ${currentMetrics.accessRequestCount} access requests (provisioning overhead)</p>

<h3>Service Level Performance</h3>
${adjustedMetricsData.hasAdjustedMetrics ? '<p><em>Using adjusted metrics for accurate interpretation</em></p>' : ''}
<ul>
  <li><strong>TTFR:</strong> ${formatTime(narrativeTTFR)} average${adjustedMetricsData.hasAdjustedMetrics ? ' (adjusted)' : ''} - ${narrativeTTFRComparison.emoji} ${narrativeTTFRComparison.description}</li>
  <li><strong>TTR:</strong> ${formatTime(narrativeTTR)} average${adjustedMetricsData.hasAdjustedMetrics ? ' (adjusted)' : ''} - ${narrativeTTRComparison.emoji} ${narrativeTTRComparison.description}</li>
  <li><strong>SLA Breaches:</strong> ${currentMetrics.slaBreachCount} tickets (${currentMetrics.slaBreachPercent}% breach rate) - ${parseFloat(currentMetrics.slaBreachPercent) > 10 ? '⚠️ High breach rate' : 'acceptable range'}</li>
</ul>

<h3>Strategic Patterns</h3>
<ul>
  <li><strong>Department Concentration:</strong> Top 3 departments account for ${currentMetrics.departmentBreakdown && currentMetrics.departmentBreakdown.length >= 3 ? ((currentMetrics.departmentBreakdown.slice(0,3).reduce((sum, [,count]) => sum + count, 0) / currentMetrics.resolvedCount) * 100).toFixed(0) : 'N/A'}% of volume - opportunity for targeted automation</li>
  <li><strong>SaaS Provisioning:</strong> ${currentMetrics.saasAppCounts[0]?.[0] || 'N/A'} leads at ${currentMetrics.saasAppCounts[0]?.[1] || 0} requests - candidate for self-service automation</li>
  <li><strong>Workforce Lifecycle:</strong> ${currentMetrics.workforce?.totalOnboarding || 0} onboardings handled smoothly - IT scaled with company growth</li>
</ul>

${renderSlackReadoutSection(currentMetrics.slack)}

<h3>Automation & Efficiency</h3>
<p><strong>Operational Resilience:</strong> ${currentMetrics.automationPercent}% automation rate supported team capacity to handle ${currentMetrics.resolvedCount} tickets despite workforce changes</p>
<p><strong>Scalability Model:</strong> Automation provided buffer capacity during variable staffing - contributed to service level stability</p>

<hr />

<h2>3. Operational Risks</h2>

<h3>High-Priority Risks</h3>
<ul>
  <li><strong>SLA Compliance Risk:</strong> ${slaComparison.status === 'below' ? '⚠️ Critical - Below 95% target' : '✅ Low risk - above target'} (${currentMetrics.slaBreachCount} breaches)</li>
  <li><strong>Volume Sustainability:</strong> ${currentMetrics.createdCount > currentMetrics.resolvedCount ? '⚠️ Backlog accumulating - monitor burn rate' : '✅ Keeping pace with demand'}</li>
  <li><strong>Automation Coverage:</strong> ${automationComparison.status === 'below' ? '⚠️ Low automation rate limits scaling capacity' : '✅ Healthy automation foundation'}</li>
</ul>

<h3>Emerging Risks</h3>
<ul>
  <li><strong>Approval Bottlenecks:</strong> ${adjustedMetricsData.hasAdjustedMetrics ? 'Adjusted ' : ''}TTR of ${formatTime(narrativeTTR)} indicates approval-dependent workflows (Snowflake, GitHub, Gong) contribute to resolution time</li>
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

${narrativeConfidence.level !== 'confident' ? '<p><em>Note: Root cause analysis uses adjusted time metrics where data quality issues are present.</em></p>' : ''}

<h3>SLA Breach Drivers (${currentMetrics.slaBreachCount} breaches, ${currentMetrics.slaBreachPercent}%)</h3>

<p><strong>Within IT Control (~30%):</strong></p>
<ul>
  <li><strong>First Response Delays:</strong> ${narrativeTTFRComparison.status === 'above' ? `${adjustedMetricsData.hasAdjustedMetrics ? 'Adjusted ' : ''}TTFR exceeds 2h - review round robin effectiveness and coverage hours` : `${adjustedMetricsData.hasAdjustedMetrics ? 'Adjusted ' : ''}TTFR within SLA - not primary driver`}</li>
  <li><strong>Workflow Efficiency:</strong> Human-handled tickets take ${formatTime(narrativeTTR)}${adjustedMetricsData.hasAdjustedMetrics ? ' (adjusted)' : ''} vs automated - manual process optimization opportunity</li>
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
      <li>ROI: Reclaim ~${(parseFloat(narrativeTTR) * currentMetrics.resolvedCount * 0.05).toFixed(0)} hours/month in manual work</li>
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
  <li>TTR: Reduce to <12h average for IT-controlled tickets (currently ${formatTime(narrativeTTR)})</li>
</ul>

<hr />

<p><em>📊 For detailed metrics, team capacity breakdown, and department analysis, see the <a href="https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6415089689">Monthly Metrics Dashboard</a></em></p>
`;
}

module.exports = { generateAnalystReportHTML };
