/**
 * Savings & Wealth Calculations
 *
 * Domain logic for wealth creation and savings transfers.
 *
 * CRITICAL DISTINCTION:
 *   - Savings = Money transferred to wealth accounts (not spending)
 *   - Wealth Created = Income - Spending (NOT affected by savings)
 *
 * This is the most important rule in the financial model.
 * Never mix savings with spending or let it reduce wealth.
 */

import { Decimal } from '@prisma/client/runtime/library';

type LedgerEntryLike = {
  amount: Decimal;
  entryType: string;
  categoryId: string;
};

/**
 * Calculate total income
 *
 * Sums all INCOME type entries.
 *
 * @example
 *   calculateIncome(entries)
 *   // Returns: $3,500
 */
export function calculateIncome(entries: LedgerEntryLike[]): Decimal {
  return entries
    .filter((e) => e.entryType === 'INCOME')
    .reduce((sum, entry) => sum.plus(entry.amount), new Decimal(0));
}

/**
 * Calculate total savings transfers
 *
 * Sums all entries where category.countsAsSavings === true
 *
 * These are NOT expenses. They're wealth relocation.
 *
 * @example
 *   calculateSavingsTransfers(entries, categoryMap)
 *   // Returns: $500
 */
export function calculateSavingsTransfers(
  entries: LedgerEntryLike[],
  categoryMap: Map<string, { countsAsSavings: boolean }>
): Decimal {
  return entries.reduce((sum, entry) => {
    const category = categoryMap.get(entry.categoryId);
    if (category?.countsAsSavings) {
      return sum.plus(entry.amount);
    }
    return sum;
  }, new Decimal(0));
}

/**
 * Calculate wealth created
 *
 * CORE FORMULA:
 *   Wealth Created = Income - Real Spending
 *
 * NOTE: Savings transfers do NOT reduce wealth.
 *       You create wealth by earning more than you consume.
 *       Where that wealth goes (savings, investments) doesn't change the amount.
 *
 * @example
 *   calculateWealthCreated(
 *     new Decimal(3500),    // Income
 *     new Decimal(655)      // Real Spending
 *   )
 *   // Returns: $2,845
 *   // This is true REGARDLESS of whether you saved $500, $1000, or $0
 *   // Savings is WHERE the wealth goes, not WHAT the wealth is.
 */
export function calculateWealthCreated(
  income: Decimal,
  spending: Decimal
): Decimal {
  const wealth = income.minus(spending);
  // Allow negative wealth to surface financial deficits truthfully
  // Negative wealth indicates overspending relative to income
  return wealth;
}

/**
 * Calculate savings rate
 *
 * Formula:
 *   Savings Rate = (Total Savings / Income) × 100%
 *
 * Target: ≥15% for good financial health
 *
 * @example
 *   calculateSavingsRate(
 *     new Decimal(3500),    // Income
 *     new Decimal(500)      // Savings
 *   )
 *   // Returns: 14.29%
 */
export function calculateSavingsRate(
  income: Decimal,
  savings: Decimal
): Decimal {
  if (income.equals(0)) return new Decimal(0);
  return savings
    .dividedBy(income)
    .times(100)
    .toDecimalPlaces(2);
}

/**
 * Check if savings rate meets target
 */
export function isSavingsRateHealthy(
  savingsRate: Decimal,
  targetRate: Decimal = new Decimal(15)
): boolean {
  return savingsRate.greaterThanOrEqualTo(targetRate);
}

/**
 * Calculate wealth created per period from history
 *
 * Returns average wealth created over recent periods.
 *
 * @example
 *   const wealthHistory = [
 *     { income: 3500, spending: 655 },
 *     { income: 3500, spending: 720 },
 *     { income: 3500, spending: 600 }
 *   ]
 *   getAverageWealthCreated(wealthHistory)
 *   // Returns: ~$2,841.67 average per period
 */
export function getAverageWealthCreated(
  periodData: Array<{ income: Decimal; spending: Decimal }>
): Decimal {
  if (periodData.length === 0) return new Decimal(0);

  const totalWealth = periodData.reduce((sum, period) => {
    return sum.plus(
      calculateWealthCreated(period.income, period.spending)
    );
  }, new Decimal(0));

  return totalWealth.dividedBy(periodData.length).toDecimalPlaces(2);
}

/**
 * Check if wealth is growing
 *
 * True if positive wealth is created.
 */
export function isWealthGrowing(wealthCreated: Decimal): boolean {
  return wealthCreated.greaterThan(0);
}
