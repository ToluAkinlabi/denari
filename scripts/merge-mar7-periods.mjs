/**
 * Merge orphan Mar 7-20 period into canonical period, then recalculate all balances.
 *
 * Canonical: cmmjuzak10001ldpuj4foodok (UTC midnight boundary, 34 entries, real activity Mar 10-20)
 * Orphan:    cmmjc76pb0001t13yb8cicg3y (UTC+5 boundary, 6 entries from Mar 9)
 *
 * Steps:
 *   1. Reassign all entries from orphan → canonical
 *   2. Delete orphan period
 *   3. Recalculate opening/closing for all periods in chronological order
 */

import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

const CANONICAL_ID = 'cmmjuzak10001ldpuj4foodok';
const ORPHAN_ID    = 'cmmjc76pb0001t13yb8cicg3y';

async function main() {
  const user = await db.user.findFirst({ where: { name: 'Personal' } });
  if (!user) throw new Error('No user found');

  // Verify both periods exist
  const canonical = await db.period.findUnique({ where: { id: CANONICAL_ID }, include: { ledgerEntries: true } });
  const orphan    = await db.period.findUnique({ where: { id: ORPHAN_ID },    include: { ledgerEntries: true } });

  if (!canonical) throw new Error(`Canonical period ${CANONICAL_ID} not found`);
  if (!orphan)    throw new Error(`Orphan period ${ORPHAN_ID} not found — may already be deleted`);

  console.log(`Canonical: ${canonical.label} — ${canonical.ledgerEntries.length} entries`);
  console.log(`Orphan:    ${orphan.label}    — ${orphan.ledgerEntries.length} entries`);
  console.log(`Moving ${orphan.ledgerEntries.length} entries from orphan → canonical...`);

  // Step 1: Reassign entries
  const updated = await db.ledgerEntry.updateMany({
    where: { periodId: ORPHAN_ID },
    data:  { periodId: CANONICAL_ID },
  });
  console.log(`  Moved ${updated.count} entries.`);

  // Step 2: Delete orphan period
  await db.period.delete({ where: { id: ORPHAN_ID } });
  console.log(`  Deleted orphan period ${ORPHAN_ID}.`);

  // Step 3: Recalculate all period balances in order
  console.log('\n--- Recalculating all period balances ---');

  const allPeriods = await db.period.findMany({
    where: { userId: user.id },
    orderBy: { startDate: 'asc' },
    include: {
      ledgerEntries: { include: { category: true } },
    },
  });

  let carry = 0;

  for (const period of allPeriods) {
    const income = period.ledgerEntries
      .filter(e => e.entryType === 'INCOME')
      .reduce((s, e) => s + Number(e.amount), 0);

    const spending = period.ledgerEntries
      .filter(e => e.category?.countsAsExpense)
      .reduce((s, e) => s + Number(e.amount), 0);

    const savings = period.ledgerEntries
      .filter(e => e.category?.countsAsSavings)
      .reduce((s, e) => s + Number(e.amount), 0);

    const closingExpected = carry + income - spending - savings;
    const closingActual = period.closingCashActual == null ? null : Number(period.closingCashActual);

    await db.period.update({
      where: { id: period.id },
      data: {
        openingCash: carry,
        closingCashExpected: closingExpected,
      },
    });

    console.log(
      `${period.label.padEnd(18)} opening=${carry.toFixed(2).padStart(9)}  ` +
      `income=${income.toFixed(2).padStart(9)}  spending=${spending.toFixed(2).padStart(9)}  ` +
      `savings=${savings.toFixed(2).padStart(7)}  closingExp=${closingExpected.toFixed(2).padStart(9)}  ` +
      `entries=${period.ledgerEntries.length}`
    );

    carry = closingActual ?? closingExpected;
  }

  console.log('\nDone. All balances recalculated.');
  console.log(`Current live cash balance (end of most recent closing): $${carry.toFixed(2)}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
