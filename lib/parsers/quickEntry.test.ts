import { describe, expect, it } from 'vitest';
import { parseQuickEntry, inferEntryType } from './quickEntry';

describe('quick entry parser', () => {
  it('parses amount and category from simple input', () => {
    const parsed = parseQuickEntry('45 grocery');

    expect(parsed.amount.toFixed(2)).toBe('45.00');
    expect(parsed.category?.toLowerCase()).toContain('grocer');
    expect(parsed.entryType).toBe('EXPENSE');
  });

  it('detects savings entry type', () => {
    expect(inferEntryType('savings')).toBe('SAVINGS');
  });

  it('throws when no amount is provided', () => {
    expect(() => parseQuickEntry('coffee')).toThrow(/No amount found/);
  });
});
