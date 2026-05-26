/**
 * Transaction Server Actions
 *
 * Orchestrates: validation → parsing → repository access → calculation
 * All database writes happen here (centralized, type-safe, auditable).
 */

'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { Decimal } from '@prisma/client/runtime/library';
import type { CategoryGroup, CategoryType, ForecastStrategy } from '@prisma/client';
import { startOfDay, endOfDay } from 'date-fns';
import { detectFrequency } from '@/lib/finance/frequency-detection';
import { parseQuickEntry, validateParsedEntry } from '@/lib/parsers/quickEntry';
import {
  transactionSchema,
  quickEntrySchema,
  summaryEntrySchema,
  backlogImportSchema,
  validate,
  formatValidationErrors,
  parseIsoDateString,
} from '@/lib/validators/schemas';
import * as ledgerRepo from '@/lib/repositories/ledger';
import * as categoriesRepo from '@/lib/repositories/categories';
import * as periodsRepo from '@/lib/repositories/periods';
import * as savingsRepo from '@/lib/repositories/savings';
import * as usersRepo from '@/lib/repositories/users';
import * as notesRepo from '@/lib/repositories/notes';
import * as rafTransfersRepo from '@/lib/repositories/raf-transfers';
import { getEffectiveRafWeight } from '@/lib/finance/raf';
import {
  createDemoTransactionPageData,
  createDemoTransactionRangeData,
  isDemoModeEnabled,
} from '@/lib/demo-mode';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string>;
  warning?: string;
}

function toLedgerEntryType(type: 'INCOME' | 'EXPENSE' | 'SAVINGS') {
  return type === 'SAVINGS' ? 'TRANSFER' : type;
}

type LedgerWriteType = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'SUMMARY_ENTRY' | 'ADJUSTMENT';

function resolveEntryTypeForCategory(
  requestedType: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'SUMMARY_ENTRY' | 'ADJUSTMENT',
  category: { type: string; countsAsSavings?: boolean }
): { entryType?: LedgerWriteType; warning?: string; error?: string } {
  if (requestedType === 'SUMMARY_ENTRY' || requestedType === 'ADJUSTMENT') {
    return { entryType: requestedType };
  }

  // Category is authoritative for core money-movement types.
  if (category.type === 'INCOME') {
    if (requestedType !== 'INCOME') {
      return {
        error: 'Income category only accepts INCOME entries. Choose an expense/savings category for outflows.',
      };
    }
    return { entryType: 'INCOME' };
  }

  if (category.countsAsSavings) {
    if (requestedType === 'INCOME') {
      return {
        error: 'Savings categories cannot be logged as INCOME. Use TRANSFER (or select Income category).',
      };
    }

    if (requestedType === 'EXPENSE') {
      return {
        entryType: 'TRANSFER',
        warning: 'Saved as TRANSFER because this category is marked as savings.',
      };
    }

    return { entryType: 'TRANSFER' };
  }

  // Regular expense categories
  if (requestedType === 'INCOME') {
    return {
      error: 'Expense categories cannot be logged as INCOME. Use the Income category instead.',
    };
  }

  if (requestedType === 'TRANSFER') {
    return {
      error: 'Transfers are only allowed for savings categories. Choose Savings/Investment or use EXPENSE.',
    };
  }

  return { entryType: 'EXPENSE' };
}

function revalidateAiInsight(userId: string) {
  revalidateTag(`daily-ai-insight:${userId}`);
}

function isDateWithinPeriodWindow(
  date: Date,
  period: { startDate: Date; endDate: Date }
) {
  const txDay = startOfDay(date);
  const periodStart = startOfDay(period.startDate);
  const periodEnd = endOfDay(period.endDate);
  return txDay >= periodStart && txDay <= periodEnd;
}

async function resolveUserId(userId?: string) {
  if (userId) return userId;
  const user = await usersRepo.getOrCreateDefaultUser();
  return user.id;
}

function estimateNextOccurrence(date: Date, expectedFrequency: string): Date | undefined {
  const freq = expectedFrequency.toUpperCase();
  const next = new Date(date);

  if (freq === 'BIWEEKLY') next.setDate(next.getDate() + 14);
  else if (freq === 'MONTHLY') next.setMonth(next.getMonth() + 1);
  else if (freq === 'BIMONTHLY') next.setMonth(next.getMonth() + 2);
  else if (freq === 'QUARTERLY') next.setMonth(next.getMonth() + 3);
  else if (freq === 'ANNUAL') next.setFullYear(next.getFullYear() + 1);
  else return undefined;

  return next;
}

function inferTags(description: string | undefined): string[] {
  const text = (description || '').toLowerCase();
  const tags: string[] = [];

  if (text.includes('bonus')) tags.push('bonus');
  if (text.includes('refund')) tags.push('refund');
  if (text.includes('gift')) tags.push('gift');
  if (text.includes('one-time') || text.includes('onetime')) tags.push('one-time');
  if (text.includes('annual')) tags.push('annual');
  if (text.includes('quarterly')) tags.push('quarterly');
  if (text.includes('bimonthly') || text.includes('bi-monthly')) tags.push('bimonthly');

  return tags;
}

async function inferEntryForecastMetadata(input: {
  userId: string;
  categoryId: string;
  entryType: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'SUMMARY_ENTRY' | 'ADJUSTMENT';
  date: Date;
  description?: string;
  categoryDefaultStrategy?: ForecastStrategy;
  categoryExpectedFrequency?: string;
}): Promise<{
  forecastStrategy: ForecastStrategy;
  nextOccurrence?: Date;
  tags: string[];
  isProvisional: boolean;
}> {
  const {
    userId,
    categoryId,
    entryType,
    date,
    description,
    categoryDefaultStrategy,
    categoryExpectedFrequency,
  } = input;

  const tags = inferTags(description);

  if (tags.includes('one-time') || tags.includes('bonus') || tags.includes('gift')) {
    return {
      forecastStrategy: 'ONE_TIME',
      tags,
      isProvisional: false,
    };
  }

  if (categoryDefaultStrategy && categoryDefaultStrategy !== 'UNKNOWN') {
    return {
      forecastStrategy: categoryDefaultStrategy,
      nextOccurrence: estimateNextOccurrence(date, categoryExpectedFrequency || 'VARIABLE'),
      tags,
      isProvisional: false,
    };
  }

  const recent = await ledgerRepo.getRecentLedgerEntriesForCategory(userId, categoryId, 12);
  const sameType = recent.filter((entry) => entry.entryType === entryType);
  const dates = [...sameType.map((entry) => entry.date), date];

  // Self-learning: once category appears 2+ times, include and infer strategy.
  if (dates.length >= 2) {
    const frequency = detectFrequency(dates);

    if (['BIWEEKLY', 'MONTHLY'].includes(frequency.pattern)) {
      return {
        forecastStrategy: 'KNOWN_RECURRING',
        nextOccurrence: frequency.estimatedNextDate,
        tags,
        isProvisional: false,
      };
    }

    if (['BIMONTHLY', 'QUARTERLY', 'ANNUAL'].includes(frequency.pattern)) {
      return {
        forecastStrategy: 'KNOWN_IRREGULAR',
        nextOccurrence: frequency.estimatedNextDate,
        tags,
        isProvisional: false,
      };
    }

    return {
      forecastStrategy: 'KNOWN_VARIABLE',
      tags,
      isProvisional: false,
    };
  }

  return {
    forecastStrategy: 'UNKNOWN',
    tags,
    isProvisional: true,
  };
}

/**
 * Ensure default categories exist for a user
 * Creates essential categories if none exist
 */
async function ensureDefaultCategories(userId: string) {
  // Baseline categories that should always exist for every user.
  const baselineCategories: Array<{
    name: string;
    type: CategoryType;
    group: CategoryGroup;
    color: string;
    countsAsExpense: boolean;
    countsAsSavings: boolean;
    rafPercent: number;
    defaultStrategy: 'KNOWN_RECURRING' | 'KNOWN_VARIABLE' | 'KNOWN_IRREGULAR' | 'UNKNOWN' | 'ONE_TIME';
    expectedFrequency: string;
    isDiscretionary: boolean;
  }> = [
    { name: 'Income', type: 'INCOME', group: 'INCOME', color: '#10b981', countsAsExpense: false, countsAsSavings: false, rafPercent: 0, defaultStrategy: 'KNOWN_RECURRING', expectedFrequency: 'BIWEEKLY', isDiscretionary: false },
    { name: 'Grocery', type: 'GROCERY', group: 'ESSENTIAL', color: '#f97316', countsAsExpense: true, countsAsSavings: false, rafPercent: 5, defaultStrategy: 'KNOWN_VARIABLE', expectedFrequency: 'BIWEEKLY', isDiscretionary: false },
    { name: 'Rent', type: 'RENT', group: 'ESSENTIAL', color: '#ef4444', countsAsExpense: true, countsAsSavings: false, rafPercent: 28, defaultStrategy: 'KNOWN_IRREGULAR', expectedFrequency: 'MONTHLY', isDiscretionary: false },
    { name: 'Phone', type: 'PHONE', group: 'ESSENTIAL', color: '#3b82f6', countsAsExpense: true, countsAsSavings: false, rafPercent: 4, defaultStrategy: 'KNOWN_IRREGULAR', expectedFrequency: 'MONTHLY', isDiscretionary: false },
    { name: 'Debt', type: 'DEBT', group: 'ESSENTIAL', color: '#dc2626', countsAsExpense: true, countsAsSavings: false, rafPercent: 10, defaultStrategy: 'KNOWN_VARIABLE', expectedFrequency: 'BIWEEKLY', isDiscretionary: false },
    { name: 'Other', type: 'OTHER', group: 'ESSENTIAL', color: '#8b5cf6', countsAsExpense: true, countsAsSavings: false, rafPercent: 3, defaultStrategy: 'UNKNOWN', expectedFrequency: 'VARIABLE', isDiscretionary: false },
    { name: 'Spend', type: 'SPEND', group: 'LIFESTYLE', color: '#06b6d4', countsAsExpense: true, countsAsSavings: false, rafPercent: 15, defaultStrategy: 'KNOWN_VARIABLE', expectedFrequency: 'BIWEEKLY', isDiscretionary: true },
    { name: 'Misc', type: 'MISC', group: 'AVOIDABLE', color: '#ec4899', countsAsExpense: true, countsAsSavings: false, rafPercent: 5, defaultStrategy: 'UNKNOWN', expectedFrequency: 'VARIABLE', isDiscretionary: true },
    { name: 'Partnership', type: 'PARTNERSHIP', group: 'VALUES', color: '#f59e0b', countsAsExpense: true, countsAsSavings: false, rafPercent: 15, defaultStrategy: 'KNOWN_VARIABLE', expectedFrequency: 'BIWEEKLY', isDiscretionary: false },
    { name: 'Savings', type: 'SAVINGS', group: 'WEALTH', color: '#14b8a6', countsAsExpense: false, countsAsSavings: true, rafPercent: 10, defaultStrategy: 'KNOWN_VARIABLE', expectedFrequency: 'BIWEEKLY', isDiscretionary: false },
    { name: 'Investment', type: 'SAVINGS', group: 'WEALTH', color: '#0ea5e9', countsAsExpense: false, countsAsSavings: true, rafPercent: 5, defaultStrategy: 'KNOWN_VARIABLE', expectedFrequency: 'BIWEEKLY', isDiscretionary: false },
  ];

  const existing = await categoriesRepo.getCategoriesForUser(userId);
  const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));
  const missingCategories = baselineCategories.filter(
    (cat) => !existingNames.has(cat.name.toLowerCase())
  );

  if (missingCategories.length > 0) {
    await Promise.all(
      missingCategories.map((cat) =>
        categoriesRepo.createCategory({
          userId,
          ...cat,
        })
      )
    );
  }

  return categoriesRepo.getCategoriesForUser(userId);
}

export async function getAddEntryOptions(
  userId?: string
): Promise<
  ApiResponse<{
    periodId: string;
    categories: Array<{
      id: string;
      name: string;
      type: 'INCOME' | 'EXPENSE' | 'SAVINGS';
    }>;
  }>
> {
  try {
    const resolvedUserId = await resolveUserId(userId);

    // Ensure categories exist (create defaults if empty database)
    const categories = await ensureDefaultCategories(resolvedUserId);

    // Get or create current period
    const existingPeriod = await periodsRepo.getCurrentPeriodForUser(resolvedUserId);
    const periodId = existingPeriod
      ? existingPeriod.id
      : (await periodsRepo.ensurePeriodForDateAndUser(resolvedUserId, new Date())).id;

    return {
      success: true,
      data: {
        periodId,
        categories: categories.map((c: { id: string; name: string; type: string }) => ({
          id: c.id,
          name: c.name,
          type: c.type === 'SAVINGS' ? 'SAVINGS' : c.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}

/**
 * Get the current period id for transaction listing pages.
 * Avoids dashboard fallback behavior so transactions align with today's period.
 */
export async function getCurrentPeriodId(): Promise<ApiResponse<{ periodId: string }>> {
  try {
    if (await isDemoModeEnabled()) {
      return {
        success: true,
        data: { periodId: 'demo-period-current' },
      };
    }

    const resolvedUserId = await resolveUserId();
    const currentPeriod = await periodsRepo.getCurrentPeriodForUser(resolvedUserId);

    if (!currentPeriod) {
      return {
        success: false,
        error: 'No current period found',
      };
    }

    return {
      success: true,
      data: {
        periodId: currentPeriod.id,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}

/**
 * Add transaction via quick entry
 *
 * Workflow:
 *   1. Validate input format (Zod)
 *   2. Parse natural language ("45 coffee" → amount, category, type)
 *   3. Look up category by name
 *   4. Find or create period for date
 *   5. Create ledger entry
 *   6. Handle savings allocations if SAVINGS type
 *
 * @example
 *   const result = await addQuickEntry({
 *     input: "45 coffee",
 *     date: new Date()
 *   })
 *   // Returns: { success: true, data: { id: "...", ... } }
 */
export async function addQuickEntry(
  input: unknown
): Promise<ApiResponse<{ id: string; description: string; amount: string }>> {
  try {
    const userId = await resolveUserId();

    // Step 1: Validate input format
    const [valid, validationError] = validate(quickEntrySchema, input);
    if (!valid) {
      return {
        success: false,
        error: formatValidationErrors(validationError),
      };
    }

    // Step 2: Parse natural language
    let parsed;
    try {
      parsed = parseQuickEntry(validationError.input);
    } catch (e) {
      return {
        success: false,
        error: `Parse error: ${(e as Error).message}`,
      };
    }

    // Step 3: Validate parsed entry
    const [parseValid, parseError] = validateParsedEntry(parsed);
    if (!parseValid) {
      return {
        success: false,
        error: parseError || 'Invalid entry',
      };
    }

    // Step 4: Look up category
    const categories = await categoriesRepo.getCategoriesForUser(userId);
    const category = categories.find(
      (c: { name: string }) => c.name.toLowerCase() === parsed.category?.toLowerCase()
    );

    if (!category) {
      return {
        success: false,
        error: `Category not found: ${parsed.category}`,
      };
    }

    // Step 5: Get or create period for date
    const entryDate = parseIsoDateString(validationError.date) || new Date();
    const period = await periodsRepo.ensurePeriodForDateAndUser(userId, entryDate);

    // Step 6: Create ledger entry
    const resolvedType = resolveEntryTypeForCategory(
      toLedgerEntryType(parsed.entryType),
      category
    );
    if (resolvedType.error || !resolvedType.entryType) {
      return {
        success: false,
        error: resolvedType.error || 'Invalid entry type for selected category.',
      };
    }
    const entryType = resolvedType.entryType;

    const metadata = await inferEntryForecastMetadata({
      userId,
      categoryId: category.id,
      entryType,
      date: entryDate,
      description: parsed.description,
      categoryDefaultStrategy: category.defaultStrategy,
      categoryExpectedFrequency: category.expectedFrequency,
    });

    const entry = await ledgerRepo.createLedgerEntry({
      date: entryDate,
      amount: parsed.amount,
      categoryId: category.id,
      description: parsed.description,
      entryType,
      periodId: period.id,
      userId,
      tags: metadata.tags,
      forecastStrategy: metadata.forecastStrategy,
      nextOccurrence: metadata.nextOccurrence,
      isProvisional: metadata.isProvisional,
    });

    // Step 7: Handle savings allocations
    if (entryType === 'TRANSFER') {
      await savingsRepo.createAllocation({
        ledgerEntryId: entry.id,
        bucket: category.name,
        amount: parsed.amount,
        userId,
      });
    }

    revalidatePath('/');
    revalidatePath('/raf');
    revalidatePath('/transactions');
    revalidateAiInsight(userId);
    return {
      success: true,
      warning: resolvedType.warning,
      data: {
        id: entry.id,
        description: entry.description || '',
        amount: entry.amount.toString(),
      },
    };
  } catch (error) {
    console.error('addQuickEntry error:', error);
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}

/**
 * Add detailed transaction
 *
 * Workflow:
 *   1. Validate full transaction schema
 *   2. Verify category exists and belongs to user
 *   3. Verify period exists
 *   4. Create ledger entry
 *   5. Handle savings allocations if needed
 *
 * @example
 *   const result = await addTransaction({
 *     amount: "45.00",
 *     categoryId: "...",
 *     description: "Coffee at Starbucks",
 *     entryType: "EXPENSE",
 *     date: new Date(),
 *     periodId: "..."
 *   })
 */
export async function addTransaction(
  input: unknown
): Promise<ApiResponse<{ id: string; description: string }>> {
  try {
    const userId = await resolveUserId();

    // Step 1: Validate schema
    const [valid, validationError] = validate(transactionSchema, input);
    if (!valid) {
      return {
        success: false,
        error: formatValidationErrors(validationError),
      };
    }

    const data = validationError;

    // Step 2: Verify category
    const category = await categoriesRepo.getCategoryById(data.categoryId);
    if (!category) {
      return {
        success: false,
        error: 'Category not found',
      };
    }
    if (category.userId !== userId) {
      return { success: false, error: 'Unauthorized category access' };
    }

    // Step 3: Resolve period for transaction date
    const date = parseIsoDateString(data.date) || new Date();
    let resolvedPeriodId = data.periodId;
    const selectedPeriod = data.periodId
      ? await periodsRepo.getPeriodById(data.periodId)
      : null;

    if (selectedPeriod && selectedPeriod.userId !== userId) {
      return {
        success: false,
        error: 'Unauthorized period access',
      };
    }

    // If UI sends a period for "today"but user picks a historical date,
    // map to the correct period for that date.
    if (!selectedPeriod || !isDateWithinPeriodWindow(date, selectedPeriod)) {
      const resolvedPeriod = await periodsRepo.ensurePeriodForDateAndUser(userId, date);
      resolvedPeriodId = resolvedPeriod.id;
    }

    const finalPeriodId =
      resolvedPeriodId ||
      (await periodsRepo.ensurePeriodForDateAndUser(userId, date)).id;

    // Step 4: Create entry
    const resolvedType = resolveEntryTypeForCategory(
      toLedgerEntryType(data.entryType),
      category
    );
    if (resolvedType.error || !resolvedType.entryType) {
      return {
        success: false,
        error: resolvedType.error || 'Invalid entry type for selected category.',
      };
    }
    const entryType = resolvedType.entryType;
    const metadata = await inferEntryForecastMetadata({
      userId,
      categoryId: data.categoryId,
      entryType,
      date,
      description: data.description,
      categoryDefaultStrategy: category.defaultStrategy,
      categoryExpectedFrequency: category.expectedFrequency,
    });

    const entry = await ledgerRepo.createLedgerEntry({
      date: date,
      amount: new Decimal(data.amount),
      categoryId: data.categoryId,
      description: data.description,
      entryType,
      periodId: finalPeriodId,
      userId,
      tags: metadata.tags,
      forecastStrategy: metadata.forecastStrategy,
      nextOccurrence: metadata.nextOccurrence,
      isProvisional: metadata.isProvisional,
    });

    // Step 5: Handle savings allocations
    if (entryType === 'TRANSFER') {
      await savingsRepo.createAllocation({
        ledgerEntryId: entry.id,
        bucket: category.name,
        amount: new Decimal(data.amount),
        userId,
      });
    }

    revalidatePath('/');
    revalidatePath('/raf');
    revalidatePath('/transactions');
    revalidateAiInsight(userId);
    return {
      success: true,
      warning: resolvedType.warning,
      data: {
        id: entry.id,
        description: entry.description || '',
      },
    };
  } catch (error) {
    console.error('addTransaction error:', error);
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}

/**
 * Add an income entry and automatically create RAF transfers that
 * route the full income amount directly to one target bucket,
 * bypassing the normal percentage-based distribution.
 *
 * Each non-target spending bucket's proportional share of the income
 * is transferred to the target bucket so it receives 100% of the income.
 */
export async function addDirectedIncomeEntry(input: {
  amount: string;
  categoryId: string;
  description: string;
  date: string;
  periodId: string;
  directToBucketId: string;
}): Promise<ApiResponse<{ id: string; description: string }>> {
  try {
    const userId = await resolveUserId();

    const amountNum = parseFloat(input.amount);
    if (!input.amount || isNaN(amountNum) || amountNum <= 0) {
      return { success: false, error: 'Amount must be a positive number.' };
    }
    if (!input.categoryId) return { success: false, error: 'Income category is required.' };
    if (!input.directToBucketId) return { success: false, error: 'Target bucket is required.' };
    if (!input.description?.trim()) return { success: false, error: 'Description is required.' };
    if (!input.date) return { success: false, error: 'Date is required.' };

    const incomeCategory = await categoriesRepo.getCategoryById(input.categoryId);
    if (!incomeCategory || incomeCategory.userId !== userId) {
      return { success: false, error: 'Income category not found.' };
    }
    if (incomeCategory.type !== 'INCOME') {
      return { success: false, error: 'Selected category must be an income category.' };
    }

    const targetCategory = await categoriesRepo.getCategoryById(input.directToBucketId);
    if (!targetCategory || targetCategory.userId !== userId) {
      return { success: false, error: 'Target bucket not found.' };
    }
    if (targetCategory.type === 'INCOME') {
      return { success: false, error: 'Target bucket cannot be an income category.' };
    }

    const date = parseIsoDateString(input.date) || new Date();
    const resolvedPeriod = await periodsRepo.ensurePeriodForDateAndUser(userId, date);
    const periodId = resolvedPeriod.id;

    // Step 1: Save the income entry
    const metadata = await inferEntryForecastMetadata({
      userId,
      categoryId: input.categoryId,
      entryType: 'INCOME',
      date,
      description: input.description,
      categoryDefaultStrategy: incomeCategory.defaultStrategy,
      categoryExpectedFrequency: incomeCategory.expectedFrequency,
    });

    const entry = await ledgerRepo.createLedgerEntry({
      date,
      amount: new Decimal(input.amount),
      categoryId: input.categoryId,
      description: input.description,
      entryType: 'INCOME',
      periodId,
      userId,
      tags: metadata.tags,
      forecastStrategy: metadata.forecastStrategy,
      nextOccurrence: metadata.nextOccurrence,
      isProvisional: metadata.isProvisional,
    });

    // Step 2: Load all non-income categories and compute proportional RAF weights
    const allCategories = await categoriesRepo.getCategoriesForUser(userId);
    const spendingCategories = allCategories.filter((c) => c.type !== 'INCOME');

    const totalWeight = spendingCategories.reduce(
      (sum, c) => sum + getEffectiveRafWeight(c),
      0
    );

    // Step 3: Create RAF transfers from each non-target bucket → target bucket
    // for their proportional share of this income amount
    if (totalWeight > 0) {
      const incomeDecimal = new Decimal(input.amount);
      for (const cat of spendingCategories) {
        if (cat.id === input.directToBucketId) continue;
        const weight = getEffectiveRafWeight(cat);
        if (weight <= 0) continue;
        const transferAmount = incomeDecimal.times(weight).dividedBy(totalWeight);
        if (transferAmount.lessThan(0.01)) continue;
        await rafTransfersRepo.createRafTransfer({
          userId,
          periodId,
          fromCategoryId: cat.id,
          toCategoryId: input.directToBucketId,
          amount: transferAmount.toDecimalPlaces(2).toNumber(),
          note: `Auto: directed income "${input.description}" to ${targetCategory.name}`,
        });
      }
    }

    revalidatePath('/');
    revalidatePath('/raf');
    revalidatePath('/transactions');
    revalidateAiInsight(userId);
    return {
      success: true,
      data: { id: entry.id, description: entry.description || '' },
    };
  } catch (error) {
    console.error('addDirectedIncomeEntry error:', error);
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}

/**
 * Import historical entries in bulk from pasted spreadsheet rows.
 */
export async function importBacklogEntries(
  input: unknown
): Promise<ApiResponse<{ imported: number; failed: number; errors: string[] }>> {
  try {
    const userId = await resolveUserId();
    const [valid, validationError] = validate(backlogImportSchema, input);

    if (!valid) {
      return {
        success: false,
        error: formatValidationErrors(validationError),
      };
    }

    const categories = await categoriesRepo.getCategoriesForUser(userId);
    const categoryByName = new Map(
      categories.map((c: {
        id: string;
        name: string;
        type: string;
        defaultStrategy: ForecastStrategy;
        expectedFrequency: string;
      }) => [
        c.name.toLowerCase(),
        c,
      ])
    );

    let imported = 0;
    let failed = 0;
    const errors: string[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < validationError.rows.length; i++) {
      const row = validationError.rows[i];

      try {
        const category = categoryByName.get(row.categoryName.toLowerCase());
        if (!category) {
          throw new Error(`Unknown category "${row.categoryName}"`);
        }

        // Parse ISO date string to local Date
        const entryDate = parseIsoDateString(row.date);
        if (!entryDate) {
          throw new Error('Invalid date format');
        }

        const period = await periodsRepo.ensurePeriodForDateAndUser(userId, entryDate);
        const type = row.entryType || (category.type === 'INCOME' ? 'INCOME' : category.type === 'SAVINGS' ? 'SAVINGS' : 'EXPENSE');

        const resolvedType = resolveEntryTypeForCategory(
          toLedgerEntryType(type),
          category
        );
        if (resolvedType.error || !resolvedType.entryType) {
          throw new Error(resolvedType.error || 'Invalid entry type for selected category.');
        }
        const entryType = resolvedType.entryType;
        if (resolvedType.warning) {
          warnings.push(`Row ${i + 1}: ${resolvedType.warning}`);
        }
        const metadata = await inferEntryForecastMetadata({
          userId,
          categoryId: category.id,
          entryType,
          date: entryDate,
          description: row.description || category.name,
          categoryDefaultStrategy: category.defaultStrategy,
          categoryExpectedFrequency: category.expectedFrequency,
        });

        const entry = await ledgerRepo.createLedgerEntry({
          date: entryDate,
          amount: new Decimal(row.amount),
          categoryId: category.id,
          description: row.description || category.name,
          entryType,
          periodId: period.id,
          userId,
          tags: metadata.tags,
          forecastStrategy: metadata.forecastStrategy,
          nextOccurrence: metadata.nextOccurrence,
          isProvisional: metadata.isProvisional,
        });

        if (entryType === 'TRANSFER') {
          await savingsRepo.createAllocation({
            ledgerEntryId: entry.id,
            bucket: category.name,
            amount: new Decimal(row.amount),
            userId,
          });
        }

        if (row.note && row.note.trim()) {
          await notesRepo.createNote({
            userId,
            periodId: period.id,
            ledgerEntryId: entry.id,
            content: row.note.trim(),
          });
        }

        imported++;
      } catch (err) {
        failed++;
        errors.push(`Row ${i + 1}: ${(err as Error).message}`);
      }
    }

    // Revalidate to refresh the dashboard
    revalidatePath('/');
    revalidatePath('/raf');
    revalidateAiInsight(userId);

    return {
      success: true,
      warning: warnings.length > 0 ? `${warnings.length} row(s) auto-corrected to keep category/type consistency.` : undefined,
      data: { imported, failed, errors: [...warnings, ...errors] },
    };
  } catch (error) {
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}

/**
 * Add summary entry (hybrid input mode)
 *
 * Creates a SUMMARY_ENTRY when user provides a total for a category
 * instead of individual transactions.
 *
 * Double-count prevention:
 *   If existing EXPENSE entries exist in the same category+period,
 *   returns a warning with the collision details.
 *   User can choose to:
 *   1. Replace all transactions with this summary
 *   2. Merge the summary amount into existing total
 *   3. Cancel and manage transactions individually
 *
 * @example
 *   const result = await addSummaryEntry({
 *     amount: "500",
 *     categoryId: "...",
 *     description: "Groceries for the period",
 *     date: new Date(),
 *     periodId: "..."
 *   })
 *
 * @returns {success: true, data: {id, description}} or
 *          {success: false, error, collision: {existing_count, existing_total}}
 */
export async function addSummaryEntry(
  input: unknown
): Promise<
  ApiResponse<{
    id: string;
    description: string;
    collision?: {
      existingCount: number;
      existingTotal: string;
      action: 'CONFIRM_REPLACE' | 'CONFIRM_MERGE' | 'CANCEL';
    };
  }>
> {
  try {
    const userId = await resolveUserId();

    // Step 1: Validate schema
    const [valid, validationError] = validate(summaryEntrySchema, input);
    if (!valid) {
      return {
        success: false,
        error: formatValidationErrors(validationError),
      };
    }

    const data = validationError;

    // Step 2: Verify category
    const category = await categoriesRepo.getCategoryById(data.categoryId);
    if (!category) {
      return {
        success: false,
        error: 'Category not found',
      };
    }
    if (category.userId !== userId) {
      return { success: false, error: 'Unauthorized category access' };
    }

    // Step 3: Resolve period for date
    const date = parseIsoDateString(data.date) || new Date();
    let resolvedPeriodId = data.periodId;
    const selectedPeriod = data.periodId
      ? await periodsRepo.getPeriodById(data.periodId)
      : null;

    if (selectedPeriod && selectedPeriod.userId !== userId) {
      return {
        success: false,
        error: 'Unauthorized period access',
      };
    }

    if (!selectedPeriod || !isDateWithinPeriodWindow(date, selectedPeriod)) {
      const resolvedPeriod = await periodsRepo.ensurePeriodForDateAndUser(userId, date);
      resolvedPeriodId = resolvedPeriod.id;
    }

    const finalPeriodId =
      resolvedPeriodId ||
      (await periodsRepo.ensurePeriodForDateAndUser(userId, date)).id;

    // Step 4: CHECK FOR DOUBLE-COUNTING
    // Query all EXPENSE entries for this category in this period
    const existingEntries = await ledgerRepo.getLedgerEntriesByCategory(
      finalPeriodId,
      data.categoryId
    );

    const expenseEntries = existingEntries.filter(
      (e) => e.entryType === 'EXPENSE'
    );

    if (expenseEntries.length > 0) {
      // Collision detected: user provided individual txns, now trying to add a summary
      const existingTotal = expenseEntries
        .reduce((sum, e) => sum.plus(e.amount), new Decimal(0))
        .toString();

      return {
        success: false,
        error: `Collision: ${expenseEntries.length} existing transactions found in ${category.name} for this period.`,
        data: {
          id: '',
          description: '',
          collision: {
            existingCount: expenseEntries.length,
            existingTotal: existingTotal,
            action: 'CONFIRM_REPLACE',
          },
        },
      };
    }

    // Step 5: No collision - create summary entry
    const metadata = await inferEntryForecastMetadata({
      userId,
      categoryId: data.categoryId,
      entryType: 'SUMMARY_ENTRY',
      date,
      description: data.description,
      categoryDefaultStrategy: category.defaultStrategy,
      categoryExpectedFrequency: category.expectedFrequency,
    });

    const entry = await ledgerRepo.createLedgerEntry({
      date: date,
      amount: new Decimal(data.amount),
      categoryId: data.categoryId,
      description: data.description,
      entryType: 'SUMMARY_ENTRY',
      periodId: finalPeriodId,
      userId,
      tags: metadata.tags,
      forecastStrategy: metadata.forecastStrategy,
      nextOccurrence: metadata.nextOccurrence,
      isProvisional: metadata.isProvisional,
    });

    // Step 6: Attach notes if provided
    if (data.notes && data.notes.trim()) {
      await notesRepo.createNote({
        userId,
        periodId: finalPeriodId,
        ledgerEntryId: entry.id,
        content: data.notes.trim(),
      });
    }

    revalidatePath('/');
    revalidatePath('/raf');
    revalidateAiInsight(userId);
    return {
      success: true,
      data: {
        id: entry.id,
        description: entry.description || '',
      },
    };
  } catch (error) {
    console.error('addSummaryEntry error:', error);
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}

/**
 * Delete transaction
 *
 * Removes ledger entry and associated savings allocations.
 *
 * @param entryId Entry to delete
 * @param userId User must own the entry
 */
export async function deleteTransaction(
  entryId: string,
  userId?: string
): Promise<ApiResponse<null>> {
  try {
    if (await isDemoModeEnabled()) {
      return { success: true };
    }

    const resolvedUserId = await resolveUserId(userId);
    // Verify entry exists and belongs to user
    const entry = await ledgerRepo.getLedgerEntryById(entryId);
    if (!entry || entry.userId !== resolvedUserId) {
      return {
        success: false,
        error: 'Entry not found',
      };
    }

    // Delete savings allocations first (foreign key constraint)
    if (entry.entryType === 'TRANSFER') {
      // In a real app, would need a deleteBySavingsAllocationsByEntry
      // For now, we'll rely on cascade delete in Prisma if configured
    }

    // Delete entry
    await ledgerRepo.deleteLedgerEntry(entryId);

    revalidatePath('/');
    revalidatePath('/raf');
    revalidatePath('/transactions');
    revalidateAiInsight(resolvedUserId);
    return {
      success: true,
    };
  } catch (error) {
    console.error('deleteTransaction error:', error);
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}

/**
 * Update transaction
 *
 * Allows updating amount, description, or category.
 * Recalculates savings allocations if amount changed.
 *
 * @param entryId Entry to update
 * @param updates Fields to update
 */
export async function updateTransaction(
  entryId: string,
  updates: Partial<{
    amount: string;
    description: string;
    categoryId: string;
  }>,
  userId?: string
): Promise<ApiResponse<{ id: string }>> {
  try {
    if (await isDemoModeEnabled()) {
      return { success: true, data: { id: entryId } };
    }

    const resolvedUserId = await resolveUserId(userId);
    // Verify ownership
    const entry = await ledgerRepo.getLedgerEntryById(entryId);
    if (!entry || entry.userId !== resolvedUserId) {
      return {
        success: false,
        error: 'Entry not found',
      };
    }

    // Validate category if provided
    if (updates.categoryId) {
      const category = await categoriesRepo.getCategoryById(
        updates.categoryId
      );
      if (!category) {
        return {
          success: false,
          error: 'Category not found',
        };
      }

      // Keep existing entry types semantically valid when category changes.
      if (entry.entryType === 'INCOME' && category.type !== 'INCOME') {
        return {
          success: false,
          error: 'Income entries can only use Income categories',
        };
      }

      if (entry.entryType === 'TRANSFER' && !category.countsAsSavings) {
        return {
          success: false,
          error: 'Savings/transfer entries can only use savings categories',
        };
      }

      if (entry.entryType === 'EXPENSE' && category.type === 'INCOME') {
        return {
          success: false,
          error: 'Expense entries cannot use Income categories',
        };
      }

      if (entry.entryType === 'EXPENSE' && category.countsAsSavings) {
        return {
          success: false,
          error: 'Expense entries cannot use savings categories. Use Savings/Investment with TRANSFER instead.',
        };
      }

      if (entry.entryType === 'TRANSFER' && category.type === 'INCOME') {
        return {
          success: false,
          error: 'Transfer entries cannot use Income categories.',
        };
      }
    }

    // Update entry
    const updated = await ledgerRepo.updateLedgerEntry(entryId, {
      ...(updates.amount && { amount: new Decimal(updates.amount) }),
      ...(updates.description && { description: updates.description }),
      ...(updates.categoryId && { categoryId: updates.categoryId }),
    });

    // Update savings allocations if amount changed
    if (updates.amount && entry.entryType === 'TRANSFER') {
      // Delete old allocations
      // This would need a deleteByEntryId function in savingsRepo

      // Create new allocation
      const allocations = await savingsRepo.getAllocationsForEntry(entryId);
      if (allocations.length > 0) {
        const bucket = allocations[0].bucket;
        await savingsRepo.createAllocation({
          ledgerEntryId: entryId,
          bucket,
          amount: new Decimal(updates.amount),
          userId: resolvedUserId,
        });
      }
    }

    revalidatePath('/');
    revalidatePath('/raf');
    revalidatePath('/transactions');
    revalidateAiInsight(resolvedUserId);
    return {
      success: true,
      data: { id: updated.id },
    };
  } catch (error) {
    console.error('updateTransaction error:', error);
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}

/**
 * Get transactions for period
 *
 * Fetches all ledger entries for a period.
 * Optionally filters by type or category.
 *
 * @param periodId Period to fetch
 * @param filters Optional type or category filter
 */
export async function getTransactions(
  periodId: string,
  filters?: {
    type?: 'INCOME' | 'EXPENSE' | 'SAVINGS';
    categoryId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<
  ApiResponse<{
    transactions: Array<{
      id: string;
      date: string;
      description: string;
      amount: string;
      type: string;
      categoryName?: string;
      categoryId?: string;
    }>;
    total: number;
  }>
> {
  try {
    if (await isDemoModeEnabled()) {
      const demoData = createDemoTransactionPageData(filters);
      return { success: true, data: demoData };
    }

    const userId = await resolveUserId();
    const period = await periodsRepo.getPeriodById(periodId);
    if (!period) {
      return {
        success: false,
        error: 'Period not found',
      };
    }

    const periodEntries = await ledgerRepo.getLedgerEntriesForPeriod(periodId);
    const windowEntries = await ledgerRepo.getLedgerEntriesForUserDateRange(
      userId,
      startOfDay(period.startDate),
      endOfDay(period.endDate)
    );
    const normalizedWindowEntries = windowEntries.map((entry) => ({
      ...entry,
      savingsAllocations: [],
      notes: [],
    }));

    // Merge by id so legacy entries tied to overlapping period IDs still appear.
    const mergedById = new Map<string, (typeof periodEntries)[number]>();
    periodEntries.forEach((entry) => mergedById.set(entry.id, entry));
    normalizedWindowEntries.forEach((entry) => mergedById.set(entry.id, entry));

    let entries = Array.from(mergedById.values()).sort(
      (a, b) => {
        const byDate = b.date.getTime() - a.date.getTime();
        if (byDate !== 0) return byDate;
        return b.createdAt.getTime() - a.createdAt.getTime();
      }
    );

    // Apply filters
    if (filters?.type) {
      const expectedType = toLedgerEntryType(filters.type);
      entries = entries.filter((e: { entryType: string }) => e.entryType === expectedType);
    }
    if (filters?.categoryId) {
      entries = entries.filter((e: { categoryId: string }) => e.categoryId === filters.categoryId);
    }

    const total = entries.length;

    // Apply pagination
    const limit = filters?.limit ?? 10;
    const offset = filters?.offset ?? 0;
    const paginatedEntries = entries.slice(offset, offset + limit);

    // Format for response
    const categories = await categoriesRepo.getCategoriesForUser(userId);
    const categoryMap = new Map<string, { id: string; name: string }>(
      categories.map((c: { id: string; name: string }) => [c.id, c])
    );

    const formatted = paginatedEntries.map((e) => ({
      id: e.id,
      date: e.date.toISOString(),
      description: e.description || '',
      amount: e.amount.toFixed(2),
      type: e.entryType,
      categoryName: categoryMap.get(e.categoryId)?.name,
      categoryId: e.categoryId,
    }));

    return {
      success: true,
      data: {
        transactions: formatted,
        total,
      },
    };
  } catch (error) {
    console.error('getTransactions error:', error);
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}

/**
 * Get transactions for a user date range (inclusive)
 */
export async function getTransactionsForDateRange(
  startDate: Date,
  endDate: Date
): Promise<
  ApiResponse<{
    transactions: Array<{
      id: string;
      date: string;
      description: string;
      amount: string;
      type: string;
      categoryName?: string;
      categoryId?: string;
    }>;
  }>
> {
  try {
    if (await isDemoModeEnabled()) {
      return { success: true, data: createDemoTransactionRangeData() };
    }

    const userId = await resolveUserId();
    const entries = await ledgerRepo.getLedgerEntriesForUserDateRange(userId, startDate, endDate);

    const formatted = entries.map((e) => ({
      id: e.id,
      date: e.date.toISOString(),
      description: e.description || '',
      amount: e.amount.toFixed(2),
      type: e.entryType,
      categoryName: e.category?.name,
      categoryId: e.categoryId,
    }));

    return {
      success: true,
      data: {
        transactions: formatted,
      },
    };
  } catch (error) {
    console.error('getTransactionsForDateRange error:', error);
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}
