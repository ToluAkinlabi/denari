/**
 * Financial Scorecard & Discipline Scoring
 *
 * Domain logic for evaluating financial health across 6 dimensions.
 * Scorecard is 0-100 where 100 is excellent financial discipline.
 */

import { Decimal } from '@prisma/client/runtime/library';

/**
 * Component weights for final score
 * Total = 100 points distributed across categories
 */
const SCORECARD_COMPONENTS = {
  SAVINGS_DISCIPLINE: 0.25, // Save ≥15% of income
  EXPENSE_CONTROL: 0.25, // Keep spending ≤70% of income
  MISC_LEAKAGE: 0.15, // Minimize small recurring expenses
  WEALTH_GROWTH: 0.20, // Create positive wealth trend
  RECONCILIATION: 0.10, // Keep period balanced
  CATEGORY_DISCIPLINE: 0.05, // Consistent category spending
} as const;

/**
 * Evaluate savings discipline (0-100)
 *
 * Score:
 *   ≥15% savings rate = 100
 *   10-15% = proportional (67-100)
 *   5-10% = proportional (33-67)
 *   <5% = 0-33
 *   Negative = 0
 *
 * @example
 *   evaluateSavingsDiscipline(
 *     new Decimal(3500),    // Income
 *     new Decimal(525)      // Savings (15%)
 *   )
 *   // Returns: 100
 */
export function evaluateSavingsDiscipline(
  income: Decimal,
  savings: Decimal
): Decimal {
  const savingsRate = income.equals(0)
    ? new Decimal(0)
    : savings.dividedBy(income).times(100);

  // Target: 15%
  if (savingsRate.greaterThanOrEqualTo(15)) {
    return new Decimal(100);
  }
  if (savingsRate.greaterThanOrEqualTo(10)) {
    // 10-15: scale to 67-100
    return new Decimal(67).plus(
      savingsRate.minus(10).dividedBy(5).times(33)
    );
  }
  if (savingsRate.greaterThanOrEqualTo(5)) {
    // 5-10: scale to 33-67
    return new Decimal(33).plus(
      savingsRate.minus(5).dividedBy(5).times(34)
    );
  }
  // < 5: scale 0-33
  return savingsRate.dividedBy(5).times(33);
}

/**
 * Evaluate expense control (0-100)
 *
 * Score based on spending ratio:
 *   ≤70% spending = 100
 *   70-80% = proportional (100-75)
 *   80-90% = proportional (75-50)
 *   >90% = 0
 *
 * @example
 *   evaluateExpenseControl(
 *     new Decimal(3500),    // Income
 *     new Decimal(655)      // Spending (18.7%)
 *   )
 *   // Returns: 100 (well controlled)
 */
export function evaluateExpenseControl(
  income: Decimal,
  spending: Decimal
): Decimal {
  const spendingRate = income.equals(0)
    ? new Decimal(0)
    : spending.dividedBy(income).times(100);

  // Target: ≤70%
  if (spendingRate.lessThanOrEqualTo(70)) {
    return new Decimal(100);
  }
  if (spendingRate.lessThanOrEqualTo(80)) {
    // 70-80: scale to 100-75
    return new Decimal(100).minus(
      spendingRate.minus(70).dividedBy(10).times(25)
    );
  }
  if (spendingRate.lessThanOrEqualTo(90)) {
    // 80-90: scale to 75-50
    return new Decimal(75).minus(
      spendingRate.minus(80).dividedBy(10).times(25)
    );
  }
  // > 90: penalty
  return new Decimal(0);
}

/**
 * Evaluate misc leakage (0-100)
 *
 * Scores "small recurring expenses" that add up.
 * Looks for categories with many small transactions.
 *
 * Score:
 *   ≤5% of income in small expenses = 100
 *   5-10% = 75
 *   10-15% = 50
 *   >15% = 0
 *
 * @example
 *   evaluateMiscLeakage(
 *     new Decimal(3500),
 *     new Decimal(140)      // Coffee: $5×28 days = $140 (4%)
 *   )
 *   // Returns: 100
 */
export function evaluateMiscLeakage(
  income: Decimal,
  miscExpenses: Decimal
): Decimal {
  const leakageRate = income.equals(0)
    ? new Decimal(0)
    : miscExpenses.dividedBy(income).times(100);

  if (leakageRate.lessThanOrEqualTo(5)) {
    return new Decimal(100);
  }
  if (leakageRate.lessThanOrEqualTo(10)) {
    return new Decimal(75);
  }
  if (leakageRate.lessThanOrEqualTo(15)) {
    return new Decimal(50);
  }
  return new Decimal(0);
}

/**
 * Evaluate wealth growth trend (0-100)
 *
 * Based on cumulative wealth created across last 4 periods.
 *
 * Score:
 *   Creating wealth every period = 100
 *   3 of 4 periods = 75
 *   2 of 4 periods = 50
 *   1 of 4 periods = 25
 *   0 = 0
 *
 * @example
 *   evaluateWealthGrowth([
 *     { wealthCreated: 2800 },  // +2800
 *     { wealthCreated: 2820 },  // +2820
 *     { wealthCreated: 2750 },  // +2750
 *     { wealthCreated: 2900 }   // +2900
 *   ])
 *   // Returns: 100 (wealth growing every period)
 */
export function evaluateWealthGrowth(
  periodData: Array<{ wealthCreated: Decimal }>
): Decimal {
  if (periodData.length === 0) return new Decimal(0);

  const positiveCount = periodData.filter((p) =>
    p.wealthCreated.greaterThan(0)
  ).length;

  if (positiveCount === 4) return new Decimal(100);
  if (positiveCount === 3) return new Decimal(75);
  if (positiveCount === 2) return new Decimal(50);
  if (positiveCount === 1) return new Decimal(25);
  return new Decimal(0);
}

/**
 * Evaluate reconciliation accuracy (0-100)
 *
 * Based on how often period is reconciled.
 *
 * Score:
 *   Reconciled current period = 100
 *   N periods since reconciliation:
 *     0 = 100
 *     1 = 80
 *     2 = 60
 *     3+ = 0
 *
 * @example
 *   evaluateReconciliation(0)  // Just reconciled = 100
 *   evaluateReconciliation(1)  // 1 period ago = 80
 */
export function evaluateReconciliation(periodsSinceReconciliation: number): Decimal {
  if (periodsSinceReconciliation === 0) return new Decimal(100);
  if (periodsSinceReconciliation === 1) return new Decimal(80);
  if (periodsSinceReconciliation === 2) return new Decimal(60);
  return new Decimal(0);
}

/**
 * Evaluate category discipline (0-100)
 *
 * Checks if spending is reasonably distributed across categories
 * (not dominated by one category).
 *
 * Score based on Herfindahl index (concentration measure):
 *   Well distributed = 100
 *   Somewhat concentrated = 75
 *   Very concentrated = 50
 *   Dominated by one = 0
 *
 * @example
 *   evaluateCategoryDiscipline({
 *     'groceries': 200,    // 30%
 *     'dining': 150,       // 22%
 *     'transportation': 200,  // 30%
 *     'entertainment': 100  // 15%
 *   })
 *   // Returns: 75 (good distribution)
 */
export function evaluateCategoryDiscipline(categories: {
  [key: string]: Decimal;
}): Decimal {
  const entries = Object.values(categories);
  if (entries.length === 0) return new Decimal(100);

  const total = entries.reduce((sum, val) => sum.plus(val), new Decimal(0));
  if (total.equals(0)) return new Decimal(100);

  // Calculate Herfindahl index (sum of squared proportions)
  const herfindahl = entries
    .reduce((sum, val) => {
      const proportion = val.dividedBy(total);
      return sum.plus(proportion.times(proportion));
    }, new Decimal(0))
    .toNumber();

  // Convert to score (1 = perfect dist, 1/n = one dominant)
  // For 4 categories: 0.25 = perfect, 1.0 = all in one
  const minIndex = 1 / entries.length;
  const maxIndex = 1;
  const normalizedScore = (maxIndex - herfindahl) / (maxIndex - minIndex);

  return new Decimal(Math.max(0, Math.min(1, normalizedScore)) * 100)
    .toDecimalPlaces(1);
}

/**
 * Calculate overall financial score (0-100)
 *
 * Weighted average of all 6 components.
 *
 * @example
 *   calculateFinancialScore({
 *     savingsDiscipline: 100,
 *     expenseControl: 100,
 *     miscLeakage: 100,
 *     wealthGrowth: 100,
 *     reconciliation: 100,
 *     categoryDiscipline: 85
 *   })
 *   // Returns: 98
 */
export function calculateFinancialScore(components: {
  savingsDiscipline: Decimal;
  expenseControl: Decimal;
  miscLeakage: Decimal;
  wealthGrowth: Decimal;
  reconciliation: Decimal;
  categoryDiscipline: Decimal;
}): Decimal {
  const weighted = new Decimal(0)
    .plus(
      components.savingsDiscipline.times(SCORECARD_COMPONENTS.SAVINGS_DISCIPLINE)
    )
    .plus(
      components.expenseControl.times(SCORECARD_COMPONENTS.EXPENSE_CONTROL)
    )
    .plus(components.miscLeakage.times(SCORECARD_COMPONENTS.MISC_LEAKAGE))
    .plus(components.wealthGrowth.times(SCORECARD_COMPONENTS.WEALTH_GROWTH))
    .plus(
      components.reconciliation.times(SCORECARD_COMPONENTS.RECONCILIATION)
    )
    .plus(
      components.categoryDiscipline.times(
        SCORECARD_COMPONENTS.CATEGORY_DISCIPLINE
      )
    );

  return weighted.toDecimalPlaces(1);
}

/**
 * Grade financial score
 *
 * Returns letter grade A-F based on score.
 *
 * @example
 *   gradeScore(new Decimal(92))  // "A" (90+)
 *   gradeScore(new Decimal(75))  // "C" (70-80)
 */
export function gradeScore(score: Decimal): string {
  const val = score.toNumber();
  if (val >= 90) return 'A';
  if (val >= 80) return 'B';
  if (val >= 70) return 'C';
  if (val >= 60) return 'D';
  return 'F';
}
