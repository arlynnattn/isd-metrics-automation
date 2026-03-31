# ISD Metrics Automation - Documentation

This folder contains documentation for the ISD metrics automation system.

## 📚 Documentation Files

### Automation Setup

- **[Automation_Schedule.md](./Automation_Schedule.md)** ⭐ **START HERE**
  - Complete schedule for weekly AND monthly automation
  - What runs, when, and where
  - Manual trigger instructions
  - Monitoring and troubleshooting
  - **Read this first for full automation overview**

- **[Monthly_Automation_Full_Setup.txt](./Monthly_Automation_Full_Setup.txt)**
  - Detailed guide to monthly automation workflow
  - What runs on 1st of each month at 9am ET
  - GitHub Actions configuration
  - Required secrets

### Workforce Counting Methodology

- **[Workforce_CLONE_Tickets_Methodology.txt](./Workforce_CLONE_Tickets_Methodology.txt)**
  - Why we use CLONE tickets as primary source
  - Calendar event verification approach
  - Comparison of CLONE vs calendar events
  - Benefits and data quality checks

- **[Workforce_Update_Summary.txt](./Workforce_Update_Summary.txt)**
  - Summary of all workforce counting fixes
  - Before/after comparison
  - Key learnings and best practices
  - JQL queries used

- **[March_2026_Workforce_FINAL_VALIDATED.txt](./March_2026_Workforce_FINAL_VALIDATED.txt)**
  - Validated March 2026 workforce numbers
  - Complete breakdown: FTE vs contractors, onboarding vs offboarding
  - Methodology and validation approach
  - Discrepancy analysis

## 🚀 Quick Start

### Running the Monthly Automation

The automation runs automatically on the 1st of each month at 9:00 AM ET. It updates:

1. **ISD Monthly Metrics Dashboard** (6415089689)
2. **Monthly Analyst Report** (6422003766)
3. **Visual Slide Deck** (6440288277)
4. **Slack notification** to #itops-metric-reporting

### Manual Trigger

```bash
# Run all 3 updates in sequence:
node update-confluence-monthly-enhanced.js
node generate-monthly-analyst-report.js
node update-visual-slide-deck.js
```

Or trigger via GitHub Actions:
- Go to: https://github.com/arlynnattn/isd-metrics-automation/actions
- Click "Update ISD Metrics Monthly"
- Click "Run workflow"

## 📊 Key Metrics Tracked

- **Ticket Volume**: Total tickets, by department
- **Response Times**: TTFR (Time to First Response), TTR (Time to Resolution)
- **Customer Satisfaction**: CSAT scores and trends
- **Automation Rate**: % of tickets resolved by automation
- **Workforce Changes**:
  - FTE onboarding (CLONE - IT Support Onboarding)
  - Contractor onboarding (CLONE - Contractor Onboarding)
  - FTE offboarding (CLONE - Device tickets)
  - Contractor offboarding (CLONE - Contractor Offboarding)
- **SaaS App Tracking**: New apps and access requests

## 🔍 Workforce Counting Rules

### Primary Sources (CLONE Tickets)
- **FTE Onboarding**: `summary ~ "CLONE - IT Support Onboarding"` + reporter = jira-sapling/greenhouse
- **Contractor Onboarding**: `summary ~ "CLONE - Contractor Onboarding"`
- **FTE Offboarding**: `summary ~ "CLONE - Device"` + reporter = jira-sapling
- **Contractor Offboarding**: `summary ~ "CLONE - Contractor Offboarding"`

### Date Filtering
- Uses **RESOLUTION DATE** (when IT completed the work)
- Not created date (when ticket was filed)

### Verification
- Calendar events queried as verification for FTE onboarding
- Logs warning if discrepancy > 10%

## 🛠️ Troubleshooting

### Automation Didn't Run
1. Check GitHub Actions: https://github.com/arlynnattn/isd-metrics-automation/actions
2. Verify GitHub Secrets are set (ATLASSIAN_EMAIL, ATLASSIAN_API_TOKEN, SLACK_BOT_TOKEN)
3. Check Confluence page permissions

### Wrong Numbers
1. Review countWorkforceChanges() function in update-confluence-monthly-enhanced.js
2. Check JQL queries match the rules above
3. Verify reporter field is used (not creator)
4. Confirm resolution date filter (not created date)

### Discrepancy Warnings
- If CLONE tickets and calendar events differ by >10%, investigate:
  - Missing calendar events
  - Different resolution dates
  - Data quality issues in HR systems

## 📝 Change History

### March 30, 2026
- ✅ Switched to CLONE tickets as primary source for FTE onboarding
- ✅ Added contractor offboarding tracking (was missing)
- ✅ Added calendar event verification
- ✅ Created full automation for all 3 Confluence pages
- ✅ Updated GitHub Actions workflow

### Earlier Changes
- Fixed FTE onboarding to use calendar events (later changed to CLONE tickets)
- Added automation vs human breakdown
- Corrected time formats (hours + minutes)
- Fixed ticket references and automation counts

## 📧 Support

For questions or issues:
- Check GitHub Actions logs
- Review documentation in this folder
- Update JQL queries if Jira structure changes
- Verify GitHub Secrets are current
