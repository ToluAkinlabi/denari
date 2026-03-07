/**
 * Savings Allocations Repository
 *
 * Database access layer for savings allocations.
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Get allocations for a savings entry
 */
export async function getAllocationsForEntry(ledgerEntryId: string) {
  return prisma.savingsAllocation.findMany({
    where: { ledgerEntryId },
  });
}

/**
 * Get all allocations for a user
 */
export async function getAllocationsForUser(userId: string) {
  return prisma.savingsAllocation.findMany({
    where: { userId },
    include: {
      ledgerEntry: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get allocations by bucket for a user
 */
export async function getAllocationsByBucket(userId: string, bucket: string) {
  return prisma.savingsAllocation.findMany({
    where: { userId, bucket },
    include: { ledgerEntry: true },
  });
}

/**
 * Create allocation
 */
export async function createAllocation(
  data:
    | Prisma.SavingsAllocationCreateInput
    | Prisma.SavingsAllocationUncheckedCreateInput
) {
  return prisma.savingsAllocation.create({
    data,
  });
}

/**
 * Create multiple allocations
 */
export async function createManyAllocations(
  data: Prisma.SavingsAllocationCreateManyInput[]
) {
  return prisma.savingsAllocation.createMany({
    data,
  });
}

/**
 * Delete allocations for an entry
 */
export async function deleteAllocationsForEntry(ledgerEntryId: string) {
  return prisma.savingsAllocation.deleteMany({
    where: { ledgerEntryId },
  });
}

/**
 * Get total allocation amount by bucket for a user
 */
export async function getTotalByBucket(userId: string, bucket: string) {
  const result = await prisma.savingsAllocation.aggregate({
    where: { userId, bucket },
    _sum: {
      amount: true,
    },
  });

  return result._sum.amount || new Decimal(0);
}

/**
 * Get all unique buckets for a user
 */
export async function getBucketsForUser(userId: string) {
  const allocations = await prisma.savingsAllocation.findMany({
    where: { userId },
    select: { bucket: true },
    distinct: ['bucket'],
  });

  return allocations.map((a) => a.bucket);
}

/**
 * Get all allocations grouped by bucket for a user
 * Used for dashboard and reports
 */
export async function getAllBucketsForUser(userId: string) {
  return prisma.savingsAllocation.findMany({
    where: { userId },
    select: {
      bucket: true,
      amount: true,
    },
  });
}
