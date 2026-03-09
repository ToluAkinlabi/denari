const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const periods = await prisma.period.findMany({
    orderBy: { startDate: 'asc' }
  });
  
  const entries = await prisma.ledgerEntry.findMany({
    orderBy: { date: 'asc' },
    include: { category: true }
  });
  
  console.log('\n📅 PERIODS:');
  periods.forEach(p => {
    const closing = p.closingCashActual || p.closingCashExpected || 0;
    console.log(`  ${p.label} | Opening: $${p.openingCash} | Closing: $${closing}`);
  });
  
  console.log('\n📝 LEDGER ENTRIES:');
  entries.forEach(e => {
    console.log(`  ${e.date.toISOString().split('T')[0]} | ${e.category.name} | $${e.amount} | ${e.entryType}`);
  });
  
  console.log(`\nTotal entries: ${entries.length}`);
  
  await prisma.$disconnect();
}

check();
