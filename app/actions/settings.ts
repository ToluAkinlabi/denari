'use server';

import { revalidatePath } from 'next/cache';
import * as usersRepo from '@/lib/repositories/users';
import * as categoriesRepo from '@/lib/repositories/categories';
import type { ForecastStrategy } from '@prisma/client';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
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
    const resolvedUserId = await usersRepo.resolveUserId(userId);
    const categories = await categoriesRepo.getCategoryForecastSettingsForUser(resolvedUserId);
    const initialRafTotal = categories.reduce(
      (sum, category) => sum + Number(category.rafPercent ?? 0),
      0
    );
    const hasConfiguredRaf = initialRafTotal > 0;
    const defaultRafByName: Record<string, number> = {
      Rent: 28,
      Grocery: 5,
      Phone: 4,
      Debt: 10,
      Other: 3,
      Spend: 15,
      Misc: 5,
      Partnership: 15,
      Savings: 10,
      Investment: 5,
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
  income: number;
  userId?: string;
}): Promise<ApiResponse<{ movedPercent: number; fromPercent: number; toPercent: number }>> {
  try {
    const resolvedUserId = await usersRepo.resolveUserId(input.userId);
    const categories = await categoriesRepo.getCategoryForecastSettingsForUser(resolvedUserId);
    const fromCategory = categories.find((item) => item.name === input.fromBucketName);
    const toCategory = categories.find((item) => item.name === input.toBucketName);

    if (!fromCategory || !toCategory) {
      return {
        success: false,
        error: 'Could not find one or both RAF buckets.',
      };
    }

    if (input.income <= 0 || input.transferAmount <= 0) {
      return {
        success: false,
        error: 'Income and transfer amount must be positive.',
      };
    }

    const requestedShiftPercent = (input.transferAmount / input.income) * 100;
    const fromCurrent = Number(fromCategory.rafPercent ?? 0);
    const toCurrent = Number(toCategory.rafPercent ?? 0);
    const effectiveShiftPercent = Math.max(0, Math.min(requestedShiftPercent, fromCurrent));

    if (effectiveShiftPercent <= 0) {
      return {
        success: false,
        error: `${fromCategory.name} has no RAF percentage left to shift.`,
      };
    }

    const nextFrom = Number((fromCurrent - effectiveShiftPercent).toFixed(2));
    const nextTo = Number((toCurrent + effectiveShiftPercent).toFixed(2));

    await categoriesRepo.rebalanceCategoryRafPercentages({
      userId: resolvedUserId,
      fromCategoryId: fromCategory.id,
      toCategoryId: toCategory.id,
      fromPercent: nextFrom,
      toPercent: nextTo,
    });

    revalidatePath('/');
    revalidatePath('/settings');
    revalidatePath('/raf');

    return {
      success: true,
      data: {
        movedPercent: Number(effectiveShiftPercent.toFixed(2)),
        fromPercent: nextFrom,
        toPercent: nextTo,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}
