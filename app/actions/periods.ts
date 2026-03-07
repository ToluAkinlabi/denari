/**
 * Period Server Actions
 *
 * Orchestrates: period reconciliation, opening cash updates, period data
 */

'use server';

import { Decimal } from '@prisma/client/runtime/library';
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
import {
  calculateExpectedCash,
  calculateReconciliationDifference,
  isReconciled,
  getReconciliationQuality,
  generateReconciliationHints,
  suggestReconciliationAction,
} from '@/lib/finance/reconciliation';
import { calculateTotalSpending } from '@/lib/finance/spending';
import { calculateIncome, calculateSavingsTransfers } from '@/lib/finance/wealth';
import { getPayCycleIndex } from '@/lib/periods';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Reconcile a period
 *
 * Workflow:
 *   1. Validate input
 *   2. Fetch period and all transactions
 *   3. Calculate expected vs actual cash
 *   4. Determine if balanced
 *   5. If not balanced, suggest adjustment entry
 *   6. Create adjustment entry if provided
 *
 * @example
 *   const result = await reconcilePeriod({
 *     periodId: "...",
 *     actualCash: "3342.50",
 *     entryToBalance: {
 *       description: "Rounding adjustment",
 *       amount: "2.50"
 *     }
 *   })
 */
export async function reconcilePeriod(
  input: unknown,
  userId?: string
): Promise<
  ApiResponse<{
    reconciled: boolean;
    difference: string;
    quality: string;
    hints: string[];
    balanceAction?: string;
  }>
> {
  try {
    const resolvedUserId = await usersRepo.resolveUserId(userId);
    // Step 1: Validate
    const [valid, validationError] = validate(reconciliationSchema, input);
    if (!valid) {
      return {
        success: false,
        error: formatValidationErrors(validationError),
      };
    }

    const data = validationError;

    // Step 2: Fetch period
    const period = await periodsRepo.getPeriodById(data.periodId);
    if (!period) {
      return {
        success: false,
        error: 'Period not found',
      };
    }

    // Step 3: Fetch transactions
    const entries = await ledgerRepo.getLedgerEntriesForPeriod(data.periodId);

    // Step 4: Calculate expected cash
    const categoryMap = new Map<
      string,
      { type: string; countsAsExpense: boolean; countsAsSavings: boolean }
    >();
    const categories = await categoriesRepo.getCategoriesForUser(resolvedUserId);
    categories.forEach((c: {
      id: string;
      type: string;
      countsAsExpense: boolean | null;
      countsAsSavings: boolean | null;
    }) => {
      categoryMap.set(c.id, {
        type: c.type,
        countsAsExpense: c.countsAsExpense ?? false,
        countsAsSavings: c.countsAsSavings ?? false,
      });
    });

    const income = calculateIncome(entries);
    const spending = calculateTotalSpending(entries, categoryMap);
    const savings = calculateSavingsTransfers(entries, categoryMap);

    const expectedCash = calculateExpectedCash(
      period.openingCash,
      income,
      spending,
      savings
    );

    const actualCash = new Decimal(data.actualCash);
    const difference = calculateReconciliationDifference(expectedCash, actualCash);
    const reconciled = isReconciled(difference);
    const quality = getReconciliationQuality(difference, expectedCash);

    // Step 5: Generate hints
    const hints = generateReconciliationHints(
      difference,
      entries,
      categoryMap
    );

    const result = {
      reconciled,
      difference: difference.toString(),
      quality: quality.toString(),
      hints,
    };

    // Step 6: Create adjustment entry if provided and not reconciled
    if (!reconciled && data.entryToBalance) {
      const miscCategory = categories.find(
        (c: { name: string }) => c.name.toLowerCase() === 'adjustment' ||
          c.name.toLowerCase() === 'misc'
      );

      if (miscCategory) {
        await ledgerRepo.createLedgerEntry({
          date: new Date(),
          amount: new Decimal(data.entryToBalance.amount),
          categoryId: miscCategory.id,
          description:
            data.entryToBalance.description || 'Reconciliation adjustment',
          // If actual < expected (negative difference), reduce expected via expense.
          // If actual > expected (positive difference), increase expected via income.
          entryType: difference.isNegative() ? 'EXPENSE' : 'INCOME',
          periodId: data.periodId,
          userId: resolvedUserId,
        });

        // Recompute after adjustment before deciding reconciliation state.
        const updatedEntries = await ledgerRepo.getLedgerEntriesForPeriod(data.periodId);
        const updatedIncome = calculateIncome(updatedEntries);
        const updatedSpending = calculateTotalSpending(updatedEntries, categoryMap);
        const updatedSavings = calculateSavingsTransfers(updatedEntries, categoryMap);
        const updatedExpectedCash = calculateExpectedCash(
          period.openingCash,
          updatedIncome,
          updatedSpending,
          updatedSavings
        );
        const updatedDifference = calculateReconciliationDifference(updatedExpectedCash, actualCash);
        const updatedReconciled = isReconciled(updatedDifference);

        if (updatedReconciled) {
          await periodsRepo.updatePeriod(data.periodId, {
            status: 'RECONCILED',
          });
        }

        return {
          success: true,
          data: {
            ...result,
            reconciled: updatedReconciled,
            difference: updatedDifference.toString(),
            balanceAction: updatedReconciled
              ? 'Adjustment entry created and period reconciled'
              : 'Adjustment entry created; period still not reconciled. Re-run reconcile with actual cash.',
          },
        };
      }
    }

    if (reconciled) {
      // Mark period as reconciled
      await periodsRepo.updatePeriod(data.periodId, {
        status: 'RECONCILED',
      });
    }

    return {
      success: true,
      data: {
        ...result,
        balanceAction: reconciled
          ? 'Period is balanced'
          : suggestReconciliationAction(expectedCash, actualCash),
      },
    };
  } catch (error) {
    console.error('reconcilePeriod error:', error);
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
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
  input: unknown
): Promise<ApiResponse<{ success: boolean; message: string }>> {
  try {
    // Validate
    const [valid, validationError] = validate(periodOpeningCashSchema, input);
    if (!valid) {
      return {
        success: false,
        error: formatValidationErrors(validationError),
      };
    }

    const data = validationError;

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
      index: number;
      startDate: string;
      endDate: string;
      income: string;
      wealth: string;
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
        startDate: Date;
        endDate: Date;
        status: string;
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
        const wealth = income.minus(spending);

        return {
          id: period.id,
          index: getPayCycleIndex(period.startDate) + 1,
          startDate: period.startDate.toISOString(),
          endDate: period.endDate.toISOString(),
          income: income.toString(),
          wealth: wealth.toString(),
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
