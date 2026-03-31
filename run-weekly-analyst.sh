#!/bin/bash

# Weekly Analyst Report Generator
# Generates executive analysis from weekly metrics data

# NOTE: For manual local runs, set these environment variables:
# export ATLASSIAN_EMAIL="your-email@attentivemobile.com"
# export ATLASSIAN_API_TOKEN="your-api-token"

cd "$(dirname "$0")"

echo "🔄 Generating Weekly Analyst Report..."
echo ""
echo "Note: This script currently uses sample data."
echo "Run './run-weekly.sh' first to collect current week metrics."
echo ""

node generate-weekly-analyst-report.js

echo ""
echo "✅ Done! Analyst report generated."
echo "🔗 Confluence page: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6424363046"
