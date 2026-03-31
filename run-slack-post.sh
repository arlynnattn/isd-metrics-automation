#!/bin/bash

# Post message to Slack #itops-metric-reporting channel

# NOTE: For manual local runs, set this environment variable:
# export SLACK_BOT_TOKEN="your-slack-token"

cd "$(dirname "$0")"

echo "📤 Posting to #itops-metric-reporting..."
echo ""

node post-to-slack.js

echo ""
echo "✅ Done!"
