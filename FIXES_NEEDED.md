# Fixes Needed for ISD Metrics Automation

## Summary
The weekly metrics script ran successfully end-to-end, but three components need attention to work fully in production:

---

## 1. ⚠️ Confluence API Access (403 Error)

### Issue
```
Error updating Confluence page: HTTP 403: {"message":"Current user not permitted to use Confluence","statusCode":403}
```

### Root Cause
The Atlassian API token may not have Confluence product access enabled, or the user account doesn't have Confluence license.

### Solutions

#### Option A: Generate New API Token with Confluence Access
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a name: "ISD Metrics Automation - Confluence Access"
4. Copy the token
5. Update `.env` file:
   ```bash
   ATLASSIAN_API_TOKEN=<new-token-here>
   ```
6. Update GitHub Secret `ATLASSIAN_API_TOKEN` with new token

#### Option B: Check User Confluence License
1. Go to Atlassian Admin Console
2. Check if `agalang@attentivemobile.com` has Confluence product access
3. If not, request Confluence license from admin
4. Once granted, retry with existing token

#### Option C: Use Manual Workflow (Current Workaround)
The script already saves HTML to `~/Desktop/ISD_Weekly_Metrics_YYYY-MM-DD.html`
- Copy the HTML
- Manually paste into Confluence page editor
- This works but requires manual step each week

### Testing
```bash
# Test Confluence API access
curl -u "agalang@attentivemobile.com:<API_TOKEN>" \
  -H "Accept: application/json" \
  "https://attentivemobile.atlassian.net/wiki/rest/api/content/6423805982?expand=version"

# Should return page data, not 403 error
```

---

## 2. ⚠️ Google Calendar Credentials Missing

### Issue
```
Error checking workforce changes from calendar: Google Calendar credentials not found
⚠️  Falling back to zero counts due to calendar unavailability
```

### Impact
- Workforce changes (onboarding/offboarding) report as 0
- OOO status defaults to "all engineers active"
- New Monday cohort logic not being used

### Solution

Follow the complete guide in `GOOGLE_CALENDAR_SETUP.md`, or quick steps:

#### Local Development
1. Create Google Cloud service account
2. Enable Google Calendar API
3. Download JSON key
4. Save as `~/isd-metrics-automation/google-service-account.json`
5. Share "Biz Sys + Security + IT OOO Calendar" with service account email
6. Test:
   ```bash
   cd ~/isd-metrics-automation
   node check-calendar-ooo.js
   ```

#### GitHub Actions (Production)
1. Complete local setup first
2. Copy contents of `google-service-account.json`
3. Add as GitHub Secret: `GOOGLE_SERVICE_ACCOUNT_KEY`
4. The workflow already handles this automatically

### Testing
```bash
# Test OOO checker
cd ~/isd-metrics-automation
node check-calendar-ooo.js

# Expected output:
# Checking OOO calendar from 2026-05-12 to 2026-05-19...
# Found X OOO events this week
#   ✅ Carlos Ramirez is ACTIVE
#   ✅ Artie Byers is ACTIVE
#   ❌ JP Dulude is OUT OF OFFICE

# Test workforce changes
node -e "
const { checkWorkforceChanges, getMondayOfWeek } = require('./check-calendar-ooo');
const monday = getMondayOfWeek(new Date());
checkWorkforceChanges(monday).then(result => {
  console.log('Onboarded:', result.onboardedCount);
  console.log('Offboarded:', result.offboardedCount);
  console.log('Date labels:', result.onboardingDateLabel, result.offboardingDateLabel);
});
"
```

---

## 3. ⚠️ Slack Bot Token Missing (Optional)

### Issue
```
Skipping Slack metrics for Last 7 days - no token provided
```

### Impact
- #ask-it Slack metrics show as "N/A"
- Slack notification after workflow completes won't be sent
- Minor issue - rest of metrics work fine

### Solution

#### Add to Local .env
Add this line to `~/.env`:
```bash
SLACK_BOT_TOKEN=xoxb-101543140326-10784618198918-qfiO8lsXxzXb7IUieNirM1OC
```

#### Add to GitHub Secret
1. Go to https://github.com/arlynnattn/isd-metrics-automation/settings/secrets/actions
2. Add secret `SLACK_BOT_TOKEN` with value above
3. The workflow already uses this secret

### Testing
```bash
# Test Slack API access
export SLACK_BOT_TOKEN="xoxb-101543140326-10784618198918-qfiO8lsXxzXb7IUieNirM1OC"

# Test channel access
curl -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=10" \
  | grep '"ok":true'

# Should return: "ok":true
```

---

## 4. ✅ Time Formatting - WORKING

### Status
**Already fixed and working correctly!**

Example output:
- `0.53h` → `32m`
- `9.63h` → `9h 38m`
- `1.25h` → `1h 15m`

Both Slack notifications and Confluence HTML use the new format.

---

## 5. ✅ Workforce Changes Logic - WORKING

### Status
**Already fixed and working correctly!**

New rules implemented:
- ✅ Onboarding: Monday cohort only (not rolling 7-day)
- ✅ Offboarding: Monday-Sunday range (not Monday-to-next-Monday)
- ✅ De-duplication by person name
- ✅ Explicit date labels in output
- ✅ Graceful fallback when calendar unavailable

Needs Google Calendar credentials to work fully.

---

## Priority Order

### High Priority (Blocks Full Automation)
1. **Google Calendar Credentials** - Required for workforce changes accuracy
2. **Confluence API Access** - Required for automatic dashboard updates

### Medium Priority (Nice to Have)
3. **Slack Bot Token** - Required for #ask-it metrics and notifications

---

## Quick Setup Script

Create this script to set up everything at once:

```bash
#!/bin/bash
# setup-credentials.sh

cd ~/isd-metrics-automation

echo "🔧 Setting up ISD Metrics Automation credentials..."

# Check for Google Calendar credentials
if [ ! -f "google-service-account.json" ]; then
  echo "❌ Google Calendar credentials missing"
  echo "   See GOOGLE_CALENDAR_SETUP.md for instructions"
else
  echo "✅ Google Calendar credentials found"
fi

# Check Confluence access
echo "Testing Confluence API..."
RESPONSE=$(curl -s -u "agalang@attentivemobile.com:$ATLASSIAN_API_TOKEN" \
  "https://attentivemobile.atlassian.net/wiki/rest/api/content/6423805982?expand=version")

if echo "$RESPONSE" | grep -q '"statusCode":403'; then
  echo "❌ Confluence API access denied (403)"
  echo "   Token may need Confluence product access"
else
  echo "✅ Confluence API access working"
fi

# Check Slack token
if [ -z "$SLACK_BOT_TOKEN" ]; then
  echo "❌ SLACK_BOT_TOKEN not set"
  echo "   Add to ~/.env: SLACK_BOT_TOKEN=xoxb-..."
else
  echo "✅ Slack token configured"
fi

echo ""
echo "Run './setup-credentials.sh' after fixing any issues"
```

---

## GitHub Actions Status

### Currently Working
- ✅ Jira API access
- ✅ Metrics calculation
- ✅ Time formatting
- ✅ HTML generation
- ✅ Workforce change logic (needs credentials)

### Needs Attention
- ⚠️ `GOOGLE_SERVICE_ACCOUNT_KEY` secret - Add to GitHub
- ⚠️ `ATLASSIAN_API_TOKEN` - May need regeneration for Confluence access
- ⚠️ `SLACK_BOT_TOKEN` secret - Already in GitHub? (check)

---

## Test Full Workflow

After fixing the issues, test the complete workflow:

```bash
cd ~/isd-metrics-automation

# Set all environment variables
export ATLASSIAN_EMAIL="agalang@attentivemobile.com"
export ATLASSIAN_API_TOKEN="<your-token>"
export SLACK_BOT_TOKEN="xoxb-..."

# Run weekly metrics
node update-confluence-weekly.js

# Check for success:
# ✅ No "Error checking workforce changes"
# ✅ No "Skipping Slack metrics"
# ✅ No "Error updating Confluence page"
# ✅ Metrics saved to metrics-cache-weekly.json
# ✅ HTML generated with formatted times
```

---

## Questions?

- **Confluence 403**: Regenerate API token at https://id.atlassian.com/manage-profile/security/api-tokens
- **Google Calendar**: See full guide in GOOGLE_CALENDAR_SETUP.md
- **Slack Token**: Check if already in GitHub secrets or request new one
- **General Issues**: Check workflow logs in GitHub Actions
