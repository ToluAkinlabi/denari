/**
 * Reconcile Mar 7-20 to $2,136.95 (reverse-engineered from $1,720 actual bank + $416.95 Mar 21 expenses).
 * Then cascade-recalculate all subsequent periods.
 */
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const MAR7_PERIOD_ID = 'cmmjuzak10001ldpuj4foodok';
const ACTUAL_CLOSING = 2136.95;

async function main() {
  const user = await db.user.findFirst({ where: { name: 'Personal' } });
  if (!user) throw new Error('No user found');

  // 1. Set closingCashActual on the Mar 7-20 period
  await db.period.update({
    where: { id: MAR7_PERIOD_ID },
    data: { closingCashActual: ACTUAL_CLOSING, status: 'RECONCILED' },
  });
  console.log(`Set Mar 7-20 closingCashActual = $${ACTUAL_CLOSING.toFixed(2)} (RECONCILED)`);

  // 2. Cascade recalculate all periods in order
  const allPeriods = await db.period.findMany({
    where: { userId: user.id },
    orderBy: { startDate: 'asc' },
    include: { ledgerEntries: { include: { category: true } } },
  });

  let carry = 0;
  for (const period of allPeriods) {
    const income = period.ledgerEntries.filter(e => e.entryType === 'INCOME').reduce((s,e)=>s+Number(e.amount),0);
    const spending = period.ledgerEntries.filter(e => e.category?.countsAsExpense).reduce((s,e)=>s+Number(e.amount),0);
    const savings = period.ledgerEntries.filter(e => e.category?.countsAsSavings).reduce((s,e)=>s+Number(e.amount),0);
    const closingExpected = carry + income - spending - savings;
    const closingActual = period.closingCashActual == null ? null : Number(period.closingCashActual);

    await db.period.update({
      where: { id: period.id },
      data: { openingCash: carry, closingCashExpected: closingExpected },
    });

    const statusNote = closingActual !== null ? ` ← ANCHORED at $${closingActual.toFixed(2)}` : '';
    console.log(
      `${period.label.padEnd(18)} open=$${carry.toFixed(2).padStart(9)}  exp=$${closingExpected.toFixed(2).padStart(9)}${statusNote}`
    );

    carry = closingActual ?? closingExpected;
  }

  console.log(`\nFinal balance: $${carry.toFixed(2)}`);
  console.log(carry <= 1720.05 && carry >= 1719.95 ? '✓ Matches actual bank balance of $1,720' : `⚠ Expected $1,720 but got $${carry.toFixed(2)}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
