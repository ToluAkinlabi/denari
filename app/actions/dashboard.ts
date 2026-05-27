/**
 * Dashboard Server Actions
 *
 * Orchestrates: data fetch → calculations → view model generation
 * Returns formatted data ready for UI consumption.
 */

'use server';

import { Decimal } from '@prisma/client/runtime/library';
import { differenceInCalendarDays, startOfDay, endOfDay } from 'date-fns';
import type { LedgerEntry, Category, SavingsAllocation, Note } from '@prisma/client';
import * as periodsRepo from '@/lib/repositories/periods';
import * as ledgerRepo from '@/lib/repositories/ledger';
import * as categoriesRepo from '@/lib/repositories/categories';
import * as rafTransfersRepo from '@/lib/repositories/raf-transfers';
import * as periodRafAllocationsRepo from '@/lib/repositories/period-raf-allocations';
import * as plaidRepo from '@/lib/repositories/plaid';
import * as savingsRepo from '@/lib/repositories/savings';
import * as usersRepo from '@/lib/repositories/users';
import { getPayCycleIndex } from '@/lib/periods';
import { calculateTotalSpending } from '@/lib/finance/spending';
import { createDemoDashboardData, isDemoModeEnabled } from '@/lib/demo-mode';
import { calculateCashflowByCategory } from '@/lib/finance/cashflow';
import { applyRafPeriodTransfers, buildRafTransferSuggestions, calculateRafPlan, getRafGuidanceConfidence, type RafPlan } from '@/lib/finance/raf';
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
import { forecastNextPeriodEnhanced } from '@/lib/finance/forecast-enhanced';
import { buildCategoryHistory, buildSavingsHistory } from '@/lib/finance/forecast-builder';
import { getDailyInsight } from '@/lib/ai/daily-insight';

interface SerializedCategoryForecast {
  categoryId: string;
  categoryName: string;
  strategy: string;
  forecast: { min: string; likely: string; max: string };
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  notes?: string;
}

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
  paceMetrics: {
    day: number;
    totalDays: number;
    dailyBudget: string;
    expectedSpend: string;
    actualSpend: string;
    status: 'GREEN' | 'YELLOW' | 'RED';
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
    isNegative: boolean;
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
    kind: 'income' | 'expense' | 'savings';
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
  raf: RafPlan;
  rafWeeklyTrend: {
    periodProgressPercent: string;
    topOverspendBucket: string;
    buckets: Array<{
      name: string;
      plannedToDate: string;
      actualSpent: string;
      variance: string;
      weeklySpend: string;
      status: 'UNDER' | 'ON_TRACK' | 'OVER';
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
    // Ranges for enhanced forecast
    income: { min: string; likely: string; max: string };
    spending: { min: string; likely: string; max: string };
    savings: { min: string; likely: string; max: string };
    discretionaryBuffer: { min: string; likely: string; max: string };
    endingCash: { min: string; likely: string; max: string };
    // Backward compatibility (using likely value)
    nextIncome: string;
    nextSpending: string;
    nextSavings: string;
    nextWealth: string;
    nextEndingCash: string;
    warnings: string[];
    categoryBreakdown?: SerializedCategoryForecast[];
  };
  aiInsight: {
    summary: string;
    model: string;
    generatedAt: string;
    reliability: 'HIGH' | 'MEDIUM' | 'LOW';
    reliabilityReason: string;
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

const RAF_CANONICAL_BUCKETS = [
  'Spend',
  'Partnership',
  'Debt',
  'Phone',
  'Other bills',
  'Gifts & Donations',
  'Savings',
  'Investments',
  'Groceries',
] as const;

function canonicalizeRafBucketName(name: string): string | null {
  const normalized = name.trim().toLowerCase();

  if (normalized === 'spend') return 'Spend';
  if (normalized === 'partnership') return 'Partnership';
  if (normalized === 'debt') return 'Debt';
  if (normalized === 'phone') return 'Phone';
  if (normalized === 'other' || normalized === 'others' || normalized === 'rent' || normalized === 'other bills') {
    return 'Other bills';
  }
  if (normalized === 'gifts' || normalized === 'gift' || normalized === 'misc' || normalized === 'gifts & donations') {
    return 'Gifts & Donations';
  }
  if (normalized === 'savings') return 'Savings';
  if (normalized === 'investment' || normalized === 'investments') return 'Investments';
  if (normalized === 'grocery' || normalized === 'groceries') return 'Groceries';

  return null;
}

function statusPriority(status: 'OPEN' | 'AT_RISK' | 'EXHAUSTED'): number {
  if (status === 'EXHAUSTED') return 3;
  if (status === 'AT_RISK') return 2;
  return 1;
}

function normalizeDashboardRafPlan(plan: RafPlan): RafPlan {
  const bucketMap = new Map<
    string,
    {
      categoryId: string;
      name: string;
      percent: Decimal;
      allocated: Decimal;
      spent: Decimal;
      remaining: Decimal;
      status: 'OPEN' | 'AT_RISK' | 'EXHAUSTED';
      kind: 'expense' | 'savings' | 'other';
    }
  >();

  for (const bucket of plan.buckets) {
    const canonicalName = canonicalizeRafBucketName(bucket.name);
    if (!canonicalName) continue;

    const existing = bucketMap.get(canonicalName);
    const bucketPercent = new Decimal(bucket.percent.replace('%', '') || '0');
    const bucketAllocated = new Decimal(bucket.allocated);
    const bucketSpent = new Decimal(bucket.spent);
    const bucketRemaining = new Decimal(bucket.remaining);

    if (!existing) {
      bucketMap.set(canonicalName, {
        categoryId: bucket.categoryId,
        name: canonicalName,
        percent: bucketPercent,
        allocated: bucketAllocated,
        spent: bucketSpent,
        remaining: bucketRemaining,
        status: bucket.status,
        kind: bucket.kind,
      });
      continue;
    }

    existing.percent = existing.percent.plus(bucketPercent);
    existing.allocated = existing.allocated.plus(bucketAllocated);
    existing.spent = existing.spent.plus(bucketSpent);
    existing.remaining = existing.remaining.plus(bucketRemaining);

    if (statusPriority(bucket.status) > statusPriority(existing.status)) {
      existing.status = bucket.status;
    }
  }

  const orderIndex = new Map<string, number>(
    RAF_CANONICAL_BUCKETS.map((name, idx) => [name, idx])
  );

  const normalizedBuckets = Array.from(bucketMap.values())
    .map((bucket) => {
      const remainingPercent = bucket.allocated.equals(0)
        ? new Decimal(0)
        : bucket.remaining.dividedBy(bucket.allocated).times(100);

      return {
        categoryId: bucket.categoryId,
        name: bucket.name,
        percent: `${bucket.percent.toFixed(2)}%`,
        allocated: bucket.allocated.toFixed(2),
        spent: bucket.spent.toFixed(2),
        remaining: bucket.remaining.toFixed(2),
        remainingPercent: `${remainingPercent.toFixed(2)}%`,
        status: bucket.status,
        kind: bucket.kind,
      };
    })
    .sort((left, right) => (orderIndex.get(left.name) ?? 999) - (orderIndex.get(right.name) ?? 999));

  return {
    ...plan,
    buckets: normalizedBuckets,
    exhaustedBuckets: normalizedBuckets.filter((bucket) => bucket.status === 'EXHAUSTED'),
    atRiskBuckets: normalizedBuckets.filter((bucket) => bucket.status === 'AT_RISK'),
    transferSuggestions: buildRafTransferSuggestions({ buckets: normalizedBuckets }),
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
  userId?: string
): Promise<ApiResponse<DashboardData>> {
  try {
    if (await isDemoModeEnabled()) {
      return { success: true, data: await createDemoDashboardData() };
    }
    const resolvedUserId = await usersRepo.resolveUserId(userId);
    const compareTo = options?.compareTo ?? 'PREVIOUS';
    const includeProjection = options?.includeProjection ?? true;

    // Fetch current period or provided period
    let currentPeriod = options?.periodId
      ? await periodsRepo.getPeriodById(options.periodId)
      : await periodsRepo.getCurrentPeriodForUser(resolvedUserId);

    if (!currentPeriod) {
      return {
        success: false,
        error: 'No current period found',
      };
    }

    // Ownership guard: when a specific periodId is provided, ensure it belongs to this user.
    if (options?.periodId && currentPeriod.userId !== resolvedUserId) {
      return { success: false, error: 'Unauthorized period access' };
    }

    // Fetch all data
    let allCurrentPeriodEntries = await ledgerRepo.getLedgerEntriesForPeriod(
      currentPeriod.id
    );

    const windowEntries = await ledgerRepo.getLedgerEntriesForUserDateRange(
      resolvedUserId,
      startOfDay(currentPeriod.startDate),
      endOfDay(currentPeriod.endDate)
    );
    const normalizedWindowEntries = windowEntries.map((entry) => ({
      ...entry,
      savingsAllocations: [],
      notes: [],
    }));

    const currentById = new Map<string, (typeof allCurrentPeriodEntries)[number]>();
    allCurrentPeriodEntries.forEach((entry) => currentById.set(entry.id, entry));
    normalizedWindowEntries.forEach((entry) => currentById.set(entry.id, entry));
    allCurrentPeriodEntries = Array.from(currentById.values());

    // If current period is empty, fall back to the most recent period with data.
    // This keeps dashboard/transactions useful right after backlog imports.
    if (!options?.periodId && allCurrentPeriodEntries.length === 0) {
      const mostRecentWithData = await periodsRepo.getMostRecentPeriodWithEntries(resolvedUserId);
      if (mostRecentWithData) {
        currentPeriod = mostRecentWithData;
        allCurrentPeriodEntries = await ledgerRepo.getLedgerEntriesForPeriod(currentPeriod.id);

        const fallbackWindowEntries = await ledgerRepo.getLedgerEntriesForUserDateRange(
          resolvedUserId,
          startOfDay(currentPeriod.startDate),
          endOfDay(currentPeriod.endDate)
        );
        const normalizedFallbackWindowEntries = fallbackWindowEntries.map((entry) => ({
          ...entry,
          savingsAllocations: [],
          notes: [],
        }));
        const fallbackById = new Map<string, (typeof allCurrentPeriodEntries)[number]>();
        allCurrentPeriodEntries.forEach((entry) => fallbackById.set(entry.id, entry));
        normalizedFallbackWindowEntries.forEach((entry) => fallbackById.set(entry.id, entry));
        allCurrentPeriodEntries = Array.from(fallbackById.values());
      }
    }
    const periodStart = startOfDay(currentPeriod.startDate);
    const periodEnd = startOfDay(currentPeriod.endDate);

    // Guard rail: only include entries whose date falls inside this period window.
    // Period boundaries: INCLUSIVE on both start and end dates
    const currentEntries = allCurrentPeriodEntries.filter((entry) => {
      const entryDay = startOfDay(entry.date);
      return entryDay >= periodStart && entryDay <= periodEnd;
    });
    const [importedEntries, categories, periodTransfers, periodAllocations] = await Promise.all([
      plaidRepo.getIncludedImportedTransactionsForDateRange(resolvedUserId, periodStart, periodEnd),
      categoriesRepo.getCategoriesForUser(resolvedUserId),
      rafTransfersRepo.getRafTransfersForPeriod(resolvedUserId, currentPeriod.id),
      periodRafAllocationsRepo.getRafAllocationsForPeriod(currentPeriod.id),
    ]);

    const currentEntriesWithImported = [
      ...currentEntries,
      ...importedEntries.map((entry) => ({
        id: entry.id,
        userId: resolvedUserId,
        periodId: currentPeriod.id,
        date: entry.date,
        amount: entry.amount,
        categoryId: entry.categoryId ?? '',
        entryType: 'EXPENSE',
        source: 'plaid',
        description: entry.name,
        tags: [],
        forecastStrategy: 'UNKNOWN',
        nextOccurrence: null,
        isProvisional: entry.pending,
        createdAt: entry.date,
        updatedAt: entry.date,
        category: undefined,
        savingsAllocations: [],
        notes: [],
      })),
    ];
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
    const currentIncome = calculateIncome(currentEntriesWithImported);
    const currentSpending = calculateTotalSpending(currentEntriesWithImported, categoryMap);
    const currentSavings = calculateSavingsTransfers(currentEntriesWithImported, categoryMap);
    const currentCashEnding = calculateExpectedCash(
      currentPeriod.openingCash,
      currentIncome,
      currentSpending,
      currentSavings
    );
    const effectiveCashEnding = currentPeriod.status === 'RECONCILED' && currentPeriod.closingCashActual != null
      ? currentPeriod.closingCashActual
      : currentCashEnding;
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

    // Pace metrics calculation
    const today = startOfDay(new Date());
    const totalPeriodDays = differenceInCalendarDays(periodEnd, periodStart) + 1;
    const rawDaysElapsed = differenceInCalendarDays(today, periodStart) + 1;
    const daysElapsed = Math.max(0, Math.min(rawDaysElapsed, totalPeriodDays));
    const dailyBudget = currentIncome.equals(0)
      ? new Decimal(0)
      : currentIncome.dividedBy(totalPeriodDays);
    const expectedSpend = dailyBudget.times(daysElapsed);
    
    // Pace status: GREEN (under pace), YELLOW (near pace ~90-110%), RED (overspending)
    const paceRatio = expectedSpend.equals(0)
      ? new Decimal(0)
      : currentSpending.dividedBy(expectedSpend);
    let paceStatus: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
    if (paceRatio.greaterThanOrEqualTo(1.1)) {
      paceStatus = 'RED';
    } else if (paceRatio.greaterThanOrEqualTo(0.9)) {
      paceStatus = 'YELLOW';
    }

    const paceMetrics = {
      day: Math.min(daysElapsed, totalPeriodDays),
      totalDays: totalPeriodDays,
      dailyBudget: dailyBudget.toFixed(2),
      expectedSpend: expectedSpend.toFixed(2),
      actualSpend: currentSpending.toFixed(2),
      status: paceStatus,
    };

    // For RAF calculations: use reconciled actual cash if available (period is anchored),
    // otherwise use the calculated opening cash for consistency across all modules
    const rafCarryForward = currentPeriod.status === 'RECONCILED' && currentPeriod.closingCashActual != null
      ? currentPeriod.closingCashActual
      : currentPeriod.openingCash;

    const baseRafPlan = calculateRafPlan({
      income: currentIncome,
      carryForward: rafCarryForward,
      entries: currentEntriesWithImported.map((entry) => ({
        categoryId: entry.categoryId,
        amount: entry.amount,
      })),
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        type: category.type,
        expectedFrequency: category.expectedFrequency,
        countsAsExpense: category.countsAsExpense ?? false,
        countsAsSavings: category.countsAsSavings ?? false,
        rafPercent: category.rafPercent,
      })),
      periodAllocations: periodAllocations.map((a) => ({
        categoryId: a.categoryId,
        rafPercent: a.rafPercent,
      })),
    });
    const rafPlan = normalizeDashboardRafPlan(applyRafPeriodTransfers(
      baseRafPlan,
      periodTransfers.map((transfer) => ({
        fromCategoryId: transfer.fromCategoryId,
        toCategoryId: transfer.toCategoryId,
        amount: transfer.amount,
      }))
    ));

    const periodProgressRatio = paceMetrics.totalDays > 0
      ? new Decimal(paceMetrics.day).dividedBy(paceMetrics.totalDays)
      : new Decimal(0);
    const weeklyWindowStart = new Date(today);
    weeklyWindowStart.setDate(weeklyWindowStart.getDate() - 6);
    const weeklySpendByCategory = new Map<string, Decimal>();

    currentEntriesWithImported.forEach((entry) => {
      if (!entry.categoryId) return;
      const entryDay = startOfDay(entry.date);
      if (entryDay < weeklyWindowStart || entryDay > today) return;
      const current = weeklySpendByCategory.get(entry.categoryId) || new Decimal(0);
      weeklySpendByCategory.set(entry.categoryId, current.plus(new Decimal(String(entry.amount))));
    });

    const rafWeeklyTrendBuckets = rafPlan.buckets.map((bucket) => {
      const allocated = new Decimal(bucket.allocated);
      const spent = new Decimal(bucket.spent);
      const plannedToDate = allocated.times(periodProgressRatio);
      const variance = spent.minus(plannedToDate);
      const tolerance = Decimal.max(allocated.times(0.05), new Decimal(10));
      const weeklySpend = weeklySpendByCategory.get(bucket.categoryId) || new Decimal(0);
      const status: 'UNDER' | 'ON_TRACK' | 'OVER' = variance.greaterThan(tolerance)
        ? 'OVER'
        : variance.lessThan(tolerance.negated())
        ? 'UNDER'
        : 'ON_TRACK';

      return {
        name: bucket.name,
        plannedToDate: plannedToDate.toFixed(2),
        actualSpent: spent.toFixed(2),
        variance: variance.toFixed(2),
        weeklySpend: weeklySpend.toFixed(2),
        status,
        sortKey: variance.toNumber(),
      };
    });

    const topOverspend = [...rafWeeklyTrendBuckets]
      .filter((bucket) => bucket.status === 'OVER')
      .sort((left, right) => right.sortKey - left.sortKey)[0];
    const rafWeeklyTrend = {
      periodProgressPercent: periodProgressRatio.times(100).toFixed(1),
      topOverspendBucket: topOverspend
        ? `${topOverspend.name} (+$${new Decimal(topOverspend.variance).toFixed(2)} vs plan)`
        : 'No RAF bucket is currently above planned pace.',
      buckets: rafWeeklyTrendBuckets
        .sort((left, right) => right.sortKey - left.sortKey)
        .slice(0, 5)
        .map((bucket) => ({
          name: bucket.name,
          plannedToDate: bucket.plannedToDate,
          actualSpent: bucket.actualSpent,
          variance: bucket.variance,
          weeklySpend: bucket.weeklySpend,
          status: bucket.status,
        })),
    };

    // Category breakdown - lifetime totals across all user entries
    const allEntriesForUser = await ledgerRepo.getLedgerEntriesForUser(resolvedUserId);

    const categoryBreakdown = calculateCashflowByCategory(
      allEntriesForUser,
      categoryMap
    );
    const categoryData = categoryBreakdown.map((item) => {
      return {
        name: item.categoryName,
        emoji: undefined,
        amount: item.amount.toFixed(2),
        percentage:
          item.percentage.toFixed(1) +
          (item.kind === 'income' ? '% of income' : '% of spend'),
        kind: item.kind,
        trend: 'stable' as const,
      };
    });

    // Savings recap
    const allAllocations = await savingsRepo.getAllBucketsForUser(resolvedUserId);
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
        amount: amount.toFixed(2),
        percentage: percentage.toFixed(1) + '%',
      };
    });

    // Scorecard - Optimize: fetch all entries for recent periods in one query batch
    const recentPeriods = await periodsRepo.getRecentPeriods(resolvedUserId, 4);
    
    // Batch fetch: get all entries for recent periods together instead of N+1 queries
    const entriesByPeriod = new Map<string, (LedgerEntry & { category: Category | null; savingsAllocations: SavingsAllocation[]; notes: Note[] })[]>();
    if (recentPeriods.length > 0) {
      for (const period of recentPeriods) {
        const entries = await ledgerRepo.getLedgerEntriesForPeriod(period.id);
        entriesByPeriod.set(period.id, entries);
      }
    }

    const recentData = recentPeriods.map((p: { id: string; status: string }) => {
      const entries = entriesByPeriod.get(p.id) || [];
      const income = calculateIncome(entries);
      const spending = calculateTotalSpending(entries, categoryMap);
      const savings = calculateSavingsTransfers(entries, categoryMap);
      const wealth = calculateWealthCreated(income, spending);
      return { income, spending, savings, wealth };
    });

    const recentWindow = recentData.slice(0, 3);
    const recentCount = recentWindow.length || 1;
    const avgRecentIncome = recentWindow
      .reduce((sum, item) => sum.plus(item.income), new Decimal(0))
      .dividedBy(recentCount);
    const avgRecentSpending = recentWindow
      .reduce((sum, item) => sum.plus(item.spending), new Decimal(0))
      .dividedBy(recentCount);
    const avgRecentSavings = recentWindow
      .reduce((sum, item) => sum.plus(item.savings), new Decimal(0))
      .dividedBy(recentCount);

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
      income: { min: '0', likely: '0', max: '0' },
      spending: { min: '0', likely: '0', max: '0' },
      savings: { min: '0', likely: '0', max: '0' },
      discretionaryBuffer: { min: '0', likely: '0', max: '0' },
      endingCash: { min: '0', likely: '0', max: '0' },
      nextIncome: '0',
      nextSpending: '0',
      nextSavings: '0',
      nextWealth: '0',
      nextEndingCash: '0',
      warnings: [],
    };

    if (includeProjection && recentPeriods.length >= 2) {
      try {
        // Build category histories from recent period entries
        const allRecentEntries = Array.from(entriesByPeriod.values()).flat();
        const entriesWithCategory = allRecentEntries
          .filter((entry) => entry.category !== null)
          .map((entry) => ({ ...entry, category: entry.category! }));
        
        const incomeCategories = buildCategoryHistory(
          entriesWithCategory,
          'INCOME'
        );
        
        const spendingCategories = buildCategoryHistory(
          entriesWithCategory,
          'EXPENSE'
        );
        
        const savingsCategories = buildSavingsHistory(
          entriesWithCategory
        );

        // Use enhanced forecast with category-level intelligence
        // Use effectiveCashEnding (reconciled actual if available) as forecast seed
        const enhancedResult = forecastNextPeriodEnhanced({
          currentCash: effectiveCashEnding,
          incomeCategories,
          spendingCategories,
          savingsCategories,
          periodIncome: currentIncome, // Use current income for context
        });

        forecast = {
          confidence: enhancedResult.confidence,
          income: {
            min: enhancedResult.income.min.toFixed(2),
            likely: enhancedResult.income.likely.toFixed(2),
            max: enhancedResult.income.max.toFixed(2),
          },
          spending: {
            min: enhancedResult.spending.min.toFixed(2),
            likely: enhancedResult.spending.likely.toFixed(2),
            max: enhancedResult.spending.max.toFixed(2),
          },
          savings: {
            min: enhancedResult.savings.min.toFixed(2),
            likely: enhancedResult.savings.likely.toFixed(2),
            max: enhancedResult.savings.max.toFixed(2),
          },
          discretionaryBuffer: {
            min: enhancedResult.discretionaryBuffer.min.toFixed(2),
            likely: enhancedResult.discretionaryBuffer.likely.toFixed(2),
            max: enhancedResult.discretionaryBuffer.max.toFixed(2),
          },
          endingCash: {
            min: enhancedResult.endingCash.min.toFixed(2),
            likely: enhancedResult.endingCash.likely.toFixed(2),
            max: enhancedResult.endingCash.max.toFixed(2),
          },
          // Backward compatibility - use likely values
          nextIncome: enhancedResult.income.likely.toFixed(2),
          nextSpending: enhancedResult.spending.likely.toFixed(2),
          nextSavings: enhancedResult.savings.likely.toFixed(2),
          nextWealth: enhancedResult.wealthCreated.likely.toFixed(2),
          nextEndingCash: enhancedResult.endingCash.likely.toFixed(2),
          warnings: enhancedResult.warnings,
          categoryBreakdown: enhancedResult.categoryBreakdown.map((category) => ({
            categoryId: category.categoryId,
            categoryName: category.categoryName,
            strategy: category.strategy,
            forecast: {
              min: category.forecast.min.toFixed(2),
              likely: category.forecast.likely.toFixed(2),
              max: category.forecast.max.toFixed(2),
            },
            confidence: category.confidence,
            notes: category.notes,
          })),
        };
      } catch (error) {
        // Fallback to simple forecast if enhanced fails
        console.error('Enhanced forecast failed, using simple forecast:', error);
        
        const recentIncome = recentData.map((d) => d.income);
        const recentSpending = recentData.map((d) => d.spending);
        const recentSavings = recentData.map((d) => d.savings);

        // Use effectiveCashEnding (reconciled actual if available) as forecast seed
        const forecastResult = forecastNextPeriod({
          currentCash: effectiveCashEnding,
          recentIncome,
          recentSpending,
          recentSavings,
        });

        const likely = forecastResult.income.toFixed(2);
        forecast = {
          confidence: forecastResult.confidence,
          income: { min: likely, likely, max: likely },
          spending: { 
            min: forecastResult.spending.toFixed(2), 
            likely: forecastResult.spending.toFixed(2), 
            max: forecastResult.spending.toFixed(2) 
          },
          savings: {
            min: forecastResult.savings.toFixed(2),
            likely: forecastResult.savings.toFixed(2),
            max: forecastResult.savings.toFixed(2)
          },
          discretionaryBuffer: { min: '0', likely: '0', max: '0' },
          endingCash: {
            min: forecastResult.endingCash.toFixed(2),
            likely: forecastResult.endingCash.toFixed(2),
            max: forecastResult.endingCash.toFixed(2)
          },
          nextIncome: forecastResult.income.toFixed(2),
          nextSpending: forecastResult.spending.toFixed(2),
          nextSavings: forecastResult.savings.toFixed(2),
          nextWealth: forecastResult.wealthCreated.toFixed(2),
          nextEndingCash: forecastResult.endingCash.toFixed(2),
          warnings: getForecastWarnings(forecastResult),
        };
      }
    }

    const guidanceConfidence = getRafGuidanceConfidence({
      profileSource: rafPlan.profileSource,
      warningCount: rafPlan.warnings.length,
      exhaustedCount: rafPlan.exhaustedBuckets.length,
      atRiskCount: rafPlan.atRiskBuckets.length,
      historyPeriods: recentPeriods.length,
      forecastConfidence: forecast.confidence,
    });

    const partnershipContribution = currentEntries
      .filter((entry) => {
        if (!entry.categoryId) return false;
        const category = categoryMap.get(entry.categoryId);
        return Boolean(
          category &&
          category.name.toLowerCase().includes('partnership') &&
          (category.countsAsExpense || category.countsAsSavings)
        );
      })
      .reduce((sum, entry) => sum.plus(new Decimal(String(entry.amount))), new Decimal(0));

    const scenarioExtraSpend = new Decimal(
      Math.min(250, Math.max(25, Number(currentSpending.times(0.08).toFixed(2))))
    );
    const scenarioSkipSavings = currentSavings.greaterThan(0)
      ? new Decimal(
          Math.min(250, Math.max(20, Number(currentSavings.times(0.35).toFixed(2))))
        )
      : new Decimal(0);
    const scenarioSkipPartnership = partnershipContribution.greaterThan(0)
      ? new Decimal(
          Math.min(300, Math.max(20, Number(partnershipContribution.times(0.3).toFixed(2))))
        )
      : new Decimal(0);
    const forecastLikelyCash = new Decimal(forecast.nextEndingCash || '0');
    const scenarioRiskCash = forecastLikelyCash.minus(scenarioExtraSpend);
    const scenarioLiquidityCash = forecastLikelyCash.plus(scenarioSkipSavings).plus(scenarioSkipPartnership);
    const daysRemaining = Math.max(1, paceMetrics.totalDays - paceMetrics.day);
    const spendBucket = rafPlan.buckets.find((bucket) => bucket.name.toLowerCase() === 'spend');
    const spendRemaining = spendBucket ? new Decimal(spendBucket.remaining) : new Decimal(0);
    const suggestedDailySpendCap = Decimal.max(spendRemaining.dividedBy(daysRemaining), new Decimal(0));
    const priorityBucket = rafPlan.exhaustedBuckets[0] ?? rafPlan.atRiskBuckets[0] ?? rafPlan.buckets[0];

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
          current: currentIncome.toFixed(2),
          compared: baseIncome.toFixed(2),
          change: incomeChange.toFixed(2),
          changePercent: incomeChangePercent.toFixed(1) + '%',
        },
        wealth: {
          current: currentWealth.toFixed(2),
          compared: baseWealth.toFixed(2),
          change: wealthChange.toFixed(2),
          changePercent: wealthChangePercent.toFixed(1) + '%',
        },
      };
    }

    const aiInsight = await getDailyInsight(resolvedUserId, {
      income: currentIncome.toFixed(2),
      spending: currentSpending.toFixed(2),
      savings: currentSavings.toFixed(2),
      wealthCreated: currentWealth.toFixed(2),
      endingCash: currentCashEnding.toFixed(2),
      spendingPercent: spendingPercent.toFixed(1) + '%',
      savingsRate: savingsRate.toFixed(1) + '%',
      paceStatus,
      periodDay: paceMetrics.day,
      totalDays: paceMetrics.totalDays,
      forecastIncome: forecast.nextIncome,
      forecastSpending: forecast.nextSpending,
      forecastSavings: forecast.nextSavings,
      forecastEndingCash: forecast.nextEndingCash,
      forecastWarnings: forecast.warnings,
      avgRecentIncome: avgRecentIncome.toFixed(2),
      avgRecentSpending: avgRecentSpending.toFixed(2),
      avgRecentSavings: avgRecentSavings.toFixed(2),
      scenarioExtraSpend: scenarioExtraSpend.toFixed(2),
      scenarioSkipSavings: scenarioSkipSavings.toFixed(2),
      scenarioSkipPartnership: scenarioSkipPartnership.toFixed(2),
      scenarioRiskCash: scenarioRiskCash.toFixed(2),
      scenarioLiquidityCash: scenarioLiquidityCash.toFixed(2),
      daysRemaining,
      suggestedDailySpendCap: suggestedDailySpendCap.toFixed(2),
      priorityBucketName: priorityBucket?.name ?? 'Spend',
      priorityBucketRemaining: priorityBucket?.remaining ?? '0.00',
      priorityBucketStatus: priorityBucket?.status ?? 'OPEN',
      guidanceConfidence: guidanceConfidence.level,
      guidanceConfidenceReason: guidanceConfidence.reason,
      weeklyTrendSummary: rafWeeklyTrend.topOverspendBucket,
      weeklyTrendBuckets: rafWeeklyTrend.buckets
        .map((bucket) => `${bucket.name}: weekly $${bucket.weeklySpend}, variance $${bucket.variance}`)
        .join(' | '),
      transferSuggestionSummary: rafPlan.transferSuggestions
        .map((item) => `$${item.amount} ${item.fromBucket}->${item.toBucket}`)
        .join(' | '),
      rafProfileSource: rafPlan.profileSource,
      rafTotalPercent: rafPlan.totalPercent,
      rafAllocated: rafPlan.allocated,
      rafUnallocated: rafPlan.unallocated,
      rafOverallocated: rafPlan.overallocated,
      rafTopBuckets: rafPlan.buckets
        .slice(0, 4)
        .map((bucket) => `${bucket.name}: ${bucket.remaining} left of ${bucket.allocated}`)
        .join(' | '),
      rafAtRiskBuckets: rafPlan.atRiskBuckets
        .map((bucket) => `${bucket.name}: ${bucket.remaining} left`)
        .join(' | '),
      rafExhaustedBuckets: rafPlan.exhaustedBuckets
        .map((bucket) => `${bucket.name}: exhausted`) 
        .join(' | '),
      rafWarnings: rafPlan.warnings,
    });

    const dashboardData: DashboardData = {
      currentPeriod: {
        id: currentPeriod.id,
        index: getPayCycleIndex(currentPeriod.startDate) + 1,
        startDate: currentPeriod.startDate.toISOString(),
        endDate: currentPeriod.endDate.toISOString(),
        isReconciled: currentPeriod.status === 'RECONCILED',
      },
      paceMetrics,
      cashMetrics: {
        opening: currentPeriod.openingCash.toFixed(2),
        income: currentIncome.toFixed(2),
        spending: currentSpending.toFixed(2),
        savings: currentSavings.toFixed(2),
        ending: effectiveCashEnding.toFixed(2),
        isBalanced,
        balanceError: balanceError.toFixed(2),
      },
      wealthMetrics: {
        created: currentWealth.toFixed(2),
        isNegative: currentCashEnding.isNegative(),
        savingsRate: savingsRate.toFixed(1) + '%',
        isSavingsHealthy: savingsHealthy,
        spendingPercentage: spendingPercent.toFixed(1) + '%',
        isSpendingControlled: spendingControlled,
      },
      categoryBreakdown: categoryData,
      savingsRecap: {
        totalSavings: currentSavings.toFixed(2),
        buckets: savingsData,
      },
      raf: rafPlan,
      rafWeeklyTrend,
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
      aiInsight: {
        ...aiInsight,
        reliability: guidanceConfidence.level,
        reliabilityReason: guidanceConfidence.reason,
      },
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
  userId?: string
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
