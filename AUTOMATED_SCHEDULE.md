# Automated Metrics Schedule

**Status**: ✅ Active
**Last Updated**: 2026-03-28

---

## 📅 Schedule

### **Weekly Reports** - Every Monday at 9:00 AM ET
**What Runs**:
1. `./run-weekly.sh` - Generates dashboard, posts to Confluence & Slack
2. `./run-weekly-analyst.sh` - Generates analyst report, posts to Confluence

**What Gets Published**:
- ✅ Weekly Dashboard → Confluence page 6423805982
- ✅ Weekly Summary → Slack #itops-metric-reporting
- ✅ Weekly Analyst Report → Confluence page 6424363046
- 📄 Backup files saved to Desktop

**Log Files**:
- `~/isd-metrics-automation/logs/weekly-YYYYMMDD.log`
- `~/isd-metrics-automation/logs/weekly-analyst-YYYYMMDD.log`

---

### **Monthly Reports** - 1st of Every Month at 9:00 AM ET
**What Runs**:
1. `./run-monthly.sh` - Generates dashboard, posts to Confluence & Slack
2. `./run-monthly-analyst.sh` - Generates analyst report, posts to Confluence

**What Gets Published**:
- ✅ Monthly Dashboard → Confluence page 6415089689
- ✅ Monthly Summary → Slack #itops-metric-reporting
- ✅ Monthly Analyst Report → Confluence page 6422003766
- 📄 Backup files saved to Desktop

**Log Files**:
- `~/isd-metrics-automation/logs/monthly-YYYYMMDD.log`
- `~/isd-metrics-automation/logs/monthly-analyst-YYYYMMDD.log`

---

## 🔍 Monitoring

### Check if Cron Jobs Are Active
```bash
crontab -l
```

### View Recent Logs
```bash
# Weekly logs
ls -lt ~/isd-metrics-automation/logs/weekly*.log | head -5
tail -50 ~/isd-metrics-automation/logs/weekly-$(date +%Y%m%d).log

# Monthly logs
ls -lt ~/isd-metrics-automation/logs/monthly*.log | head -5
tail -50 ~/isd-metrics-automation/logs/monthly-$(date +%Y%m%d).log
```

### Check Slack Channel
- Go to: https://attentive.slack.com/archives/C... (search for #itops-metric-reporting)
- Look for automated posts at ~9 AM ET on Mondays and 1st of month

### Check Confluence Pages
- **Weekly Dashboard**: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6423805982
- **Weekly Analyst**: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6424363046
- **Monthly Dashboard**: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6415089689
- **Monthly Analyst**: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6422003766

---

## 🛠️ Manual Override

If you need to run manually (outside of schedule):

```bash
cd ~/isd-metrics-automation

# Weekly
./run-weekly.sh
./run-weekly-analyst.sh
./validate-metrics.js

# Monthly
./run-monthly.sh
./run-monthly-analyst.sh
./validate-metrics.js
```

---

## ⚠️ Troubleshooting

### Cron Job Didn't Run
**Check if cron service is running**:
```bash
# macOS
ps aux | grep cron
```

**Check system logs**:
```bash
tail -100 /var/log/system.log | grep cron
```

### Reports Not Posted to Slack
**Check log files**:
```bash
cat ~/isd-metrics-automation/logs/weekly-$(date +%Y%m%d).log
```

**Common issues**:
- SLACK_BOT_TOKEN expired → Update in `run-weekly.sh` and `run-monthly.sh`
- Bot not in channel → Invite bot to #itops-metric-reporting

### Reports Not Updated in Confluence
**Check log files** for Confluence API errors

**Common issues**:
- ATLASSIAN_API_TOKEN expired → Update in `run-weekly.sh` and `run-monthly.sh`
- Token lacks write permissions → Generate new token with Confluence write access

---

## 🔐 Environment Variables

The cron jobs use API tokens stored in:
- `~/isd-metrics-automation/run-weekly.sh`
- `~/isd-metrics-automation/run-monthly.sh`

**Tokens Used**:
- `ATLASSIAN_EMAIL` - Your Atlassian email
- `ATLASSIAN_API_TOKEN` - Jira/Confluence API token
- `SLACK_BOT_TOKEN` - Slack bot token for posting

**Refresh Tokens**: https://id.atlassian.com/manage-profile/security/api-tokens

---

## 📊 Expected Results

### **Next Weekly Run**: Monday, March 31, 2026 at 9:00 AM ET

**Timeline**:
- 9:00:00 AM - Weekly dashboard starts
- 9:00:30 AM - Dashboard completes, Confluence & Slack updated
- 9:00:31 AM - Weekly analyst starts
- 9:01:00 AM - Analyst completes, Confluence updated
- 9:01:01 AM - All done! ✅

**Check**:
- Slack #itops-metric-reporting for weekly summary
- Confluence pages for updated reports
- Desktop for backup HTML files

### **Next Monthly Run**: Tuesday, April 1, 2026 at 9:00 AM ET

**Timeline**:
- 9:00:00 AM - Monthly dashboard starts
- 9:01:00 AM - Dashboard completes, Confluence & Slack updated
- 9:01:01 AM - Monthly analyst starts
- 9:01:30 AM - Analyst completes, Confluence updated
- 9:01:31 AM - All done! ✅

**Check**:
- Slack #itops-metric-reporting for monthly summary
- Confluence pages for updated reports
- Desktop for backup HTML files

---

## 🎯 Success Criteria

After each automated run, verify:
- [ ] Slack message posted to #itops-metric-reporting
- [ ] Confluence dashboard page updated
- [ ] Confluence analyst page updated
- [ ] Log files created in `~/isd-metrics-automation/logs/`
- [ ] No errors in log files
- [ ] Desktop backup files created

---

## 📞 Support

If automation fails:
1. Check log files in `~/isd-metrics-automation/logs/`
2. Run manually to test: `./run-weekly.sh`
3. Check API tokens haven't expired
4. Review this document for troubleshooting steps

For code issues, see:
- `QUICK_START.md` - Manual workflow
- `FIXES_APPLIED.md` - Recent fixes
- `README.md` - Full documentation
