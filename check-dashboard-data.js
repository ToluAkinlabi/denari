const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('\n📊 Dashboard Data Check');
  console.log('='.repeat(80));
  
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('❌ No user found');
    await prisma.$disconnect();
    return;
  }
  
  console.log(`✅ User: ${user.name} (${user.id})`);
  
  // Find current period
  const today = new Date('2026-03-07');
  const currentPeriod = await prisma.period.findFirst({
    where: {
      userId: user.id,
      startDate: { lte: today },
      endDate: { gte: today }
    },
    include: {
      ledgerEntries: {
        include: { category: true }
      }
    }
  });
  
  if (currentPeriod) {
    console.log(`\n✅ Current Period Found:`);
    console.log(`   Label: ${currentPeriod.label}`);
    console.log(`   Start: ${currentPeriod.startDate.toISOString().split('T')[0]}`);
    console.log(`   End: ${currentPeriod.endDate.toISOString().split('T')[0]}`);
    console.log(`   Opening Cash: $${currentPeriod.openingCash}`);
    console.log(`   Entries: ${currentPeriod.ledgerEntries.length}`);
    
    if (currentPeriod.ledgerEntries.length > 0) {
      console.log('\n   Entry Details:');
      currentPeriod.ledgerEntries.forEach(entry => {
        const date = entry.date.toISOString().split('T')[0];
        console.log(`   - ${date} | ${entry.category.name} | $${entry.amount} | ${entry.description}`);
      });
    }
  } else {
    console.log('\n❌ No current period found for today');
  }
  
  // Check previous period
  const previousPeriod = await prisma.period.findFirst({
    where: {
      userId: user.id,
      endDate: { lt: today }
    },
    orderBy: { endDate: 'desc' }
  });
  
  if (previousPeriod) {
    console.log(`\n📅 Previous Period:`);
    console.log(`   Label: ${previousPeriod.label}`);
    console.log(`   End: ${previousPeriod.endDate.toISOString().split('T')[0]}`);
    console.log(`   Opening Cash: $${previousPeriod.openingCash}`);
    console.log(`   Closing Expected: $${previousPeriod.closingCashExpected}`);
    console.log(`   Closing Actual: $${previousPeriod.closingCashActual || 'null'}`);
  }
  
  console.log('\n' + '='.repeat(80));
  
  await prisma.$disconnect();
}

main().catch(console.error);
