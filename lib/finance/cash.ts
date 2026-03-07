/**
 * Cash Calculations
 *
 * Domain logic for cash remaining and liquid money calculations.
 *
 * Cash is the money currently available in checking/liquid accounts.
 * It is affected by: income, expenses, and savings transfers (outflows).
 *
 * Rule: Never mix cash with wealth or spending calculations.
 * Cash represents actual liquid money, not financial health.
 */

import { Decimal } from '@prisma/client/runtime/library';

/**
 * Calculate cash remaining for a period
 *
 * Formula:
 *   Cash Remaining = Opening Cash + Income - Expenses - Savings
 *
 * Explanation:
 *   - Opening Cash: Starting liquid money
 *   - Income: Money coming in
 *   - Expenses: Money spent (countsAsExpense=true)
 *   - Savings: Money transferred out (countsAsSavings=true)
 *
 * @example
 *   calculateCashRemaining(
 *     new Decimal(5000),    // Opening: $5,000
 *     new Decimal(3500),    // Income: +$3,500
 *     new Decimal(655),     // Expenses: -$655
 *     new Decimal(500)      // Savings: -$500
 *   )
 *   // Returns: $7,345
 */
export function calculateCashRemaining(
  openingCash: Decimal,
  income: Decimal,
  expenses: Decimal,
  savings: Decimal
): Decimal {
  return openingCash
    .plus(income)
    .minus(expenses)
    .minus(savings);
}

/**
 * Verify closing cash against expected
 *
 * Used for reconciliation.
 *
 * @example
 *   const difference = verifyCashBalance(
 *     new Decimal(7345),    // Expected from formula
 *     new Decimal(7340),    // Actual from bank
 *   )
 *   // Returns: 5 (off by $5)
 */
export function verifyCashBalance(
  expectedCash: Decimal,
  actualCash: Decimal | null
): Decimal | null {
  if (actualCash === null) return null;
  return expectedCash.minus(actualCash).abs();
}

/**
 * Determine if cash balance matches
 *
 * Within tolerance of $0.01 for floating point errors.
 */
export function isCashReconciled(
  difference: Decimal | null,
  tolerance: Decimal = new Decimal('0.01')
): boolean {
  if (difference === null) return false;
  return difference.lessThanOrEqualTo(tolerance);
}
