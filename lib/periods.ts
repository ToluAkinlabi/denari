/**
 * Period utilities
 * Biweekly pay period calculations and management
 */

import { addDays, startOfDay } from 'date-fns';

/**
 * First payday: January 9, 2026
 * Biweekly cycle: 14 days
 * First payday is the END of the first period (Period 0: Dec 27, 2025 - Jan 9, 2026)
 * Each period is 14 days with inclusive boundaries on both start and end dates
 */
const FIRST_PAYDAY = new Date(2026, 0, 9); // Local date: Jan 9, 2026
const CYCLE_LENGTH_DAYS = 14;

/**
 * Get the pay cycle index for a given date
 * Payday is the END of a period, so dates after payday belong to the next period
 */
export function getPayCycleIndex(date: Date): number {
  const daysSinceFirstPayday = Math.floor(
    (date.getTime() - FIRST_PAYDAY.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  // If date is after the payday, it belongs to the next period
  // Example: Jan 10 is 1 day after Jan 9 payday, so it's in Period 1, not Period 0
  if (daysSinceFirstPayday > 0) {
    return Math.ceil(daysSinceFirstPayday / CYCLE_LENGTH_DAYS);
  }
  
  return Math.floor(daysSinceFirstPayday / CYCLE_LENGTH_DAYS);
}

/**
 * Get period start date from cycle index
 * Period 0 ends on FIRST_PAYDAY, so it starts 13 days before
 */
export function getPeriodStartDate(cycleIndex: number): Date {
  return startOfDay(addDays(FIRST_PAYDAY, cycleIndex * CYCLE_LENGTH_DAYS - (CYCLE_LENGTH_DAYS - 1)));
}

/**
 * Get period end date from cycle index
 * Each period ends on a payday
 */
export function getPeriodEndDate(cycleIndex: number): Date {
  return startOfDay(addDays(FIRST_PAYDAY, cycleIndex * CYCLE_LENGTH_DAYS));
}

/**
 * Get the payday (start date) for a given date
 */
export function getPaydayForDate(date: Date): Date {
  const cycleIndex = getPayCycleIndex(date);
  return getPeriodStartDate(cycleIndex);
}

/**
 * Determine which period a date belongs to
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
    payDate: endDate, // Payday is the end date, not start date
    label: formatPeriodLabel(startDate, endDate),
  };
}

/**
 * Format period label (e.g., "Jan 9 - Jan 22")
 */
export function formatPeriodLabel(startDate: Date, endDate: Date): string {
  const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
  const startDay = startDate.getDate();
  const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
  const endDay = endDate.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}`;
  }

  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}

/**
 * Get all periods in a date range
 */
export function getPeriodsInRange(startDate: Date, endDate: Date): Period[] {
  const periods: Period[] = [];
  let currentDate = startDate;

  while (currentDate <= endDate) {
    const period = getPeriodForDate(currentDate);

    // Only add if we haven't already (check if cycleIndex is different)
    if (periods.length === 0 || periods[periods.length - 1].cycleIndex !== period.cycleIndex) {
      periods.push(period);
    }

    currentDate = addDays(period.endDate, 1);
  }

  return periods;
}

/**
 * Get the upcoming payday from today
 */
export function getNextPayday(from: Date = new Date()): Date {
  const currentPeriod = getPeriodForDate(from);

  // If we're past the end of current period, move to next
  if (from > currentPeriod.endDate) {
    return getPeriodStartDate(currentPeriod.cycleIndex + 1);
  }

  return currentPeriod.payDate;
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
      label: formatPeriodLabel(startDate, endDate),
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

/**
 * Get first payday config
 */
export function getFirstPayday(): Date {
  return new Date(FIRST_PAYDAY);
}

export function getCycleLength(): number {
  return CYCLE_LENGTH_DAYS;
}
