/**
 * Period Server Actions
 *
 * Orchestrates: period reconciliation, opening cash updates, period data
 */

'use server';

import { revalidatePath } from 'next/cache';
import { Decimal } from '@prisma/client/runtime/library';
import { startOfDay, endOfDay } from 'date-fns';
import {
  reconciliationSchema,
  periodOpeningCashSchema,
  validate,
  formatValidationErrors,
} from '@/lib/validators/schemas';
import * as periodsRepo from '@/lib/repositories/periods';
import * as ledgerRepo from '@/lib/repositories/ledger';
import * as categoriesRepo from '@/lib/repositories/categories';
import * as usersRepo from '@/lib/repositories/users';
import * as plaidRepo from '@/lib/repositories/plaid';
import {
  calculateExpectedCash,
  calculateReconciliationDifference,
  isReconciled,
  getReconciliationQuality,
  generateReconciliationHints,
} from '@/lib/finance/reconciliation';
import { calculateTotalSpending } from '@/lib/finance/spending';
import { calculateIncome, calculateSavingsTransfers } from '@/lib/finance/wealth';
import { getPayCycleIndex } from '@/lib/periods';

/**
 * Cascade-recalculate openingCash and closingCashExpected for ALL periods for a user.
 * Respects closingCashActual as an anchor: if a period has an actual closing value,
 * the next period opens from that value rather than the calculated expected.
 * Includes imported transactions marked as includeInRaf in all calculations.
 */
async function cascadeRecalculateAllPeriods(userId: string): Promise<void> {
  const allPeriodsDesc = await periodsRepo.getRecentPeriods(userId, 9999);
  const periods = [...allPeriodsDesc].reverse(); // oldest first

  const categories = await categoriesRepo.getCategoriesForUser(userId);
  const categoryMap = new Map<string, { countsAsExpense: boolean; countsAsSavings: boolean }>();
  categories.forEach((c: { id: string; countsAsExpense: boolean | null; countsAsSavings: boolean | null }) => {
    categoryMap.set(c.id, {
      countsAsExpense: c.countsAsExpense ?? false,
      countsAsSavings: c.countsAsSavings ?? false,
    });
  });

  // Seed carry from the oldest period's stored opening cash rather than zero.
  // This preserves any manually-anchored balance from before the earliest reconciled anchor.
  let carry = periods.length > 0 ? new Decimal(periods[0].openingCash.toString()) : new Decimal(0);
  for (const period of periods) {
    const entries = (period as { ledgerEntries?: unknown[] }).ledgerEntries ?? [];
    
    // Fetch imported transactions for this period
    const importedEntries = await plaidRepo.getIncludedImportedTransactionsForDateRange(
      userId,
      startOfDay(period.startDate),
      endOfDay(period.endDate)
    );
    
    // Combine with ledger entries for calculations
    const allEntries = [
      ...entries,
      ...importedEntries.map((entry) => ({
        entryType: 'EXPENSE' as const,
        amount: entry.amount,
        categoryId: entry.categoryId,
        category: { countsAsExpense: true, countsAsSavings: false },
      })),
    ];
    
    const income = calculateIncome(entries as Parameters<typeof calculateIncome>[0]);
    const spending = calculateTotalSpending(allEntries as Parameters<typeof calculateTotalSpending>[0], categoryMap);
    const savings = calculateSavingsTransfers(entries as Parameters<typeof calculateSavingsTransfers>[0], categoryMap);
    const closingExpected = carry.plus(income).minus(spending).minus(savings);

    await periodsRepo.updatePeriod(period.id, {
      openingCash: carry,
      closingCashExpected: closingExpected,
    });

    // If this period has a manually-anchored actual closing, use it as the carry.
    const closingActual = (period as { closingCashActual?: Decimal | null }).closingCashActual;
    carry = closingActual != null ? new Decimal(closingActual.toString()) : closingExpected;
  }
}

function revalidateFinancialViews() {
  revalidatePath('/');
  revalidatePath('/raf');
  revalidatePath('/periods');
  revalidatePath('/settings');
  revalidatePath('/reports');
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Reconcile a period
 *
 * Anchors the period's closing cash to a known actual value (e.g. your bank balance),
 * then cascade-recalculates opening/closing for all subsequent periods so every
 * period's opening cash reflects the true carried-forward amount.
 *
 * @example
 *   await reconcilePeriod({ periodId: "...", actualCash: "2136.95" })
 */
export async function reconcilePeriod(
  input: unknown,
  userId?: string
): Promise<
  ApiResponse<{
    reconciled: boolean;
    difference: string;
    expectedCash: string;
    actualCash: string;
    quality: string;
    hints: string[];
  }>
> {
  try {
    const resolvedUserId = await usersRepo.resolveUserId(userId);

    const [valid, validationError] = validate(reconciliationSchema, input);
    if (!valid) {
      return { success: false, error: formatValidationErrors(validationError) };
    }
    const data = validationError;

    const period = await periodsRepo.getPeriodById(data.periodId);
    if (!period) {
      return { success: false, error: 'Period not found' };
    }

    if (period.userId !== resolvedUserId) {
      return { success: false, error: 'Unauthorized period access' };
    }

    // Build category map for calculations
    const categories = await categoriesRepo.getCategoriesForUser(resolvedUserId);
    const categoryMap = new Map<string, { type: string; countsAsExpense: boolean; countsAsSavings: boolean }>();
    categories.forEach((c: { id: string; type: string; countsAsExpense: boolean | null; countsAsSavings: boolean | null }) => {
      categoryMap.set(c.id, {
        type: c.type,
        countsAsExpense: c.countsAsExpense ?? false,
        countsAsSavings: c.countsAsSavings ?? false,
      });
    });

    const entries = await ledgerRepo.getLedgerEntriesForPeriod(data.periodId);
    
    // Fetch imported transactions for this period and include them in reconciliation calculation
    const importedEntries = await plaidRepo.getIncludedImportedTransactionsForDateRange(
      resolvedUserId,
      startOfDay(period.startDate),
      endOfDay(period.endDate)
    );
    
    // Combine all entries for spending calculation (imported are always expenses)
    const allEntries = [
      ...entries,
      ...importedEntries.map((entry) => ({
        entryType: 'EXPENSE' as const,
        amount: entry.amount,
        categoryId: entry.categoryId,
        category: { countsAsExpense: true, countsAsSavings: false },
      })),
    ];
    
    const income = calculateIncome(entries);
    const spending = calculateTotalSpending(allEntries as Parameters<typeof calculateTotalSpending>[0], categoryMap);
    const savings = calculateSavingsTransfers(entries, categoryMap);
    const expectedCash = calculateExpectedCash(period.openingCash, income, spending, savings);
    const actualCash = new Decimal(data.actualCash);
    const difference = calculateReconciliationDifference(expectedCash, actualCash);
    const reconciled = isReconciled(difference);
    const quality = getReconciliationQuality(difference, expectedCash);
    const hints = generateReconciliationHints(difference, entries, categoryMap);

    // Anchor this period's actual closing and mark reconciled
    await periodsRepo.updatePeriod(data.periodId, {
      closingCashActual: actualCash,
      status: 'RECONCILED',
    });

    // Cascade: recalculate all periods so subsequent openings use this anchor
    await cascadeRecalculateAllPeriods(resolvedUserId);
    revalidateFinancialViews();

    return {
      success: true,
      data: {
        reconciled,
        difference: difference.toString(),
        expectedCash: expectedCash.toString(),
        actualCash: actualCash.toString(),
        quality: quality.toString(),
        hints,
      },
    };
  } catch (error) {
    console.error('reconcilePeriod error:', error);
    return { success: false, error: `Server error: ${(error as Error).message}` };
  }
}

/**
 * Reopen a reconciled period.
 *
 * Clears anchored actual closing cash and sets status back to OPEN,
 * then re-runs cascade balance calculations for all periods.
 */
export async function unreconcilePeriod(
  input: unknown,
  userId?: string
): Promise<ApiResponse<{ reopened: boolean }>> {
  try {
    const resolvedUserId = await usersRepo.resolveUserId(userId);

    if (
      typeof input !== 'object' ||
      input === null ||
      !('periodId' in input) ||
      typeof (input as { periodId?: unknown }).periodId !== 'string' ||
      (input as { periodId: string }).periodId.trim().length === 0
    ) {
      return { success: false, error: 'Invalid period id' };
    }

    const periodId = (input as { periodId: string }).periodId;
    const period = await periodsRepo.getPeriodById(periodId);

    if (!period) {
      return { success: false, error: 'Period not found' };
    }

    if (period.userId !== resolvedUserId) {
      return { success: false, error: 'Unauthorized period access' };
    }

    if (period.status !== 'RECONCILED') {
      return { success: true, data: { reopened: false } };
    }

    await periodsRepo.updatePeriod(periodId, {
      status: 'OPEN',
      closingCashActual: null,
    });

    await cascadeRecalculateAllPeriods(resolvedUserId);
    revalidateFinancialViews();

    return { success: true, data: { reopened: true } };
  } catch (error) {
    console.error('unreconcilePeriod error:', error);
    return { success: false, error: `Server error: ${(error as Error).message}` };
  }
}

/**
 * Update period opening cash
 *
 * Adjusts opening balance for a period.
 * Marks period as reconciled if now balanced.
 *
 * @example
 *   const result = await updatePeriodOpeningCash({
 *     periodId: "...",
 *     openingCash: "1000.00"
 *   })
 */
export async function updatePeriodOpeningCash(
  input: unknown,
  userId?: string
): Promise<ApiResponse<{ success: boolean; message: string }>> {
  try {
    const resolvedUserId = await usersRepo.resolveUserId(userId);

    // Validate
    const [valid, validationError] = validate(periodOpeningCashSchema, input);
    if (!valid) {
      return {
        success: false,
        error: formatValidationErrors(validationError),
      };
    }

    const data = validationError;

    // Ownership check
    const period = await periodsRepo.getPeriodById(data.periodId);
    if (!period) {
      return { success: false, error: 'Period not found' };
    }
    if (period.userId !== resolvedUserId) {
      return { success: false, error: 'Unauthorized period access' };
    }

    // Update period
    await periodsRepo.updatePeriod(data.periodId, {
      openingCash: new Decimal(data.openingCash),
    });

    return {
      success: true,
      data: {
        success: true,
        message: 'Opening cash updated',
      },
    };
  } catch (error) {
    console.error('updatePeriodOpeningCash error:', error);
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}

/**
 * Get period detail
 *
 * Fetches period with all calculated metrics.
 * Includes all transactions and reconciliation status.
 *
 * @param periodId Period to fetch
 */
export async function getPeriodDetail(
  periodId: string,
  userId?: string
): Promise<
  ApiResponse<{
    id: string;
    startDate: string;
    endDate: string;
    index: number;
    openingCash: string;
    income: string;
    spending: string;
    savings: string;
    endingCash: string;
    wealth: string;
    isReconciled: boolean;
    notes?: string;
  }>
> {
  try {
    const resolvedUserId = await usersRepo.resolveUserId(userId);
    const period = await periodsRepo.getPeriodById(periodId);
    if (!period) {
      return {
        success: false,
        error: 'Period not found',
      };
    }

    const entries = await ledgerRepo.getLedgerEntriesForPeriod(periodId);

    const categoryMap = new Map<string, { countsAsExpense: boolean; countsAsSavings: boolean }>();
    const categories = await categoriesRepo.getCategoriesForUser(resolvedUserId);
    categories.forEach((c: {
      id: string;
      countsAsExpense: boolean | null;
      countsAsSavings: boolean | null;
    }) => {
      categoryMap.set(c.id, {
        countsAsExpense: c.countsAsExpense ?? false,
        countsAsSavings: c.countsAsSavings ?? false,
      });
    });

    const income = calculateIncome(entries);
    const spending = calculateTotalSpending(entries, categoryMap);
    const savings = calculateSavingsTransfers(entries, categoryMap);
    const endingCash = calculateExpectedCash(
      period.openingCash,
      income,
      spending,
      savings
    );
    const wealth = income.minus(spending);

    return {
      success: true,
      data: {
        id: period.id,
        startDate: period.startDate.toISOString(),
        endDate: period.endDate.toISOString(),
        index: getPayCycleIndex(period.startDate) + 1,
        openingCash: period.openingCash.toString(),
        income: income.toString(),
        spending: spending.toString(),
        savings: savings.toString(),
        endingCash: endingCash.toString(),
        wealth: wealth.toFixed(2),
        isReconciled: period.status === 'RECONCILED',
        notes: period.notes || undefined,
      },
    };
  } catch (error) {
    console.error('getPeriodDetail error:', error);
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}

/**
 * Get periods list
 *
 * Fetches recent periods with summary metrics.
 *
 * @param count Number of periods to fetch (default 12)
 */
export async function getRecentPeriods(
  options?: { page?: number; pageSize?: number },
  userId?: string
): Promise<
  ApiResponse<{
    items: Array<{
      id: string;
      label: string;
      index: number;
      startDate: string;
      endDate: string;
      income: string;
      spending: string;
      savings: string;
      wealth: string;
      openingCash: string;
      closingCashExpected: string;
      closingCashActual: string | null;
      isReconciled: boolean;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }>
> {
  try {
    const resolvedUserId = await usersRepo.resolveUserId(userId);
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 10;
    
    // Fetch all periods to get total count and paginate
    const allPeriods = await periodsRepo.getRecentPeriods(resolvedUserId, 999);
    const total = allPeriods.length;
    const start = (page - 1) * pageSize;
    const periods = allPeriods.slice(start, start + pageSize);

    const result = await Promise.all(
      periods.map(async (period: {
        id: string;
        label: string;
        startDate: Date;
        endDate: Date;
        status: string;
        openingCash: Decimal;
        closingCashExpected: Decimal | null;
        closingCashActual: Decimal | null;
      }) => {
        const entries = await ledgerRepo.getLedgerEntriesForPeriod(period.id);

        const categoryMap = new Map<
          string,
          { countsAsExpense: boolean; countsAsSavings: boolean }
        >();
        const categories = await categoriesRepo.getCategoriesForUser(resolvedUserId);
        categories.forEach((c: {
          id: string;
          countsAsExpense: boolean | null;
          countsAsSavings: boolean | null;
        }) => {
          categoryMap.set(c.id, {
            countsAsExpense: c.countsAsExpense ?? false,
            countsAsSavings: c.countsAsSavings ?? false,
          });
        });

        const income = calculateIncome(entries);
        const spending = calculateTotalSpending(entries, categoryMap);
        const savings = calculateSavingsTransfers(entries, categoryMap);
        const wealth = income.minus(spending);

        return {
          id: period.id,
          label: period.label,
          index: getPayCycleIndex(period.startDate) + 1,
          startDate: period.startDate.toISOString(),
          endDate: period.endDate.toISOString(),
          income: income.toString(),
          spending: spending.toString(),
          savings: savings.toString(),
          wealth: wealth.toString(),
          openingCash: period.openingCash.toString(),
          closingCashExpected: (period.closingCashExpected ?? new Decimal(0)).toString(),
          closingCashActual: period.closingCashActual != null ? period.closingCashActual.toString() : null,
          isReconciled: period.status === 'RECONCILED',
        };
      })
    );

    return {
      success: true,
      data: {
        items: result,
        total,
        page,
        pageSize,
      },
    };
  } catch (error) {
    console.error('getRecentPeriods error:', error);
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}
