#!/bin/bash

# Test posting weekly metrics to Slack

# NOTE: For manual local runs, set this environment variable:
# export SLACK_BOT_TOKEN="your-slack-token"

cd "$(dirname "$0")"

echo "📊 Testing Weekly Metrics Slack Post..."
echo ""
echo "Note: Bot must be invited to #itops-metric-reporting first"
echo "Run: /invite @IT Metrics Bot"
echo ""

node post-weekly-metrics.js

echo ""
echo "✅ Test complete!"
