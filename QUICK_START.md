# Quick Start Guide - Fixed System

**Last Updated**: 2026-03-28
**Status**: ✅ All critical fixes applied

---

## 🚀 Weekly Reports Workflow

```bash
cd ~/isd-metrics-automation

# 1. Generate weekly dashboard (data + JSON cache)
./run-weekly.sh

# 2. Generate weekly analyst report (uses cache from step 1)
./run-weekly-analyst.sh

# 3. Validate everything is consistent
./validate-metrics.js

# 4. Publish to Confluence
#    - Analyst report: ✅ Already published automatically
#    - Dashboard: Open Desktop/ISD_Weekly_Metrics_*.html and paste into:
#      https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6423805982
```

---

## 📅 Monthly Reports Workflow

```bash
cd ~/isd-metrics-automation

# 1. Generate monthly dashboard (data + JSON cache)
./run-monthly.sh

# 2. Generate monthly analyst report (uses cache from step 1)
./run-monthly-analyst.sh

# 3. Validate everything is consistent
./validate-metrics.js

# 4. Publish to Confluence
#    - Analyst report: ✅ Already published automatically
#    - Dashboard: Open Desktop/ISD_Monthly_Metrics_*.html and paste into:
#      https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6415089689
```

---

## ⚠️ IMPORTANT: Run Order Matters!

**Always run dashboard script BEFORE analyst script!**

```
✅ CORRECT:
./run-weekly.sh        # Creates metrics-cache-weekly.json
./run-weekly-analyst.sh  # Reads metrics-cache-weekly.json

❌ WRONG:
./run-weekly-analyst.sh  # ERROR: Cache file doesn't exist!
./run-weekly.sh
```

**Why?** The analyst scripts consume data from the dashboard scripts. If you run the analyst script first, it will fail with:
```
✗ Error loading metrics: Weekly metrics cache not found.
⚠️  You must run ./run-weekly.sh FIRST to generate metrics data.
```

---

## 🔍 Validation

Run after generating reports:

```bash
./validate-metrics.js
```

**Expected Output (Good)**:
```
✅ VALIDATION PASSED - All metrics are consistent
Reports are ready for leadership consumption.
```

**Example Output (Problem)**:
```
❌ Breach rate mismatch: 4.6% reported vs 5.2% calculated
❌ VALIDATION FAILED - Errors found in metrics
```

If validation fails:
1. Check error messages
2. Re-run dashboard scripts to regenerate data
3. Validate again

---

## 📊 What Gets Generated

### After `./run-weekly.sh`
- ✅ `metrics-cache-weekly.json` - Metrics for analyst script
- ✅ `Desktop/ISD_Weekly_Metrics_YYYY-MM-DD.html` - Dashboard report

### After `./run-weekly-analyst.sh`
- ✅ `Desktop/ISD_Weekly_Analyst_Report_YYYY-MM-DD.html` - Analyst report
- ✅ Confluence page auto-updated at: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6424363046

### After `./run-monthly.sh`
- ✅ `metrics-cache-monthly.json` - Metrics for analyst script
- ✅ `Desktop/ISD_Monthly_Metrics_MMM_YYYY.html` - Dashboard report

### After `./run-monthly-analyst.sh`
- ✅ `Desktop/ISD_Monthly_Analyst_Report_YYYY-MM-DD.html` - Analyst report
- ✅ Confluence page auto-updated at: https://attentivemobile.atlassian.net/wiki/spaces/ISD/pages/6422003766

---

## 🎯 What Changed (Quick Summary)

### Before (Broken)
- ❌ Analyst reports used fake hardcoded data
- ❌ Target comparisons wrong (24m reported as "above 2h target")
- ❌ No validation between dashboard and analyst
- ❌ Data quality warnings buried in footnotes

### After (Fixed)
- ✅ Analyst reports use real data from dashboard
- ✅ Target comparisons correct (24m = 0.4h = within 2h target)
- ✅ Validation script catches inconsistencies
- ✅ Data quality warnings prominent at top

---

## 🔧 Troubleshooting

### "Weekly metrics cache not found"
**Solution**: Run `./run-weekly.sh` first to generate the cache

### "Monthly metrics cache not found"
**Solution**: Run `./run-monthly.sh` first to generate the cache

### Validation fails with mismatch errors
**Solution**: Re-run dashboard scripts (`./run-weekly.sh` or `./run-monthly.sh`)

### Numbers different between dashboard and analyst
**Solution**: This should be impossible now. If it happens, file a bug report.

### Confluence page shows old data
**Solution**:
- Analyst reports: Re-run analyst script (auto-publishes)
- Dashboard reports: Re-run dashboard script and manually paste to Confluence

---

## 📋 Monthly Checklist

Run on 1st of each month:

```bash
# Generate reports
./run-monthly.sh
./run-monthly-analyst.sh

# Validate
./validate-metrics.js

# Publish
# - Analyst: Already done ✅
# - Dashboard: Copy from Desktop to Confluence
```

---

## 📧 Weekly Checklist

Run every Monday:

```bash
# Generate reports
./run-weekly.sh
./run-weekly-analyst.sh

# Validate
./validate-metrics.js

# Publish
# - Analyst: Already done ✅
# - Dashboard: Copy from Desktop to Confluence
```

---

## 📖 Documentation

- `README.md` - Full feature documentation
- `AUDIT_REPORT.md` - Original issues found
- `FIXES_APPLIED.md` - Comprehensive fix documentation
- `QUICK_START.md` - This file

---

**Questions?** See `FIXES_APPLIED.md` for detailed information about what was fixed and why.
