import { cookies } from 'next/headers';
import type { DashboardData } from '@/app/actions/dashboard';
import type { MonthlyReportData } from '@/app/actions/reports';
import type { RafPageData } from '@/app/actions/raf';
import { startOfDay, subDays } from 'date-fns';
import type { RafPlan } from '@/lib/finance/raf';

export const DEMO_MODE_COOKIE = 'ledge-demo-mode';

function toIsoDate(value: Date) {
  return value.toISOString();
}

function formatRange(start: Date, end: Date) {
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function createDemoRafPlan(): RafPlan {
  const buckets = [
    {
      categoryId: 'demo-rent',
      name: 'Rent',
      percent: '19.08%',
      allocated: '620.00',
      spent: '595.00',
      remaining: '25.00',
      remainingPercent: '4.03%',
      status: 'AT_RISK' as const,
      kind: 'expense' as const,
    },
    {
      categoryId: 'demo-grocery',
      name: 'Grocery',
      percent: '7.69%',
      allocated: '250.00',
      spent: '175.00',
      remaining: '75.00',
      remainingPercent: '30.00%',
      status: 'OPEN' as const,
      kind: 'expense' as const,
    },
    {
      categoryId: 'demo-phone',
      name: 'Phone',
      percent: '4.92%',
      allocated: '160.00',
      spent: '152.00',
      remaining: '8.00',
      remainingPercent: '5.00%',
      status: 'AT_RISK' as const,
      kind: 'expense' as const,
    },
    {
      categoryId: 'demo-debt',
      name: 'Debt',
      percent: '13.23%',
      allocated: '430.00',
      spent: '430.00',
      remaining: '0.00',
      remainingPercent: '0.00%',
      status: 'EXHAUSTED' as const,
      kind: 'expense' as const,
    },
    {
      categoryId: 'demo-other',
      name: 'Other',
      percent: '4.00%',
      allocated: '130.00',
      spent: '70.00',
      remaining: '60.00',
      remainingPercent: '46.15%',
      status: 'OPEN' as const,
      kind: 'other' as const,
    },
    {
      categoryId: 'demo-spend',
      name: 'Spend',
      percent: '18.77%',
      allocated: '610.00',
      spent: '420.00',
      remaining: '190.00',
      remainingPercent: '31.15%',
      status: 'OPEN' as const,
      kind: 'expense' as const,
    },
    {
      categoryId: 'demo-misc',
      name: 'Misc',
      percent: '5.54%',
      allocated: '180.00',
      spent: '170.00',
      remaining: '10.00',
      remainingPercent: '5.56%',
      status: 'AT_RISK' as const,
      kind: 'other' as const,
    },
    {
      categoryId: 'demo-partnership',
      name: 'Partnership',
      percent: '12.92%',
      allocated: '420.00',
      spent: '90.00',
      remaining: '330.00',
      remainingPercent: '78.57%',
      status: 'OPEN' as const,
      kind: 'other' as const,
    },
    {
      categoryId: 'demo-savings',
      name: 'Savings',
      percent: '10.77%',
      allocated: '350.00',
      spent: '120.00',
      remaining: '230.00',
      remainingPercent: '65.71%',
      status: 'OPEN' as const,
      kind: 'savings' as const,
    },
    {
      categoryId: 'demo-investment',
      name: 'Investment',
      percent: '3.08%',
      allocated: '100.00',
      spent: '0.00',
      remaining: '100.00',
      remainingPercent: '100.00%',
      status: 'OPEN' as const,
      kind: 'savings' as const,
    },
  ];

  return {
    totalIncome: '2400.00',
    carryForward: '850.00',
    allocationBase: '3250.00',
    totalPercent: '100.00',
    allocated: '3250.00',
    unallocated: '0.00',
    overallocated: '0.00',
    profileSource: 'DEFAULT',
    warnings: [
      'Demo mode is active. All numbers shown here are synthetic.',
      'Consider moving about $75.00 from Partnership to Savings.',
    ],
    buckets,
    exhaustedBuckets: buckets.filter((bucket) => bucket.status === 'EXHAUSTED'),
    atRiskBuckets: buckets.filter((bucket) => bucket.status === 'AT_RISK'),
    transferSuggestions: [
      {
        fromBucket: 'Partnership',
        toBucket: 'Savings',
        amount: '75.00',
        reason: 'Savings is under pressure while Partnership has surplus capacity.',
      },
    ],
  };
}

const demoRafPlan = createDemoRafPlan();

function createDemoCategories() {
  return [
    { id: 'demo-rent', name: 'Rent', rafPercent: 19, type: 'RENT' },
    { id: 'demo-grocery', name: 'Grocery', rafPercent: 7, type: 'GROCERY' },
    { id: 'demo-phone', name: 'Phone', rafPercent: 5, type: 'PHONE' },
    { id: 'demo-debt', name: 'Debt', rafPercent: 14, type: 'DEBT' },
    { id: 'demo-other', name: 'Other', rafPercent: 4, type: 'OTHER' },
    { id: 'demo-spend', name: 'Spend', rafPercent: 19, type: 'SPEND' },
    { id: 'demo-misc', name: 'Misc', rafPercent: 6, type: 'MISC' },
    { id: 'demo-partnership', name: 'Partnership', rafPercent: 16, type: 'PARTNERSHIP' },
    { id: 'demo-savings', name: 'Savings', rafPercent: 11, type: 'SAVINGS' },
    { id: 'demo-investment', name: 'Investment', rafPercent: 5, type: 'SAVINGS' },
  ];
}

function createDemoTransactions() {
  const baseDate = startOfDay(new Date());
  return [
    { id: 'demo-tx-1', date: toIsoDate(baseDate), description: 'Paycheck', amount: '2400.00', type: 'INCOME', categoryName: 'Income', categoryId: 'demo-income' },
    { id: 'demo-tx-2', date: toIsoDate(subDays(baseDate, 1)), description: 'Rent Payment', amount: '620.00', type: 'EXPENSE', categoryName: 'Rent', categoryId: 'demo-rent' },
    { id: 'demo-tx-3', date: toIsoDate(subDays(baseDate, 2)), description: 'Grocery Run', amount: '74.18', type: 'EXPENSE', categoryName: 'Grocery', categoryId: 'demo-grocery' },
    { id: 'demo-tx-4', date: toIsoDate(subDays(baseDate, 3)), description: 'Phone Bill', amount: '52.00', type: 'EXPENSE', categoryName: 'Phone', categoryId: 'demo-phone' },
    { id: 'demo-tx-5', date: toIsoDate(subDays(baseDate, 4)), description: 'Savings Transfer', amount: '180.00', type: 'SAVINGS', categoryName: 'Savings', categoryId: 'demo-savings' },
    { id: 'demo-tx-6', date: toIsoDate(subDays(baseDate, 5)), description: 'Side Project Income', amount: '315.00', type: 'INCOME', categoryName: 'Partnership', categoryId: 'demo-partnership' },
    { id: 'demo-tx-7', date: toIsoDate(subDays(baseDate, 6)), description: 'Fuel', amount: '48.52', type: 'EXPENSE', categoryName: 'Other', categoryId: 'demo-other' },
    { id: 'demo-tx-8', date: toIsoDate(subDays(baseDate, 7)), description: 'Investment', amount: '100.00', type: 'SAVINGS', categoryName: 'Investment', categoryId: 'demo-investment' },
    { id: 'demo-tx-9', date: toIsoDate(subDays(baseDate, 8)), description: 'Restaurant', amount: '36.40', type: 'EXPENSE', categoryName: 'Spend', categoryId: 'demo-spend' },
    { id: 'demo-tx-10', date: toIsoDate(subDays(baseDate, 9)), description: 'Cash Refund', amount: '22.00', type: 'INCOME', categoryName: 'Income', categoryId: 'demo-income' },
    { id: 'demo-tx-11', date: toIsoDate(subDays(baseDate, 10)), description: 'Debt Payment', amount: '430.00', type: 'EXPENSE', categoryName: 'Debt', categoryId: 'demo-debt' },
    { id: 'demo-tx-12', date: toIsoDate(subDays(baseDate, 11)), description: 'Coffee', amount: '7.25', type: 'EXPENSE', categoryName: 'Misc', categoryId: 'demo-misc' },
    { id: 'demo-tx-13', date: toIsoDate(subDays(baseDate, 12)), description: 'Gig Income', amount: '180.00', type: 'INCOME', categoryName: 'Partnership', categoryId: 'demo-partnership' },
    { id: 'demo-tx-14', date: toIsoDate(subDays(baseDate, 13)), description: 'Subscription', amount: '14.99', type: 'EXPENSE', categoryName: 'Misc', categoryId: 'demo-misc' },
  ];
}

function createDemoPeriods() {
  const now = startOfDay(new Date());
  return Array.from({ length: 8 }, (_, index) => {
    const start = startOfDay(subDays(now, 14 * index + 13));
    const end = startOfDay(subDays(now, 14 * index));
    const income = 2200 + index * 55;
    const spending = 1420 + index * 40;
    const savings = 350 + index * 18;
    const wealth = income - spending;
    const openingCash = 650 + index * 45;
    const closingCashExpected = openingCash + income - spending - savings;
    const closingCashActual = index % 3 === 0 ? null : (closingCashExpected + (index % 2 === 0 ? 18 : -12)).toFixed(2);

    return {
      id: `demo-period-${index + 1}`,
      label: formatRange(start, end),
      index: index + 1,
      startDate: toIsoDate(start),
      endDate: toIsoDate(end),
      income: income.toFixed(2),
      spending: spending.toFixed(2),
      savings: savings.toFixed(2),
      wealth: wealth.toFixed(2),
      openingCash: openingCash.toFixed(2),
      closingCashExpected: closingCashExpected.toFixed(2),
      closingCashActual,
      isReconciled: index % 2 === 0,
    };
  });
}

const demoTransactions = createDemoTransactions();
const demoPeriods = createDemoPeriods();

export async function isDemoModeEnabled() {
  const cookieStore = await cookies();
  return cookieStore.get(DEMO_MODE_COOKIE)?.value === '1';
}

export async function createDemoDashboardData(): Promise<DashboardData> {
  const now = new Date();
  const periodStart = startOfDay(subDays(now, 7));
  const periodEnd = startOfDay(now);

  return {
    currentPeriod: {
      id: 'demo-period-current',
      index: 7,
      startDate: toIsoDate(periodStart),
      endDate: toIsoDate(periodEnd),
      isReconciled: false,
    },
    paceMetrics: {
      day: 6,
      totalDays: 14,
      dailyBudget: '171.43',
      expectedSpend: '1028.58',
      actualSpend: '780.25',
      status: 'GREEN',
    },
    cashMetrics: {
      opening: '850.00',
      income: '2400.00',
      spending: '1025.00',
      savings: '400.00',
      ending: '1825.00',
      isBalanced: true,
      balanceError: '0.00',
    },
    wealthMetrics: {
      created: '1375.00',
      isNegative: false,
      savingsRate: '16.67%',
      isSavingsHealthy: true,
      spendingPercentage: '42.71%',
      isSpendingControlled: true,
    },
    categoryBreakdown: [
      { name: 'Income', amount: '2715.00', percentage: '50.1%', kind: 'income', trend: 'up' },
      { name: 'Rent', amount: '620.00', percentage: '11.5%', kind: 'expense', trend: 'stable' },
      { name: 'Groceries', amount: '374.18', percentage: '6.9%', kind: 'expense', trend: 'up' },
      { name: 'Savings', amount: '580.00', percentage: '10.7%', kind: 'savings', trend: 'up' },
      { name: 'Misc', amount: '68.24', percentage: '1.3%', kind: 'expense', trend: 'down' },
    ],
    savingsRecap: {
      totalSavings: '580.00',
      buckets: [
        { name: 'Savings', amount: '350.00', percentage: '60.3%' },
        { name: 'Investment', amount: '100.00', percentage: '17.2%' },
        { name: 'Buffer', amount: '130.00', percentage: '22.4%' },
      ],
    },
    raf: demoRafPlan,
    rafWeeklyTrend: {
      periodProgressPercent: '42.86%',
      topOverspendBucket: 'Rent',
      buckets: [
        { name: 'Rent', plannedToDate: '310.00', actualSpent: '320.00', variance: '-10.00', weeklySpend: '160.00', status: 'OVER' },
        { name: 'Grocery', plannedToDate: '125.00', actualSpent: '104.00', variance: '+21.00', weeklySpend: '52.00', status: 'UNDER' },
        { name: 'Savings', plannedToDate: '175.00', actualSpent: '120.00', variance: '+55.00', weeklySpend: '60.00', status: 'UNDER' },
      ],
    },
    scorecard: {
      overall: '84',
      grade: 'B',
      savingsDiscipline: 'A-',
      expenseControl: 'B',
      miscLeakage: 'B+',
      wealthGrowth: 'A-',
      reconciliation: 'A',
      categoryDiscipline: 'B+',
    },
    forecast: {
      confidence: 'HIGH',
      income: { min: '2300.00', likely: '2450.00', max: '2600.00' },
      spending: { min: '1000.00', likely: '1125.00', max: '1275.00' },
      savings: { min: '350.00', likely: '450.00', max: '575.00' },
      discretionaryBuffer: { min: '140.00', likely: '220.00', max: '325.00' },
      endingCash: { min: '1550.00', likely: '1800.00', max: '2100.00' },
      nextIncome: '2450.00',
      nextSpending: '1125.00',
      nextSavings: '450.00',
      nextWealth: '1325.00',
      nextEndingCash: '1800.00',
      warnings: ['Demo mode is active. Forecast values are synthetic.'],
      categoryBreakdown: [
        { categoryId: 'demo-rent', categoryName: 'Rent', strategy: 'KNOWN_RECURRING', forecast: { min: '600.00', likely: '620.00', max: '640.00' }, confidence: 'HIGH', notes: 'Demo figure' },
      ],
    },
    aiInsight: {
      summary: 'Key insights: Demo mode is active, so all values are synthetic. Recommended actions: Review the pie chart, compare RAF buckets, and walk through the transaction list to show the workflow.',
      model: 'Demo Model',
      generatedAt: now.toISOString(),
      reliability: 'HIGH',
      reliabilityReason: 'Synthetic demo data.',
    },
    comparison: {
      type: 'PREVIOUS',
      income: { current: '2400.00', compared: '2325.00', change: '+75.00', changePercent: '+3.2%' },
      wealth: { current: '1375.00', compared: '1290.00', change: '+85.00', changePercent: '+6.6%' },
    },
  };
}

export function createDemoRafPageData(): RafPageData {
  const now = new Date();
  const start = startOfDay(subDays(now, 7));
  const end = startOfDay(now);

  return {
    periodId: 'demo-period-current',
    periodIndex: 7,
    periodRange: formatRange(start, end),
    income: '2400.00',
    carryForward: '850.00',
    allocationBase: '3250.00',
    isReconciled: false,
    hasIncome: true,
    raf: demoRafPlan,
    transfers: [
      {
        id: 'demo-transfer-1',
        fromCategoryId: 'demo-partnership',
        fromCategoryName: 'Partnership',
        toCategoryId: 'demo-savings',
        toCategoryName: 'Savings',
        amount: '75.00',
        createdAt: now.toISOString(),
      },
    ],
    categories: createDemoCategories().map((category) => ({
      id: category.id,
      name: category.name,
      rafPercent: category.rafPercent,
      type: category.type,
    })),
    periodProgressPercent: 43,
  };
}

export function createDemoMonthlyReportData(): MonthlyReportData {
  return {
    monthLabel: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    income: '2715.00',
    spending: '1025.00',
    savings: '580.00',
    wealthCreated: '1690.00',
    categoryBreakdown: [
      { category: 'Income', amount: '2715.00', percentage: '50.1%', kind: 'income' },
      { category: 'Rent', amount: '620.00', percentage: '11.5%', kind: 'expense' },
      { category: 'Grocery', amount: '374.18', percentage: '6.9%', kind: 'expense' },
      { category: 'Savings', amount: '580.00', percentage: '10.7%', kind: 'savings' },
      { category: 'Misc', amount: '68.24', percentage: '1.3%', kind: 'expense' },
    ],
    periodLabels: demoPeriods.slice(0, 6).map((period) => period.label),
    trendIncome: demoPeriods.slice(0, 6).map((_, index) => (2200 + index * 55).toFixed(2)),
    trendSpending: demoPeriods.slice(0, 6).map((_, index) => (1420 + index * 40).toFixed(2)),
    trendSavings: demoPeriods.slice(0, 6).map((_, index) => (350 + index * 18).toFixed(2)),
    trendWealth: demoPeriods.slice(0, 6).map((_, index) => (780 + index * 15).toFixed(2)),
    trendEndingCash: demoPeriods.slice(0, 6).map((_, index) => (1230 + index * 42).toFixed(2)),
  };
}

export function createDemoPeriodsPageData(page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  const items = demoPeriods.slice(start, start + pageSize);

  return {
    items,
    total: demoPeriods.length,
    page,
    pageSize,
  };
}

export function createDemoTransactionPageData(filters?: { limit?: number; offset?: number; type?: 'INCOME' | 'EXPENSE' | 'SAVINGS'; categoryId?: string }) {
  let transactions = [...demoTransactions];

  if (filters?.type) {
    transactions = transactions.filter((transaction) => transaction.type === filters.type);
  }

  if (filters?.categoryId) {
    transactions = transactions.filter((transaction) => transaction.categoryId === filters.categoryId);
  }

  const total = transactions.length;
  const limit = filters?.limit ?? 10;
  const offset = filters?.offset ?? 0;

  return {
    transactions: transactions.slice(offset, offset + limit),
    total,
  };
}

export function createDemoTransactionRangeData() {
  return {
    transactions: [...demoTransactions].slice(0, 12),
  };
}

export function createDemoBankReviewQueue() {
  return {
    transactions: [
      {
        id: 'demo-bank-1',
        date: toIsoDate(startOfDay(new Date())),
        amount: '74.18',
        name: 'GrocerMart',
        merchantName: 'GrocerMart',
        pending: false,
        reviewStatus: 'UNASSIGNED',
        categoryId: 'demo-grocery',
        categoryName: 'Grocery',
        includeInRaf: true,
        duplicateCategoryCounts: [{ categoryId: 'demo-grocery', categoryName: 'Grocery', count: 2 }],
      },
      {
        id: 'demo-bank-2',
        date: toIsoDate(subDays(startOfDay(new Date()), 1)),
        amount: '52.00',
        name: 'Phone Carrier',
        merchantName: 'Phone Carrier',
        pending: false,
        reviewStatus: 'UNASSIGNED',
        categoryId: 'demo-phone',
        categoryName: 'Phone',
        includeInRaf: true,
        duplicateCategoryCounts: [],
      },
    ],
    categories: createDemoCategories().filter((category) => category.type !== 'INCOME').map((category) => ({ id: category.id, name: category.name })),
  };
}

export function createDemoCategoryForecastSettings() {
  return createDemoCategories().map((category) => ({
    ...category,
    defaultStrategy: category.type === 'RENT' ? 'KNOWN_RECURRING' : 'KNOWN_VARIABLE',
    expectedFrequency: category.type === 'RENT' ? 'MONTHLY' : 'BIWEEKLY',
    isDiscretionary: category.type === 'SPEND' || category.type === 'MISC',
    countsAsExpense: category.type !== 'SAVINGS' && category.type !== 'PARTNERSHIP',
    countsAsSavings: category.type === 'SAVINGS',
  }));
}

export function createDemoPlaidConnectionStatus() {
  return {
    connected: false,
    institutionName: undefined,
  };
}
