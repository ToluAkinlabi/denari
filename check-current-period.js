const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get current period (Mar 7 - Mar 19/20)
  const currentPeriod = await prisma.period.findFirst({
    where: {
      AND: [
        { startDate: { lte: new Date('2026-03-07') } },
        { endDate: { gte: new Date('2026-03-07') } }
      ]
    }
  });

  if (!currentPeriod) {
    console.log('No current period found');
    return;
  }

  console.log('\n📊 Current Period:', currentPeriod.label);
  console.log('   Start:', currentPeriod.startDate.toISOString().split('T')[0]);
  console.log('   End:', currentPeriod.endDate.toISOString().split('T')[0]);

  // Get all entries for this period
  const entries = await prisma.ledgerEntry.findMany({
    where: { periodId: currentPeriod.id },
    include: { category: true },
    orderBy: { date: 'asc' }
  });

  console.log(`\n💰 Entries in this period (${entries.length} total):`);
  console.log('='.repeat(80));
  
  let totalIncome = 0;
  let totalExpenses = 0;

  entries.forEach(entry => {
    const date = entry.date.toISOString().split('T')[0];
    const amount = parseFloat(entry.amount);
    const type = entry.category.type;
    
    if (type === 'INCOME') {
      totalIncome += amount;
    } else if (entry.category.countsAsExpense) {
      totalExpenses += amount;
    }
    
    console.log(`   ${date} | $${amount.toFixed(2).padStart(10)} | ${entry.category.name.padEnd(15)} | ${entry.description || ''}`);
  });

  console.log('='.repeat(80));
  console.log(`   Total Income:   $${totalIncome.toFixed(2)}`);
  console.log(`   Total Expenses: $${totalExpenses.toFixed(2)}`);
  console.log('');
  
  await prisma.$disconnect();
}

main().catch(console.error);
