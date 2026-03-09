const { addDays } = require('date-fns');

const FIRST_PAYDAY = new Date(2026, 0, 9); // Local date

console.log('\n📅 Testing with LOCAL dates:\n');

for (let i = 0; i <= 5; i++) {
  const payday = addDays(FIRST_PAYDAY, i * 14);
  const periodStart = addDays(payday, -13);
  
  console.log(`Period ${i}:`);
  console.log(`  Start: ${periodStart.toLocaleDateString('en-CA')}`); // YYYY-MM-DD format
  console.log(`  End/Payday: ${payday.toLocaleDateString('en-CA')}`);
  
  const days = Math.floor((payday - periodStart) / (1000 * 60 * 60 * 24)) + 1;
  console.log(`  Days: ${days} ${days === 14 ? '✓' : '❌'}`);
  console.log('');
}

console.log('Expected paydays: Jan 9, Jan 23, Feb 6, Feb 20, Mar 6, Mar 20');
