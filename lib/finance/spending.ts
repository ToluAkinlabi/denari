/**
 * Spending & Expense Calculations
 *
 * Domain logic for real spending (money consumed and gone).
 *
 * Spending includes all categories marked with countsAsExpense=true.
 * Spending DOES NOT include savings transfers.
 *
 * Rule: Spending is money gone forever, not wealth relocation.
 */

import { Decimal } from '@prisma/client/runtime/library';

type LedgerEntryLike = {
  amount: Decimal;
  entryType: string;
  categoryId: string;
};

/**
 * Calculate total spending from ledger entries
 *
 * Sums all entries where category.countsAsExpense === true
 *
 * @example
 *   const entries = [
 *     { categoryId: 'grocery', amount: 45 },    // countsAsExpense=true
 *     { categoryId: 'savings', amount: 500 },   // countsAsExpense=false
 *     { categoryId: 'coffee', amount: 75 }      // countsAsExpense=true
 *   ]
 *   const categories = new Map([
 *     ['grocery', { countsAsExpense: true }],
 *     ['savings', { countsAsExpense: false }],
 *     ['coffee', { countsAsExpense: true }]
 *   ])
 *   calculateTotalSpending(entries, categories)
 *   // Returns: $120 (45 + 75, excludes 500)
 */
export function calculateTotalSpending(
  entries: LedgerEntryLike[],
  categoryMap: Map<string, { countsAsExpense: boolean }>
): Decimal {
  return entries.reduce((sum, entry) => {
    const category = categoryMap.get(entry.categoryId);
    if (category?.countsAsExpense) {
      return sum.plus(entry.amount);
    }
    return sum;
  }, new Decimal(0));
}

/**
 * Calculate spending rate as percentage of income
 *
 * Formula:
 *   Spending Rate = (Total Spending / Income) × 100%
 *
 * Used for checking discipline: target is ≤70% of income.
 *
 * @example
 *   calculateSpendingRate(
 *     new Decimal(3500),    // Income
 *     new Decimal(655)      // Spending
 *   )
 *   // Returns: 18.71% (well under 70% target)
 */
export function calculateSpendingRate(
  income: Decimal,
  spending: Decimal
): Decimal {
  if (income.equals(0)) return new Decimal(0);
  return spending
    .dividedBy(income)
    .times(100)
    .toDecimalPlaces(2);
}

/**
 * Check if spending is within target
 */
export function isSpendingWithinTarget(
  spendingRate: Decimal,
  targetRate: Decimal = new Decimal(70)
): boolean {
  return spendingRate.lessThanOrEqualTo(targetRate);
}

/**
 * Calculate spending by category
 *
 * Returns breakdown of spending across categories.
 *
 * @example
 *   const breakdown = calculateSpendingByCategory(entries, categoryMap)
 *   // Returns:
 *   // [
 *   //   { categoryId: 'grocery', amount: 300, count: 8 },
 *   //   { categoryId: 'coffee', amount: 120, count: 24 },
 *   //   { categoryId: 'misc', amount: 235, count: 12 }
 *   // ]
 */
export function calculateSpendingByCategory(
  entries: LedgerEntryLike[],
  categoryMap: Map<
    string,
    { countsAsExpense: boolean; name: string }
  >
): Array<{
  categoryId: string;
  categoryName: string;
  amount: Decimal;
  count: number;
  percentage: Decimal;
}> {
  const breakdown = new Map<
    string,
    { amount: Decimal; count: number; name: string }
  >();

  // Accumulate by category
  entries.forEach((entry) => {
    const category = categoryMap.get(entry.categoryId);
    if (!category?.countsAsExpense) return;

    const existing = breakdown.get(entry.categoryId) || {
      amount: new Decimal(0),
      count: 0,
      name: category.name,
    };

    breakdown.set(entry.categoryId, {
      amount: existing.amount.plus(entry.amount),
      count: existing.count + 1,
      name: existing.name,
    });
  });

  // Calculate total
  const total = Array.from(breakdown.values()).reduce(
    (sum, item) => sum.plus(item.amount),
    new Decimal(0)
  );

  // Convert to results with percentages
  return Array.from(breakdown.entries()).map(([categoryId, data]) => ({
    categoryId,
    categoryName: data.name,
    amount: data.amount,
    count: data.count,
    percentage: total.equals(0)
      ? new Decimal(0)
      : data.amount
          .dividedBy(total)
          .times(100)
          .toDecimalPlaces(2),
  }));
}
