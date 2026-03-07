import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { aggregateMonthly } from './monthly';

describe('monthly aggregation', () => {
  it('aggregates biweekly periods into monthly totals', () => {
    const result = aggregateMonthly([
      { income: new Decimal(3500), spending: new Decimal(650), savings: new Decimal(500) },
      { income: new Decimal(3500), spending: new Decimal(700), savings: new Decimal(450) },
    ]);

    expect(result.income.toFixed(2)).toBe('7000.00');
    expect(result.spending.toFixed(2)).toBe('1350.00');
    expect(result.savings.toFixed(2)).toBe('950.00');
    expect(result.wealthCreated.toFixed(2)).toBe('5650.00');
  });
});
