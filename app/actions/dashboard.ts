/**
 * Dashboard Server Actions
 *
 * Orchestrates: data fetch → calculations → view model generation
 * Returns formatted data ready for UI consumption.
 */

'use server';

import { Decimal } from '@prisma/client/runtime/library';
import * as periodsRepo from '@/lib/repositories/periods';
import * as ledgerRepo from '@/lib/repositories/ledger';
import * as categoriesRepo from '@/lib/repositories/categories';
import * as savingsRepo from '@/lib/repositories/savings';
import { getPayCycleIndex } from '@/lib/periods';
import { calculateTotalSpending, calculateSpendingByCategory } from '@/lib/finance/spending';
import {
  calculateIncome,
  calculateSavingsTransfers,
  calculateWealthCreated,
  calculateSavingsRate,
  isSavingsRateHealthy,
} from '@/lib/finance/wealth';
import {
  calculateExpectedCash,
  isReconciled,
} from '@/lib/finance/reconciliation';
import {
  evaluateSavingsDiscipline,
  evaluateExpenseControl,
  evaluateMiscLeakage,
  evaluateWealthGrowth,
  evaluateReconciliation,
  evaluateCategoryDiscipline,
  calculateFinancialScore,
  gradeScore,
} from '@/lib/finance/scorecard';
import { forecastNextPeriod, getForecastWarnings } from '@/lib/finance/forecast';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DashboardData {
  currentPeriod: {
    id: string;
    index: number;
    startDate: string;
    endDate: string;
    isReconciled: boolean;
  };
  cashMetrics: {
    opening: string;
    income: string;
    spending: string;
    savings: string;
    ending: string;
    isBalanced: boolean;
    balanceError: string;
  };
  wealthMetrics: {
    created: string;
    savingsRate: string;
    isSavingsHealthy: boolean;
    spendingPercentage: string;
    isSpendingControlled: boolean;
  };
  categoryBreakdown: Array<{
    name: string;
    emoji?: string;
    amount: string;
    percentage: string;
    trend: 'up' | 'down' | 'stable';
  }>;
  savingsRecap: {
    totalSavings: string;
    buckets: Array<{
      name: string;
      amount: string;
      percentage: string;
    }>;
  };
  scorecard: {
    overall: string;
    grade: string;
    savingsDiscipline: string;
    expenseControl: string;
    miscLeakage: string;
    wealthGrowth: string;
    reconciliation: string;
    categoryDiscipline: string;
  };
  forecast: {
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    nextIncome: string;
    nextSpending: string;
    nextSavings: string;
    nextWealth: string;
    nextEndingCash: string;
    warnings: string[];
  };
  comparison?: {
    type: 'PREVIOUS' | 'AVERAGE';
    income: {
      current: string;
      compared: string;
      change: string;
      changePercent: string;
    };
    wealth: {
      current: string;
      compared: string;
      change: string;
      changePercent: string;
    };
  };
}

/**
 * Get dashboard data
 *
 * Comprehensive financial overview for current period.
 * Includes metrics, calculations, forecasts, and comparisons.
 */
export async function getDashboardData(
  options?: {
    periodId?: string;
    compareTo?: 'PREVIOUS' | 'AVERAGE';
    includeProjection?: boolean;
  },
  userId: string = 'default-user'
): Promise<ApiResponse<DashboardData>> {
  try {
    const compareTo = options?.compareTo ?? 'PREVIOUS';
    const includeProjection = options?.includeProjection ?? true;

    // Fetch current period or provided period
    const currentPeriod = options?.periodId
      ? await periodsRepo.getPeriodById(options.periodId)
      : await periodsRepo.getCurrentPeriodForUser(userId);

    if (!currentPeriod) {
      return {
        success: false,
        error: 'No current period found',
      };
    }

    // Fetch all data
    const currentEntries = await ledgerRepo.getLedgerEntriesForPeriod(
      currentPeriod.id
    );
    const categories = await categoriesRepo.getCategoriesForUser(userId);
    const categoryMap = new Map<
      string,
      {
        name: string;
        type: string;
        countsAsExpense: boolean;
        countsAsSavings: boolean;
      }
    >();

    categories.forEach((c) => {
      categoryMap.set(c.id, {
        name: c.name,
        type: c.type,
        countsAsExpense: c.countsAsExpense ?? false,
        countsAsSavings: c.countsAsSavings ?? false,
      });
    });

    // Calculate current period metrics
    const currentIncome = calculateIncome(currentEntries);
    const currentSpending = calculateTotalSpending(currentEntries, categoryMap);
    const currentSavings = calculateSavingsTransfers(currentEntries, categoryMap);
    const currentCashEnding = calculateExpectedCash(
      currentPeriod.openingCash,
      currentIncome,
      currentSpending,
      currentSavings
    );
    const currentWealth = calculateWealthCreated(currentIncome, currentSpending);

    // Cash reconciliation
    const balanceError = new Decimal(0); // In real app, would compare to actual
    const isBalanced = isReconciled(balanceError);

    // Wealth metrics
    const savingsRate = calculateSavingsRate(currentIncome, currentSavings);
    const savingsHealthy = isSavingsRateHealthy(savingsRate);
    const spendingPercent = currentIncome.equals(0)
      ? new Decimal(0)
      : currentSpending.dividedBy(currentIncome).times(100);
    const spendingControlled = spendingPercent.lessThanOrEqualTo(70);

    // Category breakdown
    const categoryBreakdown = calculateSpendingByCategory(
      currentEntries,
      categoryMap
    );
    const categoryData = categoryBreakdown.map((item) => {
      const cat = categoryMap.get(item.categoryId);

      return {
        name: item.categoryName || cat?.name || 'Unknown',
        emoji: undefined,
        amount: item.amount.toString(),
        percentage: item.percentage.toFixed(1) + '%',
        trend: 'stable' as const,
      };
    });

    // Savings recap
    const allAllocations = await savingsRepo.getAllBucketsForUser(userId);
    const buckets = new Map<string, Decimal>();

    allAllocations.forEach((a: { bucket: string; amount: unknown }) => {
      buckets.set(
        a.bucket,
        (buckets.get(a.bucket) || new Decimal(0)).plus(new Decimal(String(a.amount)))
      );
    });

    const savingsData = Array.from(buckets.entries()).map(([bucket, amount]) => {
      const percentage = currentSavings.equals(0)
        ? new Decimal(0)
        : amount.dividedBy(currentSavings).times(100);

      return {
        name: bucket,
        amount: amount.toString(),
        percentage: percentage.toFixed(1) + '%',
      };
    });

    // Scorecard
    const recentPeriods = await periodsRepo.getRecentPeriods(userId, 4);
    const recentData = await Promise.all(
      recentPeriods.map(async (p: { id: string; status: string }) => {
        const entries = await ledgerRepo.getLedgerEntriesForPeriod(p.id);
        const income = calculateIncome(entries);
        const spending = calculateTotalSpending(entries, categoryMap);
        const savings = calculateSavingsTransfers(entries, categoryMap);
        const wealth = calculateWealthCreated(income, spending);
        return { income, spending, savings, wealth };
      })
    );

    const savingsDiscipline = evaluateSavingsDiscipline(currentIncome, currentSavings);
    const expenseControl = evaluateExpenseControl(currentIncome, currentSpending);
    const miscLeakage = evaluateMiscLeakage(
      currentIncome,
      new Decimal(0) // Would calculate misc category total
    );
    const wealthGrowth = evaluateWealthGrowth(
      recentData.map((d) => ({ wealthCreated: d.wealth }))
    );
    const reconciliation = evaluateReconciliation(
      currentPeriod.status === 'RECONCILED' ? 0 : 1
    );
    const categoryDiscipline = evaluateCategoryDiscipline(
      Object.fromEntries(
        categoryBreakdown.map((item) => [item.categoryName, item.amount])
      )
    );

    const scorecard = calculateFinancialScore({
      savingsDiscipline,
      expenseControl,
      miscLeakage,
      wealthGrowth,
      reconciliation,
      categoryDiscipline,
    });

    // Forecast
    let forecast: DashboardData['forecast'] = {
      confidence: 'MEDIUM',
      nextIncome: '0',
      nextSpending: '0',
      nextSavings: '0',
      nextWealth: '0',
      nextEndingCash: '0',
      warnings: [],
    };

    if (includeProjection && recentData.length >= 2) {
      const recentIncome = recentData.map((d) => d.income);
      const recentSpending = recentData.map((d) => d.spending);
      const recentSavings = recentData.map((d) => d.savings);

      const forecastResult = forecastNextPeriod({
        currentCash: currentCashEnding,
        recentIncome,
        recentSpending,
        recentSavings,
      });

      forecast = {
        confidence: forecastResult.confidence,
        nextIncome: forecastResult.income.toString(),
        nextSpending: forecastResult.spending.toString(),
        nextSavings: forecastResult.savings.toString(),
        nextWealth: forecastResult.wealthCreated.toString(),
        nextEndingCash: forecastResult.endingCash.toString(),
        warnings: getForecastWarnings(forecastResult),
      };
    }

    // Comparison
    let comparison: DashboardData['comparison'] | undefined;

    if (recentPeriods.length > 1) {
      let baseIncome = new Decimal(0);
      let baseWealth = new Decimal(0);

      if (compareTo === 'AVERAGE') {
        const historical = recentData.slice(1);
        const divisor = historical.length || 1;
        baseIncome = historical
          .reduce((sum, d) => sum.plus(d.income), new Decimal(0))
          .dividedBy(divisor);
        baseWealth = historical
          .reduce((sum, d) => sum.plus(d.wealth), new Decimal(0))
          .dividedBy(divisor);
      } else {
        const previousPeriod = recentPeriods[1];
        const previousEntries = await ledgerRepo.getLedgerEntriesForPeriod(previousPeriod.id);
        baseIncome = calculateIncome(previousEntries);
        const previousSpending = calculateTotalSpending(previousEntries, categoryMap);
        baseWealth = calculateWealthCreated(baseIncome, previousSpending);
      }

      const incomeChange = currentIncome.minus(baseIncome);
      const incomeChangePercent = baseIncome.equals(0)
        ? new Decimal(0)
        : incomeChange.dividedBy(baseIncome).times(100);

      const wealthChange = currentWealth.minus(baseWealth);
      const wealthChangePercent = baseWealth.equals(0)
        ? new Decimal(0)
        : wealthChange.dividedBy(baseWealth).times(100);

      comparison = {
        type: compareTo,
        income: {
          current: currentIncome.toString(),
          compared: baseIncome.toFixed(2),
          change: incomeChange.toString(),
          changePercent: incomeChangePercent.toFixed(1) + '%',
        },
        wealth: {
          current: currentWealth.toString(),
          compared: baseWealth.toFixed(2),
          change: wealthChange.toString(),
          changePercent: wealthChangePercent.toFixed(1) + '%',
        },
      };
    }

    const dashboardData: DashboardData = {
      currentPeriod: {
        id: currentPeriod.id,
        index: getPayCycleIndex(currentPeriod.startDate),
        startDate: currentPeriod.startDate.toISOString(),
        endDate: currentPeriod.endDate.toISOString(),
        isReconciled: currentPeriod.status === 'RECONCILED',
      },
      cashMetrics: {
        opening: currentPeriod.openingCash.toString(),
        income: currentIncome.toString(),
        spending: currentSpending.toString(),
        savings: currentSavings.toString(),
        ending: currentCashEnding.toString(),
        isBalanced,
        balanceError: balanceError.toString(),
      },
      wealthMetrics: {
        created: currentWealth.toString(),
        savingsRate: savingsRate.toFixed(1) + '%',
        isSavingsHealthy: savingsHealthy,
        spendingPercentage: spendingPercent.toFixed(1) + '%',
        isSpendingControlled: spendingControlled,
      },
      categoryBreakdown: categoryData,
      savingsRecap: {
        totalSavings: currentSavings.toString(),
        buckets: savingsData,
      },
      scorecard: {
        overall: scorecard.toFixed(1),
        grade: gradeScore(scorecard),
        savingsDiscipline: savingsDiscipline.toFixed(1),
        expenseControl: expenseControl.toFixed(1),
        miscLeakage: miscLeakage.toFixed(1),
        wealthGrowth: wealthGrowth.toFixed(1),
        reconciliation: reconciliation.toFixed(1),
        categoryDiscipline: categoryDiscipline.toFixed(1),
      },
      forecast,
      comparison,
    };

    return {
      success: true,
      data: dashboardData,
    };
  } catch (error) {
    console.error('getDashboardData error:', error);
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}

/**
 * Quick dashboard summary
 *
 * Minimal dashboard for mobile or quick view.
 * Returns only essential metrics.
 */
export async function getDashboardSummary(
  userId: string = 'default-user'
): Promise<
  ApiResponse<{
    cash: string;
    wealth: string;
    savingsRate: string;
    scorecard: string;
  }>
> {
  try {
    const result = await getDashboardData(
      { includeProjection: false },
      userId
    );

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error ?? 'Unable to load dashboard summary',
      };
    }

    return {
      success: true,
      data: {
        cash: result.data.cashMetrics.ending,
        wealth: result.data.wealthMetrics.created,
        savingsRate: result.data.wealthMetrics.savingsRate,
        scorecard: result.data.scorecard.overall,
      },
    };
  } catch (error) {
    console.error('getDashboardSummary error:', error);
    return {
      success: false,
      error: `Server error: ${(error as Error).message}`,
    };
  }
}
