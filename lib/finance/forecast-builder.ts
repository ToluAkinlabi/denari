/**
 * Forecast History Builder
 *
 * Builds category history from ledger entries for forecasting
 */

import { Decimal } from '@prisma/client/runtime/library';
import { LedgerEntry, Category } from '@prisma/client';
import { CategoryHistory } from './forecast-enhanced';
import { detectFrequency } from './frequency-detection';

type EntryWithCategory = LedgerEntry & {
  category: Category;
};

/**
 * Build category history from ledger entries
 * Groups by category and extracts amounts/dates for forecasting
 */
export function buildCategoryHistory(
  entries: EntryWithCategory[],
  entryType: 'INCOME' | 'EXPENSE'
): CategoryHistory[] {
  const categoryMap = new Map<string, {
    category: Category;
    amounts: Decimal[];
    dates: Date[];
  }>();

  // Group entries by category
  entries.forEach(entry => {
    if (entry.entryType !== entryType) return;

    const catId = entry.categoryId;
    if (!categoryMap.has(catId)) {
      categoryMap.set(catId, {
        category: entry.category,
        amounts: [],
        dates: [],
      });
    }

    const catData = categoryMap.get(catId)!;
    catData.amounts.push(entry.amount);
    catData.dates.push(entry.date);
  });

  // Build history array
  const histories: CategoryHistory[] = [];

  categoryMap.forEach((data, categoryId) => {
    const { category, amounts, dates } = data;

    // Respect explicit category strategy first; otherwise infer from history + metadata
    const strategy =
      category.defaultStrategy !== 'UNKNOWN'
        ? category.defaultStrategy
        : inferStrategyFromHistory(category, amounts, dates, entryType);

    histories.push({
      categoryId,
      categoryName: category.name,
      amounts,
      dates,
      forecastStrategy: strategy,
    });
  });

  return histories;
}

function inferStrategyFromHistory(
  category: Category,
  amounts: Decimal[],
  dates: Date[],
  entryType: 'INCOME' | 'EXPENSE'
): CategoryHistory['forecastStrategy'] {
  if (amounts.length === 0) return 'UNKNOWN';
  if (amounts.length === 1) return 'UNKNOWN';

  const freq = detectFrequency(dates);
  const amountVariance = calculateCoefficientOfVariation(amounts);
  const expected = (category.expectedFrequency || 'VARIABLE').toUpperCase();

  // Strong recurring signals, tuned for real-world paycheck/rent variance.
  if (
    (freq.pattern === 'BIWEEKLY' && amountVariance < 0.2) ||
    (expected === 'BIWEEKLY' && amounts.length >= 3 && amountVariance < 0.25) ||
    (entryType === 'INCOME' && amounts.length >= 3 && amountVariance < 0.25)
  ) {
    return 'KNOWN_RECURRING';
  }

  if (
    (freq.pattern === 'MONTHLY' && amountVariance < 0.25) ||
    (expected === 'MONTHLY' && amounts.length >= 2 && amountVariance < 0.3)
  ) {
    return 'KNOWN_IRREGULAR';
  }

  if (
    ['QUARTERLY', 'ANNUAL'].includes(freq.pattern) ||
    ['QUARTERLY', 'ANNUAL'].includes(expected)
  ) {
    return 'KNOWN_IRREGULAR';
  }

  if (amountVariance < 0.45) {
    return 'KNOWN_VARIABLE';
  }

  return 'UNKNOWN';
}

/**
 * Build savings category history
 */
export function buildSavingsHistory(
  entries: EntryWithCategory[]
): CategoryHistory[] {
  const categoryMap = new Map<string, {
    category: Category;
    amounts: Decimal[];
    dates: Date[];
  }>();

  // Group savings/transfer entries
  entries.forEach(entry => {
    if (entry.entryType !== 'TRANSFER' && !entry.category.countsAsSavings) return;

    const catId = entry.categoryId;
    if (!categoryMap.has(catId)) {
      categoryMap.set(catId, {
        category: entry.category,
        amounts: [],
        dates: [],
      });
    }

    const catData = categoryMap.get(catId)!;
    catData.amounts.push(entry.amount);
    catData.dates.push(entry.date);
  });

  // Build history array
  const histories: CategoryHistory[] = [];

  categoryMap.forEach((data, categoryId) => {
    histories.push({
      categoryId,
      categoryName: data.category.name,
      amounts: data.amounts,
      dates: data.dates,
      forecastStrategy: data.category.defaultStrategy,
    });
  });

  return histories;
}

/**
 * Calculate coefficient of variation (stdDev / mean)
 */
function calculateCoefficientOfVariation(values: Decimal[]): number {
  if (values.length < 2) return 0;

  const mean = values.reduce((sum, val) => sum.plus(val), new Decimal(0))
    .dividedBy(values.length);

  if (mean.equals(0)) return 0;

  const variance = values.reduce((sum, val) => {
    const diff = val.minus(mean);
    return sum.plus(diff.times(diff));
  }, new Decimal(0)).dividedBy(values.length);

  const stdDev = Math.sqrt(variance.toNumber());
  return stdDev / mean.toNumber();
}
