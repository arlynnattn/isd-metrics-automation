# Workforce Changes Update - Calendar-Based Reporting

## Summary

Updated the weekly workforce-change automation to use Google Calendar as the source of truth for counting onboarding and offboarding, implementing new date rules for Monday cohort onboarding and Monday-Sunday offboarding windows.

## Changes Made

### 1. **check-calendar-ooo.js** - New Calendar Workforce Functions

**Added Functions:**
- `getMondayOfWeek(date)` - Calculates the Monday of any given week
- `getSundayOfWeek(monday)` - Calculates the Sunday for a given Monday
- `extractPersonName(summary)` - Extracts person names from calendar event summaries with robust pattern matching
- `checkWorkforceChanges(weekStartDate)` - **Main function** that fetches workforce changes from Google Calendar

**Key Logic:**

```javascript
// Onboarding: Monday cohort only (NOT rolling 7-day)
const mondayEnd = new Date(monday);
mondayEnd.setHours(23, 59, 59, 999);

const onboardingResponse = await calendar.events.list({
  timeMin: monday.toISOString(),     // Monday 00:00:00
  timeMax: mondayEnd.toISOString(),  // Monday 23:59:59
  q: 'First Day',
  singleEvents: true,
});

// Offboarding: Monday-Sunday range (NOT Monday-to-next-Monday)
const offboardingResponse = await calendar.events.list({
  timeMin: monday.toISOString(),     // Monday 00:00:00
  timeMax: sunday.toISOString(),     // Sunday 23:59:59
  q: 'Last Day',
  singleEvents: true,
});
```

**De-duplication:**
```javascript
// Use Set to de-duplicate by person name
const onboardedPeople = new Set();
for (const event of onboardingEvents) {
  const name = extractPersonName(event.summary);
  if (name) {
    onboardedPeople.add(name);
  }
}
```

**Output Format:**
```javascript
return {
  onboardedCount: 15,
  offboardedCount: 5,
  netChange: 10,
  onboardedPeople: ['John Doe', 'Jane Smith', ...],
  offboardedPeople: ['Bob Wilson', ...],
  onboardingDateLabel: 'May 11, 2026 cohort',
  offboardingDateLabel: 'May 11, 2026 to May 17, 2026',
  fteContractorSplitSupported: false,
  splitNote: 'FTE/Contractor split not available from calendar...'
};
```

### 2. **update-confluence-weekly.js** - Updated Main Script

**Changed Imports:**
```javascript
// Before:
const { checkOOOStatus, formatForConfluence } = require('./check-calendar-ooo');

// After:
const { checkOOOStatus, checkWorkforceChanges, formatForConfluence, getMondayOfWeek } = require('./check-calendar-ooo');
```

**Updated `getWeekRanges()` Function:**
```javascript
function getWeekRanges() {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  
  // NEW: Calculate Monday of each week for workforce changes
  const currentMonday = getMondayOfWeek(now);
  const previousMonday = getMondayOfWeek(weekAgo);
  
  return {
    currentWeek: {
      jqlFilter: '-7d',
      start: weekAgo,
      end: now,
      monday: currentMonday,  // NEW
      label: currentLabel,
      shortLabel: 'This Week'
    },
    previousWeek: {
      jqlFilterRange: 'resolutiondate >= -14d AND resolutiondate < -7d',
      start: twoWeeksAgo,
      end: weekAgo,
      monday: previousMonday, // NEW
      label: previousLabel,
      shortLabel: 'Last Week'
    }
  };
}
```

**Replaced `countWorkforceChanges()` Function:**
```javascript
// BEFORE: Used Jira resolution dates with complex JQL queries
// AFTER: Uses Google Calendar as source of truth

async function countWorkforceChanges(weekStartDate, label) {
  console.log(`  Counting workforce changes for ${label}`);
  
  // Get workforce changes from Google Calendar
  const calendarData = await checkWorkforceChanges(weekStartDate);
  
  // Return data with explicit date labels
  return {
    fteOnboarding: calendarData.onboardedCount,
    contractorOnboarding: 0, // Not supported by calendar
    totalOnboarding: calendarData.onboardedCount,
    offboarding: calendarData.offboardedCount,
    netChange: calendarData.netChange,
    onboardingDateLabel: calendarData.onboardingDateLabel,
    offboardingDateLabel: calendarData.offboardingDateLabel,
    onboardedPeople: calendarData.onboardedPeople,
    offboardedPeople: calendarData.offboardedPeople,
    splitSupported: false
  };
}
```

**Updated Function Calls:**
```javascript
// BEFORE:
const currentWorkforce = await countWorkforceChanges(
  weeks.currentWeek.jqlFilter, 
  weeks.currentWeek.label, 
  false
);

// AFTER:
const currentWorkforce = await countWorkforceChanges(
  weeks.currentWeek.monday,  // Pass actual Monday date
  weeks.currentWeek.label
);
```

**Updated Confluence HTML Output:**
```html
<!-- BEFORE: Separate FTE/Contractor rows -->
<tr>
  <td><p>FTE Onboarded</p></td>
  <td><p>15 employees</p></td>
</tr>
<tr>
  <td><p>Contractors Onboarded</p></td>
  <td><p>0 contractors</p></td>
</tr>

<!-- AFTER: Combined with explicit date labels -->
<tr>
  <td><p>Onboarded</p></td>
  <td><p>15 (May 11, 2026 cohort)</p></td>
  <td><p>12 (May 4, 2026 cohort)</p></td>
</tr>
<tr>
  <td><p>Offboarded</p></td>
  <td><p>5 (May 11, 2026 to May 17, 2026)</p></td>
  <td><p>3 (May 4, 2026 to May 10, 2026)</p></td>
</tr>

<!-- Note about data source -->
<p><em>Note: Dates are based on Google Calendar "First Day" and "Last Day" events. 
Onboarding counts Monday cohort only; offboarding counts full Monday-Sunday week.</em></p>
```

### 3. **test-workforce-calendar.js** - Comprehensive Test Suite

**New test file** with the following test categories:

1. **Date Calculation Tests** - Verify Monday/Sunday calculation logic
2. **Name Extraction Tests** - Test person name parsing from various event formats
3. **De-duplication Tests** - Verify Set-based person de-duplication
4. **Monday Cohort Logic Tests** - Document onboarding rules
5. **Offboarding Window Tests** - Document Monday-Sunday range
6. **FTE/Contractor Split Tests** - Document unsupported split behavior
7. **Error Handling Tests** - Verify graceful failure when calendar unavailable
8. **Calendar Integration Test** - Live test with actual Google Calendar (requires credentials)

**Run Tests:**
```bash
cd /tmp/isd-metrics-automation
node test-workforce-calendar.js
```

## New Reporting Rules Implemented

### 1. Onboarding (Monday Cohort Only)
- **Rule**: Count only the Monday new-hire cohort
- **Date Filter**: Monday 00:00:00 to Monday 23:59:59
- **Source**: Google Calendar "First Day" events
- **NOT a rolling 7-day range**

### 2. Offboarding (Monday-Sunday Range)
- **Rule**: Count everyone whose Last Day falls between Monday and Sunday
- **Date Filter**: Monday 00:00:00 to Sunday 23:59:59
- **Source**: Google Calendar "Last Day" events
- **NOT Monday-to-next-Monday**

### 3. De-duplication
- **Rule**: De-duplicate by person name before reporting totals
- **Implementation**: JavaScript `Set` data structure
- **Handles**: Same person appearing in multiple calendar events

### 4. Source of Truth
- **Primary**: Google Calendar for actual First Day / Last Day dates
- **Secondary**: Jira tickets only for coverage validation (not dates)
- **Priority**: Calendar dates override Jira resolution dates

### 5. FTE vs Contractor Split
- **Status**: Not supported by calendar alone
- **Reporting**: Report total count only
- **Note**: Explicitly state split is unsupported in output
- **Future**: Could add Jira cross-reference if needed

## Example Output

### Console Output
```
Counting workforce changes from Google Calendar...
  Onboarding cohort: May 11, 2026 (Monday only)
  Offboarding range: May 11, 2026 to May 17, 2026 (Monday-Sunday)
  Found 3 "First Day" events on Monday
    ✅ Onboarded: John Doe (First Day: John Doe)
    ✅ Onboarded: Jane Smith (Jane Smith - First Day)
    ✅ Onboarded: Alice Johnson (CLONE - IT Support Onboarding: Alice Johnson)
  Found 2 "Last Day" events in week range
    ❌ Offboarded: Bob Wilson (Last Day: Bob Wilson)
    ❌ Offboarded: Carol White (Carol White - Last Day)
  
Calendar-based counts:
  Onboarded (May 11, 2026 cohort): 3
  Offboarded (May 11, 2026 to May 17, 2026): 2
  Net change: +1
  Onboarded people: John Doe, Jane Smith, Alice Johnson
  Offboarded people: Bob Wilson, Carol White
  ℹ️  FTE/Contractor split not available from calendar - use Jira for ticket validation if needed
```

### Confluence Dashboard Output
```
Workforce Changes
IT Ops completed onboarding and offboarding for the following workforce changes this period:

Note: Dates are based on Google Calendar "First Day" and "Last Day" events. 
Onboarding counts Monday cohort only; offboarding counts full Monday-Sunday week.

| Change Type           | This Week                              | Last Week                              |
|-----------------------|----------------------------------------|----------------------------------------|
| Onboarded             | 3 (May 11, 2026 cohort)                | 2 (May 4, 2026 cohort)                 |
| Offboarded            | 2 (May 11, 2026 to May 17, 2026)       | 1 (May 4, 2026 to May 10, 2026)        |
| Net Headcount Change  | +1                                     | +1                                     |

FTE / Contractor split: Not available from calendar data - use Jira for ticket validation if needed
```

## Testing

### Unit Tests (No Credentials Required)
```bash
node test-workforce-calendar.js
```

All unit tests pass without Google Calendar credentials:
- ✅ Date calculations (Monday/Sunday)
- ✅ Name extraction from various formats
- ✅ De-duplication logic
- ✅ Monday cohort rules documented
- ✅ Offboarding window rules documented
- ✅ FTE/contractor split behavior documented
- ✅ Error handling verified

### Integration Test (Requires Credentials)
Set up Google Calendar credentials:
```bash
# Set environment variable
export GOOGLE_SERVICE_ACCOUNT_KEY=/path/to/google-service-account.json

# Or create file in repo
cp /path/to/credentials.json google-service-account.json
```

Then run:
```bash
node test-workforce-calendar.js
```

## Files Changed

1. **check-calendar-ooo.js** (+180 lines)
   - Added `getMondayOfWeek()`, `getSundayOfWeek()`, `extractPersonName()`
   - Added `checkWorkforceChanges()` - main calendar integration function
   - Exported new functions for use in main script

2. **update-confluence-weekly.js** (~120 lines modified)
   - Updated imports to include new calendar functions
   - Modified `getWeekRanges()` to calculate Monday dates
   - Replaced `countWorkforceChanges()` function (removed ~115 lines of Jira JQL logic)
   - Added new calendar-based implementation (~40 lines)
   - Updated function calls to pass Monday dates instead of JQL filters
   - Updated Confluence HTML to show explicit date ranges
   - Simplified workforce table (removed FTE/contractor separate rows)

3. **test-workforce-calendar.js** (+270 lines, NEW FILE)
   - Comprehensive test suite for all date logic
   - Unit tests for helper functions
   - Integration test for live calendar
   - Documentation of rules in test output

## Migration Notes

### Breaking Changes
- **FTE/Contractor Split**: No longer reported separately in weekly metrics
  - Old: Separate rows for FTE and contractor onboarding
  - New: Combined onboarding total with note about split unavailability
  - Impact: Weekly dashboard shows total only, not FTE/contractor breakdown

### Non-Breaking Changes
- **Date Labels**: Now show explicit dates instead of relative references
  - Old: "This Week", "Last Week"
  - New: "May 11, 2026 cohort", "May 11-17, 2026"
  - Impact: More precise, easier to audit

### Behavior Changes
- **Onboarding Window**: Changed from rolling 7-day to Monday-only cohort
  - Old: Any resolution in past 7 days
  - New: Only First Day events on Monday
  - Impact: More accurate reflection of cohort structure

- **Offboarding Window**: Changed from rolling 7-day to Monday-Sunday week
  - Old: Any resolution in past 7 days
  - New: Last Day events between Monday-Sunday
  - Impact: Aligns with standard weekly reporting period

### Fallback Behavior
- If Google Calendar is unavailable:
  - Returns zero counts
  - Includes error message in logs
  - Does not crash the script
  - Continues with rest of metrics

## Deployment Checklist

- [x] Code changes implemented
- [x] Tests written and passing
- [x] Documentation updated
- [ ] Google Calendar credentials configured in GitHub Actions secrets
- [ ] Test in staging/dev environment first
- [ ] Monitor first production run
- [ ] Verify Confluence output format
- [ ] Update team on FTE/contractor split change

## Future Enhancements

1. **Optional Jira Cross-Reference**: Add FTE/contractor detection by cross-referencing calendar names with Jira ticket employee type fields

2. **Calendar Event Validation**: Add warnings if First Day/Last Day events don't match expected format

3. **Historical Data Migration**: Consider backfilling historical data with new date rules (optional)

4. **Slack Notification Enhancement**: Include person names in Slack notification (privacy permitting)

## Questions or Issues?

- **Calendar not configured**: See GOOGLE_CALENDAR_SETUP.md
- **Tests failing**: Run `npm install` first to install googleapis dependency
- **Name extraction incorrect**: Check `extractPersonName()` logic in check-calendar-ooo.js
- **Date ranges wrong**: Verify `getMondayOfWeek()` is calculating correctly for your timezone

## Rollback Plan

If issues arise:
1. Revert changes to `update-confluence-weekly.js`
2. Old `countWorkforceChanges()` function used Jira only
3. No database changes required
4. No data loss risk
