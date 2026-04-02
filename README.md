# ISD Metrics Automation

**Fully automated** reporting for IT Ops metrics from Jira Service Desk, with weekly and monthly updates to Confluence and Slack.

## 📚 Documentation

Comprehensive documentation is available in the [`docs/`](./docs) folder:
- **[Automation Schedule](./docs/Automation_Schedule.md)** ⭐ **START HERE** - Complete schedule for weekly & monthly automation
- **[Quick Start Guide](./docs/README.md)** - Metrics overview and troubleshooting
- **[Monthly Automation Setup](./docs/Monthly_Automation_Full_Setup.txt)** - Full automation workflow
- **[Workforce Methodology](./docs/Workforce_CLONE_Tickets_Methodology.txt)** - How workforce counting works
- **[Slack Message Examples](./docs/Slack_Message_Examples.md)** - Visual preview of notifications
- **[March 2026 Validated Numbers](./docs/March_2026_Workforce_FINAL_VALIDATED.txt)** - Reference data

## 🤖 Automated Updates

### Weekly Updates (Every Monday at 9:00 AM ET)
GitHub Actions automatically:
1. Updates **Weekly Metrics Dashboard** (last 7 days metrics)
2. Updates **Weekly Analyst Report** (executive analysis)
3. Posts notification to **#itops-metric-reporting** Slack channel

### Monthly Updates (1st of Month at 9:00 AM ET)
GitHub Actions automatically:
1. Updates **ISD Monthly Metrics Dashboard** (main metrics page)
2. Updates **Monthly Analyst Report** (strategic insights)
3. Updates **Visual Slide Deck** (presentation-ready slides)
4. Posts notification to **#itops-metric-reporting** Slack channel

**Manual trigger**: Available via [GitHub Actions](https://github.com/arlynnattn/isd-metrics-automation/actions)

**Slack Notifications**: All updates send rich, formatted notifications using Slack Block Kit with emojis, clickable links, and organized sections.

## ✅ Features

**Automated Data Collection:**
- ✅ Jira ticket metrics (created, resolved, SLA performance) - API-driven
- ✅ Slack support-channel activity for #ask-it and #team-it-support - API-driven
- ✅ Monthly Slack `Trends / Notables / Why` extraction for leadership readouts
- ✅ `#team-it-support` prioritized first during monthly Slack collection
- ✅ Slack rate-limit retry and recovery logic for support-channel reads
- ✅ CSAT scores from Jira - API-driven
- ✅ Department breakdown - API-driven
- ✅ Top SaaS application requests - API-driven
- ✅ Business hours SLA calculations (9-6 PM ET, Mon-Fri) - Uses Jira SLA fields

**Report Types:**
- **Weekly Data Report**: Last 7 days metrics - saves to Desktop (manual Confluence paste required)
- **Monthly Data Report**: Current month metrics - saves to Desktop (manual Confluence paste required)
- **Weekly Analyst Report**: Executive analysis - automatically updates Confluence
- **Monthly Analyst Report**: Strategic insights - automatically updates Confluence
- **Automation Overview**: Week-over-week automation metrics - automatically updates Confluence

## ✅ Current Automation State

| Component | Status | Details |
|-----------|--------|---------|
| Data Collection | ✅ Fully Automated | Fetches from Jira/Slack APIs |
| Weekly Updates | ✅ Fully Automated | 2 Confluence pages auto-update every Monday at 9am ET |
| Monthly Updates | ✅ Fully Automated | 3 Confluence pages auto-update on 1st of month at 9am ET |
| Confluence Publishing | ✅ Fully Automated | Weekly Dashboard + Analyst, Monthly Dashboard + Analyst + Slides |
| Workforce Tracking | ✅ Fully Automated | Uses CLONE tickets with calendar verification |
| Data Consistency | ✅ Integrated | All reports consume same JSON metrics data |
| Slack Notifications | ✅ Fully Automated | Rich Block Kit messages to #itops-metric-reporting |

## 🚀 Quick Start

### Run Weekly Report
```bash
cd ~/isd-metrics-automation
./run-weekly.sh
```

### Run Monthly Report
```bash
cd ~/isd-metrics-automation
./run-monthly.sh
```

### Run Automation Metrics Report
```bash
cd ~/isd-metrics-automation
./run-automation-metrics.sh
```

### Run Analyst Reports
```bash
cd ~/isd-metrics-automation
./run-weekly-analyst.sh    # Executive analysis of weekly metrics
./run-monthly-analyst.sh   # Strategic insights from monthly metrics
```

Weekly and Monthly data reports are saved to your **Desktop** as HTML files. The Automation Metrics and Analyst Reports update Confluence pages directly.

## 📋 Automated Confluence Updates

### Weekly (Fully Automated via GitHub Actions)
Every Monday at 9:00 AM ET, these pages auto-update:
- **Weekly Metrics Dashboard**: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6423805982
- **Weekly Analyst Report**: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6424363046

### Monthly (Fully Automated via GitHub Actions)
On the 1st of every month at 9:00 AM ET, these pages auto-update:
- **Monthly Metrics Dashboard**: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6415089689
- **Monthly Analyst Report**: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6422003766
- **Visual Slide Deck**: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6440288277

### Other Automation Metrics (Run Manually)
- **Automation Metrics Overview**: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/5471371324

### Manual Updates (if needed)

**Weekly:**
```bash
node update-confluence-weekly.js
node generate-weekly-analyst-report.js
```

**Monthly:**
```bash
node update-confluence-monthly-enhanced.js
node generate-monthly-analyst-report.js
node update-visual-slide-deck.js
```

Or trigger via [GitHub Actions](https://github.com/arlynnattn/isd-metrics-automation/actions) → "Run workflow"

## 📊 Metrics Included

### Key Metrics Summary Table
- **Created vs Resolved** tickets (with WoW/MoM comparison)
- **TTFR** (Time to First Response) - SLA target: 2 hours
- **TTR** (Time to Resolution) - SLA target: 16 hours  
- **SLA Met %** - Overall SLA performance
- **Slack support channels** - Messages and unique users across #ask-it and #team-it-support
- **Slack readout signals** - leadership-ready Trends, Notables, and Why sections
- **CSAT** - Average score and review count

### Additional Sections
- Department breakdown (top 5 departments)
- Access requests volume
- Top SaaS applications (top 10 apps)
- Resolved ticket type breakdown
- SLA breach analysis with counts

## ⚙️ Configuration

### API Tokens
The run scripts contain your API tokens (not recommended to commit to git):
- **JIRA_API_TOKEN**: Read access to ISD project tickets
- **SLACK_BOT_TOKEN**: Read access to #ask-it and #team-it-support
- **SLACK_TEAM_IT_SUPPORT_CHANNEL_ID**: Optional override to hardcode the `#team-it-support` channel ID
- **CONFLUENCE_API_TOKEN**: (Optional) Write access to Confluence pages

### Jira Custom Fields
```javascript
FIELD_SERVICE_CATALOG = 'customfield_14446'  // SaaS app names (from Assets)
FIELD_EMPLOYEE_DEPT = 'customfield_12617'    // Employee department
FIELD_SATISFACTION = 'customfield_10048'     // CSAT rating (1-5 scale)
FIELD_TTFR = 'customfield_10130'            // Business hours TTFR
FIELD_TTR = 'customfield_10129'             // Business hours TTR
```

### JQL Filters Used

**Weekly (last 7 days):**
```jql
# Resolved tickets
project = ISD AND resolutiondate >= -7d AND status in ("13. Done", Canceled, Closed, Completed, Declined, Resolved)

# Created tickets
project = ISD AND created >= -7d
```

**Monthly (current month):**
```jql
# Resolved tickets
project = ISD AND resolutiondate >= "2026-03-01" AND status in ("13. Done", Canceled, Closed, Completed, Declined, Resolved)

# Created tickets
project = ISD AND created >= "2026-03-01"
```

## 📁 Files

### Weekly Automation Scripts
- `update-confluence-weekly.js` - Weekly metrics data collection and Confluence update
- `generate-weekly-analyst-report.js` - Executive analysis of weekly metrics

### Monthly Automation Scripts
- `update-confluence-monthly-enhanced.js` - Monthly metrics data collection and Confluence update
- `generate-monthly-analyst-report.js` - Strategic insights from monthly metrics
- `update-visual-slide-deck.js` - Updates presentation-ready slide deck

### Other Scripts
- `update-confluence-metrics.js` - Automation metrics overview (week-over-week, manual run)

### GitHub Actions Workflows
- `.github/workflows/weekly-metrics.yml` - Weekly automation (every Monday at 9am ET)
- `.github/workflows/monthly-metrics.yml` - Monthly automation (1st of month at 9am ET)

### Helper Scripts
- `run-weekly.sh` - Run weekly metrics report
- `run-monthly.sh` - Run monthly metrics report
- `run-automation-metrics.sh` - Run automation metrics overview
- `run-weekly-analyst.sh` - Run weekly analyst report
- `run-monthly-analyst.sh` - Run monthly analyst report
- `csat-config.json` - Manual CSAT tracking (deprecated, now auto-fetched)

## 🔧 Troubleshooting

### No tickets found (0 resolved/created)
**Cause**: Jira API token doesn't have read access  
**Fix**: Verify token at https://id.atlassian.com/manage-profile/security/api-tokens

### Slack metrics showing "N/A"
**Cause**: Slack Bot Token invalid or bot not in channel  
**Fix**: 
- Check token is correct
- Invite bot to #ask-it: `/invite @IT Metrics Bot`
- Invite bot to #team-it-support: `/invite @IT Metrics Bot`

### #team-it-support missing from Slack insights
**Cause**: Bot not in channel, channel ID lookup failed, or Slack rate limits interrupted the read  
**Fix**:
- Confirm the bot is invited to `#team-it-support`
- Optionally set `SLACK_TEAM_IT_SUPPORT_CHANNEL_ID` in GitHub Actions secrets or your local env
- Re-run the monthly workflow if Slack returned a temporary `429` rate limit

### CSAT scores showing "N/A"  
**Cause**: No CSAT responses in date range
**Check**: This is normal if customers haven't submitted ratings

### High SLA breach rate
**Cause**: Check if business hours are configured correctly  
**Current**: 9-6 PM ET, Monday-Friday (using Jira's built-in SLA fields)

### Confluence 403/401 errors
**Cause**: API token doesn't have Confluence write permissions  
**Workaround**: Manual copy/paste from Desktop HTML files (current workflow)

## 🔔 Slack Notifications

All automated updates send rich, formatted notifications to **#itops-metric-reporting** using Slack Block Kit:

**Features:**
- ✅ Bold headers with emojis
- 📅 Clear date/time information
- 📊 Organized sections with visual dividers
- 🔗 Clickable links to updated Confluence pages
- 🤖 Footer showing automation source and next update time

**Example Weekly Message:**
```
✅ ISD Weekly Metrics Updated
📅 Week of March 31, 2026

All weekly Confluence pages have been automatically updated...

📊 Updated Pages:
• 📈 Weekly Metrics Dashboard
• 📝 Weekly Analyst Report

🤖 Automated via GitHub Actions • Next update: Next Monday at 9:00 AM ET
```

See [Slack_Message_Examples.md](./docs/Slack_Message_Examples.md) for visual previews and technical details.

## 🛠️ Technical Details

### SLA Calculation
The scripts use Jira's **built-in SLA fields** which automatically calculate business hours:
- `customfield_10130` (TTFR): Time to first response in business hours
- `customfield_10129` (TTR): Time to resolution in business hours

**Business Hours**: 9:00 AM - 6:00 PM Eastern Time, Monday-Friday

### Service Catalog Resolution
SaaS application names are fetched from Jira Assets API:
```javascript
/gateway/api/jsm/assets/workspace/{workspaceId}/v1/object/{objectId}
```

This resolves object IDs like `"objectId": "12345"` to application names like `"Snowflake"`.

### Pagination
Both scripts handle pagination for large result sets using Jira's `nextPageToken` parameter.

## 📅 Scheduled Execution

**Fully automated via GitHub Actions** - no local cron setup needed!

- **Weekly**: Every Monday at 9:00 AM ET (GitHub Actions cron: `0 13 * * 1` UTC)
- **Monthly**: 1st of month at 9:00 AM ET (GitHub Actions cron: `0 13 1 * *` UTC)

Both workflows automatically:
1. Collect metrics from Jira/Slack APIs
2. Update Confluence pages
3. Send formatted Slack notifications to #itops-metric-reporting

**Monitor runs**: https://github.com/arlynnattn/isd-metrics-automation/actions

## 💡 Support

For issues or questions:
- Review error messages in script output
- Verify API tokens haven't expired
- Reach out in **#ask-security** for token permission questions
- Contact **@arlynn** for script modifications
