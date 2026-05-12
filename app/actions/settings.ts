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
