/**
 * Simulate dashboard loading to test period auto-creation
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Simulate the period calculation logic
function getPeriodForDate(date) {
  const FIRST_PAYDAY = new Date('2026-01-09');
  const CYCLE_LENGTH_DAYS = 14;
  
  const daysSinceFirstPayday = Math.floor(
    (date.getTime() - FIRST_PAYDAY.getTime()) / (1000 * 60 * 60 * 24)
  );
  const cycleIndex = Math.floor(daysSinceFirstPayday / CYCLE_LENGTH_DAYS);
  
  // Period start is 13 days before payday
  const periodEnd = new Date(FIRST_PAYDAY);
  periodEnd.setDate(periodEnd.getDate() + (cycleIndex * CYCLE_LENGTH_DAYS));
  
  const periodStart = new Date(periodEnd);
  periodStart.setDate(periodStart.getDate() - 13);
  
  return {
    cycleIndex,
    startDate: periodStart,
    endDate: periodEnd,
  };
}

async function simulateGetCurrentPeriod() {
  const userId = (await prisma.user.findFirst())?.id;
  if (!userId) {
    console.log('No user found');
    return;
  }
  
  const now = new Date('2026-03-07');
  console.log(`\n🔍 Looking for period containing: ${now.toISOString().split('T')[0]}`);
  
  // Try to find existing
  let period = await prisma.period.findFirst({
    where: {
      userId,
      startDate: { lte: now },
      endDate: { gte: now },
    },
  });
  
  if (period) {
    console.log('✅ Found existing period:');
    console.log(`   ${period.label}`);
    console.log(`   Opening Cash: $${period.openingCash}`);
    return period;
  }
  
  console.log('❌ No existing period found');
  console.log('🔨 Creating new period...');
  
  // Calculate period dates
  const periodWindow = getPeriodForDate(now);
  console.log(`   Calculated period: ${periodWindow.startDate.toISOString().split('T')[0]} to ${periodWindow.endDate.toISOString().split('T')[0]}`);
  
  // Find previous period
  const previousPeriod = await prisma.period.findFirst({
    where: {
      userId,
      endDate: { lt: periodWindow.startDate },
    },
    orderBy: { endDate: 'desc' },
  });
  
  let openingCash = 0;
  if (previousPeriod) {
    console.log(`\n📋 Previous period: ${previousPeriod.label}`);
    console.log(`   Opening: $${previousPeriod.openingCash}`);
    console.log(`   Closing Expected: $${previousPeriod.closingCashExpected}`);
    console.log(`   Closing Actual: $${previousPeriod.closingCashActual || 'null'}`);
    
    if (previousPeriod.closingCashActual) {
      openingCash = previousPeriod.closingCashActual;
    } else if (previousPeriod.closingCashExpected) {
      openingCash = previousPeriod.closingCashExpected;
    } else {
      openingCash = previousPeriod.openingCash;
    }
    console.log(`   → Using $${openingCash} as opening cash`);
  } else {
    openingCash = 5000;
    console.log(`\n   No previous period, using default: $${openingCash}`);
  }
  
  // Format label
  const label = `${periodWindow.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${periodWindow.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  
  console.log(`\n✨ Creating period: "${label}"`);
  console.log(`   Opening Cash: $${openingCash}`);
  
  // Note: Not actually creating to avoid modifying DB
  console.log('\n✅ Period would be created successfully');
}

async function main() {
  await simulateGetCurrentPeriod();
  await prisma.$disconnect();
}

main().catch(console.error);
