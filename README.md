# ISD Metrics Automation

Automated weekly updates of ISD project metrics (TTFR and TTR) to Confluence.

## What it does

This automation:
- Fetches TTFR (Time to First Response) and TTR (Time to Resolution) metrics from Jira
- Compares current week vs previous week
- Automatically updates the Confluence page with a formatted table
- Runs every Monday at 9:00 AM UTC

## Setup Instructions

### 1. Create an Atlassian API Token

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a name like "ISD Metrics Automation"
4. Copy the token (you won't be able to see it again)

### 2. Configure Environment Variables

#### For Local Testing:

```bash
export ATLASSIAN_EMAIL="your-email@attentivemobile.com"
export ATLASSIAN_API_TOKEN="your-api-token"
```

#### For GitHub Actions:

1. Go to your repository Settings → Secrets and variables → Actions
2. Add two repository secrets:
   - `ATLASSIAN_EMAIL`: Your Attentive email
   - `ATLASSIAN_API_TOKEN`: Your API token

### 3. Customize the Script (Optional)

The script is configured for the ISD project. You may want to adjust:

**Project Key**: In `update-confluence-metrics.js`, line 139-140:
```javascript
const currentWeekJQL = `project = ISD AND created >= ...`;
```

**Filters**: Add filters to focus on specific issue types or teams:
```javascript
const currentWeekJQL = `project = ISD AND type = "Support Request" AND created >= ...`;
```

**Schedule**: In `.github/workflows/weekly-metrics.yml`, adjust the cron schedule:
```yaml
schedule:
  - cron: '0 9 * * 1'  # Monday at 9 AM UTC
```

### 4. Test Locally

```bash
cd isd-metrics-automation
node update-confluence-metrics.js
```

You should see output like:
```
=== ISD Metrics Automation ===

Fetching issues for Week of 10/7/2025...
Found 45 issues

Fetching issues for Week of 9/30/2025...
Found 38 issues

=== Metrics Summary ===
Current Week (Week of 10/7/2025):
  Total Issues: 45
  Avg TTFR: 2.45 hours (40 issues)
  Avg TTR: 18.32 hours (35 issues)

Previous Week (Week of 9/30/2025):
  Total Issues: 38
  Avg TTFR: 3.12 hours (35 issues)
  Avg TTR: 22.15 hours (30 issues)

Fetching current Confluence page...
Updating Confluence page...
✓ Confluence page updated successfully!

✓ All done!
```

### 5. Deploy to GitHub

```bash
git init
git add .
git commit -m "Add ISD metrics automation"
git remote add origin <your-repo-url>
git push -u origin main
```

### 6. Enable GitHub Actions

1. Go to your repository on GitHub
2. Click the "Actions" tab
3. Enable workflows if prompted
4. The workflow will run automatically every Monday
5. You can also trigger it manually using "Run workflow"

## Confluence Page

The metrics are published to:
https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/5471371324/Test+Claud

Each week, a new table is added to the top of the page showing:
- Total Issues (current vs previous week)
- Average TTFR in hours
- Number of issues with first response
- Average TTR in hours
- Number of resolved issues
- Week-over-week percentage changes

## Metrics Definitions

- **TTFR (Time to First Response)**: Time from issue creation to first comment
- **TTR (Time to Resolution)**: Time from issue creation to resolution

## Troubleshooting

**Authentication errors**: Verify your email and API token are correct

**No issues found**: Check the JQL query in the script matches your project

**Permission errors**: Ensure your Atlassian account has access to:
  - View Jira issues in the ISD project
  - Edit the Confluence page

**GitHub Actions not running**: Check:
  - Secrets are configured correctly
  - Actions are enabled in repository settings
  - Workflow file is in `.github/workflows/` directory

## Manual Execution

To run manually on any schedule:

```bash
# Run immediately
node update-confluence-metrics.js

# Or use cron (Linux/Mac)
crontab -e
# Add: 0 9 * * 1 cd /path/to/isd-metrics-automation && node update-confluence-metrics.js
```

## Support

For questions or issues, reach out in #ask-security or #isd-team
