#!/usr/bin/env node

/**
 * Google Calendar OOO Checker
 * Checks the "Biz Sys + Security + IT OOO Calendar" for out-of-office events
 * for IT support engineers.
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const CALENDAR_ID = 'c_820sf7kusu8t8ojt5nksme6nbc@group.calendar.google.com';
const ENGINEERS = ['Carlos Ramirez', 'Artie Byers', 'JP Dulude'];

/**
 * Initialize Google Calendar API client
 */
async function getCalendarClient() {
  // Check for service account credentials
  const credPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
                   path.join(__dirname, 'google-service-account.json');

  if (!fs.existsSync(credPath)) {
    throw new Error(
      'Google Calendar credentials not found. Please:\n' +
      '1. Create a service account in Google Cloud Console\n' +
      '2. Download the JSON key file\n' +
      '3. Save it as google-service-account.json or set GOOGLE_SERVICE_ACCOUNT_KEY env var'
    );
  }

  const credentials = JSON.parse(fs.readFileSync(credPath, 'utf8'));

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  });

  return google.calendar({ version: 'v3', auth });
}

/**
 * Check who is out of office this week
 * @param {Date} weekStart - Start of the week to check
 * @param {Date} weekEnd - End of the week to check
 * @returns {Promise<Object>} - { outOfOffice: ['JP Dulude'], active: ['Carlos Ramirez', 'Artie Byers'] }
 */
async function checkOOOStatus(weekStart = new Date(), weekEnd = null) {
  try {
    const calendar = await getCalendarClient();

    // Default to checking current week if no end date provided
    if (!weekEnd) {
      weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
    }

    console.log(`Checking OOO calendar from ${weekStart.toISOString().split('T')[0]} to ${weekEnd.toISOString().split('T')[0]}...`);

    // Fetch events from the calendar
    const response = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: weekStart.toISOString(),
      timeMax: weekEnd.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];
    console.log(`Found ${events.length} OOO events this week`);

    const outOfOffice = [];

    // Check each engineer against the events
    for (const engineer of ENGINEERS) {
      // Look for events with the engineer's name (case insensitive)
      const hasOOOEvent = events.some(event => {
        const summary = event.summary || '';
        const description = event.description || '';
        const fullText = `${summary} ${description}`.toLowerCase();
        const engineerName = engineer.toLowerCase();

        // Check if engineer's full name or first name is in the event
        const firstName = engineer.split(' ')[0].toLowerCase();
        return fullText.includes(engineerName) || fullText.includes(firstName);
      });

      if (hasOOOEvent) {
        outOfOffice.push(engineer);
        console.log(`  ❌ ${engineer} is OUT OF OFFICE`);
      } else {
        console.log(`  ✅ ${engineer} is ACTIVE`);
      }
    }

    const active = ENGINEERS.filter(e => !outOfOffice.includes(e));

    return {
      outOfOffice,
      active,
      totalEngineers: ENGINEERS.length,
      activeCount: active.length,
      oooCount: outOfOffice.length,
    };

  } catch (error) {
    console.error('Error checking calendar:', error.message);

    // If calendar check fails, assume everyone is active (fail-open)
    console.warn('⚠️  Defaulting to all engineers ACTIVE due to calendar error');
    return {
      outOfOffice: [],
      active: ENGINEERS,
      totalEngineers: ENGINEERS.length,
      activeCount: ENGINEERS.length,
      oooCount: 0,
      error: error.message,
    };
  }
}

/**
 * Get the Monday of a given week
 * @param {Date} date - Any date in the week
 * @returns {Date} - Monday of that week at 00:00:00
 */
function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Get the Sunday of a given week
 * @param {Date} monday - Monday of the week
 * @returns {Date} - Sunday of that week at 23:59:59
 */
function getSundayOfWeek(monday) {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

/**
 * Extract person name from calendar event
 * Handles various formats: "First Day: John Doe", "John Doe - First Day", etc.
 * @param {string} summary - Event summary text
 * @returns {string|null} - Extracted person name or null
 */
function extractPersonName(summary) {
  if (!summary) return null;

  // Remove common prefixes/suffixes iteratively
  let name = summary.trim();
  const patterns = [
    /^(CLONE|First Day|Last Day|IT Support|Onboarding|Offboarding)[\s:;\-]+/gi,
    /[\s:;\-]+(CLONE|First Day|Last Day|IT Support|Onboarding|Offboarding)$/gi
  ];

  // Keep removing patterns until no more matches
  let changed = true;
  while (changed) {
    const before = name;
    for (const pattern of patterns) {
      name = name.replace(pattern, '').trim();
    }
    changed = (name !== before);
  }

  // Check if result is meaningful (not just keywords and long enough)
  const keywords = ['first day', 'last day', 'clone', 'it support', 'onboarding', 'offboarding'];
  const isKeywordOnly = keywords.some(kw => name.toLowerCase() === kw);

  if (!name || name.length < 3 || isKeywordOnly) {
    // Look for patterns like "First Day: Name" or "Name - First Day"
    const match = summary.match(/(?:First Day|Last Day)[\s:;\-]+([A-Za-z\s]+)|([A-Za-z\s]+)[\s:;\-]+(?:First Day|Last Day)/i);
    if (match) {
      name = (match[1] || match[2]).trim();
    } else {
      return null; // No valid name found
    }
  }

  return name && name.length >= 3 ? name : null;
}

/**
 * Check workforce changes from Google Calendar
 * Uses "First Day" events for onboarding (Monday cohort only)
 * Uses "Last Day" events for offboarding (Monday-Sunday range)
 *
 * @param {Date} weekStart - Monday of the reporting week
 * @returns {Promise<Object>} - Workforce change data with explicit date ranges
 */
async function checkWorkforceChanges(weekStart) {
  try {
    const calendar = await getCalendarClient();

    // Ensure weekStart is a Monday
    const monday = getMondayOfWeek(weekStart);
    const sunday = getSundayOfWeek(monday);

    // Format dates for output
    const mondayStr = monday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const sundayStr = sunday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    console.log(`\nChecking workforce changes:`);
    console.log(`  Onboarding cohort: ${mondayStr} (Monday only)`);
    console.log(`  Offboarding range: ${mondayStr} to ${sundayStr} (Monday-Sunday)`);

    // Fetch First Day events for Monday cohort (only that specific day)
    const mondayEnd = new Date(monday);
    mondayEnd.setHours(23, 59, 59, 999);

    const onboardingResponse = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: monday.toISOString(),
      timeMax: mondayEnd.toISOString(),
      q: 'First Day',
      singleEvents: true,
      orderBy: 'startTime',
    });

    const onboardingEvents = onboardingResponse.data.items || [];
    console.log(`  Found ${onboardingEvents.length} "First Day" events on Monday`);

    // Fetch Last Day events for Monday-Sunday range
    const offboardingResponse = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: monday.toISOString(),
      timeMax: sunday.toISOString(),
      q: 'Last Day',
      singleEvents: true,
      orderBy: 'startTime',
    });

    const offboardingEvents = offboardingResponse.data.items || [];
    console.log(`  Found ${offboardingEvents.length} "Last Day" events in week range`);

    // De-duplicate onboarding by person name
    const onboardedPeople = new Set();
    for (const event of onboardingEvents) {
      const name = extractPersonName(event.summary);
      if (name) {
        onboardedPeople.add(name);
        console.log(`    ✅ Onboarded: ${name} (${event.summary})`);
      }
    }

    // De-duplicate offboarding by person name
    const offboardedPeople = new Set();
    for (const event of offboardingEvents) {
      const name = extractPersonName(event.summary);
      if (name) {
        offboardedPeople.add(name);
        console.log(`    ❌ Offboarded: ${name} (${event.summary})`);
      }
    }

    const onboardedCount = onboardedPeople.size;
    const offboardedCount = offboardedPeople.size;
    const netChange = onboardedCount - offboardedCount;

    return {
      available: true,
      onboardedCount,
      offboardedCount,
      netChange,
      onboardedPeople: Array.from(onboardedPeople),
      offboardedPeople: Array.from(offboardedPeople),
      // Explicit date labels for reporting
      onboardingDateLabel: `${mondayStr} cohort`,
      offboardingDateLabel: `${mondayStr} to ${sundayStr}`,
      // Raw dates for further processing
      onboardingDate: monday,
      offboardingStartDate: monday,
      offboardingEndDate: sunday,
      // Note about FTE/contractor split
      fteContractorSplitSupported: false,
      splitNote: 'FTE/Contractor split not available from calendar - use Jira ticket validation if needed'
    };

  } catch (error) {
    console.error('Error checking workforce changes from calendar:', error.message);

    // Return empty result on error
    return {
      available: false,
      onboardedCount: 0,
      offboardedCount: 0,
      netChange: 0,
      onboardedPeople: [],
      offboardedPeople: [],
      onboardingDateLabel: 'Unknown',
      offboardingDateLabel: 'Unknown',
      fteContractorSplitSupported: false,
      splitNote: 'Calendar check failed',
      error: error.message
    };
  }
}

/**
 * Format status for Confluence HTML
 */
function formatForConfluence(status) {
  const activeList = status.active.join(', ');
  const count = `${status.activeCount} of ${status.totalEngineers}`;

  let html = `<p><strong>Active Round Robin Engineers:</strong> ${activeList} (${count} Support Engineers)</p>\n`;

  if (status.outOfOffice.length > 0) {
    html += `<p><strong>Out of Office:</strong> ${status.outOfOffice.join(', ')}</p>\n`;
  }

  return html;
}

// Export functions for use in other scripts
module.exports = {
  checkOOOStatus,
  checkWorkforceChanges,
  formatForConfluence,
  getMondayOfWeek,
  getSundayOfWeek,
  extractPersonName,
  ENGINEERS,
};

// CLI usage
if (require.main === module) {
  (async () => {
    const now = new Date();
    const status = await checkOOOStatus(now);

    console.log('\n📊 Team Status Summary:');
    console.log(`Active: ${status.active.join(', ')} (${status.activeCount}/${status.totalEngineers})`);
    if (status.outOfOffice.length > 0) {
      console.log(`Out of Office: ${status.outOfOffice.join(', ')}`);
    }
    console.log('\nConfluence HTML:');
    console.log(formatForConfluence(status));
  })();
}
