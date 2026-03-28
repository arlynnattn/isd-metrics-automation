#!/bin/bash

# ISD Weekly Metrics Report Generator
# Generates HTML report for last 7 days of ISD tickets

cd "$(dirname "$0")"

export ATLASSIAN_EMAIL="agalang@attentivemobile.com"
export ATLASSIAN_API_TOKEN="ATATT3xFfGF0hfnFNQ0rMFJl5p8fmdGT1iQZracpU1sBWO9aXgZcyV1HNfEAxuZVvtbeSkFBUgqkvIQcgknyor0xRAFSNbarHjCqAN5GoCzgUxEzmClfgZY0y9v0_55jvh97DPgN_WA_r_nJFtTjfxocvWJHIyqAJstpjbJhKz9AkxjR_-0DCI8=C5DE512A"
export SLACK_BOT_TOKEN="xoxb-101543140326-10784618198918-OeU9B9EGcS1qfBKpFO8MerRX"

echo "🔄 Generating ISD Weekly Metrics Report..."
node update-confluence-weekly.js

echo ""
echo "📤 Posting metrics summary to Slack..."
node post-weekly-metrics.js

echo ""
echo "✅ Done! Report saved to Desktop and posted to Slack."
echo "📋 Next step: Copy HTML from Desktop and paste into Confluence"
echo "🔗 Weekly Confluence page: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6423805982"
