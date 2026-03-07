import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import {
  calculateWealthCreated,
  calculateSavingsRate,
  calculateSavingsTransfers,
} from './wealth';

describe('wealth calculations', () => {
  it('calculates wealth as income minus spending', () => {
    const result = calculateWealthCreated(new Decimal(3500), new Decimal(655));
    expect(result.toFixed(2)).toBe('2845.00');
  });

  it('does not return negative wealth', () => {
    const result = calculateWealthCreated(new Decimal(500), new Decimal(700));
    expect(result.toFixed(2)).toBe('0.00');
  });

  it('calculates savings rate with precision', () => {
    const rate = calculateSavingsRate(new Decimal(3500), new Decimal(500));
    expect(rate.toFixed(2)).toBe('14.29');
  });

  it('sums only savings-flagged entries', () => {
    const entries = [
      { amount: new Decimal(500), categoryId: 'a' },
      { amount: new Decimal(45), categoryId: 'b' },
    ] as Array<{ amount: Decimal; categoryId: string }>;

    const categoryMap = new Map<string, { countsAsSavings: boolean }>([
      ['a', { countsAsSavings: true }],
      ['b', { countsAsSavings: false }],
    ]);

    const total = calculateSavingsTransfers(
      entries as unknown as Array<{ amount: Decimal; entryType: string; categoryId: string }>,
      categoryMap
    );
    expect(total.toFixed(2)).toBe('500.00');
  });
});
