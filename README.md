# ISD Metrics Automation

Automated reporting for IT Ops metrics from Jira Service Desk, matching the monthly leadership dashboard.

## ✅ Features

**Automated Data Collection:**
- Jira ticket metrics (created, resolved, SLA performance)
- Slack #ask-it channel activity  
- CSAT scores from Jira
- Department breakdown
- Top SaaS application requests
- Business hours SLA calculations (9-6 PM ET, Mon-Fri)

**Two Report Types:**
- **Weekly Report**: Last 7 days (uses `-7d` filter matching Jira)
- **Monthly Report**: Current month to date

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

## 📋 How to Update Confluence

Scripts automatically update Confluence pages:
- **Weekly Metrics**: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6423805982
- **Monthly Metrics**: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6415089689
- **Automation Metrics Overview**: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/5471371324
- **Weekly Analyst Report**: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6424363046
- **Monthly Analyst Report**: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6422003766

If manual update is needed for Weekly/Monthly reports:

1. **Run the script** (weekly or monthly)
2. **Find the HTML file** on your Desktop:
   - `ISD_Weekly_Metrics_2026-03-27.html`
   - `ISD_Monthly_Metrics_Mar_2026.html`
3. **Open the file** and copy all content (Cmd+A, Cmd+C)
4. **Go to the appropriate Confluence page** (links above)
5. **Edit the page** and paste the HTML

## 📊 Metrics Included

### Key Metrics Summary Table
- **Created vs Resolved** tickets (with WoW/MoM comparison)
- **TTFR** (Time to First Response) - SLA target: 2 hours
- **TTR** (Time to Resolution) - SLA target: 16 hours  
- **SLA Met %** - Overall SLA performance
- **#ask-it Slack** - Messages and unique users
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
- **SLACK_BOT_TOKEN**: Read access to #ask-it channel
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

### Data Collection Scripts
- `update-confluence-weekly.js` - Weekly metrics data collection
- `update-confluence-monthly-enhanced.js` - Monthly metrics data collection
- `update-confluence-metrics.js` - Automation metrics overview (week-over-week)

### Analyst Report Scripts
- `generate-weekly-analyst-report.js` - Executive analysis of weekly metrics
- `generate-monthly-analyst-report.js` - Strategic insights from monthly metrics

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

### CSAT scores showing "N/A"  
**Cause**: No CSAT responses in date range
**Check**: This is normal if customers haven't submitted ratings

### High SLA breach rate
**Cause**: Check if business hours are configured correctly  
**Current**: 9-6 PM ET, Monday-Friday (using Jira's built-in SLA fields)

### Confluence 403/401 errors
**Cause**: API token doesn't have Confluence write permissions  
**Workaround**: Manual copy/paste from Desktop HTML files (current workflow)

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

For automatic weekly/monthly reports, set up a cron job:

```bash
# Weekly on Monday at 9 AM
0 9 * * 1 cd ~/isd-metrics-automation && ./run-weekly.sh

# Monthly on 1st day of month at 9 AM
0 9 1 * * cd ~/isd-metrics-automation && ./run-monthly.sh
```

## 💡 Support

For issues or questions:
- Review error messages in script output
- Verify API tokens haven't expired
- Reach out in **#ask-security** for token permission questions
- Contact **@arlynn** for script modifications
