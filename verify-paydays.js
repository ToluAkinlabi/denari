const { addDays } = require('date-fns');

const FIRST_PAYDAY = new Date('2026-01-09');

console.log('\n📅 VERIFYING BIWEEKLY PAYDAYS:\n');
console.log('Expected: Jan 9, Jan 23, Feb 6, Feb 20, Mar 6, Mar 20\n');

for (let i = 0; i <= 5; i++) {
  const payday = addDays(FIRST_PAYDAY, i * 14);
  const periodStart = addDays(payday, -13);
  
  console.log(`Period ${i}:`);
  console.log(`  Start: ${periodStart.toISOString().split('T')[0]}`);
  console.log(`  End/Payday: ${payday.toISOString().split('T')[0]}`);
  
  // Count days to verify it's 14 days
  const days = Math.floor((payday - periodStart) / (1000 * 60 * 60 * 24)) + 1; // +1 for inclusive
  console.log(`  Days: ${days} ${days === 14 ? '✓' : '❌ WRONG!'}`);
  console.log('');
}
