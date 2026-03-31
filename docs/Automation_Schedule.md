# ISD Metrics Automation Schedule

Complete automation schedule for all weekly and monthly updates.

## 📅 Automated Schedule

### 🗓️ Weekly Updates (Every Monday at 9:00 AM ET)

**Workflow**: `.github/workflows/weekly-metrics.yml`
**Schedule**: Every Monday at 1:00 PM UTC (9:00 AM ET)
**Trigger**: `cron: '0 13 * * 1'`

**What Updates:**
1. **Weekly Metrics Dashboard** (6423805982)
   - Script: `update-confluence-weekly.js`
   - Metrics: Last 7 days
   - Link: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6423805982

2. **Weekly Analyst Report** (6424363046)
   - Script: `generate-weekly-analyst-report.js`
   - Executive analysis and insights
   - Link: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6424363046

3. **Slack Notification** → #itops-metric-reporting
   - Message: "✅ ISD Weekly Metrics Updated - All Pages"
   - Includes links to both pages

---

### 📊 Monthly Updates (1st of Month at 9:00 AM ET)

**Workflow**: `.github/workflows/monthly-metrics.yml`
**Schedule**: 1st day of every month at 1:00 PM UTC (9:00 AM ET)
**Trigger**: `cron: '0 13 1 * *'`

**What Updates:**
1. **ISD Monthly Metrics Dashboard** (6415089689)
   - Script: `update-confluence-monthly-enhanced.js`
   - Collects all monthly metrics and saves to JSON
   - Link: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6415089689

2. **Monthly Analyst Report** (6422003766)
   - Script: `generate-monthly-analyst-report.js`
   - Executive summary and strategic insights
   - Link: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6422003766

3. **Visual Slide Deck** (6440288277)
   - Script: `update-visual-slide-deck.js`
   - Presentation-ready metrics slides
   - Link: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6440288277

4. **Slack Notification** → #itops-metric-reporting
   - Message: "✅ ISD Monthly Metrics Updated - All Pages"
   - Includes links to all 3 pages

---

## 📋 Summary Table

| Frequency | Day/Date | Time (ET) | Pages Updated | Slack Channel |
|-----------|----------|-----------|---------------|---------------|
| **Weekly** | Every Monday | 9:00 AM | 2 pages (Dashboard + Analyst) | #itops-metric-reporting |
| **Monthly** | 1st of month | 9:00 AM | 3 pages (Dashboard + Analyst + Slides) | #itops-metric-reporting |

---

## 🎯 Next Scheduled Runs

### Weekly
- **Next run**: Every Monday
- **Time**: 9:00 AM ET
- **Example**: April 7, 2026 (Monday)

### Monthly
- **Next run**: April 1, 2026
- **Time**: 9:00 AM ET
- **Updates**: March 2026 metrics

---

## 🔧 Manual Trigger

Both workflows can be manually triggered if needed:

### Via GitHub Actions UI
1. Go to: https://github.com/arlynnattn/isd-metrics-automation/actions
2. Select workflow:
   - "Update ISD Metrics Weekly" OR
   - "Update ISD Metrics Monthly"
3. Click "Run workflow" dropdown
4. Select branch: `main`
5. Click green "Run workflow" button

### Via Command Line
```bash
# Weekly (run both scripts):
node update-confluence-weekly.js
node generate-weekly-analyst-report.js

# Monthly (run all 3 scripts):
node update-confluence-monthly-enhanced.js
node generate-monthly-analyst-report.js
node update-visual-slide-deck.js
```

---

## 📊 What Each Script Does

### Weekly Scripts

**`update-confluence-weekly.js`**
- Queries Jira for last 7 days of data
- Calculates: tickets, TTFR, TTR, CSAT, department breakdown
- Updates Weekly Metrics Dashboard page
- Saves metrics data for analyst report to consume

**`generate-weekly-analyst-report.js`**
- Reads weekly metrics data
- Generates executive-style analysis
- Provides week-over-week comparisons
- Updates Weekly Analyst Report page

### Monthly Scripts

**`update-confluence-monthly-enhanced.js`**
- Queries Jira for current month's data
- Calculates all metrics including workforce changes
- Uses CLONE tickets for workforce (with calendar verification)
- Updates Monthly Metrics Dashboard page
- Saves metrics to JSON for other scripts

**`generate-monthly-analyst-report.js`**
- Reads monthly metrics from JSON
- Generates strategic insights and recommendations
- Provides month-over-month comparisons
- Updates Monthly Analyst Report page

**`update-visual-slide-deck.js`**
- Reads monthly metrics from JSON
- Updates slide deck with current month's data
- Updates page title to include current month
- Updates Visual Slide Deck page

---

## 🔔 Slack Notifications

### Weekly Notification Format
```
✅ ISD Weekly Metrics Updated - All Pages
📅 Week of MM/DD/YYYY

📊 Weekly Metrics Dashboard
📝 Weekly Analyst Report
```

### Monthly Notification Format
```
✅ ISD Monthly Metrics Updated - All Pages
📅 Month YYYY

📊 Main Dashboard
📝 Monthly Analyst Report
🎨 Visual Slide Deck
```

---

## ⚙️ Required GitHub Secrets

Both workflows require these secrets to be configured:

- `ATLASSIAN_EMAIL` - Your Jira/Confluence email
- `ATLASSIAN_API_TOKEN` - API token for Jira/Confluence access
- `SLACK_BOT_TOKEN` - Bot token for posting to Slack

Check/update at: https://github.com/arlynnattn/isd-metrics-automation/settings/secrets/actions

---

## 📈 Monitoring

### Check if Automation Ran Successfully

1. **Check Slack**: Look for notification in #itops-metric-reporting
   - Weekly: Should appear every Monday ~9:05 AM ET
   - Monthly: Should appear on 1st of month ~9:05 AM ET

2. **Check GitHub Actions**:
   - Go to: https://github.com/arlynnattn/isd-metrics-automation/actions
   - Green checkmark = Success ✅
   - Red X = Failed ❌

3. **Check Confluence Pages**: Verify version number increased

### If Automation Fails

1. Check GitHub Actions logs for error message
2. Verify GitHub Secrets haven't expired
3. Check Confluence page permissions
4. Manually run scripts locally to test
5. Check Jira API quotas

---

## 🚀 Testing Recommendations

Before relying on automation:

1. **Test Weekly**: Manually trigger on a non-Monday to verify
2. **Test Monthly**: Manually trigger before April 1st to verify
3. **Verify Slack**: Confirm notifications appear in correct channel
4. **Check Pages**: Ensure all metrics look accurate

This ensures smooth operation when automation runs on schedule.
