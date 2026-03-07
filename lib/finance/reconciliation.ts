/**
 * Period Reconciliation Logic
 *
 * Domain logic for verifying and balancing period transactions.
 * A period is reconciled when expected cash matches actual cash
 * within a small tolerance.
 */

import { Decimal } from '@prisma/client/runtime/library';

type LedgerEntryLike = {
  amount: Decimal;
  categoryId: string;
};

export const RECONCILIATION_TOLERANCE = new Decimal('0.01'); // 1 cent

/**
 * Calculate expected cash at end of period
 *
 * Formula:
 *   Expected Cash = Opening Cash + Total Income - Total Spending - Total Savings
 *
 * This is what the balance SHOULD be if all transactions are correct.
 *
 * @example
 *   calculateExpectedCash(
 *     new Decimal(1000),    // Opening
 *     new Decimal(3500),    // Income
 *     new Decimal(655),     // Spending
 *     new Decimal(500)      // Savings
 *   )
 *   // Returns: $3,345
 */
export function calculateExpectedCash(
  openingCash: Decimal,
  income: Decimal,
  spending: Decimal,
  savings: Decimal
): Decimal {
  return openingCash.plus(income).minus(spending).minus(savings);
}

/**
 * Calculate reconciliation difference
 *
 * Returns the discrepancy between expected and actual cash.
 *
 * Positive = We have MORE than expected (found money / data error)
 * Negative = We have LESS than expected (lost money / transaction missing)
 * Zero = Perfect reconciliation
 *
 * @example
 *   calculateReconciliationDifference(
 *     new Decimal(3345),    // Expected
 *     new Decimal(3342.50)  // Actual
 *   )
 *   // Returns: -$2.50 (missing $2.50)
 */
export function calculateReconciliationDifference(
  expectedCash: Decimal,
  actualCash: Decimal
): Decimal {
  return actualCash.minus(expectedCash);
}

/**
 * Check if period is reconciled
 *
 * Period is reconciled if difference is within tolerance.
 * Default tolerance: $0.01
 *
 * Tolerance handles:
 *   - Rounding in manual balance entry
 *   - Penny rounding on credit card statements
 *   - Minor data entry errors
 *
 * @example
 *   isReconciled(-0.01)  // true (within tolerance)
 *   isReconciled(-0.02)  // false (exceeds tolerance)
 *   isReconciled(0)      // true (perfect)
 */
export function isReconciled(
  difference: Decimal,
  tolerance: Decimal = RECONCILIATION_TOLERANCE
): boolean {
  return difference.abs().lessThanOrEqualTo(tolerance);
}

/**
 * Get reconciliation quality score
 *
 * Returns 0-100 based on how close to reconciliation.
 * 100 = reconciled, 0 = completely off.
 *
 * @example
 *   getReconciliationQuality(
 *     new Decimal(-0.01),
 *     new Decimal(3345)
 *   )
 *   // Returns: 100 (nearly perfect)
 *
 *   getReconciliationQuality(
 *     new Decimal(-50),
 *     new Decimal(3345)
 *   )
 *   // Returns: ~99 (missing $50, but expected is $3,345)
 */
export function getReconciliationQuality(
  difference: Decimal,
  expectedCash: Decimal
): Decimal {
  if (expectedCash.equals(0)) return new Decimal(100);

  // Calculate error as percentage
  const errorPercent = difference
    .abs()
    .dividedBy(expectedCash.abs())
    .times(100);

  // Quality = 100 - errorPercent, minimum 0
  const quality = new Decimal(100).minus(errorPercent);
  return quality.lessThan(0) ? new Decimal(0) : quality.toDecimalPlaces(1);
}

/**
 * Generate reconciliation hints
 *
 * Analyzes transaction patterns to suggest where discrepancy might be.
 *
 * Rules:
 *   1. If difference > 0: We have extra (found money, double-entry, rounding up)
 *   2. If difference < 0: We're missing (forgot entry, rounding down, theft)
 *   3. Patterns: Check last few transactions for duplicates or round numbers
 *
 * @example
 *   const hints = generateReconciliationHints(
 *     new Decimal(-45.67),
 *     entries,
 *     categoryMap
 *   )
 *   // Returns: [
 *   //   "Missing $45.67 from expected balance",
 *   //   "Check for recent large cash withdrawals",
 *   //   "Look for duplicate entries in last 5 transactions"
 *   // ]
 */
export function generateReconciliationHints(
  difference: Decimal,
  entries: LedgerEntryLike[],
  categoryMap: Map<string, { type: string; countsAsExpense: boolean }>
): string[] {
  const hints: string[] = [];

  const diffAmount = Math.abs(parseFloat(difference.toString()));
  const diffSign = difference.isNegative() ? 'missing' : 'extra';

  // Primary message
  hints.push(`You are ${diffSign} $${diffAmount.toFixed(2)} from reconciliation`);

  if (difference.isNegative()) {
    // Missing money
    hints.push('Check for:');
    hints.push('  • Recent unrecorded cash withdrawal');
    hints.push('  • Forgotten expense from last week');
    hints.push('  • Rounding or partial entry');
  } else if (difference.isPositive()) {
    // Extra money
    hints.push('Check for:');
    hints.push('  • Duplicate entry (accidental double-entry)');
    hints.push('  • Unexpected refund or return');
    hints.push('  • Transfer reversal');
  }

  // Check for recent large or round transactions
  const recentRoundTransactions = entries
    .slice(-5)
    .filter((e) => {
      const amount = parseFloat(e.amount.toString());
      return amount % 10 === 0; // Round to nearest 10
    });

  if (recentRoundTransactions.length > 0) {
    hints.push(
      `Found ${recentRoundTransactions.length} recent "round" transactions (could be estimates)`
    );
  }

  return hints;
}

/**
 * Calculate reconstruction suggestion
 *
 * If period is unreconciled, suggest:
 *   - Actual entry needed to match expected
 *   - OR adjustment to expected based on actual
 *
 * @example
 *   suggestReconciliationAction(
 *     new Decimal(3345),     // Expected
 *     new Decimal(3342.50),  // Actual
 *     'ACTUAL_MISSING'       // Action type
 *   )
 *   // Returns: "Add transaction: +$2.50 misc income (or adjustment entry)"
 */
export function suggestReconciliationAction(
  expectedCash: Decimal,
  actualCash: Decimal,
  actionType: 'ACTUAL_MISSING' | 'EXPECTED_WRONG' = 'ACTUAL_MISSING'
): string {
  const difference = expectedCash.minus(actualCash);

  if (actionType === 'ACTUAL_MISSING') {
    return (
      `Create entry: ${difference.isNegative() ? '-' : '+'} ` +
      `$${difference.abs().toFixed(2)} ` +
      `${difference.isNegative() ? 'withdrawal' : 'deposit'} (reconciliation adjustment)`
    );
  } else {
    return (
      `Correct opening balance or income/expense entry by: ` +
      `${difference.isNegative() ? '-' : '+'} $${difference.abs().toFixed(2)}`
    );
  }
}
