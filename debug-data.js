const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('\n📊 Database Status:');
  console.log('='.repeat(80));
  
  const userCount = await prisma.user.count();
  const periodCount = await prisma.period.count();
  const entryCount = await prisma.ledgerEntry.count();
  const categoryCount = await prisma.category.count();
  
  console.log(`Users: ${userCount}`);
  console.log(`Categories: ${categoryCount}`);
  console.log(`Periods: ${periodCount}`);
  console.log(`Ledger Entries: ${entryCount}`);
  
  // Check current period calculation
  const today = new Date('2026-03-07');
  console.log(`\nToday: ${today.toISOString().split('T')[0]}`);
  
  // Find period that contains today
  const currentPeriod = await prisma.period.findFirst({
    where: {
      AND: [
        { startDate: { lte: today } },
        { endDate: { gte: today } }
      ]
    }
  });
  
  if (currentPeriod) {
    console.log('\n✅ Current Period Found:');
    console.log(`   ID: ${currentPeriod.id}`);
    console.log(`   Label: ${currentPeriod.label}`);
    console.log(`   Start: ${currentPeriod.startDate.toISOString().split('T')[0]}`);
    console.log(`   End: ${currentPeriod.endDate.toISOString().split('T')[0]}`);
  } else {
    console.log('\n❌ No current period found for today!');
  }
  
  // List all periods
  console.log('\n📅 All Periods:');
  const periods = await prisma.period.findMany({
    orderBy: { startDate: 'asc' },
    select: {
      label: true,
      startDate: true,
      endDate: true,
    }
  });
  
  periods.forEach((p, i) => {
    const start = p.startDate.toISOString().split('T')[0];
    const end = p.endDate.toISOString().split('T')[0];
    const isCurrent = currentPeriod && p.label === currentPeriod.label ? ' ← CURRENT' : '';
    console.log(`   ${i + 1}. ${start} to ${end} - "${p.label}"${isCurrent}`);
  });
  
  console.log('='.repeat(80));
  
  await prisma.$disconnect();
}

main().catch(console.error);
