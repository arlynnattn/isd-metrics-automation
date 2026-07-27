const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildWeeklyCapacitySlackLine,
  buildWeeklyWorkforceSlackSection,
  getWeeklyReportingAnchors,
  getWeeklySupportEngineers,
} = require('../weekly-workforce');

test('anchors weekly workforce to the reporting window start instead of the run-date Monday', () => {
  const anchors = getWeeklyReportingAnchors(new Date('2026-07-27T12:00:00-04:00'));

  assert.equal(anchors.currentWeekMonday.toISOString(), '2026-07-20T04:00:00.000Z');
  assert.equal(anchors.previousWeekMonday.toISOString(), '2026-07-13T04:00:00.000Z');
});

test('formats weekly Slack workforce from calendar totals and explicit date labels', () => {
  const section = buildWeeklyWorkforceSlackSection({
    totalOnboarding: 3,
    offboarding: 2,
    netChange: 1,
    onboardingDateLabel: 'July 27, 2026 cohort',
    offboardingDateLabel: 'July 27, 2026 to August 2, 2026',
    splitSupported: false,
    fteOnboarding: 99,
    contractorOnboarding: 88,
  });

  assert.match(section, /Onboarded: 3 \(July 27, 2026 cohort\)/);
  assert.match(section, /Offboarded: 2 \(July 27, 2026 to August 2, 2026\)/);
  assert.match(section, /Net: 🟢 \+1/);
  assert.doesNotMatch(section, /99 FTE/);
  assert.match(section, /FTE\/contractor split unavailable/);
});

test('uses the 2-person support baseline on and after July 17, 2026', () => {
  assert.deepEqual(
    getWeeklySupportEngineers(new Date('2026-07-27T12:00:00-04:00')),
    ['Carlos Ramirez', 'JP Dulude']
  );
  assert.deepEqual(
    getWeeklySupportEngineers(new Date('2026-07-16T12:00:00-04:00')),
    ['Carlos Ramirez', 'Artie Byers', 'JP Dulude']
  );
});

test('formats weekly Slack capacity note from the new support baseline', () => {
  const line = buildWeeklyCapacitySlackLine(new Date('2026-07-27T12:00:00-04:00'));

  assert.equal(line, '👤 Team Capacity: 2 support engineers baseline (effective July 17, 2026)');
});
