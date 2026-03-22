import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const user = await db.user.findFirst({ where: { name: 'Personal' } });

  const entries = await db.ledgerEntry.findMany({
    where: { period: { userId: user.id }, entryType: 'INCOME' },
    include: { period: { select: { label: true } } },
    orderBy: { amount: 'desc' },
  });

  console.log('=== ALL INCOME ENTRIES (largest first) ===');
  let total = 0;
  for (const e of entries) {
    total += Number(e.amount);
    console.log(
      String(Number(e.amount).toFixed(2)).padStart(10) + '  ' +
      e.date.toISOString().slice(0, 10) + '  ' +
      e.description.padEnd(30) + '  [' + e.period.label + ']'
    );
  }
  console.log('  TOTAL ALL-TIME INCOME: $' + total.toFixed(2));

  // Current period entries
  const curPeriod = await db.period.findFirst({
    where: { userId: user.id, label: { contains: 'Mar 21' } },
    include: { ledgerEntries: { include: { category: true }, orderBy: { date: 'asc' } } },
  });
  if (curPeriod) {
    console.log('\n=== MAR 21 - APR 3 ENTRIES ===');
    for (const e of curPeriod.ledgerEntries) {
      console.log(
        '  [' + e.entryType + '] ' +
        e.date.toISOString().slice(0, 10) + '  ' +
        e.description.padEnd(30) + '  $' + Number(e.amount).toFixed(2) +
        '  cat=' + (e.category?.name ?? 'none')
      );
    }
    const expTotal = curPeriod.ledgerEntries
      .filter(e => e.category?.countsAsExpense)
      .reduce((s, e) => s + Number(e.amount), 0);
    console.log('  Total expenses subtracted: $' + expTotal.toFixed(2));
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
