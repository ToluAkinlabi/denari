const { PrismaClient } = require('@prisma/client');
const { addDays, differenceInCalendarDays, startOfDay } = require('date-fns');

const prisma = new PrismaClient();

const FIRST_PAYDAY = new Date(2026, 0, 9);
const CYCLE_DAYS = 14;

function getPayCycleIndex(date) {
  const d = startOfDay(date);
  const diff = differenceInCalendarDays(d, FIRST_PAYDAY);
  return Math.floor(diff / CYCLE_DAYS);
}

function getPeriodForDate(date) {
  const index = getPayCycleIndex(date);
  const startDate = addDays(FIRST_PAYDAY, index * CYCLE_DAYS);
  const endDate = addDays(startDate, CYCLE_DAYS - 1);
  return { index, startDate, endDate, payDate: startDate };
}

function formatLabel(startDate, endDate) {
  const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
  const startDay = startDate.getDate();
  const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
  const endDay = endDate.getDate();
  if (startMonth === endMonth) return `${startMonth} ${startDay} - ${endDay}`;
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}

async function ensurePeriod(userId, window, cache) {
  const key = `${window.startDate.toISOString()}|${window.endDate.toISOString()}`;
  if (cache.has(key)) return cache.get(key);

  let period = await prisma.period.findFirst({
    where: {
      userId,
      startDate: window.startDate,
      endDate: window.endDate,
    },
  });

  if (!period) {
    period = await prisma.period.create({
      data: {
        userId,
        label: formatLabel(window.startDate, window.endDate),
        payDate: window.payDate,
        startDate: window.startDate,
        endDate: window.endDate,
        openingCash: 0,
        status: 'OPEN',
      },
    });
  }

  cache.set(key, period);
  return period;
}

async function main() {
  const user = await prisma.user.findFirst({
    where: { name: 'Personal' },
    orderBy: { createdAt: 'asc' },
  });

  if (!user) {
    console.log('No user found; nothing to repair.');
    return;
  }

  const entries = await prisma.ledgerEntry.findMany({
    where: { userId: user.id },
    orderBy: { date: 'asc' },
    select: { id: true, date: true, periodId: true },
  });

  if (entries.length === 0) {
    console.log('No ledger entries found; nothing to repair.');
    return;
  }

  const periodCache = new Map();
  let moved = 0;

  for (const entry of entries) {
    const window = getPeriodForDate(entry.date);
    const correctPeriod = await ensurePeriod(user.id, window, periodCache);

    if (entry.periodId !== correctPeriod.id) {
      await prisma.ledgerEntry.update({
        where: { id: entry.id },
        data: { periodId: correctPeriod.id },
      });
      moved += 1;
    }
  }

  const usedPeriodIds = new Set(
    (await prisma.ledgerEntry.findMany({
      where: { userId: user.id },
      select: { periodId: true },
      distinct: ['periodId'],
    })).map((x) => x.periodId)
  );

  const allPeriods = await prisma.period.findMany({
    where: { userId: user.id },
    select: { id: true },
  });

  const removableIds = allPeriods
    .map((p) => p.id)
    .filter((id) => !usedPeriodIds.has(id));

  if (removableIds.length > 0) {
    await prisma.period.deleteMany({
      where: { id: { in: removableIds } },
    });
  }

  console.log(`Repaired period assignments for ${entries.length} entries.`);
  console.log(`Moved entries: ${moved}`);
  console.log(`Removed empty periods: ${removableIds.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
