#!/bin/bash

# ISD Weekly Metrics Report Generator
# Generates HTML report for last 7 days of ISD tickets

# NOTE: For manual local runs, set these environment variables:
# export ATLASSIAN_EMAIL="your-email@attentivemobile.com"
# export ATLASSIAN_API_TOKEN="your-api-token"
# export SLACK_BOT_TOKEN="your-slack-token"

cd "$(dirname "$0")"

echo "🔄 Generating ISD Weekly Metrics Report..."
node update-confluence-weekly.js

echo ""
echo "📤 Posting metrics summary to Slack..."
node post-weekly-metrics.js

echo ""
echo "✅ Done! Report saved to Desktop and posted to Slack."
echo "📋 Next step: Copy HTML from Desktop and paste into Confluence"
echo "🔗 Weekly Confluence page: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6423805982"
