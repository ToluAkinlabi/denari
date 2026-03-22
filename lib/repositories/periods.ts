/**
 * Period Repository
 *
 * Database access layer for periods.
 * Centralizes all Prisma queries related to periods.
 *
 * Rule: Never query periods directly in UI components.
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { startOfDay } from 'date-fns';
import { formatPeriodLabel, getPeriodForDate } from '@/lib/periods';

function pickBestMatchingPeriod<T extends { startDate: Date; endDate: Date; ledgerEntries: unknown[] }>(
  periods: T[],
  windowStart: Date,
  windowEnd: Date
) {
  if (periods.length === 0) return null;

  let best = periods[0];
  let bestScore = -1;

  for (const period of periods) {
    const hasExactRange =
      period.startDate.getTime() === windowStart.getTime() &&
      period.endDate.getTime() === windowEnd.getTime();
    const entriesCount = period.ledgerEntries.length;
    const score = (hasExactRange ? 100000 : 0) + entriesCount;

    if (score > bestScore) {
      bestScore = score;
      best = period;
    }
  }

  return best;
}

async function computeCarryForwardForPeriod(periodId: string): Promise<Decimal> {
  const period = await prisma.period.findUnique({
    where: { id: periodId },
    include: {
      ledgerEntries: {
        include: {
          category: true,
        },
      },
    },
  });

  if (!period) {
    return new Decimal(0);
  }

  const income = period.ledgerEntries
    .filter((entry) => entry.entryType === 'INCOME')
    .reduce((sum, entry) => sum.plus(entry.amount), new Decimal(0));

  const spending = period.ledgerEntries
    .filter((entry) => entry.category?.countsAsExpense)
    .reduce((sum, entry) => sum.plus(entry.amount), new Decimal(0));

  const savings = period.ledgerEntries
    .filter((entry) => entry.category?.countsAsSavings)
    .reduce((sum, entry) => sum.plus(entry.amount), new Decimal(0));

  // Closing cash = opening cash + income - expenses - savings.
  return period.openingCash.plus(income).minus(spending).minus(savings);
}

/**
 * Get period by ID with all related data
 */
export async function getPeriodById(id: string) {
  return prisma.period.findUnique({
    where: { id },
    include: {
      ledgerEntries: {
        include: {
          category: true,
          savingsAllocations: true,
          notes: true,
        },
        orderBy: { date: 'desc' },
      },
    },
  });
}

/**
 * Get current period for a user
 * Resolves to the period containing today's date
 * Creates the period if it doesn't exist
 */
export async function getCurrentPeriodForUser(userId: string) {
  const today = startOfDay(new Date());
  const todayWindow = getPeriodForDate(today);
  
  // Find all overlapping current periods and pick the best match.
  // This guards against legacy duplicate periods with same human label.
  const existing = await prisma.period.findMany({
    where: {
      userId,
      startDate: { lte: today },
      endDate: { gte: today },
    },
    include: {
      ledgerEntries: {
        include: {
          category: true,
          savingsAllocations: true,
        },
      },
    },
  });

  if (existing.length > 0) {
    return pickBestMatchingPeriod(existing, todayWindow.startDate, todayWindow.endDate);
  }

  // If not found, create it
  return ensurePeriodForDateAndUser(userId, today);
}

/**
 * Get period for a specific date
 */
export async function getPeriodForDateAndUser(userId: string, date: Date) {
  const { startDate, endDate } = getPeriodForDate(date);

  const matches = await prisma.period.findMany({
    where: {
      userId,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    include: {
      ledgerEntries: {
        include: {
          category: true,
          savingsAllocations: true,
        },
      },
    },
  });

  return pickBestMatchingPeriod(matches, startDate, endDate);
}

/**
 * Get all periods for a user in a date range
 */
export async function getPeriodsInRange(
  userId: string,
  startDate: Date,
  endDate: Date
) {
  return prisma.period.findMany({
    where: {
      userId,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    orderBy: { startDate: 'desc' },
    include: {
      ledgerEntries: {
        include: { category: true },
      },
    },
  });
}

/**
 * Get recent periods for a user
 */
export async function getRecentPeriods(userId: string, count: number = 6) {
  return prisma.period.findMany({
    where: { userId },
    orderBy: { startDate: 'desc' },
    take: count,
    include: {
      ledgerEntries: {
        include: { category: true },
      },
    },
  });
}

/**
 * Get most recent period that has at least one ledger entry
 */
export async function getMostRecentPeriodWithEntries(userId: string) {
  return prisma.period.findFirst({
    where: {
      userId,
      ledgerEntries: {
        some: {},
      },
    },
    orderBy: { endDate: 'desc' },
    include: {
      ledgerEntries: {
        include: {
          category: true,
          savingsAllocations: true,
          notes: true,
        },
        orderBy: { date: 'desc' },
      },
    },
  });
}

/**
 * Create a new period
 */
export async function createPeriod(
  data: Prisma.PeriodCreateInput | Prisma.PeriodUncheckedCreateInput
) {
  return prisma.period.create({
    data,
    include: {
      ledgerEntries: true,
    },
  });
}

/**
 * Get or create the period for a specific transaction date.
 * Automatically carries forward the ending balance from the previous period.
 */
export async function ensurePeriodForDateAndUser(userId: string, date: Date) {
  const existing = await getPeriodForDateAndUser(userId, date);
  if (existing) {
    return existing;
  }

  const periodWindow = getPeriodForDate(date);
  
  // Get the previous period to carry forward its ending balance
  const previousPeriod = await prisma.period.findFirst({
    where: {
      userId,
      endDate: {
        lt: periodWindow.startDate, // Period that ends before this one starts
      },
    },
    orderBy: { endDate: 'desc' },
    take: 1,
  });

  // Opening cash = previous period's closing cash, or 0 for the first period.
  let openingCash = new Decimal(0);
  if (previousPeriod && previousPeriod.closingCashActual) {
    openingCash = previousPeriod.closingCashActual;
  } else if (previousPeriod) {
    // Recompute expected closing cash from opening cash plus actual activity.
    const closingCashExpected = await computeCarryForwardForPeriod(previousPeriod.id);
    openingCash = closingCashExpected;

    // Persist computed closing cash on previous period for auditability/reporting.
    await prisma.period.update({
      where: { id: previousPeriod.id },
      data: {
        closingCashExpected,
      },
    });
  } else {
    // Very first period starts from 0 unless manually adjusted later.
    openingCash = new Decimal(0);
  }

  return createPeriod({
    userId,
    label: formatPeriodLabel(periodWindow.startDate, periodWindow.endDate),
    payDate: periodWindow.payDate,
    startDate: periodWindow.startDate,
    endDate: periodWindow.endDate,
    openingCash,
    status: 'OPEN',
  });
}

/**
 * Update period (e.g., reconciliation)
 */
export async function updatePeriod(
  id: string,
  data: Prisma.PeriodUpdateInput
) {
  return prisma.period.update({
    where: { id },
    data,
  });
}

/**
 * Count periods for a user
 */
export async function countUserPeriods(userId: string) {
  return prisma.period.count({
    where: { userId },
  });
}
