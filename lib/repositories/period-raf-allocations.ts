/**
 * Period RAF Allocation Repository
 *
 * Database access layer for per-period RAF percentage overrides.
 * Users set these at the start of each month to dynamically control
 * how income is split across RAF buckets for that month.
 */

import { prisma } from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';

export interface PeriodRafAllocationRecord {
  id: string;
  categoryId: string;
  rafPercent: Decimal;
}

/**
 * Get all RAF allocations for a specific period.
 * Returns an empty array if none are set (caller should fall back to category defaults).
 */
export async function getRafAllocationsForPeriod(
  periodId: string
): Promise<PeriodRafAllocationRecord[]> {
  return prisma.periodRafAllocation.findMany({
    where: { periodId },
    select: { id: true, categoryId: true, rafPercent: true },
  });
}

/**
 * Upsert the full set of RAF allocations for a period.
 * Replaces any existing allocations for the period with the new set.
 * Pass an empty array to clear all overrides (revert to defaults).
 */
export async function setPeriodRafAllocations(
  userId: string,
  periodId: string,
  allocations: Array<{ categoryId: string; rafPercent: number }>
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Remove any existing allocations for this period
    await tx.periodRafAllocation.deleteMany({ where: { periodId } });

    if (allocations.length > 0) {
      await tx.periodRafAllocation.createMany({
        data: allocations.map((a) => ({
          userId,
          periodId,
          categoryId: a.categoryId,
          rafPercent: new Decimal(a.rafPercent),
        })),
      });
    }
  });
}
