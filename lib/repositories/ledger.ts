/**
 * Ledger Repository
 *
 * Database access layer for ledger entries (transactions).
 * Centralizes all Prisma queries related to ledger entries.
 *
 * Rule: Never query ledger entries directly in UI components.
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

type LedgerEntryType =
  | 'INCOME'
  | 'EXPENSE'
  | 'TRANSFER'
  | 'SUMMARY_ENTRY'
  | 'ADJUSTMENT';

/**
 * Get ledger entry by ID
 */
export async function getLedgerEntryById(id: string) {
  return prisma.ledgerEntry.findUnique({
    where: { id },
    include: {
      category: true,
      savingsAllocations: true,
      notes: true,
    },
  });
}

/**
 * Get all ledger entries for a period
 */
export async function getLedgerEntriesForPeriod(periodId: string) {
  return prisma.ledgerEntry.findMany({
    where: { periodId },
    include: {
      category: true,
      savingsAllocations: true,
      notes: true,
    },
    orderBy: { date: 'desc' },
  });
}

/**
 * Get ledger entries by type for a period
 */
export async function getLedgerEntriesByType(
  periodId: string,
  type: LedgerEntryType
) {
  return prisma.ledgerEntry.findMany({
    where: { periodId, entryType: type },
    include: { category: true },
    orderBy: { date: 'desc' },
  });
}

/**
 * Get ledger entries for a category
 */
export async function getLedgerEntriesByCategory(
  periodId: string,
  categoryId: string
) {
  return prisma.ledgerEntry.findMany({
    where: { periodId, categoryId },
    include: { category: true },
    orderBy: { date: 'desc' },
  });
}

/**
 * Get recent ledger entries for a user
 */
export async function getRecentLedgerEntries(
  userId: string,
  limit: number = 20
) {
  return prisma.ledgerEntry.findMany({
    where: { userId },
    include: {
      category: true,
      period: true,
      savingsAllocations: true,
    },
    orderBy: { date: 'desc' },
    take: limit,
  });
}

/**
 * Get recent ledger entries for a user/category pair
 */
export async function getRecentLedgerEntriesForCategory(
  userId: string,
  categoryId: string,
  limit: number = 12
) {
  return prisma.ledgerEntry.findMany({
    where: { userId, categoryId },
    orderBy: { date: 'desc' },
    take: limit,
  });
}

/**
 * Get user ledger entries between two dates (inclusive)
 */
export async function getLedgerEntriesForUserDateRange(
  userId: string,
  startDate: Date,
  endDate: Date
) {
  return prisma.ledgerEntry.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      category: true,
    },
    orderBy: { date: 'asc' },
  });
}

/**
 * Create ledger entry (transaction)
 */
export async function createLedgerEntry(
  data: Prisma.LedgerEntryCreateInput | Prisma.LedgerEntryUncheckedCreateInput
) {
  return prisma.ledgerEntry.create({
    data,
    include: {
      category: true,
      savingsAllocations: true,
    },
  });
}

/**
 * Create multiple ledger entries (bulk)
 */
export async function createManyLedgerEntries(
  data: Prisma.LedgerEntryCreateManyInput[]
) {
  return prisma.ledgerEntry.createMany({
    data,
  });
}

/**
 * Update ledger entry
 */
export async function updateLedgerEntry(
  id: string,
  data: Prisma.LedgerEntryUpdateInput
) {
  return prisma.ledgerEntry.update({
    where: { id },
    data,
    include: {
      category: true,
      savingsAllocations: true,
    },
  });
}

/**
 * Delete ledger entry
 */
export async function deleteLedgerEntry(id: string) {
  return prisma.ledgerEntry.delete({
    where: { id },
  });
}

/**
 * Count ledger entries in a period
 */
export async function countEntriesInPeriod(periodId: string) {
  return prisma.ledgerEntry.count({
    where: { periodId },
  });
}

/**
 * Sum amounts for ledger entries (useful for aggregations)
 */
export async function sumLedgerEntries(
  periodId: string,
  where?: Prisma.LedgerEntryWhereInput
) {
  const result = await prisma.ledgerEntry.aggregate({
    where: {
      periodId,
      ...where,
    },
    _sum: {
      amount: true,
    },
  });

  return result._sum.amount || new Decimal(0);
}
