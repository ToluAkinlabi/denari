/**
 * Audit script: find the $886 discrepancy between app ($2606) and actual bank ($1720).
 * Checks category flags, uncounted expenses, and computes what the balance SHOULD be.
 */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const user = await db.user.findFirst({ where: { name: 'Personal' } });

  // 1. Show all categories and their flags
  const categories = await db.category.findMany({ where: { userId: user.id }, orderBy: { name: 'asc' } });
  console.log('=== CATEGORIES AND FLAGS ===');
  console.log('Name'.padEnd(25) + 'countsAsExpense'.padEnd(18) + 'countsAsSavings');
  for (const c of categories) {
    console.log(c.name.padEnd(25) + String(c.countsAsExpense).padEnd(18) + String(c.countsAsSavings));
  }

  // 2. Find all EXPENSE/TRANSFER entries whose category does NOT count as expense or savings
  //    i.e. entries the user logged as expenses that the app ignores in the balance
  const allEntries = await db.ledgerEntry.findMany({
    where: { period: { userId: user.id } },
    include: { category: true, period: { select: { label: true } } },
    orderBy: { date: 'asc' },
  });

  const uncounted = allEntries.filter(e =>
    (e.entryType === 'EXPENSE' || e.entryType === 'TRANSFER') &&
    e.category &&
    !e.category.countsAsExpense &&
    !e.category.countsAsSavings
  );

  console.log('\n=== EXPENSES WITH NO countsAsExpense FLAG (not subtracted from balance) ===');
  let uncountedTotal = 0;
  for (const e of uncounted) {
    console.log(`  [${e.period.label}] ${e.date.toISOString().slice(0,10)} ${e.description.padEnd(30)} $${Number(e.amount).toFixed(2)} cat=${e.category.name}`);
    uncountedTotal += Number(e.amount);
  }
  console.log(`  TOTAL uncounted expenses: $${uncountedTotal.toFixed(2)}`);

  // 3. Same check for entries with NO category at all
  const noCat = allEntries.filter(e =>
    (e.entryType === 'EXPENSE' || e.entryType === 'TRANSFER') && !e.category
  );
  if (noCat.length > 0) {
    console.log('\n=== EXPENSES WITH NO CATEGORY (also not subtracted) ===');
    for (const e of noCat) {
      console.log(`  [${e.period.label}] ${e.date.toISOString().slice(0,10)} ${e.description} $${Number(e.amount).toFixed(2)}`);
    }
  }

  // 4. Show what the balance WOULD be if ALL expense-type entries were subtracted
  const allPeriods = await db.period.findMany({
    where: { userId: user.id },
    orderBy: { startDate: 'asc' },
    include: { ledgerEntries: { include: { category: true } } },
  });

  console.log('\n=== BALANCE: as-coded vs if-all-expenses-counted ===');
  let carryAsCoded = 0;
  let carryAllCounted = 0;

  for (const period of allPeriods) {
    const income = period.ledgerEntries.filter(e => e.entryType === 'INCOME').reduce((s,e)=>s+Number(e.amount),0);
    const spendingAsCoded = period.ledgerEntries.filter(e => e.category?.countsAsExpense).reduce((s,e)=>s+Number(e.amount),0);
    const savings = period.ledgerEntries.filter(e => e.category?.countsAsSavings).reduce((s,e)=>s+Number(e.amount),0);
    const spendingAllExpenses = period.ledgerEntries
      .filter(e => e.entryType === 'EXPENSE' || (e.entryType === 'TRANSFER' && !e.category?.countsAsSavings))
      .reduce((s,e)=>s+Number(e.amount),0);

    const closingAsCoded = carryAsCoded + income - spendingAsCoded - savings;
    const closingAllCounted = carryAllCounted + income - spendingAllExpenses - savings;

    console.log(`${period.label.padEnd(18)} as-coded=${closingAsCoded.toFixed(2).padStart(9)}  all-expenses=${closingAllCounted.toFixed(2).padStart(9)}  diff=${( closingAsCoded - closingAllCounted).toFixed(2).padStart(8)}`);

    carryAsCoded = closingAsCoded;
    carryAllCounted = closingAllCounted;
  }

  console.log(`\nApp shows: $${carryAsCoded.toFixed(2)}`);
  console.log(`All-expensed balance: $${carryAllCounted.toFixed(2)}`);
  console.log(`Actual bank: ~$1720.00`);
  console.log(`Gap (app vs actual): $${(carryAsCoded - 1720).toFixed(2)}`);
  console.log(`Gap (all-expensed vs actual): $${(carryAllCounted - 1720).toFixed(2)}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
