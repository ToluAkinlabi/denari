import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function getRafTransfersForPeriod(userId: string, periodId: string) {
  return prisma.rafTransfer.findMany({
    where: { userId, periodId },
    orderBy: { createdAt: 'asc' },
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
