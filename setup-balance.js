const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('\n💰 Setting up balance for previous period...');
  
  // Find the period ending March 6
  const period = await prisma.period.findFirst({
    where: {
      endDate: new Date('2026-03-06')
    }
  });
  
  if (!period) {
    console.log('❌ Period not found');
    await prisma.$disconnect();
    return;
  }
  
  console.log(`Found period: ${period.label}`);
  console.log(`Current opening: $${period.openingCash}`);
  
  // Update it with an opening balance and closing balance
  await prisma.period.update({
    where: { id: period.id },
    data: {
      openingCash: 5000,
      closingCashExpected: 5000,
    }
  });
  
  console.log(`✅ Updated opening cash to $5000`);
  console.log(`✅ Set closing expected to $5000`);
  
  // Now regenerate the current period so it picks up the balance
  const currentPeriod = await prisma.period.findFirst({
    where: {
      startDate: new Date('2026-03-07')
    }
  });
  
  if (currentPeriod) {
    await prisma.period.update({
      where: { id: currentPeriod.id },
      data: {
        openingCash: 5000
      }
    });
    console.log(`✅ Updated current period opening cash to $5000`);
  }
  
  console.log('\n✅ Balance brought forward is now set up!');
  
  await prisma.$disconnect();
}

main().catch(console.error);
