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
import * as usersRepo from '@/lib/repositories/users';
import { calculateIncome, calculateSavingsTransfers } from '@/lib/finance/wealth';
import type { LedgerEntry, Category, SavingsAllocation, Note } from '@prisma/client';
import { calculateTotalSpending } from '@/lib/finance/spending';
import { calculateCashflowByCategory } from '@/lib/finance/cashflow';
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
  categoryBreakdown: Array<{ category: string; amount: string; percentage: string; kind: 'income' | 'expense' | 'savings' }>;
  periodLabels: string[];
  trendIncome: string[];
  trendSpending: string[];
  trendSavings: string[];
  trendWealth: string[];
  trendEndingCash: string[];
}

type LedgerEntryLike = {
  amount: Decimal;
  categoryId: string;
  entryType: string;
};

export async function getMonthlyReport(
  month: Date = new Date(),
  userId?: string
): Promise<ApiResponse<MonthlyReportData>> {
  try {
    const resolvedUserId = await usersRepo.resolveUserId(userId);
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);

    // Fetch periods that overlap with the month for monthly totals.
    const periodsRaw = await periodsRepo.getPeriodsInRange(resolvedUserId, monthStart, monthEnd);
    const periods = periodsRaw.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    const recentPeriodsRaw = await periodsRepo.getRecentPeriods(resolvedUserId, 6);
    const recentPeriods = [...recentPeriodsRaw].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    
    const categories = await categoriesRepo.getCategoriesForUser(resolvedUserId);
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

    const entriesByPeriod = new Map<string, (LedgerEntry & { category: Category | null; savingsAllocations: SavingsAllocation[]; notes: Note[] })[]>();
    for (const period of [...periods, ...recentPeriods]) {
      if (entriesByPeriod.has(period.id)) {
        continue;
      }

      const entries = await ledgerRepo.getLedgerEntriesForPeriod(period.id);
      entriesByPeriod.set(period.id, entries);
    }

    const buildPeriodSummaries = (
      sourcePeriods: Array<{ id: string; startDate: Date; label: string; openingCash: Decimal; closingCashActual: Decimal | null }>
    ) => {
      return sourcePeriods.map((period) => {
        const entries = entriesByPeriod.get(period.id) || [];
        const income = calculateIncome(entries);
        const spending = calculateTotalSpending(entries, categoryMap);
        const savings = calculateSavingsTransfers(entries, categoryMap);
        const endingCash = period.closingCashActual ?? period.openingCash.plus(income).minus(spending).minus(savings);

        return {
          label: period.label,
          income,
          spending,
          savings,
          wealth: income.minus(spending),
          endingCash,
          entries,
        };
      });
    };

    const periodSummaries = buildPeriodSummaries(periods);
    const recentTrendSummaries = buildPeriodSummaries(recentPeriods);

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
    const cashflowByCategory = calculateCashflowByCategory(allEntries as never, categoryMap);

    const categoryBreakdown = cashflowByCategory
      .map((item: { categoryName: string; amount: Decimal; percentage: Decimal; kind: 'income' | 'expense' | 'savings' }) => ({
        category: item.categoryName,
        amount: item.amount.toFixed(2),
        percentage: `${item.percentage.toFixed(1)}%`,
        kind: item.kind,
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
        periodLabels: recentTrendSummaries.map((p: { label: string }) => p.label),
        trendIncome: recentTrendSummaries.map((p: { income: Decimal }) => p.income.toFixed(2)),
        trendSpending: recentTrendSummaries.map((p: { spending: Decimal }) => p.spending.toFixed(2)),
        trendSavings: recentTrendSummaries.map((p: { savings: Decimal }) => p.savings.toFixed(2)),
        trendWealth: recentTrendSummaries.map((p: { wealth: Decimal }) => p.wealth.toFixed(2)),
        trendEndingCash: recentTrendSummaries.map((p: { endingCash: Decimal }) => p.endingCash.toFixed(2)),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}
