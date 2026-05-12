#!/bin/bash
# Diagnostic script to check ISD Metrics Automation setup

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  ISD Metrics Automation - Setup Diagnostics              ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

cd "$(dirname "$0")"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ISSUES=0

# Check 1: Atlassian Email
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Checking Atlassian Email..."
if [ -n "$ATLASSIAN_EMAIL" ]; then
  echo -e "${GREEN}✓${NC} ATLASSIAN_EMAIL set: $ATLASSIAN_EMAIL"
else
  echo -e "${RED}✗${NC} ATLASSIAN_EMAIL not set"
  echo "  Set: export ATLASSIAN_EMAIL='your-email@attentivemobile.com'"
  ((ISSUES++))
fi
echo ""

# Check 2: Atlassian API Token
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. Checking Atlassian API Token..."
if [ -n "$ATLASSIAN_API_TOKEN" ]; then
  TOKEN_LEN=${#ATLASSIAN_API_TOKEN}
  echo -e "${GREEN}✓${NC} ATLASSIAN_API_TOKEN set (${TOKEN_LEN} characters)"

  # Test Jira API
  echo "  Testing Jira API access..."
  JIRA_RESPONSE=$(curl -s -u "$ATLASSIAN_EMAIL:$ATLASSIAN_API_TOKEN" \
    "https://attentivemobile.atlassian.net/rest/api/3/project/ISD" 2>&1)

  if echo "$JIRA_RESPONSE" | grep -q '"key":"ISD"'; then
    echo -e "${GREEN}  ✓${NC} Jira API access working"
  else
    echo -e "${RED}  ✗${NC} Jira API access failed"
    echo "     Response: $(echo $JIRA_RESPONSE | head -c 100)"
    ((ISSUES++))
  fi

  # Test Confluence API
  echo "  Testing Confluence API access..."
  CONF_RESPONSE=$(curl -s -u "$ATLASSIAN_EMAIL:$ATLASSIAN_API_TOKEN" \
    "https://attentivemobile.atlassian.net/wiki/rest/api/content/6423805982?expand=version" 2>&1)

  if echo "$CONF_RESPONSE" | grep -q '"statusCode":403'; then
    echo -e "${RED}  ✗${NC} Confluence API: 403 Forbidden"
    echo "     Token may not have Confluence product access"
    echo "     Regenerate at: https://id.atlassian.com/manage-profile/security/api-tokens"
    ((ISSUES++))
  elif echo "$CONF_RESPONSE" | grep -q '"id":"6423805982"'; then
    echo -e "${GREEN}  ✓${NC} Confluence API access working"
  else
    echo -e "${YELLOW}  ?${NC} Confluence API: Unexpected response"
    echo "     Response: $(echo $CONF_RESPONSE | head -c 100)"
  fi
else
  echo -e "${RED}✗${NC} ATLASSIAN_API_TOKEN not set"
  echo "  Generate at: https://id.atlassian.com/manage-profile/security/api-tokens"
  echo "  Set: export ATLASSIAN_API_TOKEN='your-token'"
  ((ISSUES++))
fi
echo ""

# Check 3: Google Calendar Credentials
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. Checking Google Calendar Credentials..."
if [ -f "google-service-account.json" ]; then
  echo -e "${GREEN}✓${NC} google-service-account.json found"

  # Extract service account email
  SERVICE_EMAIL=$(cat google-service-account.json | grep -o '"client_email"[^,]*' | cut -d'"' -f4)
  echo "  Service account: $SERVICE_EMAIL"

  # Test calendar access
  echo "  Testing Google Calendar API..."
  node check-calendar-ooo.js > /tmp/calendar-test.log 2>&1

  if grep -q "Error checking calendar:" /tmp/calendar-test.log; then
    echo -e "${RED}  ✗${NC} Calendar access failed"
    cat /tmp/calendar-test.log | grep "Error" | head -3 | sed 's/^/     /'
    echo "     See GOOGLE_CALENDAR_SETUP.md for setup instructions"
    ((ISSUES++))
  elif grep -q "Team Status Summary" /tmp/calendar-test.log; then
    echo -e "${GREEN}  ✓${NC} Google Calendar API working"
    cat /tmp/calendar-test.log | grep "Active:" | sed 's/^/     /'
  else
    echo -e "${YELLOW}  ?${NC} Calendar test: Unexpected result"
  fi

  rm -f /tmp/calendar-test.log
elif [ -n "$GOOGLE_SERVICE_ACCOUNT_KEY" ]; then
  echo -e "${YELLOW}✓${NC} GOOGLE_SERVICE_ACCOUNT_KEY env var set"
  echo "  (File not present, but env var configured for CI/CD)"
else
  echo -e "${RED}✗${NC} Google Calendar credentials not found"
  echo "  Create service account and save JSON as google-service-account.json"
  echo "  See: GOOGLE_CALENDAR_SETUP.md"
  ((ISSUES++))
fi
echo ""

# Check 4: Slack Bot Token
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. Checking Slack Bot Token..."
if [ -n "$SLACK_BOT_TOKEN" ]; then
  TOKEN_PREFIX=$(echo $SLACK_BOT_TOKEN | cut -c1-8)
  echo -e "${GREEN}✓${NC} SLACK_BOT_TOKEN set (${TOKEN_PREFIX}...)"

  # Test Slack API
  echo "  Testing Slack API access..."
  SLACK_RESPONSE=$(curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
    "https://slack.com/api/auth.test")

  if echo "$SLACK_RESPONSE" | grep -q '"ok":true'; then
    echo -e "${GREEN}  ✓${NC} Slack API access working"
    USER=$(echo $SLACK_RESPONSE | grep -o '"user":"[^"]*"' | cut -d'"' -f4)
    echo "     Bot user: $USER"
  else
    echo -e "${RED}  ✗${NC} Slack API access failed"
    echo "     Token may be invalid or expired"
    ((ISSUES++))
  fi
else
  echo -e "${YELLOW}⚠${NC} SLACK_BOT_TOKEN not set (optional)"
  echo "  #ask-it metrics will show as N/A"
  echo "  Set: export SLACK_BOT_TOKEN='xoxb-...'"
fi
echo ""

# Check 5: Node.js and Dependencies
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. Checking Node.js and Dependencies..."
if command -v node &> /dev/null; then
  NODE_VERSION=$(node --version)
  echo -e "${GREEN}✓${NC} Node.js installed: $NODE_VERSION"

  if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules directory exists"

    # Check for required packages
    if [ -f "node_modules/googleapis/package.json" ]; then
      echo -e "${GREEN}  ✓${NC} googleapis package installed"
    else
      echo -e "${RED}  ✗${NC} googleapis package missing"
      echo "     Run: npm install"
      ((ISSUES++))
    fi
  else
    echo -e "${RED}✗${NC} node_modules not found"
    echo "  Run: npm install"
    ((ISSUES++))
  fi
else
  echo -e "${RED}✗${NC} Node.js not installed"
  echo "  Install: brew install node (or download from nodejs.org)"
  ((ISSUES++))
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Summary:"
echo ""

if [ $ISSUES -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed!${NC}"
  echo "  You're ready to run the weekly metrics automation."
  echo ""
  echo "  Run: node update-confluence-weekly.js"
  echo ""
else
  echo -e "${RED}✗ Found $ISSUES issue(s) that need attention${NC}"
  echo ""
  echo "  See FIXES_NEEDED.md for detailed solutions"
  echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
