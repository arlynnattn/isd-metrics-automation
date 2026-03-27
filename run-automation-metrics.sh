#!/bin/bash

# ISD Automation Metrics Report Generator
# Updates the "IT Ops - Metrics Fully Automated" Confluence page

cd "$(dirname "$0")"

export ATLASSIAN_EMAIL="agalang@attentivemobile.com"
export ATLASSIAN_API_TOKEN="ATATT3xFfGF0hfnFNQ0rMFJl5p8fmdGT1iQZracpU1sBWO9aXgZcyV1HNfEAxuZVvtbeSkFBUgqkvIQcgknyor0xRAFSNbarHjCqAN5GoCzgUxEzmClfgZY0y9v0_55jvh97DPgN_WA_r_nJFtTjfxocvWJHIyqAJstpjbJhKz9AkxjR_-0DCI8=C5DE512A"

echo "🔄 Generating ISD Automation Metrics Report..."
node update-confluence-metrics.js

echo ""
echo "✅ Done! Automation metrics updated."
echo "🔗 Confluence page: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/5471371324"
