const { PrismaClient } = require('@prisma/client');
const { addDays, differenceInCalendarDays, startOfDay } = require('date-fns');

const prisma = new PrismaClient();

const FIRST_PAYDAY = new Date(2026, 0, 16); // Jan 16, 2026
const CYCLE_LENGTH_DAYS = 14;

function normalizeCycleDate(date) {
  const isUtcMidnight =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0;

  if (isUtcMidnight) {
    return startOfDay(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  return startOfDay(date);
}

function getPayCycleIndex(date) {
  const normalizedDate = normalizeCycleDate(date);
  const normalizedFirstPayday = normalizeCycleDate(FIRST_PAYDAY);
  const daysSinceFirstPayday = differenceInCalendarDays(normalizedDate, normalizedFirstPayday);
  return Math.floor(daysSinceFirstPayday / CYCLE_LENGTH_DAYS);
}

function getPeriodStartDate(cycleIndex) {
  return normalizeCycleDate(addDays(FIRST_PAYDAY, cycleIndex * CYCLE_LENGTH_DAYS));
}

function getPeriodEndDate(cycleIndex) {
  return normalizeCycleDate(addDays(getPeriodStartDate(cycleIndex), CYCLE_LENGTH_DAYS - 1));
}

function formatPeriodLabel(startDate, endDate) {
  const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
  const startDay = startDate.getDate();
  const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
  const endDay = endDate.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}`;
  }

  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}

async function ensurePeriod(userId, date, periodCache) {
  const cycleIndex = getPayCycleIndex(date);
  const startDate = getPeriodStartDate(cycleIndex);
  const endDate = getPeriodEndDate(cycleIndex);
  const key = `${startDate.toISOString()}::${endDate.toISOString()}`;

  if (periodCache.has(key)) {
    return periodCache.get(key);
  }

  let period = await prisma.period.findFirst({
    where: {
      userId,
      startDate,
      endDate,
    },
  });

  if (!period) {
    period = await prisma.period.create({
      data: {
        userId,
        label: formatPeriodLabel(startDate, endDate),
        payDate: startDate,
        startDate,
        endDate,
        openingCash: 0,
        status: 'OPEN',
      },
    });
  }

  periodCache.set(key, period);
  return period;
}

async function realignUserPeriods(userId) {
  const periodCache = new Map();

  const ledgerEntries = await prisma.ledgerEntry.findMany({
    where: { userId },
    select: { id: true, date: true, periodId: true },
  });

  const rafTransfers = await prisma.rafTransfer.findMany({
    where: { userId },
    select: { id: true, createdAt: true, periodId: true },
  });

  let ledgerReassigned = 0;
  for (const entry of ledgerEntries) {
    const targetPeriod = await ensurePeriod(userId, entry.date, periodCache);
    if (entry.periodId !== targetPeriod.id) {
      await prisma.ledgerEntry.update({
        where: { id: entry.id },
        data: { periodId: targetPeriod.id },
      });
      ledgerReassigned += 1;
    }
  }

  let transferReassigned = 0;
  for (const transfer of rafTransfers) {
    const targetPeriod = await ensurePeriod(userId, transfer.createdAt, periodCache);
    if (transfer.periodId !== targetPeriod.id) {
      await prisma.rafTransfer.update({
        where: { id: transfer.id },
        data: { periodId: targetPeriod.id },
      });
      transferReassigned += 1;
    }
  }

  // Ensure current period exists in the new schedule.
  await ensurePeriod(userId, new Date(), periodCache);

  // Update labels/payDate/start/end to canonical formatting on every touched period.
  const touchedPeriods = Array.from(periodCache.values());
  for (const period of touchedPeriods) {
    await prisma.period.update({
      where: { id: period.id },
      data: {
        label: formatPeriodLabel(period.startDate, period.endDate),
        payDate: period.startDate,
      },
    });
  }

  // Remove periods that are now unused.
  const allPeriods = await prisma.period.findMany({
    where: { userId },
    select: { id: true },
  });

  let deletedPeriods = 0;
  for (const period of allPeriods) {
    const usage = await prisma.period.findUnique({
      where: { id: period.id },
      select: {
        _count: {
          select: {
            ledgerEntries: true,
            rafTransfers: true,
          },
        },
      },
    });

    if (usage && usage._count.ledgerEntries === 0 && usage._count.rafTransfers === 0) {
      await prisma.period.delete({ where: { id: period.id } });
      deletedPeriods += 1;
    }
  }

  const currentDate = new Date('2026-05-22T00:00:00');
  const cycleIndex = getPayCycleIndex(currentDate);
  const verificationStart = getPeriodStartDate(cycleIndex);
  const verificationEnd = getPeriodEndDate(cycleIndex);

  return {
    ledgerReassigned,
    transferReassigned,
    deletedPeriods,
    verification: {
      periodNumber: cycleIndex + 1,
      start: verificationStart.toISOString().slice(0, 10),
      end: verificationEnd.toISOString().slice(0, 10),
    },
  };
}

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, name: true } });

  if (users.length === 0) {
    console.log('No users found.');
    return;
  }

  for (const user of users) {
    const result = await realignUserPeriods(user.id);
    console.log(`User ${user.name} (${user.id})`);
    console.log(`  Ledger entries reassigned: ${result.ledgerReassigned}`);
    console.log(`  RAF transfers reassigned: ${result.transferReassigned}`);
    console.log(`  Empty periods deleted: ${result.deletedPeriods}`);
    console.log(
      `  Verification (2026-05-22): Period #${result.verification.periodNumber} (${result.verification.start} to ${result.verification.end})`
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
