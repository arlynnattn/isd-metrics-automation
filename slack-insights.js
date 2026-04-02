#!/usr/bin/env node

const https = require('https');

const DEFAULT_CHANNELS = [
  {
    key: 'askIt',
    name: 'ask-it',
    displayName: '#ask-it',
    channelId: process.env.SLACK_ASK_IT_CHANNEL_ID || 'CTHCKD6J2'
  },
  {
    key: 'teamItSupport',
    name: 'team-it-support',
    displayName: '#team-it-support',
    channelId: process.env.SLACK_TEAM_IT_SUPPORT_CHANNEL_ID || null
  }
];

const THEME_RULES = [
  { label: 'Access & Permissions', regex: /\b(access|permission|permissions|grant|provision|entitlement|enable|disabled)\b/i },
  { label: 'Account & Authentication', regex: /\b(okta|mfa|sso|login|sign[\s-]?in|password|locked out|unlock|authentication)\b/i },
  { label: 'Device & Hardware', regex: /\b(laptop|macbook|monitor|keyboard|mouse|dock|charger|hardware|device)\b/i },
  { label: 'Network & VPN', regex: /\b(vpn|wifi|wi-fi|network|internet|connectivity|dns)\b/i },
  { label: 'Messaging & Collaboration', regex: /\b(email|gmail|calendar|zoom|slack|teams|meeting)\b/i },
  { label: 'Apps & SaaS', regex: /\b(github|snowflake|gong|jira|confluence|figma|salesforce|netsuite|workspace|google drive)\b/i },
  { label: 'Onboarding & Offboarding', regex: /\b(onboarding|offboarding|new hire|new joiner|termination|employee exit|contractor)\b/i },
  { label: 'Incidents & Outages', regex: /\b(incident|outage|sev|degraded|down|failing|broken|urgent|escalation)\b/i }
];

const INCIDENT_REGEX = /\b(incident|outage|sev[ -]?\d|degraded|down|p1|p2|urgent|escalat(?:e|ion)|major issue)\b/i;

function slackRequest(path, token) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'slack.com',
      path,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300 && parsed.ok !== false) {
            resolve(parsed);
            return;
          }
          reject(new Error(`Slack API error (${res.statusCode}): ${parsed.error || data}`));
        } catch (error) {
          reject(new Error(`Failed to parse Slack response: ${error.message}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function resolveChannelId(channelConfig, token) {
  if (channelConfig.channelId) {
    return channelConfig.channelId;
  }

  let cursor = null;

  do {
    let path = '/api/conversations.list?types=public_channel,private_channel&limit=1000';
    if (cursor) {
      path += `&cursor=${encodeURIComponent(cursor)}`;
    }

    const response = await slackRequest(path, token);
    const channel = (response.channels || []).find((item) => item.name === channelConfig.name);
    if (channel) {
      return channel.id;
    }

    cursor = response.response_metadata?.next_cursor || null;
  } while (cursor);

  return null;
}

async function fetchChannelMessages(channelId, startDate, endDate, token) {
  const oldest = Math.floor(startDate.getTime() / 1000);
  const latest = Math.floor(endDate.getTime() / 1000);
  const messages = [];
  let cursor = null;
  let hasMore = true;

  while (hasMore) {
    let path = `/api/conversations.history?channel=${channelId}&oldest=${oldest}&latest=${latest}&limit=200&inclusive=true`;
    if (cursor) {
      path += `&cursor=${encodeURIComponent(cursor)}`;
    }

    const response = await slackRequest(path, token);
    messages.push(...(response.messages || []));
    hasMore = response.has_more === true;
    cursor = response.response_metadata?.next_cursor || null;
  }

  return messages;
}

function normalizeSlackText(text) {
  if (!text) {
    return '';
  }

  return text
    .replace(/<mailto:[^|>]+\|([^>]+)>/g, '$1')
    .replace(/<https?:\/\/[^|>]+\|([^>]+)>/g, '$1')
    .replace(/<@[^>]+>/g, '@user')
    .replace(/<![^>]+>/g, '')
    .replace(/<#[^|>]+\|([^>]+)>/g, '#$1')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isHumanAuthoredMessage(message) {
  return Boolean(
    message &&
    message.user &&
    !message.bot_id &&
    (!message.subtype || message.subtype === 'thread_broadcast')
  );
}

function scoreThemeMatches(text) {
  return THEME_RULES
    .map((rule) => (rule.regex.test(text) ? rule.label : null))
    .filter(Boolean);
}

function formatExcerpt(text, maxLength = 140) {
  if (!text) {
    return 'No text preview available';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

function buildNotableReason(message, themes) {
  const reasons = [];

  if ((message.reply_count || 0) >= 5) {
    reasons.push(`high-engagement thread (${message.reply_count} replies)`);
  }

  const reactionCount = (message.reactions || []).reduce((sum, reaction) => sum + (reaction.count || 0), 0);
  if (reactionCount >= 3) {
    reasons.push(`strong channel signal (${reactionCount} reactions)`);
  }

  if (INCIDENT_REGEX.test(message.normalizedText)) {
    reasons.push('incident-style language');
  }

  if (themes.includes('Access & Permissions') || themes.includes('Account & Authentication')) {
    reasons.push('common support driver');
  }

  return reasons[0] || 'notable support conversation';
}

function analyzeChannel(messages, channelConfig) {
  const humanMessages = messages
    .filter(isHumanAuthoredMessage)
    .map((message) => ({
      ...message,
      normalizedText: normalizeSlackText(message.text || '')
    }))
    .filter((message) => message.normalizedText.length > 0);

  const uniqueUsers = new Set();
  const activeDays = new Set();
  const themeCounts = {};
  let incidentSignals = 0;
  let threadCount = 0;

  for (const message of humanMessages) {
    uniqueUsers.add(message.user);
    activeDays.add(new Date(parseFloat(message.ts) * 1000).toISOString().split('T')[0]);

    if ((message.reply_count || 0) > 0) {
      threadCount++;
    }

    if (INCIDENT_REGEX.test(message.normalizedText)) {
      incidentSignals++;
    }

    const themes = scoreThemeMatches(message.normalizedText);
    for (const theme of themes) {
      themeCounts[theme] = (themeCounts[theme] || 0) + 1;
    }
  }

  const topThemes = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label, count]) => ({ label, count }));

  const notables = humanMessages
    .map((message) => {
      const themes = scoreThemeMatches(message.normalizedText);
      const reactionCount = (message.reactions || []).reduce((sum, reaction) => sum + (reaction.count || 0), 0);
      const score =
        (message.reply_count || 0) * 3 +
        reactionCount * 2 +
        (INCIDENT_REGEX.test(message.normalizedText) ? 4 : 0) +
        Math.min(themes.length, 2);

      return {
        ts: message.ts,
        text: formatExcerpt(message.normalizedText),
        replyCount: message.reply_count || 0,
        reactionCount,
        themes,
        score,
        reason: buildNotableReason(message, themes)
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    channel: channelConfig.displayName,
    messageCount: humanMessages.length,
    uniqueUsers: uniqueUsers.size,
    activeDays: activeDays.size,
    threadCount,
    incidentSignals,
    topThemes,
    notables
  };
}

function summarizeAcrossChannels(channelSummaries) {
  const availableChannels = channelSummaries.filter((summary) => !summary.error);
  const themeCounts = {};
  const combinedNotables = [];

  for (const channel of availableChannels) {
    for (const theme of channel.topThemes || []) {
      themeCounts[theme.label] = (themeCounts[theme.label] || 0) + theme.count;
    }

    for (const notable of channel.notables || []) {
      combinedNotables.push({
        channel: channel.channel,
        ...notable
      });
    }
  }

  const topThemes = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));

  return {
    totalMessages: availableChannels.reduce((sum, channel) => sum + channel.messageCount, 0),
    totalUniqueUsers: availableChannels.reduce((sum, channel) => sum + channel.uniqueUsers, 0),
    totalActiveDays: availableChannels.reduce((sum, channel) => sum + channel.activeDays, 0),
    totalIncidentSignals: availableChannels.reduce((sum, channel) => sum + channel.incidentSignals, 0),
    topThemes,
    notableItems: combinedNotables
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ score, ...item }) => item)
  };
}

async function fetchMonthlySlackInsights(startDate, endDate, label, token) {
  if (!token) {
    return {
      available: false,
      messageCount: 'N/A',
      uniqueUsers: 'N/A',
      overview: [],
      channels: [],
      overall: {
        topThemes: [],
        notableItems: []
      }
    };
  }

  console.log(`\nFetching Slack insights for ${label}...`);

  const channels = [];

  for (const channelConfig of DEFAULT_CHANNELS) {
    try {
      const channelId = await resolveChannelId(channelConfig, token);
      if (!channelId) {
        channels.push({
          channel: channelConfig.displayName,
          error: `Channel not found or bot is not a member`
        });
        continue;
      }

      const messages = await fetchChannelMessages(channelId, startDate, endDate, token);
      const summary = analyzeChannel(messages, channelConfig);
      channels.push(summary);
      console.log(`  ${channelConfig.displayName}: ${summary.messageCount} messages, ${summary.uniqueUsers} users`);
    } catch (error) {
      channels.push({
        channel: channelConfig.displayName,
        error: error.message
      });
      console.warn(`  ${channelConfig.displayName}: ${error.message}`);
    }
  }

  const overall = summarizeAcrossChannels(channels);
  const overview = overall.topThemes.slice(0, 3).map((theme) => `${theme.label} (${theme.count} mentions)`);

  return {
    available: channels.some((channel) => !channel.error),
    messageCount: overall.totalMessages,
    uniqueUsers: overall.totalUniqueUsers,
    overview,
    channels,
    overall
  };
}

module.exports = {
  DEFAULT_CHANNELS,
  analyzeChannel,
  fetchMonthlySlackInsights,
  normalizeSlackText,
  scoreThemeMatches,
  summarizeAcrossChannels
};
