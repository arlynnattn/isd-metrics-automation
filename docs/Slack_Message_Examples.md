# Slack Message Examples

Visual preview of automated Slack notifications sent to #itops-metric-reporting

## 📱 Message Format

Both weekly and monthly messages use **Slack Block Kit** for rich, visually appealing formatting with:
- ✅ Bold header with emoji
- 📅 Clear date/time information
- 📊 Organized list of updated pages with emojis
- 🔗 Clickable links to Confluence pages
- 🤖 Footer with automation context
- 🎨 Visual dividers and sections

---

## 🗓️ Weekly Message Example

```
┌──────────────────────────────────────────┐
│ ✅ ISD Weekly Metrics Updated            │  ← Header (bold, large)
├──────────────────────────────────────────┤
│ 📅 Week of March 31, 2026                │
│                                          │
│ All weekly Confluence pages have been    │
│ automatically updated with the latest    │
│ metrics.                                 │
├──────────────────────────────────────────┤  ← Divider
│ 📊 Updated Pages:                        │
│                                          │
│ • 📈 Weekly Metrics Dashboard (link)    │
│ • 📝 Weekly Analyst Report (link)       │
├──────────────────────────────────────────┤
│ 🤖 Automated via GitHub Actions •       │  ← Footer (gray text)
│ Next update: Next Monday at 9:00 AM ET  │
└──────────────────────────────────────────┘
```

**Links:**
- Weekly Metrics Dashboard → https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6423805982
- Weekly Analyst Report → https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6424363046

---

## 📊 Monthly Message Example

```
┌──────────────────────────────────────────┐
│ ✅ ISD Monthly Metrics Updated           │  ← Header (bold, large)
├──────────────────────────────────────────┤
│ 📅 March 2026                            │
│                                          │
│ All monthly Confluence pages have been   │
│ automatically updated with the latest    │
│ metrics.                                 │
├──────────────────────────────────────────┤  ← Divider
│ 📊 Updated Pages:                        │
│                                          │
│ • 📈 Monthly Metrics Dashboard (link)   │
│ • 📝 Monthly Analyst Report (link)      │
│ • 🎨 Visual Slide Deck (link)           │
├──────────────────────────────────────────┤
│ 🤖 Automated via GitHub Actions •       │  ← Footer (gray text)
│ Next update: 1st of next month at 9 AM  │
└──────────────────────────────────────────┘
```

**Links:**
- Monthly Metrics Dashboard → https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6415089689
- Monthly Analyst Report → https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6422003766
- Visual Slide Deck → https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6440288277

---

## 🎨 Design Features

### Header Block
- **Type**: `header`
- **Style**: Bold, large text with emoji
- **Purpose**: Immediate attention and status indication

### Information Section
- **Type**: `section` with `mrkdwn`
- **Contains**: Date and description
- **Style**: Clean, readable text with emoji icons

### Divider
- **Type**: `divider`
- **Purpose**: Visual separation between sections

### Links Section
- **Type**: `section` with bullet list
- **Links**: Markdown format `<url|text>` for clickable links
- **Emojis**: Each page has a unique emoji for easy identification

### Context Footer
- **Type**: `context`
- **Style**: Small, gray text
- **Contains**: Automation info and next scheduled run

---

## 🔔 Notification Settings

- **Channel**: #itops-metric-reporting
- **Unfurl Links**: Disabled (prevents large previews)
- **Fallback Text**: Plain text version for notifications
- **When Posted**:
  - Weekly: Every Monday at 9:00 AM ET
  - Monthly: 1st of month at 9:00 AM ET

---

## 🎯 Benefits of Block Kit Format

✅ **Professional Appearance**
- Clean, organized layout
- Consistent branding with emojis
- Easy to scan and read

✅ **Better User Experience**
- Clickable links stand out
- Clear hierarchy of information
- Mobile-friendly layout

✅ **Informative**
- Shows what was updated
- Indicates automation source
- Provides next update time

✅ **Accessibility**
- Fallback text for screen readers
- Clear text contrast
- Semantic structure

---

## 🛠️ Technical Implementation

Messages are sent using Slack's `chat.postMessage` API with Block Kit JSON:

```json
{
  "channel": "itops-metric-reporting",
  "text": "✅ ISD Weekly Metrics Updated",  // Fallback text
  "blocks": [
    { "type": "header", ... },
    { "type": "section", ... },
    { "type": "divider" },
    { "type": "section", ... },
    { "type": "context", ... }
  ],
  "unfurl_links": false
}
```

**Block Types Used:**
- `header` - Large bold text for title
- `section` - Main content with markdown support
- `divider` - Visual separator
- `context` - Small footer text

**Markdown Features:**
- `*bold*` for emphasis
- `<url|text>` for links
- Bullet points with `•`
- Line breaks with `\n`

---

## 📸 What It Actually Looks Like

In Slack, the message will appear with:
- ✅ Green checkmark emoji in the header
- 📅 Calendar emoji for dates
- 📊 Chart emoji for section headers
- 📈 Graph emojis for dashboard links
- 📝 Memo emoji for report links
- 🎨 Art palette emoji for slide deck link
- 🤖 Robot emoji in footer indicating automation
- Dividing lines between sections
- Gray text for the footer
- Blue clickable links

The entire message is contained in a clean card-like container that stands out in the Slack channel!

---

## 🔍 Testing

To test the Slack message format:

1. **Manual Trigger**: Run workflow from GitHub Actions
2. **Check Channel**: Go to #itops-metric-reporting
3. **Verify**:
   - ✅ Message appears with proper formatting
   - ✅ All links are clickable
   - ✅ Emojis display correctly
   - ✅ Layout is clean and readable
   - ✅ Footer shows correct next update time

You can also use [Slack Block Kit Builder](https://app.slack.com/block-kit-builder) to preview and customize the layout.
