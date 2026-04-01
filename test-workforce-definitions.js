#!/usr/bin/env node

/**
 * Test workforce counting using the exact definitions provided
 * To match the "12 FTE, 4 Contractors" feedback
 */

const https = require('https');

// Configuration - credentials from environment variables
const ATLASSIAN_EMAIL = process.env.ATLASSIAN_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || process.env.ATLASSIAN_API_TOKEN;

if (!ATLASSIAN_EMAIL || !JIRA_API_TOKEN) {
  console.error('Error: ATLASSIAN_EMAIL and JIRA_API_TOKEN environment variables are required');
  console.error('Set them with: export ATLASSIAN_EMAIL=your-email@attentivemobile.com');
  console.error('             export JIRA_API_TOKEN=your-token');
  process.exit(1);
}

const JIRA_BASE_URL = 'attentivemobile.atlassian.net';
const JIRA_AUTH_HEADER = 'Basic ' + Buffer.from(`${ATLASSIAN_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');

/**
 * Make an HTTPS request to Jira API
 */
function makeRequest(baseUrl, path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: baseUrl,
      path: path,
      method: method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testDefinitions() {
  console.log('TESTING WORKFORCE DEFINITIONS FOR MARCH 2026');
  console.log('='.repeat(70));
  console.log('Using CREATED date (not resolution date)');
  console.log('Using REPORTER field (not creator)');
  console.log('');

  // Test 1: FTE Onboarding (assuming "IT Support Onboarding" not "Offboarding")
  console.log('1. FTE ONBOARDING');
  console.log('   Definition: reporter in (jira-sapling, jira-greenhouse)');
  console.log('               AND summary ~ "IT Support Onboarding"');
  console.log('               AND created in March 2026');

  let jql = 'project = ISD AND reporter in ("jira-sapling@attentivemobile.com", "jira-greenhouse@attentivemobile.com") AND summary ~ "IT Support Onboarding" AND created >= "2026-03-01" AND created <= "2026-03-31"';
  let path = `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=key,summary,creator,created&maxResults=100`;
  let res = await makeRequest(JIRA_BASE_URL, path, 'GET', null, { 'Authorization': JIRA_AUTH_HEADER });

  const fteOnboarding = res.values ? res.values.length : (res.issues ? res.issues.length : 0);
  console.log(`   ✓ Found: ${fteOnboarding} tickets\n`);
  const issues1 = res.values || res.issues || [];
  if (issues1.length > 0) {
    issues1.slice(0, 5).forEach(i => console.log(`     ${i.key} - ${i.fields.summary}`));
    if (fteOnboarding > 5) console.log(`     ... and ${fteOnboarding - 5} more`);
  }

  // Test 2: Contractor Onboarding
  console.log('\n2. CONTRACTOR ONBOARDING');
  console.log('   Definition: summary ~ "CLONE - Contractor Onboarding"');
  console.log('               AND created in March 2026');

  jql = 'project = ISD AND summary ~ "CLONE - Contractor Onboarding" AND created >= "2026-03-01" AND created <= "2026-03-31"';
  path = `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=key,summary,created&maxResults=100`;
  res = await makeRequest(JIRA_BASE_URL, path, 'GET', null, { 'Authorization': JIRA_AUTH_HEADER });

  const contractorOnboarding = res.values ? res.values.length : (res.issues ? res.issues.length : 0);
  console.log(`   ✓ Found: ${contractorOnboarding} tickets\n`);
  const issues2 = res.values || res.issues || [];
  if (issues2.length > 0) {
    issues2.slice(0, 5).forEach(i => console.log(`     ${i.key} - ${i.fields.summary}`));
    if (contractorOnboarding > 5) console.log(`     ... and ${contractorOnboarding - 5} more`);
  }

  // Test 3: FTE Offboarding - SHORT pattern "CLONE - Device"
  console.log('\n3. FTE OFFBOARDING (using "CLONE - Device")');
  console.log('   Definition: reporter in (jira-sapling, jira-greenhouse)');
  console.log('               AND summary ~ "CLONE - Device"');
  console.log('               AND created in March 2026');

  jql = 'project = ISD AND reporter in ("jira-sapling@attentivemobile.com", "jira-greenhouse@attentivemobile.com") AND summary ~ "CLONE - Device" AND created >= "2026-03-01" AND created <= "2026-03-31"';
  path = `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=key,summary,creator,created&maxResults=100`;
  res = await makeRequest(JIRA_BASE_URL, path, 'GET', null, { 'Authorization': JIRA_AUTH_HEADER });

  const fteOffboardingShort = res.values ? res.values.length : (res.issues ? res.issues.length : 0);
  console.log(`   ✓ Found: ${fteOffboardingShort} tickets\n`);
  const issues3 = res.values || res.issues || [];
  if (issues3.length > 0) {
    issues3.slice(0, 5).forEach(i => console.log(`     ${i.key} - ${i.fields.summary}`));
    if (fteOffboardingShort > 5) console.log(`     ... and ${fteOffboardingShort - 5} more`);
  }

  // Test 3b: FTE Offboarding - LONG pattern for comparison
  console.log('\n3b. FTE OFFBOARDING (comparison: "CLONE - Device IT Offboarding")');
  console.log('    Current automation pattern');

  jql = 'project = ISD AND reporter in ("jira-sapling@attentivemobile.com", "jira-greenhouse@attentivemobile.com") AND summary ~ "CLONE - Device IT Offboarding" AND created >= "2026-03-01" AND created <= "2026-03-31"';
  path = `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=key,summary,creator,created&maxResults=100`;
  res = await makeRequest(JIRA_BASE_URL, path, 'GET', null, { 'Authorization': JIRA_AUTH_HEADER });

  const fteOffboardingLong = res.values ? res.values.length : (res.issues ? res.issues.length : 0);
  console.log(`    ✓ Found: ${fteOffboardingLong} tickets (for comparison)\n`);

  // Test 4: Contractor Offboarding
  console.log('\n4. CONTRACTOR OFFBOARDING');
  console.log('   Definition: summary ~ "CLONE - Contractor Offboarding"');
  console.log('               AND created in March 2026');

  jql = 'project = ISD AND summary ~ "CLONE - Contractor Offboarding" AND created >= "2026-03-01" AND created <= "2026-03-31"';
  path = `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=key,summary,created&maxResults=100`;
  res = await makeRequest(JIRA_BASE_URL, path, 'GET', null, { 'Authorization': JIRA_AUTH_HEADER });

  const contractorOffboardingCount = res.values ? res.values.length : (res.issues ? res.issues.length : 0);
  console.log(`   ✓ Found: ${contractorOffboardingCount} tickets\n`);
  const issues4 = res.values || res.issues || [];
  if (issues4.length > 0) {
    issues4.slice(0, 5).forEach(i => console.log(`     ${i.key} - ${i.fields.summary}`));
    if (contractorOffboardingCount > 5) console.log(`     ... and ${contractorOffboardingCount - 5} more`);
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('COMPARISON WITH FEEDBACK');
  console.log('='.repeat(70));
  console.log(`FTE Offboarded:        ${fteOffboardingShort} (feedback said: 12)`);
  console.log(`Contractor Offboarded: ${contractorOffboardingCount} (feedback said: 4)`);
  console.log('');

  if (fteOffboardingShort === 12 && contractorOffboardingCount === 4) {
    console.log('✅ EXACT MATCH! These definitions match the feedback.');
  } else {
    console.log('⚠️  Numbers don\'t match exactly. Possible reasons:');
    console.log('   - Different date interpretation (start date vs created date)');
    console.log('   - Test/duplicate tickets included in feedback');
    console.log('   - Different creator/reporter interpretation');
  }
}

testDefinitions().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
