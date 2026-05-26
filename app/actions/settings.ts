'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { startOfDay } from 'date-fns';
import * as usersRepo from '@/lib/repositories/users';
import * as categoriesRepo from '@/lib/repositories/categories';
import * as periodsRepo from '@/lib/repositories/periods';
import * as ledgerRepo from '@/lib/repositories/ledger';
import * as rafTransfersRepo from '@/lib/repositories/raf-transfers';
import * as plaidRepo from '@/lib/repositories/plaid';
import { calculateIncome } from '@/lib/finance/wealth';
import { applyRafPeriodTransfers, calculateRafPlan } from '@/lib/finance/raf';
import {
  DEMO_MODE_COOKIE,
  createDemoCategoryForecastSettings,
  isDemoModeEnabled,
} from '@/lib/demo-mode';
import type { ForecastStrategy } from '@prisma/client';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function getDemoModeEnabled(): Promise<ApiResponse<{ enabled: boolean }>> {
  return {
    success: true,
    data: { enabled: await isDemoModeEnabled() },
  };
}

export async function setDemoModeEnabled(input: { enabled: boolean }): Promise<ApiResponse<{ enabled: boolean }>> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(DEMO_MODE_COOKIE, input.enabled ? '1' : '0', {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: input.enabled ? 60 * 60 * 24 * 365 : 0,
    });

    revalidatePath('/');
    revalidatePath('/raf');
    revalidatePath('/reports');
    revalidatePath('/periods');
    revalidatePath('/transactions');
    revalidatePath('/settings');

    return { success: true, data: { enabled: input.enabled } };
  } catch (error) {
    return { success: false, error: `Server error: ${(error as Error).message}` };
  }
}

type CategoryForecastSetting = {
  id: string;
  name: string;
  defaultStrategy: ForecastStrategy;
  expectedFrequency: string;
  isDiscretionary: boolean;
  rafPercent: number;
  countsAsExpense: boolean;
  countsAsSavings: boolean;
  type: string;
};

export async function getCategoryForecastSettings(
  userId?: string
): Promise<ApiResponse<CategoryForecastSetting[]>> {
  try {
    if (await isDemoModeEnabled()) {
      return {
        success: true,
        data: createDemoCategoryForecastSettings() as CategoryForecastSetting[],
      };
    }

    const resolvedUserId = await usersRepo.resolveUserId(userId);
    const categories = await categoriesRepo.getCategoryForecastSettingsForUser(resolvedUserId);
    const initialRafTotal = categories.reduce(
      (sum, category) => sum + Number(category.rafPercent ?? 0),
      0
    );
    const hasConfiguredRaf = initialRafTotal > 0;
    const defaultRafByName: Record<string, number> = {
      Rent: 0,
      Grocery: 7,
      Phone: 5,
      Debt: 14,
      Other: 4,
      Spend: 21,
      Misc: 7,
      Partnership: 20,
      Savings: 14,
      Investment: 8,
    };

    return {
      success: true,
      data: categories.map((category) => ({
        ...category,
        rafPercent: hasConfiguredRaf
          ? Number(category.rafPercent ?? 0)
          : defaultRafByName[category.name] ?? Number(category.rafPercent ?? 0),
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}

export async function updateCategoryForecastSetting(input: {
  categoryId: string;
  defaultStrategy: ForecastStrategy;
  expectedFrequency: string;
  isDiscretionary: boolean;
  rafPercent: number;
  userId?: string;
}): Promise<ApiResponse<{ updated: boolean }>> {
  try {
    if (await isDemoModeEnabled()) {
      return { success: true, data: { updated: true } };
    }

    const resolvedUserId = await usersRepo.resolveUserId(input.userId);

    const result = await categoriesRepo.updateCategoryForecastSettings(
      input.categoryId,
      resolvedUserId,
      {
        defaultStrategy: input.defaultStrategy,
        expectedFrequency: input.expectedFrequency,
        isDiscretionary: input.isDiscretionary,
        rafPercent: Math.max(0, Math.min(100, input.rafPercent)),
      }
    );

    revalidatePath('/settings');
    revalidatePath('/');

    return {
      success: true,
      data: { updated: result.count > 0 },
    };
  } catch (error) {
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}

export async function applyRafTransferSuggestion(input: {
  fromBucketName: string;
  toBucketName: string;
  transferAmount: number;
  userId?: string;
}): Promise<ApiResponse<{ movedAmount: number; fromBucketName: string; toBucketName: string }>> {
  try {
    if (await isDemoModeEnabled()) {
      return {
        success: true,
        data: {
          movedAmount: Number(input.transferAmount.toFixed(2)),
          fromBucketName: input.fromBucketName,
          toBucketName: input.toBucketName,
        },
      };
    }

    const resolvedUserId = await usersRepo.resolveUserId(input.userId);
    const currentPeriod = await periodsRepo.getCurrentPeriodForUser(resolvedUserId);
    if (!currentPeriod) {
      return {
        success: false,
        error: 'No current period found.',
      };
    }

    const [categories, currentEntries, importedEntries, existingTransfers] = await Promise.all([
      categoriesRepo.getCategoryForecastSettingsForUser(resolvedUserId),
      ledgerRepo.getLedgerEntriesForPeriod(currentPeriod.id),
      plaidRepo.getIncludedImportedTransactionsForDateRange(
        resolvedUserId,
        startOfDay(currentPeriod.startDate),
        startOfDay(currentPeriod.endDate)
      ),
      rafTransfersRepo.getRafTransfersForPeriod(resolvedUserId, currentPeriod.id),
    ]);

    // Merge imported bank transactions so transfer affordability matches the RAF page.
    const allEntries = [
      ...currentEntries,
      ...importedEntries.map((entry) => ({
        categoryId: entry.categoryId ?? '',
        amount: entry.amount,
        entryType: 'EXPENSE',
      })),
    ];

    const fromCategory = categories.find((item) => item.name === input.fromBucketName);
    const toCategory = categories.find((item) => item.name === input.toBucketName);

    if (!fromCategory || !toCategory) {
      return {
        success: false,
        error: 'Could not find one or both RAF buckets.',
      };
    }

    if (input.transferAmount <= 0) {
      return {
        success: false,
        error: 'Transfer amount must be positive.',
      };
    }

    const currentIncome = calculateIncome(allEntries);
    
    // Use reconciled actual cash for RAF plan if period is anchored, otherwise use opening cash
    const rafCarryForward = currentPeriod.status === 'RECONCILED' && currentPeriod.closingCashActual != null
      ? currentPeriod.closingCashActual
      : currentPeriod.openingCash;
    
    const baseRafPlan = calculateRafPlan({
      income: currentIncome,
      carryForward: rafCarryForward,
      entries: allEntries.map((entry) => ({ categoryId: entry.categoryId, amount: entry.amount })),
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        type: category.type,
        expectedFrequency: category.expectedFrequency,
        countsAsExpense: category.countsAsExpense ?? false,
        countsAsSavings: category.countsAsSavings ?? false,
        rafPercent: category.rafPercent,
      })),
    });

    const rafPlan = applyRafPeriodTransfers(
      baseRafPlan,
      existingTransfers.map((transfer) => ({
        fromCategoryId: transfer.fromCategoryId,
        toCategoryId: transfer.toCategoryId,
        amount: transfer.amount,
      }))
    );

    const fromBucket = rafPlan.buckets.find((bucket) => bucket.categoryId === fromCategory.id);
    const fromSurplus = fromBucket ? Math.max(0, Number(fromBucket.remaining)) : 0;

    if (fromSurplus <= 0) {
      return {
        success: false,
        error: `${fromCategory.name} has no available dollars left to move this period.`,
      };
    }

    if (input.transferAmount > fromSurplus + 0.01) {
      return {
        success: false,
        error: `Max transfer from ${fromCategory.name} is $${fromSurplus.toFixed(2)} based on current surplus.`,
      };
    }

    await rafTransfersRepo.createRafTransfer({
      userId: resolvedUserId,
      periodId: currentPeriod.id,
      fromCategoryId: fromCategory.id,
      toCategoryId: toCategory.id,
      amount: Number(input.transferAmount.toFixed(2)),
    });

    revalidatePath('/');
    revalidatePath('/settings');
    revalidatePath('/raf');

    return {
      success: true,
      data: {
        movedAmount: Number(input.transferAmount.toFixed(2)),
        fromBucketName: fromCategory.name,
        toBucketName: toCategory.name,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}

export async function undoRafTransfer(input: {
  transferId: string;
  userId?: string;
}): Promise<ApiResponse<{ undone: boolean }>> {
  try {
    if (await isDemoModeEnabled()) {
      return { success: true, data: { undone: true } };
    }

    const resolvedUserId = await usersRepo.resolveUserId(input.userId);
    const currentPeriod = await periodsRepo.getCurrentPeriodForUser(resolvedUserId);

    if (!currentPeriod) {
      return {
        success: false,
        error: 'No current period found.',
      };
    }

    const result = await rafTransfersRepo.deleteRafTransferById(
      resolvedUserId,
      input.transferId,
      currentPeriod.id
    );

    if (result.count === 0) {
      return {
        success: false,
        error: 'Transfer not found in the current period.',
      };
    }

    revalidatePath('/');
    revalidatePath('/settings');
    revalidatePath('/raf');

    return {
      success: true,
      data: {
        undone: true,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}
