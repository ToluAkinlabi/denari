/**
 * Reports server actions.
 *
 * Monthly aggregations and category breakdowns for reports page.
 */

'use server';

import { startOfMonth, endOfMonth } from 'date-fns';
import { Decimal } from '@prisma/client/runtime/library';
import * as periodsRepo from '@/lib/repositories/periods';
import * as ledgerRepo from '@/lib/repositories/ledger';
import * as categoriesRepo from '@/lib/repositories/categories';
import { calculateIncome, calculateSavingsTransfers } from '@/lib/finance/wealth';
import { calculateTotalSpending, calculateSpendingByCategory } from '@/lib/finance/spending';
import { aggregateMonthly } from '@/lib/finance/monthly';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface MonthlyReportData {
  monthLabel: string;
  income: string;
  spending: string;
  savings: string;
  wealthCreated: string;
  categoryBreakdown: Array<{ category: string; amount: string; percentage: string }>;
  trendSpending: string[];
}

type LedgerEntryLike = {
  amount: Decimal;
  categoryId: string;
  entryType: string;
};

export async function getMonthlyReport(
  month: Date = new Date(),
  userId: string = 'default-user'
): Promise<ApiResponse<MonthlyReportData>> {
  try {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);

    const periods = await periodsRepo.getPeriodsInRange(userId, monthStart, monthEnd);
    const categories = await categoriesRepo.getCategoriesForUser(userId);
    const categoryMap = new Map<
      string,
      { name: string; countsAsExpense: boolean; countsAsSavings: boolean }
    >(
      categories.map((c: {
        id: string;
        name: string;
        countsAsExpense: boolean | null;
        countsAsSavings: boolean | null;
      }) => [
        c.id,
        {
          name: c.name,
          countsAsExpense: c.countsAsExpense ?? false,
          countsAsSavings: c.countsAsSavings ?? false,
        },
      ])
    );

    const periodSummaries = await Promise.all(
      periods.map(async (period: { id: string }) => {
        const entries = await ledgerRepo.getLedgerEntriesForPeriod(period.id);
        return {
          income: calculateIncome(entries),
          spending: calculateTotalSpending(entries, categoryMap),
          savings: calculateSavingsTransfers(entries, categoryMap),
          entries,
        };
      })
    );

    const totals = aggregateMonthly(
      periodSummaries.map((p: {
        income: Decimal;
        spending: Decimal;
        savings: Decimal;
      }) => ({
        income: p.income,
        spending: p.spending,
        savings: p.savings,
      }))
    );

    const allEntries = periodSummaries.flatMap(
      (p: { entries: unknown[] }) => p.entries
    ) as unknown as LedgerEntryLike[];
    const spendingByCategory = calculateSpendingByCategory(allEntries as never, categoryMap);

    const categoryBreakdown = spendingByCategory
      .map((item: { categoryName: string; amount: Decimal; percentage: Decimal }) => ({
        category: item.categoryName,
        amount: item.amount.toFixed(2),
        percentage: `${item.percentage.toFixed(1)}%`,
      }))
      .sort((a, b) => Number(b.amount) - Number(a.amount));

    return {
      success: true,
      data: {
        monthLabel: month.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
        income: totals.income.toFixed(2),
        spending: totals.spending.toFixed(2),
        savings: totals.savings.toFixed(2),
        wealthCreated: totals.wealthCreated.toFixed(2),
        categoryBreakdown,
        trendSpending: periodSummaries.map((p: { spending: Decimal }) => p.spending.toFixed(2)),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}
