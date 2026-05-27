/**
 * Period utilities
 * Monthly pay period calculations and management
 */

import { startOfDay } from 'date-fns';

/**
 * Base period anchor: January 2026 = Period 0
 * Each period covers a full calendar month (1st to last day).
 */
const BASE_YEAR = 2026;
const BASE_MONTH = 0; // January (0-indexed)

function normalizeCycleDate(date: Date): Date {
  // Prisma/Postgres date-like fields are commonly represented at UTC midnight.
  // Convert those to local calendar date to avoid timezone-driven off-by-one period indexes.
  const isUtcMidnight =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0;

  if (isUtcMidnight) {
    return startOfDay(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  return startOfDay(date);
}

/**
 * Get the pay cycle index for a given date.
 * Period 0 = January 2026. Period index increases by 1 each calendar month.
 */
export function getPayCycleIndex(date: Date): number {
  const normalized = normalizeCycleDate(date);
  return (normalized.getFullYear() - BASE_YEAR) * 12 + (normalized.getMonth() - BASE_MONTH);
}

/**
 * Get period start date (1st of the month) from cycle index.
 */
export function getPeriodStartDate(cycleIndex: number): Date {
  const totalMonths = BASE_MONTH + cycleIndex;
  const year = BASE_YEAR + Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 12) % 12;
  return startOfDay(new Date(year, month, 1));
}

/**
 * Get period end date (last day of the month) from cycle index.
 */
export function getPeriodEndDate(cycleIndex: number): Date {
  const start = getPeriodStartDate(cycleIndex);
  // Day 0 of next month = last day of this month
  return startOfDay(new Date(start.getFullYear(), start.getMonth() + 1, 0));
}

/**
 * Get the period start (1st of month) for a given date.
 */
export function getPaydayForDate(date: Date): Date {
  const cycleIndex = getPayCycleIndex(date);
  return getPeriodStartDate(cycleIndex);
}

/**
 * Determine which period a date belongs to.
 */
export interface Period {
  cycleIndex: number;
  startDate: Date;
  endDate: Date;
  payDate: Date;
  label: string;
}

export function getPeriodForDate(date: Date): Period {
  const cycleIndex = getPayCycleIndex(date);
  const startDate = getPeriodStartDate(cycleIndex);
  const endDate = getPeriodEndDate(cycleIndex);

  return {
    cycleIndex,
    startDate,
    endDate,
    payDate: startDate,
    label: formatPeriodLabel(startDate, endDate),
  };
}

/**
 * Format period label (e.g., "May 2026")
 */
export function formatPeriodLabel(startDate: Date, _endDate?: Date): string {
  return startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Get all periods in a date range
 */
export function getPeriodsInRange(startDate: Date, endDate: Date): Period[] {
  const periods: Period[] = [];
  let currentIndex = getPayCycleIndex(startDate);
  const endIndex = getPayCycleIndex(endDate);

  while (currentIndex <= endIndex) {
    const pStart = getPeriodStartDate(currentIndex);
    const pEnd = getPeriodEndDate(currentIndex);
    periods.push({
      cycleIndex: currentIndex,
      startDate: pStart,
      endDate: pEnd,
      payDate: pStart,
      label: formatPeriodLabel(pStart),
    });
    currentIndex++;
  }

  return periods;
}

/**
 * Get the upcoming payday from today
 */
export function getNextPayday(from: Date = new Date()): Date {
  const today = startOfDay(from);
  const currentPeriod = getPeriodForDate(today);
  if (today.getTime() === currentPeriod.payDate.getTime()) {
    return currentPeriod.payDate;
  }
  return getPeriodStartDate(currentPeriod.cycleIndex + 1);
}

/**
 * Get the current period
 */
export function getCurrentPeriod(): Period {
  return getPeriodForDate(new Date());
}

/**
 * Check if a date is within a period
 */
export function isDateInPeriod(date: Date, period: Period): boolean {
  return date >= period.startDate && date <= period.endDate;
}

/**
 * Get recent periods (last N periods)
 */
export function getRecentPeriods(count: number = 4): Period[] {
  const periods: Period[] = [];
  const currentPeriod = getCurrentPeriod();

  for (let i = 0; i < count; i++) {
    const cycleIndex = currentPeriod.cycleIndex - i;
    const startDate = getPeriodStartDate(cycleIndex);
    const endDate = getPeriodEndDate(cycleIndex);

    periods.push({
      cycleIndex,
      startDate,
      endDate,
      payDate: startDate,
      label: formatPeriodLabel(startDate),
    });
  }

  return periods.reverse();
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

