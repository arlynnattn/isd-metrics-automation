#!/bin/bash

# Weekly Analyst Report Generator
# Generates executive analysis from weekly metrics data

cd "$(dirname "$0")"

export ATLASSIAN_EMAIL="agalang@attentivemobile.com"
export ATLASSIAN_API_TOKEN="ATATT3xFfGF0hfnFNQ0rMFJl5p8fmdGT1iQZracpU1sBWO9aXgZcyV1HNfEAxuZVvtbeSkFBUgqkvIQcgknyor0xRAFSNbarHjCqAN5GoCzgUxEzmClfgZY0y9v0_55jvh97DPgN_WA_r_nJFtTjfxocvWJHIyqAJstpjbJhKz9AkxjR_-0DCI8=C5DE512A"

echo "🔄 Generating Weekly Analyst Report..."
echo ""
echo "Note: This script currently uses sample data."
echo "Run './run-weekly.sh' first to collect current week metrics."
echo ""

node generate-weekly-analyst-report.js

echo ""
echo "✅ Done! Analyst report generated."
echo "🔗 Confluence page: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6424363046"
