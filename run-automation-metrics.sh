#!/bin/bash

# ISD Automation Metrics Report Generator
# Updates the "IT Ops - Metrics Fully Automated" Confluence page

# NOTE: For manual local runs, set these environment variables:
# export ATLASSIAN_EMAIL="your-email@attentivemobile.com"
# export ATLASSIAN_API_TOKEN="your-api-token"

cd "$(dirname "$0")"

echo "🔄 Generating ISD Automation Metrics Report..."
node update-confluence-metrics.js

echo ""
echo "✅ Done! Automation metrics updated."
echo "🔗 Confluence page: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/5471371324"
