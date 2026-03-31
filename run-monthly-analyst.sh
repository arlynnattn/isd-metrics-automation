#!/bin/bash

# Monthly Analyst Report Generator
# Generates executive analysis from monthly metrics data

# NOTE: For manual local runs, set these environment variables:
# export ATLASSIAN_EMAIL="your-email@attentivemobile.com"
# export ATLASSIAN_API_TOKEN="your-api-token"

cd "$(dirname "$0")"

echo "🔄 Generating Monthly Analyst Report..."
echo ""
echo "Note: This script currently uses sample data."
echo "Run './run-monthly.sh' first to collect current month metrics."
echo ""

node generate-monthly-analyst-report.js

echo ""
echo "✅ Done! Analyst report generated."
echo "🔗 Confluence page: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6422003766"
