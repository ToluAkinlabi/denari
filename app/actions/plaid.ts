'use server';

import { CountryCode, Products } from 'plaid';
import { revalidatePath } from 'next/cache';
import * as usersRepo from '@/lib/repositories/users';
import * as categoriesRepo from '@/lib/repositories/categories';
import * as periodsRepo from '@/lib/repositories/periods';
import * as ledgerRepo from '@/lib/repositories/ledger';
import * as plaidRepo from '@/lib/repositories/plaid';
import { createPlaidClient } from '@/lib/plaid/client';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function extractPlaidErrorMessage(error: unknown, fallback: string) {
  const maybeError = error as {
    message?: string;
    response?: {
      data?: {
        error_type?: string;
        error_code?: string;
        error_message?: string;
        display_message?: string | null;
      };
    };
  };

  const plaidData = maybeError.response?.data;
  if (plaidData) {
    const details = [plaidData.error_type, plaidData.error_code, plaidData.error_message]
      .filter((value): value is string => Boolean(value && value.trim().length > 0))
      .join(' - ');

    if (details) {
      return `${fallback}: ${details}`;
    }
  }

  const message = maybeError.message?.trim();
  if (message) {
    return `${fallback}: ${message}`;
  }

  return fallback;
}

async function ensureUnassignedCategory(userId: string) {
  const existing = await categoriesRepo.getCategoryByName(userId, 'Unassigned');
  if (existing) return existing;

  return categoriesRepo.createCategory({
    userId,
    name: 'Unassigned',
    type: 'OTHER',
    group: 'ESSENTIAL',
    color: '#6b7280',
    countsAsExpense: true,
    countsAsSavings: false,
    rafPercent: 0,
    icon: 'CircleHelp',
    defaultStrategy: 'UNKNOWN',
    expectedFrequency: 'VARIABLE',
    isDiscretionary: false,
  });
}

export async function getPlaidConnectionStatus(userId?: string): Promise<ApiResponse<{ connected: boolean; institutionName?: string }>> {
  try {
    const resolvedUserId = await usersRepo.resolveUserId(userId);
    const connection = await plaidRepo.getPlaidConnectionForUser(resolvedUserId);

    return {
      success: true,
      data: {
        connected: !!connection,
        institutionName: connection?.institutionName ?? undefined,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}

export async function createPlaidLinkToken(userId?: string): Promise<ApiResponse<{ linkToken: string }>> {
  try {
    const resolvedUserId = await usersRepo.resolveUserId(userId);
    const client = createPlaidClient();
    const redirectUri = process.env.PLAID_REDIRECT_URI?.trim();
    const webhook = process.env.PLAID_WEBHOOK_URL?.trim();

    const response = await client.linkTokenCreate({
      user: { client_user_id: resolvedUserId },
      client_name: 'Ledge',
      language: 'en',
      country_codes: [CountryCode.Us],
      products: [Products.Transactions],
      ...(redirectUri ? { redirect_uri: redirectUri } : {}),
      ...(webhook ? { webhook } : {}),
    });

    return {
      success: true,
      data: {
        linkToken: response.data.link_token,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: extractPlaidErrorMessage(error, 'Could not create Plaid link token'),
    };
  }
}

export async function exchangePlaidPublicToken(input: {
  publicToken: string;
  institutionName?: string;
  userId?: string;
}): Promise<ApiResponse<{ connected: boolean }>> {
  try {
    const resolvedUserId = await usersRepo.resolveUserId(input.userId);
    const client = createPlaidClient();

    const exchange = await client.itemPublicTokenExchange({
      public_token: input.publicToken,
    });

    await plaidRepo.upsertPlaidConnection({
      userId: resolvedUserId,
      itemId: exchange.data.item_id,
      accessToken: exchange.data.access_token,
      institutionName: input.institutionName,
    });

    return {
      success: true,
      data: {
        connected: true,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: extractPlaidErrorMessage(error, 'Could not connect bank account'),
    };
  }
}

export async function syncPlaidTransactions(userId?: string): Promise<ApiResponse<{ added: number; modified: number; removed: number }>> {
  try {
    const resolvedUserId = await usersRepo.resolveUserId(userId);
    const connection = await plaidRepo.getPlaidConnectionForUser(resolvedUserId);

    if (!connection) {
      return {
        success: false,
        error: 'No Plaid connection found. Connect a bank first.',
      };
    }

    const client = createPlaidClient();
    const unassignedCategory = await ensureUnassignedCategory(resolvedUserId);

    let cursor = connection.cursor ?? null;
    let hasMore = true;
    let addedCount = 0;
    let modifiedCount = 0;
    let removedCount = 0;

    while (hasMore) {
      const response = await client.transactionsSync({
        access_token: connection.accessToken,
        cursor: cursor ?? undefined,
        count: 100,
      });

      const payload = response.data;

      const toUpsert = [
        ...payload.added.map((tx) => ({
          plaidTransactionId: tx.transaction_id,
          plaidAccountId: tx.account_id,
          date: new Date(tx.date),
          amount: Number(tx.amount),
          merchantName: tx.merchant_name ?? undefined,
          name: tx.name,
          pending: tx.pending,
          categoryId: unassignedCategory.id,
          reviewStatus: 'UNASSIGNED' as const,
          includeInRaf: true,
        })),
        ...payload.modified.map((tx) => ({
          plaidTransactionId: tx.transaction_id,
          plaidAccountId: tx.account_id,
          date: new Date(tx.date),
          amount: Number(tx.amount),
          merchantName: tx.merchant_name ?? undefined,
          name: tx.name,
          pending: tx.pending,
          categoryId: unassignedCategory.id,
          reviewStatus: 'UNASSIGNED' as const,
          includeInRaf: true,
        })),
      ];

      if (toUpsert.length > 0) {
        await plaidRepo.upsertImportedTransactions({
          userId: resolvedUserId,
          plaidItemId: connection.itemId,
          transactions: toUpsert,
        });
      }

      const removedIds = payload.removed.map((tx) => tx.transaction_id);
      if (removedIds.length > 0) {
        await plaidRepo.removeImportedTransactionsByPlaidIds(removedIds);
      }

      addedCount += payload.added.length;
      modifiedCount += payload.modified.length;
      removedCount += payload.removed.length;

      cursor = payload.next_cursor;
      hasMore = payload.has_more;
    }

    await plaidRepo.updatePlaidCursor(resolvedUserId, cursor);

    revalidatePath('/');
    revalidatePath('/raf');
    revalidatePath('/transactions');

    return {
      success: true,
      data: {
        added: addedCount,
        modified: modifiedCount,
        removed: removedCount,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: extractPlaidErrorMessage(error, 'Could not sync transactions'),
    };
  }
}

export async function getBankReviewQueue(userId?: string): Promise<ApiResponse<{ transactions: Array<{ id: string; date: string; amount: string; name: string; merchantName?: string; pending: boolean; reviewStatus: string; categoryId?: string; categoryName?: string; includeInRaf: boolean; duplicateCategoryCounts: Array<{ categoryId: string; categoryName: string; count: number }> }>; categories: Array<{ id: string; name: string }> }>> {
  try {
    const resolvedUserId = await usersRepo.resolveUserId(userId);
    const [transactions, categories] = await Promise.all([
      plaidRepo.getImportedTransactionsForReview(resolvedUserId),
      categoriesRepo.getCategoryForecastSettingsForUser(resolvedUserId),
    ]);
    const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
    const periodCountsCache = new Map<string, Map<string, number>>();

    const transactionsWithDuplicates = await Promise.all(
      transactions.map(async (tx) => {
        const period = await periodsRepo.getPeriodForDateAndUser(resolvedUserId, tx.date);
        if (!period) {
          return {
            ...tx,
            duplicateCategoryCounts: [],
          };
        }

        let categoryCounts = periodCountsCache.get(period.id);
        if (!categoryCounts) {
          const periodEntries = await ledgerRepo.getLedgerEntriesForPeriod(period.id);
          categoryCounts = periodEntries.reduce((counts, entry) => {
            if (entry.categoryId) {
              counts.set(entry.categoryId, (counts.get(entry.categoryId) ?? 0) + 1);
            }
            return counts;
          }, new Map<string, number>());
          periodCountsCache.set(period.id, categoryCounts);
        }

        return {
          ...tx,
          duplicateCategoryCounts: [...categoryCounts.entries()]
            .filter(([, count]) => count > 0)
            .map(([categoryId, count]) => ({
              categoryId,
              categoryName: categoryNameById.get(categoryId) ?? 'Unknown',
              count,
            })),
        };
      })
    );

    return {
      success: true,
      data: {
        transactions: transactionsWithDuplicates.map((tx) => ({
          id: tx.id,
          date: tx.date.toISOString(),
          amount: tx.amount.toFixed(2),
          name: tx.name,
          merchantName: tx.merchantName ?? undefined,
          pending: tx.pending,
          reviewStatus: tx.reviewStatus,
          categoryId: tx.categoryId ?? undefined,
          categoryName: tx.category?.name ?? undefined,
          includeInRaf: tx.includeInRaf,
          duplicateCategoryCounts: tx.duplicateCategoryCounts,
        })),
        categories: categories
          .filter((category) => category.type !== 'INCOME')
          .map((category) => ({ id: category.id, name: category.name })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Could not load bank review queue: ${(error as Error).message}`,
    };
  }
}

export async function categorizeImportedTransaction(input: {
  transactionId: string;
  categoryId: string;
  userId?: string;
}): Promise<ApiResponse<{ updated: boolean }>> {
  try {
    const resolvedUserId = await usersRepo.resolveUserId(input.userId);

    const result = await plaidRepo.updateImportedTransactionReview({
      userId: resolvedUserId,
      transactionId: input.transactionId,
      reviewStatus: 'CATEGORIZED',
      includeInRaf: true,
      categoryId: input.categoryId,
    });

    revalidatePath('/');
    revalidatePath('/raf');
    revalidatePath('/transactions');

    return {
      success: true,
      data: {
        updated: result.count > 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Could not categorize transaction: ${(error as Error).message}`,
    };
  }
}

export async function skipImportedTransaction(input: {
  transactionId: string;
  userId?: string;
}): Promise<ApiResponse<{ updated: boolean }>> {
  try {
    const resolvedUserId = await usersRepo.resolveUserId(input.userId);

    const result = await plaidRepo.updateImportedTransactionReview({
      userId: resolvedUserId,
      transactionId: input.transactionId,
      reviewStatus: 'SKIPPED',
      includeInRaf: false,
      categoryId: undefined,
    });

    revalidatePath('/');
    revalidatePath('/raf');
    revalidatePath('/transactions');

    return {
      success: true,
      data: {
        updated: result.count > 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Could not skip transaction: ${(error as Error).message}`,
    };
  }
}

export async function restoreImportedTransaction(input: {
  transactionId: string;
  userId?: string;
}): Promise<ApiResponse<{ updated: boolean }>> {
  try {
    const resolvedUserId = await usersRepo.resolveUserId(input.userId);
    const unassigned = await ensureUnassignedCategory(resolvedUserId);

    const result = await plaidRepo.updateImportedTransactionReview({
      userId: resolvedUserId,
      transactionId: input.transactionId,
      reviewStatus: 'UNASSIGNED',
      includeInRaf: true,
      categoryId: unassigned.id,
    });

    revalidatePath('/');
    revalidatePath('/raf');
    revalidatePath('/transactions');

    return {
      success: true,
      data: {
        updated: result.count > 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Could not restore transaction: ${(error as Error).message}`,
    };
  }
}

export async function getImportedSpendingForCurrentPeriod(userId?: string): Promise<ApiResponse<{ amount: string }>> {
  try {
    const resolvedUserId = await usersRepo.resolveUserId(userId);
    const currentPeriod = await periodsRepo.getCurrentPeriodForUser(resolvedUserId);

    if (!currentPeriod) {
      return {
        success: false,
        error: 'No current period found.',
      };
    }

    const imported = await plaidRepo.getIncludedImportedTransactionsForDateRange(
      resolvedUserId,
      currentPeriod.startDate,
      currentPeriod.endDate
    );

    const total = imported.reduce((sum, tx) => sum + Number(tx.amount), 0);

    return {
      success: true,
      data: {
        amount: total.toFixed(2),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Could not read imported spending: ${(error as Error).message}`,
    };
  }
}
