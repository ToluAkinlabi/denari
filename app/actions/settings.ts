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

    return {
      success: true,
      data: categories,
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
