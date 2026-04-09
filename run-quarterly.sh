#!/bin/bash

# ISD Quarterly Metrics Report Generator
# Generates HTML reports for Q1 2026 (Jan-Mar) vs Q4 2025 (Oct-Dec)

cd "$(dirname "$0")"

# Load credentials from .env.local if it exists
if [ -f .env.local ]; then
  echo "📝 Loading credentials from .env.local..."
  source .env.local
else
  echo "⚠️  No .env.local file found. Please create one with your credentials."
  echo "   Template available at: .env.local"
  echo ""
fi

echo "🔄 Generating ISD Quarterly Metrics Report (Q1 2026)..."
echo ""
node update-confluence-quarterly-enhanced.js

echo ""
echo "🔄 Generating Quarterly Analyst Report..."
node generate-quarterly-analyst-report.js

echo ""
echo "✅ Done! Reports saved to Desktop:"
echo "   📊 ISD_Quarterly_Metrics_Q1_2026.html"
echo "   📝 ISD_Quarterly_Analyst_Report_Q1_2026.html"
echo ""
echo "📋 Next steps:"
echo "   1. Review the HTML files on your Desktop"
echo "   2. Copy and paste into Confluence (or update page IDs in scripts for auto-update)"
echo "   3. Share with leadership for MBR/QBR review"
