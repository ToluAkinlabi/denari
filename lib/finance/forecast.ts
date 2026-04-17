/**
 * Financial Forecasting
 *
 * Domain logic for projecting next period's financials
 * based on recent history (last 4 periods).
 */

import { Decimal } from '@prisma/client/runtime/library';

/**
 * Calculate average value from period history
 *
 * Uses last 4 periods, ignoring outliers.
 */
function getHistoricalAverage(values: Decimal[]): Decimal {
  if (values.length === 0) return new Decimal(0);

  // Sort and remove top/bottom 25% (if >4 items)
  const sorted = [...values].sort((a, b) => a.comparedTo(b));
  let toAverage = sorted;

  if (sorted.length > 4) {
    // Remove outliers
    const start = Math.ceil(sorted.length * 0.25);
    const end = Math.floor(sorted.length * 0.75);
    toAverage = sorted.slice(start, end);
  }

  if (toAverage.length === 0) return new Decimal(0);

  const sum = toAverage.reduce((acc, val) => acc.plus(val), new Decimal(0));
  return sum.dividedBy(toAverage.length).toDecimalPlaces(2);
}

/**
 * Calculate confidence level for forecast
 *
 * Based on variance in recent periods.
 * High variance = low confidence.
 *
 * Returns:
 *   "HIGH" (confidence ≥80%)
 *   "MEDIUM" (confidence 50-80%)
 *   "LOW" (confidence <50%)
 *
 * @example
 *   getConfidenceLevel([3500, 3500, 3400, 3600])  // "HIGH" (consistent)
 *   getConfidenceLevel([3500, 3000, 4000, 2500])  // "LOW" (variable)
 */
export function getConfidenceLevel(
  values: Decimal[]
): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (values.length < 2) return 'LOW';

  // Calculate coefficient of variation
  const mean = getHistoricalAverage(values);
  if (mean.equals(0)) return 'MEDIUM';

  const variance = values.reduce((sum, val) => {
    const diff = val.minus(mean);
    return sum.plus(diff.times(diff));
  }, new Decimal(0));

  const stdDev = variance
    .dividedBy(values.length)
    .sqrt();
  const coeffVar = stdDev.dividedBy(mean.abs()).times(100);

  // Coefficient of variation to confidence
  const cv = coeffVar.toNumber();
  if (cv < 5) return 'HIGH';
  if (cv < 15) return 'MEDIUM';
  return 'LOW';
}

/**
 * Forecast next period income
 *
 * Uses average of last 4 periods + 0-10% variance buffer.
 *
 * @example
 *   forecastIncome(
 *     [3500, 3500, 3400, 3600],  // Last 4 periods
 *     'MEDIUM'                    // Confidence
 *   )
 *   // Returns: ~$3,500
 */
export function forecastIncome(
  recentIncome: Decimal[],
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
): Decimal {
  const average = getHistoricalAverage(recentIncome);

  // Apply confidence buffer (conservative margin)
  const buffer = confidence === 'HIGH' ? 0 : confidence === 'MEDIUM' ? 0.05 : 0.1;
  return average.times(new Decimal(1 - buffer)).toDecimalPlaces(2);
}

/**
 * Forecast next period spending
 *
 * Uses average of last 4 periods.
 * Can project by category for detailed forecasts.
 *
 * @example
 *   forecastSpending(
 *     [655, 720, 600, 680],  // Last 4 periods
 *     'MEDIUM'
 *   )
 *   // Returns: ~$664
 */
export function forecastSpending(
  recentSpending: Decimal[],
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
): Decimal {
  void confidence;
  return getHistoricalAverage(recentSpending);
}

/**
 * Forecast next period savings
 *
 * Uses average of last 4 periods.
 *
 * @example
 *   forecastSavings(
 *     [500, 520, 480, 540],  // Last 4 periods
 *     'HIGH'
 *   )
 *   // Returns: ~$510
 */
export function forecastSavings(
  recentSavings: Decimal[],
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
): Decimal {
  void confidence;
  return getHistoricalAverage(recentSavings);
}

/**
 * Forecast ending cash for next period
 *
 * Formula:
 *   Cash End = Cash Start + Income - Spending - Savings
 *
 * @example
 *   forecastCashEnd(
 *     new Decimal(3345),    // Current ending (becomes next opening)
 *     new Decimal(3500),    // Forecasted income
 *     new Decimal(664),     // Forecasted spending
 *     new Decimal(510)      // Forecasted savings
 *   )
 *   // Returns: ~$5,171
 */
export function forecastCashEnd(
  openingCash: Decimal,
  forecastedIncome: Decimal,
  forecastedSpending: Decimal,
  forecastedSavings: Decimal
): Decimal {
  return openingCash
    .plus(forecastedIncome)
    .minus(forecastedSpending)
    .minus(forecastedSavings)
    .toDecimalPlaces(2);
}

/**
 * Forecast wealth creation for next period
 *
 * Formula: Income - Spending
 *
 * @example
 *   forecastWealthCreated(
 *     new Decimal(3500),    // Forecasted income
 *     new Decimal(664)      // Forecasted spending
 *   )
 *   // Returns: ~$2,836
 */
export function forecastWealthCreated(
  forecastedIncome: Decimal,
  forecastedSpending: Decimal
): Decimal {
  const wealth = forecastedIncome.minus(forecastedSpending);
  return wealth.greaterThan(0) ? wealth : new Decimal(0);
}

/**
 * Forecast complete next period
 *
 * Returns all projected metrics for next period.
 *
 * @example
 *   const forecast = forecastNextPeriod({
 *     currentCash: 3345,
 *     recentIncome: [3500, 3500, 3400, 3600],
 *     recentSpending: [655, 720, 600, 680],
 *     recentSavings: [500, 520, 480, 540]
 *   })
 *   // Returns: {
 *   //   income: 3500,
 *   //   spending: 664,
 *   //   savings: 510,
 *   //   wealth: 2836,
 *   //   endingCash: 5171,
 *   //   confidence: 'MEDIUM'
 *   // }
 */
export interface ForecastResult {
  income: Decimal;
  spending: Decimal;
  savings: Decimal;
  wealthCreated: Decimal;
  endingCash: Decimal;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export function forecastNextPeriod(input: {
  currentCash: Decimal;
  recentIncome: Decimal[];
  recentSpending: Decimal[];
  recentSavings: Decimal[];
}): ForecastResult {
  const confidence = getConfidenceLevel(input.recentIncome);

  const forecastedIncome = forecastIncome(input.recentIncome, confidence);
  const forecastedSpending = forecastSpending(input.recentSpending, confidence);
  const forecastedSavings = forecastSavings(input.recentSavings, confidence);

  const wealthCreated = forecastWealthCreated(
    forecastedIncome,
    forecastedSpending
  );
  const endingCash = forecastCashEnd(
    input.currentCash,
    forecastedIncome,
    forecastedSpending,
    forecastedSavings
  );

  return {
    income: forecastedIncome,
    spending: forecastedSpending,
    savings: forecastedSavings,
    wealthCreated,
    endingCash,
    confidence,
  };
}

/**
 * Get forecast warning if conditions are unfavorable
 *
 * Checks if forecasted metrics would be problematic.
 * Returns array of warnings (empty if forecast is healthy).
 *
 * @example
 *   const warnings = getForecastWarnings({
 *     income: 3500,
 *     spending: 2800,    // 80% - exceeds target
 *     savings: 100,      // ~3% - low savings
 *     endingCash: -1000  // Negative cash!
 *   })
 *   // Returns: [
 *   //   "WARNING: Forecasted spending is 80% of income (target: ≤70%)",
 *   //   "WARNING: Forecasted savings is only 3% (target: ≥15%)",
 *   //   "CRITICAL: Forecasted ending cash is negative (-$1,000)"
 *   // ]
 */
export function getForecastWarnings(result: ForecastResult): string[] {
  const warnings: string[] = [];

  const spendingRate = result.income.equals(0)
    ? new Decimal(0)
    : result.spending.dividedBy(result.income).times(100);

  const savingsRate = result.income.equals(0)
    ? new Decimal(0)
    : result.savings.dividedBy(result.income).times(100);

  if (spendingRate.greaterThan(70)) {
    warnings.push(
      `WARNING: Forecasted spending is ${spendingRate.toFixed(1)}% of income (target: ≤70%)`
    );
  }

  if (savingsRate.lessThan(15)) {
    warnings.push(
      `WARNING: Forecasted savings is only ${savingsRate.toFixed(1)}% (target: ≥15%)`
    );
  }

  if (result.endingCash.lessThan(0)) {
    warnings.push(
      `CRITICAL: Forecasted ending cash is negative (-$${result.endingCash.abs().toFixed(2)})`
    );
  }

  return warnings;
}
