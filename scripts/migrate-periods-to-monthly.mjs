/**
 * Migrate existing biweekly periods to monthly periods.
 *
 * Strategy:
 * 1. For each user, load all periods.
 * 2. Group periods by calendar month (determined by startDate).
 * 3. For each month-group:
 *    a. Pick the "canonical" period (most ledger entries; tie-break: earliest startDate).
 *    b. Reassign all ledger entries from other periods in the group → canonical period.
 *    c. Reassign any PeriodRafAllocation rows similarly.
 *    d. Delete the empty (non-canonical) periods.
 *    e. Update the canonical period's startDate, endDate, and label to the full calendar month.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function monthKey(date) {
  // key = "YYYY-MM" based on the UTC date stored by Prisma/Postgres
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function firstOfMonth(dateKey) {
  // Returns a UTC midnight Date for the 1st of the given "YYYY-MM" key
  return new Date(`${dateKey}-01T00:00:00.000Z`);
}

function lastOfMonth(dateKey) {
  const [year, month] = dateKey.split('-').map(Number);
  // Day 0 of the next month = last day of this month
  const last = new Date(Date.UTC(year, month, 0));
  return last;
}

function monthLabel(dateKey) {
  const date = firstOfMonth(dateKey);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

async function migrateUser(userId) {
  const periods = await prisma.period.findMany({
    where: { userId },
    include: {
      _count: { select: { ledgerEntries: true } },
    },
    orderBy: { startDate: 'asc' },
  });

  if (periods.length === 0) {
    console.log(`  No periods found.`);
    return;
  }

  // Group by calendar month (UTC month of startDate)
  const groups = new Map(); // monthKey -> Period[]
  for (const period of periods) {
    const key = monthKey(period.startDate);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(period);
  }

  for (const [key, group] of groups.entries()) {
    const label = monthLabel(key);
    const start = firstOfMonth(key);
    const end = lastOfMonth(key);

    console.log(`\n  Month ${key} (${label}): ${group.length} period(s)`);
    for (const p of group) {
      const pStart = new Date(p.startDate).toISOString().split('T')[0];
      const pEnd = new Date(p.endDate).toISOString().split('T')[0];
      console.log(`    - [${p.id}] ${pStart} → ${pEnd}  entries=${p._count.ledgerEntries}`);
    }

    // Pick canonical period: most entries first, then earliest startDate
    group.sort((a, b) => {
      if (b._count.ledgerEntries !== a._count.ledgerEntries) {
        return b._count.ledgerEntries - a._count.ledgerEntries;
      }
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

    const canonical = group[0];
    const others = group.slice(1);

    if (others.length > 0) {
      for (const other of others) {
        // Reassign ledger entries
        const movedEntries = await prisma.ledgerEntry.updateMany({
          where: { periodId: other.id },
          data: { periodId: canonical.id },
        });
        console.log(`    Moved ${movedEntries.count} entries from ${other.id} → ${canonical.id}`);

        // Reassign PeriodRafAllocations
        const movedAllocs = await prisma.periodRafAllocation.updateMany({
          where: { periodId: other.id },
          data: { periodId: canonical.id },
        });
        console.log(`    Moved ${movedAllocs.count} RAF allocations from ${other.id} → ${canonical.id}`);

        // Delete the empty period
        await prisma.period.delete({ where: { id: other.id } });
        console.log(`    Deleted period ${other.id}`);
      }
    }

    // Update canonical period to full month boundaries
    const updated = await prisma.period.update({
      where: { id: canonical.id },
      data: {
        startDate: start,
        endDate: end,
        label,
      },
    });

    const newStart = new Date(updated.startDate).toISOString().split('T')[0];
    const newEnd = new Date(updated.endDate).toISOString().split('T')[0];
    console.log(`    Updated canonical period to ${newStart} → ${newEnd} "${updated.label}"`);
  }
}

async function main() {
  console.log('=== Migrating periods to monthly boundaries ===\n');

  const users = await prisma.user.findMany({ select: { id: true } });
  console.log(`Found ${users.length} user(s).`);

  for (const user of users) {
    console.log(`\nUser: ${user.id}`);
    await migrateUser(user.id);
  }

  console.log('\n=== Migration complete ===');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
