/**
 * Frequency Detection
 *
 * Analyzes transaction history to detect patterns (recurring, irregular, etc)
 */

import { Decimal } from '@prisma/client/runtime/library';
import { differenceInDays } from 'date-fns';

export type FrequencyPattern = 
  | 'BIWEEKLY'      // Every 14 days (paycheck)
  | 'MONTHLY'       // ~30 days (rent, subscriptions)  
  | 'QUARTERLY'     // ~90 days (insurance)
  | 'ANNUAL'        // ~365 days
  | 'VARIABLE'      // No clear pattern
  | 'IRREGULAR';    // Happens rarely, no pattern

export interface FrequencyAnalysis {
  pattern: FrequencyPattern;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  avgGapDays: number;
  occurrences: number;
  lastOccurrence: Date;
  estimatedNextDate?: Date;
}

/**
 * Detect frequency pattern from entry dates
 * 
 * @example
 *   detectFrequency([
 *     new Date('2026-01-09'),
 *     new Date('2026-01-23'),
 *     new Date('2026-02-06'),
 *     new Date('2026-02-20')
 *   ])
 *   // Returns: { pattern: 'BIWEEKLY', confidence: 'HIGH', avgGapDays: 14, ... }
 */
export function detectFrequency(dates: Date[]): FrequencyAnalysis {
  if (dates.length === 0) {
    throw new Error('Cannot detect frequency from empty date array');
  }

  if (dates.length === 1) {
    return {
      pattern: 'IRREGULAR',
      confidence: 'LOW',
      avgGapDays: 0,
      occurrences: 1,
      lastOccurrence: dates[0],
    };
  }

  // Sort dates chronologically
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  
  // Calculate gaps between consecutive dates
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const daysBetween = differenceInDays(sorted[i], sorted[i - 1]);
    if (daysBetween > 0) {
      gaps.push(daysBetween);
    }
  }

  if (gaps.length === 0) {
    return {
      pattern: 'IRREGULAR',
      confidence: 'LOW',
      avgGapDays: 0,
      occurrences: dates.length,
      lastOccurrence: sorted[sorted.length - 1],
    };
  }

  const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  const variance = calculateVariance(gaps);
  const stdDev = Math.sqrt(variance);
  
  // Coefficient of variation (lower = more consistent)
  const cv = avgGap > 0 ? (stdDev / avgGap) : 1;

  // Pattern detection based on average gap
  let pattern: FrequencyPattern;
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW';

  // High consistency = clear pattern
  if (cv < 0.15) {
    confidence = 'HIGH';
  } else if (cv < 0.35) {
    confidence = 'MEDIUM';
  } else {
    confidence = 'LOW';
  }

  // Match to known patterns (with tolerance)
  if (isNearValue(avgGap, 14, 2)) {
    pattern = 'BIWEEKLY';
  } else if (isNearValue(avgGap, 30, 3) || isNearValue(avgGap, 31, 3)) {
    pattern = 'MONTHLY';
  } else if (isNearValue(avgGap, 90, 7)) {
    pattern = 'QUARTERLY';
  } else if (isNearValue(avgGap, 365, 14)) {
    pattern = 'ANNUAL';
  } else if (avgGap < 40) {
    pattern = 'VARIABLE';  // Frequent but irregular
  } else {
    pattern = 'IRREGULAR';  // Infrequent, no pattern
  }

  const lastOccurrence = sorted[sorted.length - 1];
  
  // Estimate next occurrence if pattern is clear
  let estimatedNextDate: Date | undefined;
  if (confidence === 'HIGH' && avgGap > 0) {
    estimatedNextDate = new Date(lastOccurrence);
    estimatedNextDate.setDate(estimatedNextDate.getDate() + Math.round(avgGap));
  }

  return {
    pattern,
    confidence,
    avgGapDays: Math.round(avgGap),
    occurrences: dates.length,
    lastOccurrence,
    estimatedNextDate,
  };
}

/**
 * Check if value is near target (within tolerance)
 */
function isNearValue(value: number, target: number, tolerance: number): boolean {
  return Math.abs(value - target) <= tolerance;
}

/**
 * Calculate variance of numbers
 */
function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Detect if an amount is an outlier in a series
 * Using IQR (Interquartile Range) method
 * 
 * @example
 *   isOutlier(new Decimal(5000), [
 *     new Decimal(500), new Decimal(550), new Decimal(480)
 *   ])
 *   // Returns: true (5000 is way higher than normal)
 */
export function isOutlier(value: Decimal, historicalValues: Decimal[]): boolean {
  if (historicalValues.length < 3) {
    // Not enough history to determine outliers
    return false;
  }

  const sorted = [...historicalValues]
    .map(d => d.toNumber())
    .sort((a, b) => a - b);

  const q1Index = Math.floor(sorted.length / 4);
  const q3Index = Math.floor(sorted.length * 0.75);
  
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;

  const lowerBound = q1 - (1.5 * iqr);
  const upperBound = q3 + (1.5 * iqr);

  const numValue = value.toNumber();

  return numValue < lowerBound || numValue > upperBound;
}

/**
 * Categorize an expense based on amount relative to income
 * 
 * @example
 *   categorizeExpenseSize(
 *     new Decimal(1200),  // Flight ticket
 *     new Decimal(3500)   // Period income
 *   )
 *   // Returns: 'LARGE' (34% of income)
 */
export function categorizeExpenseSize(
  amount: Decimal,
  periodIncome: Decimal
): 'SMALL' | 'MEDIUM' | 'LARGE' {
  if (periodIncome.lte(0)) return 'MEDIUM';

  const percentage = amount.dividedBy(periodIncome).times(100);

  if (percentage.lt(5)) return 'SMALL';
  if (percentage.lt(15)) return 'MEDIUM';
  return 'LARGE';
}
