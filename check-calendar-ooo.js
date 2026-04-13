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
  formatForConfluence,
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
