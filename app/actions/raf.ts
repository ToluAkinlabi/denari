'use server';

import { differenceInCalendarDays, startOfDay } from 'date-fns';
import { getPayCycleIndex } from '@/lib/periods';
import * as periodsRepo from '@/lib/repositories/periods';
import * as ledgerRepo from '@/lib/repositories/ledger';
import * as categoriesRepo from '@/lib/repositories/categories';
import * as rafTransfersRepo from '@/lib/repositories/raf-transfers';
import * as plaidRepo from '@/lib/repositories/plaid';
import * as usersRepo from '@/lib/repositories/users';
import { calculateIncome } from '@/lib/finance/wealth';
import { applyRafPeriodTransfers, calculateRafPlan, type RafPlan } from '@/lib/finance/raf';

export interface RafPageData {
  periodId: string;
  periodIndex: number;
  periodRange: string;
  income: string;
  carryForward: string;
  allocationBase: string;
  isReconciled: boolean;
  hasIncome: boolean;
  raf: RafPlan;
  transfers: Array<{
    id: string;
    fromCategoryId: string;
    fromCategoryName: string;
    toCategoryId: string;
    toCategoryName: string;
    amount: string;
    createdAt: string;
  }>;
  categories: Array<{
    id: string;
    name: string;
    rafPercent: number;
    type: string;
  }>;
  periodProgressPercent: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function getRafPageData(userId?: string): Promise<ApiResponse<RafPageData>> {
  try {
    const resolvedUserId = await usersRepo.resolveUserId(userId);

    const currentPeriod = await periodsRepo.getCurrentPeriodForUser(resolvedUserId);
    if (!currentPeriod) {
      return { success: false, error: 'No current period found' };
    }

    const periodStart = startOfDay(new Date(currentPeriod.startDate));
    const periodEnd = startOfDay(new Date(currentPeriod.endDate));

    const [currentEntries, importedEntries, categories, periodTransfers] = await Promise.all([
      ledgerRepo.getLedgerEntriesForPeriod(currentPeriod.id),
      plaidRepo.getIncludedImportedTransactionsForDateRange(resolvedUserId, periodStart, periodEnd),
      categoriesRepo.getCategoryForecastSettingsForUser(resolvedUserId),
      rafTransfersRepo.getRafTransfersForPeriodDetailed(resolvedUserId, currentPeriod.id),
    ]);

    const allEntries = [
      ...currentEntries,
      ...importedEntries.map((entry) => ({
        categoryId: entry.categoryId ?? '',
        amount: entry.amount,
        entryType: 'EXPENSE',
      })),
    ];

    const currentIncome = calculateIncome(allEntries);
    const effectiveCashBalance = currentPeriod.status === 'RECONCILED' && currentPeriod.closingCashActual != null
      ? currentPeriod.closingCashActual
      : currentPeriod.openingCash;
    const allocationBase = currentPeriod.status === 'RECONCILED' && currentPeriod.closingCashActual != null
      ? currentPeriod.closingCashActual
      : currentIncome.plus(currentPeriod.openingCash);

    const baseRafPlan = calculateRafPlan({
      income: currentIncome,
      carryForward: currentPeriod.openingCash,
      entries: allEntries.map((e) => ({ categoryId: e.categoryId, amount: e.amount })),
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        expectedFrequency: c.expectedFrequency,
        countsAsExpense: c.countsAsExpense ?? false,
        countsAsSavings: c.countsAsSavings ?? false,
        rafPercent: c.rafPercent,
      })),
    });
    const rafPlan = applyRafPeriodTransfers(
      baseRafPlan,
      periodTransfers.map((transfer) => ({
        fromCategoryId: transfer.fromCategoryId,
        toCategoryId: transfer.toCategoryId,
        amount: transfer.amount,
      }))
    );

    const today = startOfDay(new Date());
    const totalDays = differenceInCalendarDays(periodEnd, periodStart) + 1;
    const daysElapsed = Math.max(0, Math.min(differenceInCalendarDays(today, periodStart) + 1, totalDays));
    const periodProgressPercent = totalDays > 0 ? Math.round((daysElapsed / totalDays) * 100) : 0;

    const startStr = new Date(currentPeriod.startDate).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
    const endStr = new Date(currentPeriod.endDate).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });

    const defaultRafByName: Record<string, number> = {
      Rent: 0, Grocery: 7, Phone: 5, Debt: 14, Other: 4,
      Spend: 21, Misc: 7, Partnership: 20, Savings: 14, Investment: 8,
    };
    const rafTotal = categories.reduce((sum, c) => sum + Number(c.rafPercent ?? 0), 0);
    const hasConfiguredRaf = rafTotal > 0;

    return {
      success: true,
      data: {
        periodId: currentPeriod.id,
        periodIndex: getPayCycleIndex(currentPeriod.startDate) + 1,
        periodRange: `${startStr} – ${endStr}`,
        isReconciled: currentPeriod.status === 'RECONCILED',
        income: currentIncome.toFixed(2),
        carryForward: effectiveCashBalance.toFixed(2),
        allocationBase: allocationBase.toFixed(2),
        hasIncome: allocationBase.greaterThan(0),
        raf: rafPlan,
        transfers: periodTransfers.map((transfer) => ({
          id: transfer.id,
          fromCategoryId: transfer.fromCategoryId,
          fromCategoryName: transfer.fromCategory.name,
          toCategoryId: transfer.toCategoryId,
          toCategoryName: transfer.toCategory.name,
          amount: transfer.amount.toFixed(2),
          createdAt: transfer.createdAt.toISOString(),
        })),
        categories: categories
          .filter((c) => c.type !== 'INCOME')
          .map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            rafPercent: hasConfiguredRaf
              ? Number(c.rafPercent ?? 0)
              : defaultRafByName[c.name] ?? Number(c.rafPercent ?? 0),
          })),
        periodProgressPercent,
      },
    };
  } catch (error) {
    return { success: false, error: `Server error: ${(error as Error).message}` };
  }
}
