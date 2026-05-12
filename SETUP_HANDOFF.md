# ISD Metrics Automation - Setup Handoff for Claude Chat

## Current Status (as of May 12, 2026)

### ✅ COMPLETED
1. **Atlassian API Token** - FIXED AND WORKING
   - New token generated and tested
   - Both Jira and Confluence APIs verified working
   - Token saved to `~/.env` file
   - Full token stored locally (not shown here for security)

2. **Slack Bot Token** - ADDED TO .ENV
   - Token tested and verified working
   - Saved to `~/.env` file
   - Tested and verified working
   - Saved to `~/.env` file

3. **Time Formatting** - IMPLEMENTED
   - Converts decimal hours to "Xh Ym" format
   - Example: 9.63h → "9h 38m"
   - Working in both Slack and Confluence output

4. **Workforce Change Logic** - IMPLEMENTED
   - Uses Google Calendar as source of truth
   - Monday cohort only for onboarding
   - Monday-Sunday range for offboarding
   - De-duplication by person name
   - Explicit date labels in output

### ⏳ REMAINING TASK
**Google Calendar Credentials** - IN PROGRESS (stopped due to Codex limitation)

---

## What Needs to Be Done: Google Calendar Setup

### Context
You started creating a Google Cloud service account but need to continue this setup outside of Claude Code due to Codex configuration.

### Where We Left Off
- Google Cloud Console is open
- You may have started creating a service account named `isd-metrics-calendar-reader`
- Need to complete the setup and download the JSON key file

### Complete Steps (from the beginning)

#### Step 1: Create Service Account (if not already done)
1. Go to https://console.cloud.google.com/apis/credentials
2. Select project: `isd-metrics-automation` (or your project)
3. Click **"+ CREATE CREDENTIALS"** → **"Service account"**
4. Fill in:
   - Service account name: `isd-metrics-calendar-reader`
   - Service account ID: (auto-generated)
   - Description: `Read-only access to IT OOO calendar for metrics automation`
5. Click **"CREATE AND CONTINUE"**
6. Skip role selection (click "CONTINUE")
7. Click **"DONE"**

#### Step 2: Download JSON Key
1. Find your service account in the list
2. Click on it
3. Go to **"KEYS"** tab
4. Click **"ADD KEY"** → **"Create new key"**
5. Select **"JSON"** format
6. Click **"CREATE"**
7. JSON file will download automatically (save it!)

#### Step 3: Enable Google Calendar API
1. Go to https://console.cloud.google.com/apis/library
2. Search for: "Google Calendar API"
3. Click on it
4. Click **"ENABLE"**

#### Step 4: Share Calendar with Service Account
1. Open the JSON key file you downloaded
2. Find and copy the `"client_email"` value (looks like: `isd-metrics-calendar-reader@project-id.iam.gserviceaccount.com`)
3. Go to https://calendar.google.com
4. Find **"Biz Sys + Security + IT OOO Calendar"** in your calendar list
5. Click three dots → **"Settings and sharing"**
6. Scroll to **"Share with specific people"**
7. Click **"+ Add people"**
8. Paste the service account email
9. Set permission: **"See all event details"**
10. Click **"Send"**

#### Step 5: Save Credentials Locally
```bash
# Move the downloaded JSON to the right location
mv ~/Downloads/isd-metrics-*.json ~/isd-metrics-automation/google-service-account.json

# Or if you named it something else:
mv ~/Downloads/your-key-file.json ~/isd-metrics-automation/google-service-account.json
```

#### Step 6: Test It
```bash
cd ~/isd-metrics-automation
node check-calendar-ooo.js
```

Expected output:
```
Checking OOO calendar from 2026-05-12 to 2026-05-19...
Found X OOO events this week
  ✅ Carlos Ramirez is ACTIVE
  ✅ Artie Byers is ACTIVE
  ✅ JP Dulude is ACTIVE

📊 Team Status Summary:
Active: Carlos Ramirez, Artie Byers, JP Dulude (3/3)
```

#### Step 7: Add to GitHub Secrets (for Production)
1. Go to https://github.com/arlynnattn/isd-metrics-automation/settings/secrets/actions
2. Click **"New repository secret"**
3. Name: `GOOGLE_SERVICE_ACCOUNT_KEY`
4. Value: Paste the **entire contents** of the JSON file
5. Click **"Add secret"**

---

## After Google Calendar Setup is Complete

### Test the Full Workflow
```bash
cd ~/isd-metrics-automation
node update-confluence-weekly.js
```

You should see:
- ✅ No "Error checking workforce changes"
- ✅ No "Skipping Slack metrics"  
- ✅ No "Error updating Confluence page"
- ✅ Workforce changes with actual counts (not 0)
- ✅ Time formatted as "Xh Ym" in output

### Run Diagnostics
```bash
cd ~/isd-metrics-automation
./diagnose-setup.sh
```

Should show: **"✓ All checks passed!"**

---

## GitHub Secrets to Update

Once local setup works, update these GitHub secrets:

1. **ATLASSIAN_EMAIL** (already set)
   - Value: `agalang@attentivemobile.com`

2. **ATLASSIAN_API_TOKEN** (needs update)
   - Old token is expired
   - New token stored in `~/.env` file (copy from there)

3. **SLACK_BOT_TOKEN** (check if already set, if not add)
   - Value stored in `~/.env` file (copy from there)

4. **GOOGLE_SERVICE_ACCOUNT_KEY** (new - add this)
   - Value: Entire JSON file contents from Step 5 above

Go to: https://github.com/arlynnattn/isd-metrics-automation/settings/secrets/actions

---

## What Changed in the Code

### Files Modified
1. `check-calendar-ooo.js` - Added workforce change functions
2. `update-confluence-weekly.js` - Uses calendar for workforce data
3. `save-metrics-to-json.js` - Added time formatting
4. `.github/workflows/weekly-metrics.yml` - Uses formatted time values
5. `.github/workflows/monthly-metrics.yml` - Uses formatted time values

### New Files Added
1. `test-workforce-calendar.js` - Test suite for calendar logic
2. `WORKFORCE_CHANGES_UPDATE.md` - Complete documentation
3. `FIXES_NEEDED.md` - Troubleshooting guide
4. `diagnose-setup.sh` - Diagnostic script

All changes are pushed to: https://github.com/arlynnattn/isd-metrics-automation

---

## Quick Reference Commands

### Test individual components:
```bash
# Test OOO checker
node check-calendar-ooo.js

# Test workforce changes
node test-workforce-calendar.js

# Run full weekly metrics
node update-confluence-weekly.js

# Run diagnostics
./diagnose-setup.sh
```

### Check what's working:
```bash
# View latest metrics cache
cat metrics-cache-weekly.json | jq '.currentWeek | {avgTTFRFormatted, avgTTRFormatted, workforce}'

# Check last generated HTML
ls -lt ~/Desktop/ISD_Weekly_Metrics_*.html | head -1
```

---

## Troubleshooting

### Google Calendar 403 Error
- Make sure calendar is shared with service account email
- Check service account has "See all event details" permission
- Verify Calendar API is enabled in Google Cloud Console

### Service Account Email Not Found
Open the JSON file and look for:
```json
{
  "client_email": "isd-metrics-calendar-reader@project-id.iam.gserviceaccount.com"
}
```

### Calendar Not Found
The calendar ID is hardcoded as: `c_820sf7kusu8t8ojt5nksme6nbc@group.calendar.google.com`

If this is wrong, update in `check-calendar-ooo.js`:
```javascript
const CALENDAR_ID = 'c_820sf7kusu8t8ojt5nksme6nbc@group.calendar.google.com';
```

---

## Summary for Claude Chat

**Hi Claude!** I'm continuing the ISD Metrics Automation setup from Claude Code. Here's where we are:

✅ **Fixed:**
- Atlassian API token (Jira + Confluence working)
- Slack bot token (working)
- Time formatting (9.63h → "9h 38m")
- Workforce change logic (implemented)

⏳ **Need Help With:**
- Setting up Google Calendar service account (can't do in Claude Code due to Codex)
- I need to create the service account and download the JSON key
- Then share the "Biz Sys + Security + IT OOO Calendar" with it

See full details in this document for the exact steps I need to follow.

Can you help me complete the Google Calendar setup?

---

## Contact Info
- GitHub Repo: https://github.com/arlynnattn/isd-metrics-automation
- Email: agalang@attentivemobile.com
- Confluence: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6423805982
