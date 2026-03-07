import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import {
  calculateExpectedCash,
  calculateReconciliationDifference,
  isReconciled,
} from './reconciliation';

describe('reconciliation', () => {
  it('calculates expected cash from opening/income/spending/savings', () => {
    const expected = calculateExpectedCash(
      new Decimal(1000),
      new Decimal(3500),
      new Decimal(655),
      new Decimal(500)
    );

    expect(expected.toFixed(2)).toBe('3345.00');
  });

  it('computes difference as actual minus expected', () => {
    const diff = calculateReconciliationDifference(new Decimal(3345), new Decimal(3342.5));
    expect(diff.toFixed(2)).toBe('-2.50');
  });

  it('treats one cent as reconciled by default tolerance', () => {
    expect(isReconciled(new Decimal('-0.01'))).toBe(true);
    expect(isReconciled(new Decimal('-0.02'))).toBe(false);
  });
});
