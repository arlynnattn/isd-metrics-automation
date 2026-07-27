const { getMondayOfWeek } = require('./check-calendar-ooo');

const SUPPORT_TEAM_BASELINE_CHANGE_DATE = '2026-07-17';
const LEGACY_SUPPORT_ENGINEERS = ['Carlos Ramirez', 'Artie Byers', 'JP Dulude'];
const CURRENT_SUPPORT_ENGINEERS = ['Carlos Ramirez', 'JP Dulude'];

function getWeeklyReportingAnchors(referenceDate = new Date()) {
  const now = new Date(referenceDate);
  const currentWindowStart = new Date(now);
  currentWindowStart.setDate(now.getDate() - 7);

  const previousWindowStart = new Date(now);
  previousWindowStart.setDate(now.getDate() - 14);

  return {
    currentWeekMonday: getMondayOfWeek(currentWindowStart),
    previousWeekMonday: getMondayOfWeek(previousWindowStart),
  };
}

function formatNetChange(netChange) {
  if (netChange > 0) return `🟢 +${netChange}`;
  if (netChange < 0) return `🔴 ${netChange}`;
  return '⚪️ 0';
}

function isWorkforceDataAvailable(workforce = {}) {
  return workforce.available !== false;
}

function formatWorkforceMetricValue(workforce = {}, key) {
  if (!isWorkforceDataAvailable(workforce)) {
    return 'Unavailable';
  }

  const value = workforce[key];
  return value ?? 0;
}

function formatWorkforceNetChangeValue(workforce = {}) {
  if (!isWorkforceDataAvailable(workforce)) {
    return 'Unavailable';
  }

  const totalOnboarding = workforce.totalOnboarding ?? 0;
  const offboarding = workforce.offboarding ?? 0;
  const netChange = workforce.netChange ?? (totalOnboarding - offboarding);
  return formatNetChange(netChange);
}

function buildWeeklyWorkforceSlackSection(workforce = {}) {
  const totalOnboarding = formatWorkforceMetricValue(workforce, 'totalOnboarding');
  const offboarding = formatWorkforceMetricValue(workforce, 'offboarding');
  const netChange = formatWorkforceNetChangeValue(workforce);
  const onboardingDateLabel = workforce.onboardingDateLabel || 'Unknown cohort';
  const offboardingDateLabel = workforce.offboardingDateLabel || 'Unknown range';
  const splitSupported = workforce.splitSupported === true;
  const unavailableReason = workforce.unavailableReason || workforce.error;

  const lines = [
    '👥 *Workforce*',
    `➕ Onboarded: ${totalOnboarding} (${onboardingDateLabel})`,
    `➖ Offboarded: ${offboarding} (${offboardingDateLabel})`,
    `📊 Net: ${netChange}`
  ];

  if (!isWorkforceDataAvailable(workforce) && unavailableReason) {
    lines.push(`⚠️ Source unavailable: ${unavailableReason}`);
  } else if (!splitSupported) {
    lines.push('ℹ️ Source: Google Calendar totals only; FTE/contractor split unavailable');
  }

  return lines.join('\n');
}

function getWeeklySupportEngineers(referenceDate = new Date()) {
  const currentDate = new Date(referenceDate);
  const baselineChangeDate = new Date(`${SUPPORT_TEAM_BASELINE_CHANGE_DATE}T00:00:00-04:00`);

  if (currentDate >= baselineChangeDate) {
    return CURRENT_SUPPORT_ENGINEERS.slice();
  }

  return LEGACY_SUPPORT_ENGINEERS.slice();
}

function buildWeeklyCapacitySlackLine(referenceDate = new Date()) {
  const engineers = getWeeklySupportEngineers(referenceDate);
  return `👤 Team Capacity: ${engineers.length} support engineers baseline (effective July 17, 2026)`;
}

module.exports = {
  buildWeeklyCapacitySlackLine,
  buildWeeklyWorkforceSlackSection,
  formatNetChange,
  formatWorkforceMetricValue,
  formatWorkforceNetChangeValue,
  getWeeklyReportingAnchors,
  getWeeklySupportEngineers,
  isWorkforceDataAvailable,
};
