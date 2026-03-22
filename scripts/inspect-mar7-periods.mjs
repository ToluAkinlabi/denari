import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const user = await db.user.findFirst({ where: { name: 'Personal' } });

  // Get ALL periods, ordered, so we can see the full chain
  const allPeriods = await db.period.findMany({
    where: { userId: user.id },
    orderBy: { startDate: 'asc' },
    include: {
      ledgerEntries: {
        include: { category: true },
        orderBy: { date: 'asc' },
      },
    },
  });

  for (const p of allPeriods) {
    const income = p.ledgerEntries
      .filter(e => e.entryType === 'INCOME')
      .reduce((s, e) => s + Number(e.amount), 0);
    const expense = p.ledgerEntries
      .filter(e => e.category?.countsAsExpense)
      .reduce((s, e) => s + Number(e.amount), 0);
    const savings = p.ledgerEntries
      .filter(e => e.category?.countsAsSavings)
      .reduce((s, e) => s + Number(e.amount), 0);

    console.log(`\n=== ${p.label} [${p.id}] ===`);
    console.log(`  start: ${p.startDate.toISOString()}  end: ${p.endDate.toISOString()}`);
    console.log(`  openingCash: ${Number(p.openingCash).toFixed(2)}`);
    console.log(`  closingExpected: ${p.closingCashExpected !== null ? Number(p.closingCashExpected).toFixed(2) : 'null'}`);
    console.log(`  closingActual:   ${p.closingCashActual !== null ? Number(p.closingCashActual).toFixed(2) : 'null'}`);
    console.log(`  entries: ${p.ledgerEntries.length}  |  income: ${income.toFixed(2)}  |  expense: ${expense.toFixed(2)}  |  savings: ${savings.toFixed(2)}`);

    if (p.label.includes('Mar 7')) {
      console.log('  --- entries detail ---');
      for (const e of p.ledgerEntries) {
        console.log(`    [${e.entryType}] ${e.date.toISOString().slice(0,10)} ${e.description} $${Number(e.amount).toFixed(2)} cat=${e.category?.name ?? 'none'}`);
      }
    }
  }

  await db.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
