const { addDays } = require('date-fns');

const FIRST_PAYDAY = new Date('2026-01-09');
const CYCLE_LENGTH_DAYS = 14;

function getPayCycleIndex(date) {
  const daysSinceFirstPayday = Math.floor(
    (date.getTime() - FIRST_PAYDAY.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  // If date is after the payday, it belongs to the next period
  if (daysSinceFirstPayday > 0) {
    return Math.ceil(daysSinceFirstPayday / CYCLE_LENGTH_DAYS);
  }
  
  return Math.floor(daysSinceFirstPayday / CYCLE_LENGTH_DAYS);
}

function getPeriodStartDate(cycleIndex) {
  return addDays(FIRST_PAYDAY, cycleIndex * CYCLE_LENGTH_DAYS - (CYCLE_LENGTH_DAYS - 1));
}

function getPeriodEndDate(cycleIndex) {
  return addDays(FIRST_PAYDAY, cycleIndex * CYCLE_LENGTH_DAYS);
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

console.log('\nTesting period calculations:');
console.log('='.repeat(60));

const testDates = [
  '2026-01-09',  // First payday
  '2026-01-10',  // Day after first payday
  '2026-01-23',  // Second payday
  '2026-02-06',  // Third payday  
  '2026-02-20',  // Fourth payday
  '2026-03-06',  // Fifth payday
  '2026-03-07',  // Day after fifth payday
];

testDates.forEach(dateStr => {
  const date = new Date(dateStr);
  const cycleIndex = getPayCycleIndex(date);
  const startDate = getPeriodStartDate(cycleIndex);
  const endDate = getPeriodEndDate(cycleIndex);
  
  console.log(`\nDate: ${dateStr}`);
  console.log(`  Cycle Index: ${cycleIndex}`);
  console.log(`  Period: ${formatDate(startDate)} to ${formatDate(endDate)}`);
  console.log(`  Payday: ${formatDate(endDate)}`);
});
