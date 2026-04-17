/**
 * Enhanced Financial Forecasting - Dynamic & Category-Aware
 *
 * Handles variable income, irregular expenses, and outlier detection
 */

import { Decimal } from '@prisma/client/runtime/library';
import { detectFrequency, isOutlier, categorizeExpenseSize } from './frequency-detection';

export interface CategoryHistory {
  categoryId: string;
  categoryName: string;
  amounts: Decimal[];
  dates: Date[];
  forecastStrategy: 'KNOWN_RECURRING' | 'KNOWN_VARIABLE' | 'KNOWN_IRREGULAR' | 'UNKNOWN' | 'ONE_TIME';
}

export interface ForecastRange {
  min: Decimal;
  likely: Decimal;
  max: Decimal;
}

export interface EnhancedForecastResult {
  income: ForecastRange;
  spending: ForecastRange;
  savings: ForecastRange;
  discretionaryBuffer: ForecastRange;  // For unknowns
  wealthCreated: ForecastRange;
  endingCash: ForecastRange;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  categoryBreakdown: CategoryForecast[];
  warnings: string[];
}

export interface CategoryForecast {
  categoryId: string;
  categoryName: string;
  strategy: string;
  forecast: ForecastRange;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  notes?: string;
}

function maxDecimal(a: Decimal, b: Decimal): Decimal {
  return a.comparedTo(b) >= 0 ? a : b;
}

/**
 * Calculate weighted average with recency bias
 * More recent periods get higher weight
 */
function getWeightedAverage(values: Decimal[]): Decimal {
  if (values.length === 0) return new Decimal(0);

  // Weights: [0.4, 0.3, 0.2, 0.1] for 4 most recent periods
  const weights = [0.4, 0.3, 0.2, 0.1];
  
  // Use only last 4 periods, most recent first
  const recent = values.slice(-4).reverse();
  
  let weightedSum = new Decimal(0);
  let totalWeight = 0;

  recent.forEach((val, idx) => {
    const weight = weights[idx] || 0.05; // Default small weight for older
    weightedSum = weightedSum.plus(val.times(weight));
    totalWeight += weight;
  });

  return weightedSum.dividedBy(totalWeight).toDecimalPlaces(2);
}

/**
 * Calculate median (outlier-resistant)
 */
function getMedian(values: Decimal[]): Decimal {
  if (values.length === 0) return new Decimal(0);

  const sorted = [...values].sort((a, b) => a.comparedTo(b));
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return sorted[mid - 1].plus(sorted[mid]).dividedBy(2).toDecimalPlaces(2);
  }

  return sorted[mid];
}

/**
 * Forecast a single category based on its history and strategy
 */
export function forecastCategory(history: CategoryHistory, periodIncome: Decimal): CategoryForecast {
  const { amounts, dates, forecastStrategy, categoryName, categoryId } = history;

  if (amounts.length === 0) {
    return {
      categoryId,
      categoryName,
      strategy: forecastStrategy,
      forecast: { min: new Decimal(0), likely: new Decimal(0), max: new Decimal(0) },
      confidence: 'LOW',
      notes: 'No history available',
    };
  }

  let forecast: ForecastRange;
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  let notes: string | undefined;

  switch (forecastStrategy) {
    case 'KNOWN_RECURRING':
      // Same amount each time (paycheck, rent)
      const median = getMedian(amounts);
      forecast = {
        min: median.times(0.95).toDecimalPlaces(2),
        likely: median,
        max: median.times(1.05).toDecimalPlaces(2),
      };
      confidence = 'HIGH';
      break;

    case 'KNOWN_VARIABLE':
      // Varies but predictable (groceries)
      const filteredAmounts = removeOutliers(amounts);
      const weighted = getWeightedAverage(filteredAmounts);
      const variance = calculateStdDev(filteredAmounts);
      forecast = {
        min: weighted.minus(variance).toDecimalPlaces(2),
        likely: weighted,
        max: weighted.plus(variance).toDecimalPlaces(2),
      };
      confidence = variance.lessThan(weighted.times(0.35)) ? 'MEDIUM' : 'LOW';
      break;

    case 'KNOWN_IRREGULAR':
      // Infrequent but known (flights, annual insurance)
      const freq = detectFrequency(dates);
      const avgAmount = amounts.reduce((sum, a) => sum.plus(a), new Decimal(0))
        .dividedBy(amounts.length);
      
      // Amortize over expected frequency
      const periodsPerOccurrence = Math.max(1, Math.round(freq.avgGapDays / 14)); // 14-day periods
      const amortized = avgAmount.dividedBy(periodsPerOccurrence);
      const occurrenceFactor = Math.min(1, 14 / Math.max(14, freq.avgGapDays));
      const minFactor = Math.max(0.2, occurrenceFactor * 0.5);
      const maxFactor = Math.max(0.45, occurrenceFactor);
      const irregularMax = maxDecimal(avgAmount.times(maxFactor).toDecimalPlaces(2), amortized.toDecimalPlaces(2));

      forecast = {
        min: amortized.times(minFactor).toDecimalPlaces(2),
        likely: amortized.toDecimalPlaces(2),
        max: irregularMax,
      };
      confidence = freq.avgGapDays <= 28 ? 'MEDIUM' : 'LOW';
      notes = `Avg: $${avgAmount.toFixed(2)} every ~${freq.avgGapDays} days`;
      break;

    case 'ONE_TIME':
      // Explicitly marked as non-repeating
      forecast = { min: new Decimal(0), likely: new Decimal(0), max: new Decimal(0) };
      confidence = 'HIGH';
      notes = 'Marked as one-time expense';
      break;

    case 'UNKNOWN':
    default:
      // New category or unpredictable
      if (amounts.length === 1) {
        const singleAmount = amounts[0];
        const size = categorizeExpenseSize(singleAmount, periodIncome);
        
        if (size === 'LARGE') {
          // Assume it's one-time if large
          forecast = { min: new Decimal(0), likely: new Decimal(0), max: singleAmount };
          notes = 'Assuming one-time (large amount)';
        } else {
          // Assume might repeat
          forecast = {
            min: new Decimal(0),
            likely: singleAmount.times(0.5),  // Conservative
            max: singleAmount,
          };
          notes = 'Limited history - conservative estimate';
        }
        confidence = 'LOW';
      } else {
        // Has some history
        const filteredAmounts = removeOutliers(amounts);
        const avg = getWeightedAverage(filteredAmounts);
        forecast = {
          min: avg.times(0.55),
          likely: avg.times(0.8),  // Conservative buffer
          max: avg.times(1.1),
        };
        confidence = 'LOW';
      }
      break;
  }

  // Ensure non-negative
  forecast.min = forecast.min.lessThan(0) ? new Decimal(0) : forecast.min;
  forecast.likely = forecast.likely.lessThan(0) ? new Decimal(0) : forecast.likely;
  forecast.max = forecast.max.lessThan(0) ? new Decimal(0) : forecast.max;

  return {
    categoryId,
    categoryName,
    strategy: forecastStrategy,
    forecast,
    confidence,
    notes,
  };
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: Decimal[]): Decimal {
  if (values.length === 0) return new Decimal(0);

  const mean = values.reduce((sum, val) => sum.plus(val), new Decimal(0))
    .dividedBy(values.length);

  const variance = values.reduce((sum, val) => {
    const diff = val.minus(mean);
    return sum.plus(diff.times(diff));
  }, new Decimal(0)).dividedBy(values.length);

  // Approximate square root for Decimal
  const stdDevNum = Math.sqrt(variance.toNumber());
  return new Decimal(stdDevNum).toDecimalPlaces(2);
}

function removeOutliers(values: Decimal[]): Decimal[] {
  if (values.length < 4) return values;

  const filtered = values.filter((value) => !isOutlier(value, values));

  // Keep original values if filtering would over-prune and destabilize estimates.
  return filtered.length >= 2 ? filtered : values;
}

/**
 * Enhanced forecast with category-level breakdown
 */
export function forecastNextPeriodEnhanced(input: {
  currentCash: Decimal;
  incomeCategories: CategoryHistory[];
  spendingCategories: CategoryHistory[];
  savingsCategories: CategoryHistory[];
  periodIncome?: Decimal;  // For sizing calculations
}): EnhancedForecastResult {
  const { currentCash, incomeCategories, spendingCategories, savingsCategories, periodIncome } = input;

  // Use recent average income if not provided
  const avgIncome = periodIncome || calculateAverageIncome(incomeCategories);

  // Forecast each category
  const incomeForecasts = incomeCategories.map(cat => forecastCategory(cat, avgIncome));
  const spendingForecasts = spendingCategories.map(cat => forecastCategory(cat, avgIncome));
  const savingsForecasts= savingsCategories.map(cat => forecastCategory(cat, avgIncome));

  // Aggregate ranges
  const income = aggregateForecasts(incomeForecasts);
  const spending = aggregateForecasts(spendingForecasts);
  const savings = aggregateForecasts(savingsForecasts);

  // Dynamic discretionary buffer: tighter when strategies are known, wider when unknown-heavy.
  const allForecasts = [...incomeForecasts, ...spendingForecasts, ...savingsForecasts];
  const unknownCount = allForecasts.filter((f) => f.strategy === 'UNKNOWN').length;
  const unknownRatio = allForecasts.length > 0 ? unknownCount / allForecasts.length : 1;
  const thinHistoryPenalty = allForecasts.length <= 4 ? 0.01 : 0;
  const bufferPercent = Math.min(0.07, 0.02 + unknownRatio * 0.04 + thinHistoryPenalty);

  const discretionaryBuffer: ForecastRange = {
    min: income.min.times(bufferPercent * 0.6).toDecimalPlaces(2),
    likely: income.likely.times(bufferPercent).toDecimalPlaces(2),
    max: income.max.times(bufferPercent * 1.35).toDecimalPlaces(2),
  };

  // Calculate wealth and ending cash
  const wealthCreated: ForecastRange = {
    min: income.min.minus(spending.max).toDecimalPlaces(2),
    likely: income.likely.minus(spending.likely).toDecimalPlaces(2),
    max: income.max.minus(spending.min).toDecimalPlaces(2),
  };

  const endingCash: ForecastRange = {
    min: currentCash
      .plus(income.min)
      .minus(spending.max)
      .minus(savings.max)
      .minus(discretionaryBuffer.max)
      .toDecimalPlaces(2),
    likely: currentCash
      .plus(income.likely)
      .minus(spending.likely)
      .minus(savings.likely)
      .minus(discretionaryBuffer.likely)
      .toDecimalPlaces(2),
    max: currentCash
      .plus(income.max)
      .minus(spending.min)
      .minus(savings.min)
      .minus(discretionaryBuffer.min)
      .toDecimalPlaces(2),
  };

  // Overall confidence
  const confidence = determineOverallConfidence(allForecasts);

  // Generate warnings
  const warnings = generateWarnings({
    income: income.likely,
    spending: spending.likely,
    savings: savings.likely,
    endingCash: endingCash.likely,
  });

  return {
    income,
    spending,
    savings,
    discretionaryBuffer,
    wealthCreated,
    endingCash,
    confidence,
    categoryBreakdown: [
      ...incomeForecasts,
      ...spendingForecasts,
      ...savingsForecasts,
    ],
    warnings,
  };
}

function calculateAverageIncome(categories: CategoryHistory[]): Decimal {
  const allAmounts = categories.flatMap(cat => cat.amounts);
  if (allAmounts.length === 0) return new Decimal(3500); // Default assumption
  
  return getWeightedAverage(allAmounts);
}

function aggregateForecasts(forecasts: CategoryForecast[]): ForecastRange {
  return {
    min: forecasts.reduce((sum, f) => sum.plus(f.forecast.min), new Decimal(0)),
    likely: forecasts.reduce((sum, f) => sum.plus(f.forecast.likely), new Decimal(0)),
    max: forecasts.reduce((sum, f) => sum.plus(f.forecast.max), new Decimal(0)),
  };
}

function determineOverallConfidence(forecasts: CategoryForecast[]): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (forecasts.length === 0) return 'LOW';

  const highCount = forecasts.filter(f => f.confidence === 'HIGH').length;
  const mediumCount = forecasts.filter(f => f.confidence === 'MEDIUM').length;

  const highRatio = highCount / forecasts.length;
  const mediumRatio = mediumCount / forecasts.length;

  if (highRatio >= 0.7) return 'HIGH';
  if (highRatio + mediumRatio >= 0.6) return 'MEDIUM';
  return 'LOW';
}

function generateWarnings(metrics: {
  income: Decimal;
  spending: Decimal;
  savings: Decimal;
  endingCash: Decimal;
}): string[] {
  const warnings: string[] = [];

  const spendingRate = metrics.income.equals(0)
    ? new Decimal(0)
    : metrics.spending.dividedBy(metrics.income).times(100);

  const savingsRate = metrics.income.equals(0)
    ? new Decimal(0)
    : metrics.savings.dividedBy(metrics.income).times(100);

  if (spendingRate.greaterThan(70)) {
    warnings.push(
      `⚠️ Spending projected at ${spendingRate.toFixed(1)}% of income (target: ≤70%)`
    );
  }

  if (savingsRate.lessThan(15)) {
    warnings.push(
      `⚠️ Savings projected at only ${savingsRate.toFixed(1)}% (target: ≥15%)`
    );
  }

  if (metrics.endingCash.lessThan(0)) {
    warnings.push(
      `🚨 CRITICAL: Ending cash projected negative (-$${metrics.endingCash.abs().toFixed(2)})`
    );
  } else if (metrics.endingCash.lessThan(500)) {
    warnings.push(
      `⚠️ Low ending cash projected ($${metrics.endingCash.toFixed(2)}) - consider reducing discretionary spending`
    );
  }

  return warnings;
}
