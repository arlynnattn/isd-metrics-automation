# Slack Message Preview

**Channel**: #itops-metric-reporting

---

## 📊 Weekly Message Example (Good Metrics)

Based on actual data from Mar 21-28, 2026:

```
📊 IT Ops Weekly Metrics
📅 Last 7 days (Mar 21 - Mar 28, 2026)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 Performance
✅ SLA: 95.3% (Target: 95%)
⏱️ TTFR: 24m (Target: 2h)
⏱️ TTR: 8h 26m (Target: 16h)
✅ CSAT: 5.00/5.0 (19 reviews)

📈 Volume
✅ Resolved: 134 tickets
📥 Created: 143 tickets
⚠️ Backlog growing

🤖 Automation
⚠️ Rate: 1.5% (Target: 5%)
⚡ Breaches: 10 tickets

👥 Workforce
➕ Onboarded: 4 FTE + 3 contractors
➖ Offboarded: 6
📊 Net: 🟢 +1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Full Reports
• 📊 Dashboard
• 📈 Analyst Report
```

**Visual Indicators**:
- ✅ = Meeting/exceeding target (green checkmark)
- ⚠️ = Below target or warning (yellow warning)
- 🟢 = Positive net change (green circle)
- 🔴 = Negative net change (red circle)
- ⚪️ = No change (white circle)

---

## 📊 Monthly Message Example (Poor Metrics with Data Quality Warning)

Based on actual data from March 2026:

```
📊 IT Ops Monthly Metrics
📅 March 2026

⚠️ Data Quality Notice: March includes ticket clock cleanup - see analyst report for details

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 Performance
⚠️ SLA: 92.2% (Target: 95%)
⏱️ TTFR: 36h 55m (Target: 2h)
⏱️ TTR: 103h 28m (Target: 16h)
✅ CSAT: 4.95/5.0 (85 reviews)

📈 Volume
✅ Resolved: 612 tickets
📥 Created: 605 tickets
✅ Backlog reducing

🤖 Automation
⚠️ Rate: 1.8% (Target: 5%)
⚡ Breaches: 66 tickets

👥 Workforce
➕ Onboarded: 27 FTE + 13 contractors
➖ Offboarded: 24
📊 Net: 🟢 +16

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Full Reports
• 📊 Dashboard
• 📈 Analyst Report
```

**Special Features**:
- Data quality warning at top for March
- Links are clickable in Slack
- Status emojis automatically adjust based on targets

---

## 🎨 Emoji Legend

### Status Indicators
- ✅ **Green Check** - Meeting or exceeding target (good!)
- ⚠️ **Yellow Warning** - Below target or needs attention
- 🟢 **Green Circle** - Positive net change
- 🔴 **Red Circle** - Negative net change
- ⚪️ **White Circle** - No change

### Category Icons
- 🎯 **Target** - Performance metrics (SLA, TTFR, TTR, CSAT)
- 📈 **Chart Up** - Volume metrics (tickets resolved/created)
- 🤖 **Robot** - Automation metrics
- 👥 **People** - Workforce changes
- ⏱️ **Stopwatch** - Time-based metrics
- ⚡ **Lightning** - SLA breaches
- 📊 **Bar Chart** - Net changes
- ➕ **Plus** - Onboarding
- ➖ **Minus** - Offboarding
- 📥 **Inbox** - Created tickets
- 📋 **Clipboard** - Links to full reports

---

## 🔄 Dynamic Behavior

The messages automatically adjust based on actual metrics:

### SLA Performance
- **95%+ → ✅ SLA: 95.3%** (green check)
- **<95% → ⚠️ SLA: 92.2%** (yellow warning)

### CSAT Score
- **4.5+ → ✅ CSAT: 5.00/5.0** (green check)
- **<4.5 → ⚠️ CSAT: 4.20/5.0** (yellow warning)

### Automation Rate
- **5%+ → ✅ Rate: 6.2%** (green check)
- **<5% → ⚠️ Rate: 1.5%** (yellow warning)

### Backlog Status
- **Created ≤ Resolved → ✅ Backlog reducing**
- **Created > Resolved → ⚠️ Backlog growing**

### Workforce Net Change
- **Positive → 🟢 +16** (green circle)
- **Negative → 🔴 -5** (red circle)
- **Zero → ⚪️ 0** (white circle)

### Data Quality (Monthly Only)
- **March → Shows warning at top**
- **Other months → No warning**

---

## 📱 How It Looks in Slack

The message will:
- ✅ Use bold text for key numbers
- ✅ Include Unicode line separators for visual clarity
- ✅ Have clickable links to Confluence pages
- ✅ Show emoji status indicators inline
- ✅ Be easy to scan in 5 seconds
- ✅ Fit in mobile Slack app nicely

---

## 🎯 Design Goals Achieved

1. **Scannable** - Key metrics visible at a glance
2. **Actionable** - Status emojis show what needs attention
3. **Complete** - All important metrics included
4. **Mobile-Friendly** - Works well on phone
5. **Professional** - Clean, organized layout
6. **Contextual** - Targets shown inline for quick comparison
7. **Transparent** - Data quality warnings when applicable

---

## 🔍 Example Scenarios

### Scenario 1: Perfect Week
```
✅ SLA: 98.5% (Target: 95%)
✅ CSAT: 5.00/5.0
✅ Resolved: 150 tickets
✅ Backlog reducing
```
**= All green checks, leadership is happy!**

### Scenario 2: Needs Attention
```
⚠️ SLA: 89.2% (Target: 95%)
⚠️ Rate: 2.1% (Target: 5%)
⚠️ Backlog growing
```
**= Multiple warnings, action needed!**

### Scenario 3: Mixed Results (Most Common)
```
✅ SLA: 95.3% (Target: 95%)
✅ CSAT: 5.00/5.0
⚠️ Rate: 1.5% (Target: 5%)
⚠️ Backlog growing
```
**= Some good, some needs work**

---

## 📅 Next Slack Post

**When**: Monday, March 31, 2026 at 9:00 AM ET
**Where**: #itops-metric-reporting
**What**: Weekly metrics with emoji formatting
**Format**: Exactly as shown in preview above

Check the channel after 9 AM to see it live!
