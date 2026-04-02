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
  { label: 'Access Provisioning & Approvals', regex: /\b(access|permission|permissions|grant|provision|entitlement|enable|approval|approved)\b/i },
  { label: 'Identity & Authentication', regex: /\b(okta|mfa|sso|login|sign[\s-]?in|password|locked out|unlock|authentication)\b/i },
  { label: 'Endpoints & Hardware', regex: /\b(laptop|macbook|monitor|keyboard|mouse|dock|charger|hardware|device)\b/i },
  { label: 'Network & Connectivity', regex: /\b(vpn|wifi|wi-fi|network|internet|connectivity|dns)\b/i },
  { label: 'Collaboration Tooling', regex: /\b(email|gmail|calendar|zoom|slack|teams|meeting)\b/i },
  { label: 'SaaS & Internal Tools', regex: /\b(github|snowflake|gong|jira|confluence|figma|salesforce|netsuite|workspace|google drive|zapier)\b/i },
  { label: 'Employee Lifecycle', regex: /\b(onboarding|offboarding|new hire|new joiner|termination|employee exit|contractor)\b/i },
  { label: 'Incident / Service Disruption', regex: /\b(incident|outage|sev[ -]?\d|degraded|down|failing|broken|urgent|escalation)\b/i },
  { label: 'Security / Governance Review', regex: /\b(review|security|vendor|compliance|audit|oauth|token|scope|risk|app approval|slack app)\b/i }
];

const LEADERSHIP_PATTERNS = [
  {
    key: 'approval_friction',
    label: 'Access provisioning and approvals',
    regex: /\b(access|approval|approved|permission|permissions|provision|grant)\b/i,
    stakeholder: 'IT + system owners',
    pov: 'This shows where governance and provisioning steps are creating service friction.'
  },
  {
    key: 'identity_friction',
    label: 'Identity and authentication friction',
    regex: /\b(okta|mfa|sso|login|password|locked out|unlock|authentication)\b/i,
    stakeholder: 'IT leadership',
    pov: 'This is a pulse on day-to-day employee productivity blockers.'
  },
  {
    key: 'security_review',
    label: 'Security and governance review demand',
    regex: /\b(security|review|oauth|vendor|compliance|audit|slack app|risk|scope)\b/i,
    stakeholder: 'IT + Security',
    pov: 'This signals where enablement work is turning into governance review work.'
  },
  {
    key: 'customer_vendor_impact',
    label: 'Customer or vendor-facing workflow risk',
    regex: /\b(customer|client|vendor|partner|reported|get(?:ting)? emails|integration|zapier|mindbody)\b/i,
    stakeholder: 'IT + business owners',
    pov: 'These threads matter because they can spill beyond internal support into external trust or revenue workflows.'
  },
  {
    key: 'incident_disruption',
    label: 'Operational disruption / outage signals',
    regex: /\b(incident|outage|sev[ -]?\d|degraded|down|urgent|escalation)\b/i,
    stakeholder: 'IT leadership',
    pov: 'This is where service disruption risk is surfacing in Slack before or alongside formal incident handling.'
  },
  {
    key: 'onboarding_load',
    label: 'Onboarding-driven support load',
    regex: /\b(onboarding|new hire|new joiner|contractor)\b/i,
    stakeholder: 'IT + People + hiring leaders',
    pov: 'This ties support demand to workforce growth and access orchestration.'
  }
];

const IMPACT_PATTERNS = [
  { regex: /\b(customer|client|vendor|partner|mindbody|reported)\b/i, reason: 'external-facing workflow risk', weight: 8 },
  { regex: /\b(security|compliance|oauth|audit|risk|review|slack app)\b/i, reason: 'governance or security review', weight: 7 },
  { regex: /\b(incident|outage|sev[ -]?\d|degraded|down|urgent|escalation)\b/i, reason: 'service disruption signal', weight: 8 },
  { regex: /\b(access|approval|permission|provision)\b/i, reason: 'access and approval friction', weight: 5 },
  { regex: /\b(onboarding|new hire|contractor)\b/i, reason: 'workforce growth support demand', weight: 4 }
];

class SlackApiError extends Error {
  constructor(statusCode, errorCode, message, retryAfterSeconds = null) {
    super(message);
    this.name = 'SlackApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slackRequest(path, token, attempt = 0) {
  const maxAttempts = 3;

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'slack.com',
      path,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`
      }
    }, async (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', async () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300 && parsed.ok !== false) {
            resolve(parsed);
            return;
          }

          const retryAfterHeader = res.headers['retry-after'];
          const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;

          if (res.statusCode === 429 && attempt < maxAttempts - 1) {
            const delayMs = ((retryAfterSeconds || 2) * 1000) + (attempt * 500);
            await wait(delayMs);
            try {
              resolve(await slackRequest(path, token, attempt + 1));
              return;
            } catch (error) {
              reject(error);
              return;
            }
          }

          reject(new SlackApiError(
            res.statusCode,
            parsed.error || 'unknown_error',
            `Slack API error (${res.statusCode}): ${parsed.error || data}`,
            retryAfterSeconds
          ));
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

function scoreLeadershipPatterns(text) {
  return LEADERSHIP_PATTERNS
    .map((pattern) => (pattern.regex.test(text) ? pattern : null))
    .filter(Boolean);
}

function formatExcerpt(text, maxLength = 160) {
  if (!text) {
    return 'No text preview available';
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

function summarizeThemeLabel(label) {
  switch (label) {
    case 'Access Provisioning & Approvals':
      return 'Access provisioning and approval work remained the clearest demand driver.';
    case 'Identity & Authentication':
      return 'Authentication friction continued to create employee productivity interruptions.';
    case 'Security / Governance Review':
      return 'Governance review work showed up as a meaningful share of support effort.';
    case 'Customer or vendor-facing workflow risk':
      return 'A subset of support work had direct external or cross-functional visibility.';
    default:
      return `${label} surfaced as a recurring support pattern.`;
  }
}

function buildLeadershipStory(pattern, count, coverage) {
  const base = `${pattern.label} appeared ${count} times across ${coverage} ${coverage === 1 ? 'channel' : 'channels'}.`;

  return {
    label: pattern.label,
    count,
    stakeholder: pattern.stakeholder,
    summary: `${base} ${pattern.pov}`,
    whyItMatters: pattern.pov
  };
}

function buildNotableReason(message) {
  const reasons = [];

  for (const impact of IMPACT_PATTERNS) {
    if (impact.regex.test(message.normalizedText)) {
      reasons.push(impact.reason);
    }
  }

  if ((message.reply_count || 0) >= 10) {
    reasons.push(`cross-functional attention (${message.reply_count} replies)`);
  }

  const reactionCount = (message.reactions || []).reduce((sum, reaction) => sum + (reaction.count || 0), 0);
  if (reactionCount >= 5) {
    reasons.push(`strong channel uptake (${reactionCount} reactions)`);
  }

  return reasons[0] || 'support signal worth leadership review';
}

function scoreNotable(message) {
  const reactionCount = (message.reactions || []).reduce((sum, reaction) => sum + (reaction.count || 0), 0);
  let score = (message.reply_count || 0) * 2 + reactionCount;

  for (const impact of IMPACT_PATTERNS) {
    if (impact.regex.test(message.normalizedText)) {
      score += impact.weight;
    }
  }

  return score;
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
  const patternCounts = {};
  let incidentSignals = 0;
  let threadCount = 0;

  for (const message of humanMessages) {
    uniqueUsers.add(message.user);
    activeDays.add(new Date(parseFloat(message.ts) * 1000).toISOString().split('T')[0]);

    if ((message.reply_count || 0) > 0) {
      threadCount++;
    }

    const themes = scoreThemeMatches(message.normalizedText);
    for (const theme of themes) {
      themeCounts[theme] = (themeCounts[theme] || 0) + 1;
      if (theme === 'Incident / Service Disruption') {
        incidentSignals++;
      }
    }

    const patterns = scoreLeadershipPatterns(message.normalizedText);
    for (const pattern of patterns) {
      patternCounts[pattern.key] = (patternCounts[pattern.key] || 0) + 1;
    }
  }

  const topThemes = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label, count]) => ({
      label,
      count,
      summary: summarizeThemeLabel(label)
    }));

  const leadershipStories = Object.entries(patternCounts)
    .map(([key, count]) => {
      const pattern = LEADERSHIP_PATTERNS.find((item) => item.key === key);
      return pattern ? buildLeadershipStory(pattern, count, 1) : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const notables = humanMessages
    .map((message) => {
      const score = scoreNotable(message);
      const patterns = scoreLeadershipPatterns(message.normalizedText).map((pattern) => pattern.label);
      return {
        ts: message.ts,
        text: formatExcerpt(message.normalizedText),
        replyCount: message.reply_count || 0,
        reactionCount: (message.reactions || []).reduce((sum, reaction) => sum + (reaction.count || 0), 0),
        themes: scoreThemeMatches(message.normalizedText),
        patterns,
        score,
        reason: buildNotableReason(message)
      };
    })
    .filter((item) => item.score >= 10 || item.patterns.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  return {
    channel: channelConfig.displayName,
    messageCount: humanMessages.length,
    uniqueUsers: uniqueUsers.size,
    activeDays: activeDays.size,
    threadCount,
    incidentSignals,
    topThemes,
    leadershipStories,
    notables
  };
}

function summarizeAcrossChannels(channelSummaries) {
  const availableChannels = channelSummaries.filter((summary) => !summary.error);
  const themeCounts = {};
  const storyCounts = {};
  const storyCoverage = {};
  const combinedNotables = [];

  for (const channel of availableChannels) {
    for (const theme of channel.topThemes || []) {
      themeCounts[theme.label] = (themeCounts[theme.label] || 0) + theme.count;
    }

    for (const story of channel.leadershipStories || []) {
      storyCounts[story.label] = (storyCounts[story.label] || 0) + story.count;
      storyCoverage[story.label] = (storyCoverage[story.label] || 0) + 1;
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
    .slice(0, 4)
    .map(([label, count]) => ({
      label,
      count,
      summary: summarizeThemeLabel(label)
    }));

  const leadershipReadout = Object.entries(storyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, count]) => {
      const pattern = LEADERSHIP_PATTERNS.find((item) => item.label === label);
      return buildLeadershipStory(pattern, count, storyCoverage[label] || 1);
    });

  const notableItems = combinedNotables
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ score, ...item }) => item);

  return {
    totalMessages: availableChannels.reduce((sum, channel) => sum + channel.messageCount, 0),
    totalUniqueUsers: availableChannels.reduce((sum, channel) => sum + channel.uniqueUsers, 0),
    totalActiveDays: availableChannels.reduce((sum, channel) => sum + channel.activeDays, 0),
    totalIncidentSignals: availableChannels.reduce((sum, channel) => sum + channel.incidentSignals, 0),
    topThemes,
    leadershipReadout,
    notableItems
  };
}

function buildOverview(overall) {
  return (overall.leadershipReadout || [])
    .slice(0, 3)
    .map((story) => story.summary);
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
        leadershipReadout: [],
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
          error: 'Channel not found or bot is not a member'
        });
        continue;
      }

      const messages = await fetchChannelMessages(channelId, startDate, endDate, token);
      const summary = analyzeChannel(messages, channelConfig);
      channels.push(summary);
      console.log(`  ${channelConfig.displayName}: ${summary.messageCount} messages, ${summary.uniqueUsers} users`);
    } catch (error) {
      const errorMessage = error instanceof SlackApiError && error.statusCode === 429
        ? 'Rate limited after retries; rerun should recover'
        : error.message;

      channels.push({
        channel: channelConfig.displayName,
        error: errorMessage
      });
      console.warn(`  ${channelConfig.displayName}: ${errorMessage}`);
    }
  }

  const overall = summarizeAcrossChannels(channels);

  return {
    available: channels.some((channel) => !channel.error),
    messageCount: overall.totalMessages,
    uniqueUsers: overall.totalUniqueUsers,
    overview: buildOverview(overall),
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
