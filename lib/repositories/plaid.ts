import { prisma } from '@/lib/db';
import { Prisma, type ImportedTransactionReviewStatus } from '@prisma/client';
import { decryptSensitiveValue, encryptSensitiveValue } from '@/lib/security/field-encryption';

export async function getPlaidConnectionForUser(userId: string) {
  const connection = await prisma.plaidConnection.findUnique({
    where: { userId },
  });

  if (!connection) {
    return null;
  }

  const accessToken = decryptSensitiveValue(connection.accessToken);
  const cursor = connection.cursor ? decryptSensitiveValue(connection.cursor) : null;

  if (accessToken !== connection.accessToken || cursor !== connection.cursor) {
    await prisma.plaidConnection.update({
      where: { userId },
      data: {
        accessToken: encryptSensitiveValue(accessToken),
        cursor: cursor ? encryptSensitiveValue(cursor) : null,
      },
    });
  }

  return {
    ...connection,
    accessToken,
    cursor,
  };
}

export async function upsertPlaidConnection(input: {
  userId: string;
  itemId: string;
  accessToken: string;
  institutionName?: string;
}) {
  return prisma.plaidConnection.upsert({
    where: { userId: input.userId },
    update: {
      itemId: input.itemId,
      accessToken: encryptSensitiveValue(input.accessToken),
      institutionName: input.institutionName,
    },
    create: {
      userId: input.userId,
      itemId: input.itemId,
      accessToken: encryptSensitiveValue(input.accessToken),
      institutionName: input.institutionName,
    },
  });
}

export async function updatePlaidCursor(userId: string, cursor: string | null) {
  return prisma.plaidConnection.updateMany({
    where: { userId },
    data: { cursor: cursor ? encryptSensitiveValue(cursor) : null },
  });
}

export async function upsertImportedTransactions(input: {
  userId: string;
  plaidItemId: string;
  transactions: Array<{
    plaidTransactionId: string;
    plaidAccountId: string;
    date: Date;
    amount: number;
    merchantName?: string;
    name: string;
    pending: boolean;
    categoryId: string;
    reviewStatus?: ImportedTransactionReviewStatus;
    includeInRaf?: boolean;
  }>;
}) {
  for (const tx of input.transactions) {
    await prisma.importedBankTransaction.upsert({
      where: { plaidTransactionId: tx.plaidTransactionId },
      update: {
        plaidAccountId: tx.plaidAccountId,
        date: tx.date,
        amount: new Prisma.Decimal(tx.amount),
        merchantName: tx.merchantName,
        name: tx.name,
        pending: tx.pending,
      },
      create: {
        userId: input.userId,
        plaidItemId: input.plaidItemId,
        plaidTransactionId: tx.plaidTransactionId,
        plaidAccountId: tx.plaidAccountId,
        date: tx.date,
        amount: new Prisma.Decimal(tx.amount),
        merchantName: tx.merchantName,
        name: tx.name,
        pending: tx.pending,
        categoryId: tx.categoryId,
        reviewStatus: tx.reviewStatus ?? 'UNASSIGNED',
        includeInRaf: tx.includeInRaf ?? true,
      },
    });
  }
}

export async function removeImportedTransactionsByPlaidIds(plaidTransactionIds: string[]) {
  if (plaidTransactionIds.length === 0) return { count: 0 };

  return prisma.importedBankTransaction.deleteMany({
    where: {
      plaidTransactionId: {
        in: plaidTransactionIds,
      },
    },
  });
}

export async function getImportedTransactionsForReview(userId: string) {
  return prisma.importedBankTransaction.findMany({
    where: {
      userId,
      reviewStatus: {
        not: 'CATEGORIZED',
      },
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ pending: 'desc' }, { date: 'desc' }],
    take: 80,
  });
}

export async function getIncludedImportedTransactionsForDateRange(
  userId: string,
  startDate: Date,
  endDate: Date
) {
  return prisma.importedBankTransaction.findMany({
    where: {
      userId,
      includeInRaf: true,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      id: true,
      amount: true,
      categoryId: true,
      pending: true,
      reviewStatus: true,
      date: true,
      name: true,
    },
  });
}

export async function updateImportedTransactionReview(input: {
  userId: string;
  transactionId: string;
  reviewStatus: ImportedTransactionReviewStatus;
  includeInRaf: boolean;
  categoryId?: string;
}) {
  return prisma.importedBankTransaction.updateMany({
    where: {
      id: input.transactionId,
      userId: input.userId,
    },
    data: {
      reviewStatus: input.reviewStatus,
      includeInRaf: input.includeInRaf,
      categoryId: input.categoryId,
    },
  });
}
