#!/usr/bin/env node

/**
 * Post message to Slack channel
 */

const https = require('https');

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const CHANNEL_NAME = 'itops-metric-reporting';

if (!SLACK_BOT_TOKEN) {
  console.error('Error: SLACK_BOT_TOKEN environment variable required');
  process.exit(1);
}

const MESSAGE = `We've fully automated IT Ops metrics—week over week and monthly.

Details here: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/5471371324/IT+Ops+-+Metrics+Fully+Automated

⚡ Build stats:
• Build time: ~4 hours total (full metrics suite + analyst reporting)
• Tools: Claude Code (AI pair programming), Node.js, Git
• Integrations: Atlassian APIs (Jira and Confluence), Slack bot token
• External dependencies: none

📢 Moving forward:
• Weekly metrics will auto-post to this channel every Monday
• Monthly metrics will auto-post on the 1st of each month
• Reports include: data dashboards + executive analyst insights`;

function makeSlackRequest(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);

    const options = {
      hostname: 'slack.com',
      path: '/api/chat.postMessage',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(responseData);
          if (response.ok) {
            resolve(response);
          } else {
            reject(new Error(`Slack API error: ${response.error}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${responseData}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function postToSlack() {
  try {
    console.log('🔄 Posting message to Slack...');
    console.log(`Channel: #${CHANNEL_NAME}\n`);

    const response = await makeSlackRequest({
      channel: CHANNEL_NAME,
      text: MESSAGE,
      unfurl_links: false,
      unfurl_media: false
    });

    console.log('✅ Message posted successfully!');
    console.log(`Message timestamp: ${response.ts}`);
    console.log(`Channel: ${response.channel}`);

  } catch (error) {
    console.error('✗ Error posting to Slack:', error.message);
    process.exit(1);
  }
}

postToSlack();
