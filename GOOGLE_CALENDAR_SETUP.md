# Google Calendar OOO Integration Setup

This guide will help you set up automatic out-of-office checking from the "Biz Sys + Security + IT OOO Calendar".

## Step 1: Create a Google Cloud Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one called "isd-metrics-automation")
3. Navigate to **APIs & Services** → **Credentials**
4. Click **+ CREATE CREDENTIALS** → **Service account**
5. Fill in:
   - Service account name: `isd-metrics-calendar-reader`
   - Service account ID: (auto-generated)
   - Description: `Read-only access to IT OOO calendar for metrics automation`
6. Click **CREATE AND CONTINUE**
7. Skip the optional steps (no roles needed at project level)
8. Click **DONE**

## Step 2: Create Service Account Key

1. Find your new service account in the list
2. Click on it to open details
3. Go to **KEYS** tab
4. Click **ADD KEY** → **Create new key**
5. Select **JSON** format
6. Click **CREATE**
7. The JSON file will download automatically
8. **Rename it to** `google-service-account.json`
9. **Move it to** `~/isd-metrics-automation/google-service-account.json`

## Step 3: Enable Google Calendar API

1. In Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Google Calendar API"
3. Click on it and click **ENABLE**

## Step 4: Share Calendar with Service Account

1. Open the JSON key file you downloaded
2. Copy the `client_email` value (looks like: `isd-metrics-calendar-reader@project-id.iam.gserviceaccount.com`)
3. Open Google Calendar at [calendar.google.com](https://calendar.google.com)
4. Find the **"Biz Sys + Security + IT OOO Calendar"** in your calendar list
5. Click the three dots next to it → **Settings and sharing**
6. Scroll to **Share with specific people**
7. Click **+ Add people**
8. Paste the service account email
9. Set permission to **See all event details**
10. Click **Send**

## Step 5: Test the Integration

Run the test script:

```bash
cd ~/isd-metrics-automation
node check-calendar-ooo.js
```

You should see output like:
```
Checking OOO calendar from 2026-04-13 to 2026-04-20...
Found 2 OOO events this week
  ✅ Carlos Ramirez is ACTIVE
  ✅ Artie Byers is ACTIVE
  ✅ JP Dulude is ACTIVE

📊 Team Status Summary:
Active: Carlos Ramirez, Artie Byers, JP Dulude (3/3)
```

## Step 6: Add to GitHub Secrets

For GitHub Actions to work, add the service account key:

1. Go to your repo: https://github.com/arlynnattn/isd-metrics-automation
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `GOOGLE_SERVICE_ACCOUNT_KEY`
5. Value: Paste the **entire contents** of `google-service-account.json`
6. Click **Add secret**

## Troubleshooting

**Error: "Google Calendar credentials not found"**
- Make sure `google-service-account.json` exists in the repo root
- Or set environment variable: `export GOOGLE_SERVICE_ACCOUNT_KEY=/path/to/key.json`

**Error: "Calendar not found" or "403 Forbidden"**
- Verify the calendar is shared with the service account email
- Check the service account has "See all event details" permission
- Make sure Google Calendar API is enabled in your project

**No OOO events detected when there should be**
- Check that engineer names (Carlos Ramirez, Artie Byers, JP Dulude) appear in the event title or description
- Events must be within the date range being checked

## Security Notes

- The `google-service-account.json` file is already in `.gitignore` - **never commit it to git**
- The service account only has read access to the shared calendar
- Keep the JSON key file secure and treat it like a password
