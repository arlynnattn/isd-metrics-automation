#!/bin/bash

# ISD Monthly Metrics Report Generator
# Generates HTML report for current month ISD tickets

# NOTE: For manual local runs, set these environment variables:
# export ATLASSIAN_EMAIL="your-email@attentivemobile.com"
# export ATLASSIAN_API_TOKEN="your-api-token"
# export SLACK_BOT_TOKEN="your-slack-token"

cd "$(dirname "$0")"

echo "🔄 Generating ISD Monthly Metrics Report..."
node update-confluence-monthly-enhanced.js

echo ""
echo "📤 Posting metrics summary to Slack..."
node post-monthly-metrics.js

echo ""
echo "✅ Done! Report saved to Desktop and posted to Slack."
echo "📋 Next step: Copy HTML from Desktop and paste into Confluence"
echo "🔗 Monthly Confluence page: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6415089689"
