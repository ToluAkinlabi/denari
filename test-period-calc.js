// Test the period.ts calculation for March 7

const { addDays } = require('date-fns');

const FIRST_PAYDAY = new Date('2026-01-09');
const CYCLE_LENGTH_DAYS = 14;

function getPayCycleIndex(date) {
  const daysSinceFirstPayday = Math.floor(
    (date.getTime() - FIRST_PAYDAY.getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.floor(daysSinceFirstPayday / CYCLE_LENGTH_DAYS);
}

function getPeriodStartDate(cycleIndex) {
  return addDays(FIRST_PAYDAY, cycleIndex * CYCLE_LENGTH_DAYS - (CYCLE_LENGTH_DAYS - 1));
}

function getPeriodEndDate(cycleIndex) {
  return addDays(FIRST_PAYDAY, cycleIndex * CYCLE_LENGTH_DAYS);
}

function getPeriodForDate(date) {
  let cycleIndex = getPayCycleIndex(date);
  let startDate = getPeriodStartDate(cycleIndex);
  let endDate = getPeriodEndDate(cycleIndex);
  
  // Edge case: if date is after the calculated period end, it belongs to the next period
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  
  if (dateDay > endDay) {
    cycleIndex += 1;
    startDate = getPeriodStartDate(cycleIndex);
    endDate = getPeriodEndDate(cycleIndex);
  }
  
  return { cycleIndex, startDate, endDate };
}

// Test for March 7
const testDate = new Date('2026-03-07');
console.log(`\n📅 Testing period calculation for: ${testDate.toISOString().split('T')[0]}`);

const result = getPeriodForDate(testDate);
console.log(`\nCycle Index: ${result.cycleIndex}`);
console.log(`Start Date: ${result.startDate.toISOString().split('T')[0]}`);
console.log(`End Date: ${result.endDate.toISOString().split('T')[0]}`);

// Test a few dates
console.log('\n' + '='.repeat(80));
console.log('Testing multiple dates:');
console.log('='.repeat(80));

const testDates = [
  '2026-01-09', // First payday
  '2026-01-23', // Second payday  
  '2026-02-06', // Third payday
  '2026-02-20', // Fourth payday
  '2026-03-06', // Fifth payday
  '2026-03-07', // Day after fifth payday
  '2026-03-20', // Sixth payday
];

testDates.forEach(dateStr => {
  const d = new Date(dateStr);
  const p = getPeriodForDate(d);
  console.log(`${dateStr} → Period #${p.cycleIndex}: ${p.startDate.toISOString().split('T')[0]} to ${p.endDate.toISOString().split('T')[0]}`);
});
