import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function getRafTransfersForPeriod(userId: string, periodId: string) {
  return prisma.rafTransfer.findMany({
    where: { userId, periodId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getRafTransfersForPeriodDetailed(userId: string, periodId: string) {
  return prisma.rafTransfer.findMany({
    where: { userId, periodId },
    orderBy: { createdAt: 'asc' },
    include: {
      fromCategory: {
        select: {
          id: true,
          name: true,
        },
      },
      toCategory: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function createRafTransfer(input: {
  userId: string;
  periodId: string;
  fromCategoryId: string;
  toCategoryId: string;
  amount: number;
  note?: string;
}) {
  return prisma.rafTransfer.create({
    data: {
      userId: input.userId,
      periodId: input.periodId,
      fromCategoryId: input.fromCategoryId,
      toCategoryId: input.toCategoryId,
      amount: new Prisma.Decimal(input.amount),
      note: input.note,
    },
  });
}

export async function deleteRafTransferById(userId: string, transferId: string, periodId?: string) {
  const where = periodId
    ? { id: transferId, userId, periodId }
    : { id: transferId, userId };

  return prisma.rafTransfer.deleteMany({
    where,
  });
}
