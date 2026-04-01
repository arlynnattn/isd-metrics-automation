#!/usr/bin/env node
const https = require('https');
const fs = require('fs');

// Read .env file manually
const envContent = fs.readFileSync('.env', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2];
  }
});

const JIRA_EMAIL = envVars.JIRA_EMAIL;
const JIRA_API_TOKEN = envVars.JIRA_API_TOKEN;
const authHeader = 'Basic ' + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');

async function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'attentivemobile.atlassian.net',
      path: path,
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function query() {
  console.log('Using YOUR exact definitions:\n');

  // FTE Onboarding: created by jira-sapling or jira-greenhouse AND summary contains "IT Support Onboarding"
  // (assuming you meant "Onboarding" not "Offboarding")
  console.log('=== FTE ONBOARDING ===');
  console.log('JQL: creator in (jira-sapling, jira-greenhouse) AND summary ~ "IT Support Onboarding" AND created >= "2026-03-01" AND created <= "2026-03-31"');
  let jql = encodeURIComponent('project = ISD AND creator in (jira-sapling, jira-greenhouse) AND summary ~ "IT Support Onboarding" AND created >= "2026-03-01" AND created <= "2026-03-31"');
  let res = await makeRequest(`/rest/api/3/search?jql=${jql}&fields=key,summary,creator,created&maxResults=100`);
  console.log(`Total: ${res.total}\n`);
  if (res.issues) res.issues.forEach(i => console.log(`  ${i.key} - ${i.fields.summary}`));

  // Contractor Onboarding: summary contains "CLONE - Contractor Onboarding"
  console.log('\n=== CONTRACTOR ONBOARDING ===');
  console.log('JQL: summary ~ "CLONE - Contractor Onboarding" AND created >= "2026-03-01" AND created <= "2026-03-31"');
  jql = encodeURIComponent('project = ISD AND summary ~ "CLONE - Contractor Onboarding" AND created >= "2026-03-01" AND created <= "2026-03-31"');
  res = await makeRequest(`/rest/api/3/search?jql=${jql}&fields=key,summary,created&maxResults=100`);
  console.log(`Total: ${res.total}\n`);
  if (res.issues) res.issues.forEach(i => console.log(`  ${i.key} - ${i.fields.summary}`));

  // FTE Offboarding: created by jira-sapling or jira-greenhouse AND summary contains "CLONE - Device"
  console.log('\n=== FTE OFFBOARDING (Device tickets) ===');
  console.log('JQL: creator in (jira-sapling, jira-greenhouse) AND summary ~ "CLONE - Device" AND created >= "2026-03-01" AND created <= "2026-03-31"');
  jql = encodeURIComponent('project = ISD AND creator in (jira-sapling, jira-greenhouse) AND summary ~ "CLONE - Device" AND created >= "2026-03-01" AND created <= "2026-03-31"');
  res = await makeRequest(`/rest/api/3/search?jql=${jql}&fields=key,summary,creator,created&maxResults=100`);
  console.log(`Total: ${res.total}\n`);
  if (res.issues) res.issues.forEach(i => console.log(`  ${i.key} - ${i.fields.summary}`));

  // Contractor Offboarding: summary contains "CLONE - Contractor Offboarding"
  console.log('\n=== CONTRACTOR OFFBOARDING ===');
  console.log('JQL: summary ~ "CLONE - Contractor Offboarding" AND created >= "2026-03-01" AND created <= "2026-03-31"');
  jql = encodeURIComponent('project = ISD AND summary ~ "CLONE - Contractor Offboarding" AND created >= "2026-03-01" AND created <= "2026-03-31"');
  res = await makeRequest(`/rest/api/3/search?jql=${jql}&fields=key,summary,created&maxResults=100`);
  console.log(`Total: ${res.total}\n`);
  if (res.issues) res.issues.forEach(i => console.log(`  ${i.key} - ${i.fields.summary}`));

  console.log('\n=== SUMMARY ===');
  console.log('This uses CREATED date (not resolution date)');
  console.log('Using the exact field definitions you provided');
}

query().catch(console.error);
