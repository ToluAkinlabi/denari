/**
 * Monthly aggregation utilities.
 *
 * Rolls biweekly periods into calendar-month views on demand.
 */

import { Decimal } from '@prisma/client/runtime/library';

export interface MonthlyPeriodInput {
  income: Decimal;
  spending: Decimal;
  savings: Decimal;
}

export interface MonthlyAggregate {
  income: Decimal;
  spending: Decimal;
  savings: Decimal;
  wealthCreated: Decimal;
}

export function aggregateMonthly(periods: MonthlyPeriodInput[]): MonthlyAggregate {
  const income = periods.reduce((sum, p) => sum.plus(p.income), new Decimal(0));
  const spending = periods.reduce((sum, p) => sum.plus(p.spending), new Decimal(0));
  const savings = periods.reduce((sum, p) => sum.plus(p.savings), new Decimal(0));

  return {
    income,
    spending,
    savings,
    wealthCreated: income.minus(spending),
  };
}
