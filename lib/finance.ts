/**
 * Finance Calculation Engine
 *
 * Core financial math utilities.
 * All calculations maintain strict distinction between:
 * - Cash (liquid money in accounts)
 * - Spending (money consumed, gone)
 * - Savings (wealth relocation)
 * - Wealth Created (income - real spending)
 */

import { Decimal } from '@prisma/client/runtime/library';

export interface LedgerEntry {
  id: string;
  amount: string | number | Decimal;
  entryType: string;
  categoryId: string;
}

export interface Category {
  id: string;
  name: string;
  type: string;
  countsAsExpense: boolean;
  countsAsSavings: boolean;
}

export interface PeriodFinancials {
  income: Decimal;
  expenses: Decimal;
  savings: Decimal;
  cashRemaining: Decimal;
  wealthCreated: Decimal;
  savingsRate: Decimal;
  expenseRate: Decimal;
}

/**
 * Convert any numeric value to Decimal
 */
export function toDecimal(value: string | number | Decimal): Decimal {
  if (value instanceof Decimal) return value;
  return new Decimal(value);
}

/**
 * Sum up decimal values safely
 */
export function sumDecimals(values: (string | number | Decimal)[]): Decimal {
  return values.reduce<Decimal>(
    (sum, val) => sum.plus(toDecimal(val)),
    new Decimal(0)
  );
}

/**
 * Calculate period income
 * Sum all INCOME entries for the period
 */
export function calculatePeriodIncome(entries: LedgerEntry[]): Decimal {
  const incomeEntries = entries.filter(
    (e) => e.entryType === 'INCOME'
  );
  return sumDecimals(incomeEntries.map((e) => e.amount));
}

/**
 * Calculate real expenses (only categories marked as countsAsExpense)
 * This excludes savings transfers
 */
export function calculatePeriodExpenses(
  entries: LedgerEntry[],
  categories: Map<string, Category>
): Decimal {
  const expenseEntries = entries.filter((e) => {
    const category = categories.get(e.categoryId);
    return category && category.countsAsExpense === true;
  });
  return sumDecimals(expenseEntries.map((e) => e.amount));
}

/**
 * Calculate savings transfers (only categories marked as countsAsSavings)
 * Savings is NOT spending—it's wealth relocation
 */
export function calculateSavingsTransfers(
  entries: LedgerEntry[],
  categories: Map<string, Category>
): Decimal {
  const savingsEntries = entries.filter((e) => {
    const category = categories.get(e.categoryId);
    return category && category.countsAsSavings === true;
  });
  return sumDecimals(savingsEntries.map((e) => e.amount));
}

/**
 * Calculate real spending (same as expenses)
 * Money actually consumed and gone
 */
export function calculateRealSpending(
  entries: LedgerEntry[],
  categories: Map<string, Category>
): Decimal {
  return calculatePeriodExpenses(entries, categories);
}

/**
 * Calculate wealth created in period
 * Wealth Created = Income - Real Spending
 *
 * Note: Savings does NOT reduce wealth creation.
 * Savings is part of wealth, not against it.
 */
export function calculateWealthCreated(
  entries: LedgerEntry[],
  categories: Map<string, Category>
): Decimal {
  const income = calculatePeriodIncome(entries);
  const realSpending = calculateRealSpending(entries, categories);
  return income.minus(realSpending);
}

/**
 * Calculate cash remaining in period
 * Cash = Opening Cash + Income - Expenses - Savings (outflows)
 *
 * This tracks liquid money available.
 */
export function calculateCashRemaining(
  openingCash: Decimal,
  entries: LedgerEntry[],
  categories: Map<string, Category>
): Decimal {
  const income = calculatePeriodIncome(entries);
  const expenses = calculatePeriodExpenses(entries, categories);
  const savings = calculateSavingsTransfers(entries, categories);

  return openingCash.plus(income).minus(expenses).minus(savings);
}

/**
 * Calculate savings rate
 * Savings Rate = Savings / Income
 */
export function calculateSavingsRate(
  income: Decimal,
  savings: Decimal
): Decimal {
  if (income.equals(0)) return new Decimal(0);
  return savings.dividedBy(income).times(100).toDecimalPlaces(2);
}

/**
 * Calculate expense rate
 * Expense Rate = Expenses / Income
 */
export function calculateExpenseRate(
  income: Decimal,
  expenses: Decimal
): Decimal {
  if (income.equals(0)) return new Decimal(0);
  return expenses.dividedBy(income).times(100).toDecimalPlaces(2);
}

/**
 * Reconcile a period
 * Compare expected closing cash vs actual closing cash
 */
export interface ReconciliationResult {
  expectedClosingCash: Decimal;
  actualClosingCash: Decimal;
  difference: Decimal;
  isReconciled: boolean;
  reconciliationStatus: 'MATCHED' | 'MISMATCH' | 'PENDING_ACTUAL';
}

export function reconcilePeriod(
  openingCash: Decimal,
  income: Decimal,
  expenses: Decimal,
  savings: Decimal,
  actualClosingCash: Decimal | null
): ReconciliationResult {
  const expectedClosingCash = openingCash
    .plus(income)
    .minus(expenses)
    .minus(savings);

  if (actualClosingCash === null) {
    return {
      expectedClosingCash,
      actualClosingCash: new Decimal(0),
      difference: new Decimal(0),
      isReconciled: false,
      reconciliationStatus: 'PENDING_ACTUAL',
    };
  }

  const difference = expectedClosingCash.minus(actualClosingCash).abs();
  const isReconciled = difference.equals(0);

  return {
    expectedClosingCash,
    actualClosingCash,
    difference,
    isReconciled,
    reconciliationStatus: isReconciled ? 'MATCHED' : 'MISMATCH',
  };
}

/**
 * Calculate full period financials summary
 */
export function calculatePeriodFinancials(
  openingCash: Decimal,
  entries: LedgerEntry[],
  categories: Map<string, Category>
): PeriodFinancials {
  const income = calculatePeriodIncome(entries);
  const expenses = calculatePeriodExpenses(entries, categories);
  const savings = calculateSavingsTransfers(entries, categories);
  const cashRemaining = calculateCashRemaining(openingCash, entries, categories);
  const wealthCreated = calculateWealthCreated(entries, categories);
  const savingsRate = calculateSavingsRate(income, savings);
  const expenseRate = calculateExpenseRate(income, expenses);

  return {
    income,
    expenses,
    savings,
    cashRemaining,
    wealthCreated,
    savingsRate,
    expenseRate,
  };
}

/**
 * Category breakdown for a period
 * Returns sum of amounts by category
 */
export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  amount: Decimal;
  percentage: Decimal;
  count: number;
}

export function calculateCategoryBreakdown(
  entries: LedgerEntry[],
  categories: Map<string, Category>,
  entryType?: string
): CategoryBreakdown[] {
  const breakdown = new Map<string, { amount: Decimal; count: number }>();

  entries.forEach((entry) => {
    if (entryType && entry.entryType !== entryType) return;

    const key = entry.categoryId;
    const current = breakdown.get(key) || { amount: new Decimal(0), count: 0 };

    breakdown.set(key, {
      amount: current.amount.plus(toDecimal(entry.amount)),
      count: current.count + 1,
    });
  });

  const total = sumDecimals(
    Array.from(breakdown.values()).map((v) => v.amount)
  );

  return Array.from(breakdown.entries()).map(([categoryId, data]) => ({
    categoryId,
    categoryName: categories.get(categoryId)?.name || 'Unknown',
    amount: data.amount,
    percentage: total.equals(0)
      ? new Decimal(0)
      : data.amount.dividedBy(total).times(100).toDecimalPlaces(2),
    count: data.count,
  }));
}

/**
 * Monthly aggregation
 * Rolls up multiple periods into monthly totals
 */
export interface MonthlyAggregate {
  year: number;
  month: number;
  income: Decimal;
  expenses: Decimal;
  savings: Decimal;
  wealthCreated: Decimal;
}

export function aggregatePeriodsToMonth(
  periodFinancials: PeriodFinancials[]
): MonthlyAggregate {
  return {
    year: 0,
    month: 0,
    income: sumDecimals(periodFinancials.map((p) => p.income)),
    expenses: sumDecimals(periodFinancials.map((p) => p.expenses)),
    savings: sumDecimals(periodFinancials.map((p) => p.savings)),
    wealthCreated: sumDecimals(periodFinancials.map((p) => p.wealthCreated)),
  };
}

/**
 * Simple forecast based on recent average spending
 */
export interface Forecast {
  projectedExpenses: Decimal;
  projectedSavings: Decimal;
  projectedCashRemaining: Decimal;
}

export function forecastNextPeriod(
  recentPeriodFinancials: PeriodFinancials[],
  projectedIncome: Decimal,
  currentOpeningCash: Decimal
): Forecast {
  const recentCount = recentPeriodFinancials.length;
  if (recentCount === 0) {
    return {
      projectedExpenses: new Decimal(0),
      projectedSavings: new Decimal(0),
      projectedCashRemaining: currentOpeningCash.plus(projectedIncome),
    };
  }

  const avgExpenses = sumDecimals(
    recentPeriodFinancials.map((p) => p.expenses)
  ).dividedBy(recentCount);

  const avgSavings = sumDecimals(
    recentPeriodFinancials.map((p) => p.savings)
  ).dividedBy(recentCount);

  const projectedCashRemaining = currentOpeningCash
    .plus(projectedIncome)
    .minus(avgExpenses)
    .minus(avgSavings);

  return {
    projectedExpenses: avgExpenses,
    projectedSavings: avgSavings,
    projectedCashRemaining,
  };
}

/**
 * Financial discipline score
 * Rated out of 100 based on multiple factors
 */
export interface FinancialScore {
  savingsDiscipline: number;
  expenseControl: number;
  miscLeakage: number;
  wealthGrowth: number;
  categoryBalance: number;
  reconciliationAccuracy: number;
  overallScore: number;
}

export function calculateFinancialScore(
  entries: LedgerEntry[],
  categories: Map<string, Category>,
  savingsRate: Decimal,
  expenseRate: Decimal,
  reconciliationDifference: Decimal,
  wealthCreated: Decimal,
  income: Decimal
): FinancialScore {
  // Savings discipline: target >= 15% savings rate = 20 points
  const savingsDiscipline = Math.min(
    20,
    savingsRate.toNumber() >= 15 ? 20 : (savingsRate.toNumber() / 15) * 20
  );

  // Expense control: target <= 70% of income = 20 points
  const expenseControl = Math.min(
    20,
    expenseRate.toNumber() <= 70 ? 20 : Math.max(0, 20 - (expenseRate.toNumber() - 70) / 2)
  );

  // Misc leakage: minimize misc spending = 15 points
  const miscBreakdown = calculateCategoryBreakdown(entries, categories);
  const miscEntry = miscBreakdown.find((c) => c.categoryName === 'Misc');
  const miscAmount = miscEntry?.amount || new Decimal(0);
  const income_num = income.toNumber();
  const miscPercentage = income_num > 0 ? (miscAmount.toNumber() / income_num) * 100 : 0;
  const miscLeakage = Math.min(15, Math.max(0, 15 - miscPercentage / 2));

  // Wealth growth: created positive wealth = 20 points
  const wealthGrowth = wealthCreated.greaterThan(0) ? 20 : 0;

  // Category balance: well-distributed spending (inverse of concentration) = 15 points
  const nonIncomeBreakdown = miscBreakdown.filter(
    (c) => categories.get(c.categoryId)?.type !== 'INCOME'
  );
  const concentrationScore = nonIncomeBreakdown.length > 0
    ? Math.min(15, (nonIncomeBreakdown.length / 8) * 15)
    : 0;

  // Reconciliation accuracy: difference < $5 = 10 points
  const reconciliationAccuracy = reconciliationDifference.lessThanOrEqualTo(5) ? 10 : 0;

  const overallScore = Math.round(
    savingsDiscipline +
      expenseControl +
      miscLeakage +
      wealthGrowth +
      concentrationScore +
      reconciliationAccuracy
  );

  return {
    savingsDiscipline: Math.round(savingsDiscipline),
    expenseControl: Math.round(expenseControl),
    miscLeakage: Math.round(miscLeakage),
    wealthGrowth: Math.round(wealthGrowth),
    categoryBalance: Math.round(concentrationScore),
    reconciliationAccuracy: Math.round(reconciliationAccuracy),
    overallScore: Math.min(100, overallScore),
  };
}
