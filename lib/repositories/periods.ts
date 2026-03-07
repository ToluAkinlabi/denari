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
import { getPeriodForDate } from '@/lib/periods';

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
 */
export async function getCurrentPeriodForUser(userId: string) {
  const now = new Date();
  const { startDate, endDate } = getPeriodForDate(now);

  return prisma.period.findFirst({
    where: {
      userId,
      startDate: { lte: now },
      endDate: { gte: now },
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
}

/**
 * Get period for a specific date
 */
export async function getPeriodForDateAndUser(userId: string, date: Date) {
  const { startDate, endDate } = getPeriodForDate(date);

  return prisma.period.findFirst({
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
 * Create a new period
 */
export async function createPeriod(
  data: Prisma.PeriodCreateInput
) {
  return prisma.period.create({
    data,
    include: {
      ledgerEntries: true,
    },
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
