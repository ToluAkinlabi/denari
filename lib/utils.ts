/**
 * Utility functions for formatting and calculations
 */

import { Decimal } from '@prisma/client/runtime/library';
import { format, parse } from 'date-fns';

/**
 * Format currency value
 */
export function formatCurrency(
  value: string | number | Decimal,
  currency: string = 'USD'
): string {
  const numValue = typeof value === 'object' ? value.toNumber() : Number(value);

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(numValue);
}

/**
 * Format percentage
 */
export function formatPercentage(
  value: string | number | Decimal,
  decimals: number = 1
): string {
  const numValue = typeof value === 'object' ? value.toNumber() : Number(value);
  return `${numValue.toFixed(decimals)}%`;
}

/**
 * Format as thousands (e.g., 1.2K)
 */
export function formatCompact(value: string | number | Decimal): string {
  const numValue = typeof value === 'object' ? value.toNumber() : Number(value);

  if (Math.abs(numValue) >= 1000000) {
    return `${(numValue / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(numValue) >= 1000) {
    return `${(numValue / 1000).toFixed(1)}K`;
  }
  return numValue.toFixed(0);
}

/**
 * Format date for display
 */
export function formatDateDisplay(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'MMM d, yyyy');
}

/**
 * Format date for input
 */
export function formatDateInput(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'yyyy-MM-dd');
}

/**
 * Parse date from input
 */
export function parseDateInput(dateString: string): Date {
  return parse(dateString, 'yyyy-MM-dd', new Date());
}

/**
 * Format time ago
 */
export function formatTimeAgo(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((new Date().getTime() - dateObj.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

/**
 * Abbreviate category name for compact display
 */
export function abbreviateCategory(categoryName: string): string {
  const words = categoryName.split(' ');
  if (words.length === 1) {
    return categoryName.substring(0, 3).toUpperCase();
  }
  return words.map((w) => w[0]).join('').toUpperCase();
}

/**
 * Get status badge color
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'RECONCILED':
      return 'bg-green-100 text-green-800';
    case 'CLOSED':
      return 'bg-blue-100 text-blue-800';
    case 'OPEN':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Get financial health indicator
 */
export function getHealthIndicator(score: number): {
  label: string;
  color: string;
  icon: string;
} {
  if (score >= 80)
    return { label: 'Excellent', color: 'text-green-600', icon: '🟢' };
  if (score >= 60)
    return { label: 'Good', color: 'text-emerald-600', icon: '🟢' };
  if (score >= 40)
    return { label: 'Fair', color: 'text-yellow-600', icon: '🟡' };
  return { label: 'Needs Work', color: 'text-red-600', icon: '🔴' };
}

/**
 * Round to 2 decimal places
 */
export function roundToDecimals(value: number | Decimal, places: number = 2): number {
  const numValue = typeof value === 'object' ? value.toNumber() : value;
  return Math.round(numValue * Math.pow(10, places)) / Math.pow(10, places);
}

/**
 * Check if value is positive
 */
export function isPositive(value: number | Decimal): boolean {
  const numValue = typeof value === 'object' ? value.toNumber() : value;
  return numValue > 0;
}

/**
 * Check if value is negative
 */
export function isNegative(value: number | Decimal): boolean {
  const numValue = typeof value === 'object' ? value.toNumber() : value;
  return numValue < 0;
}

/**
 * Get sign indicator (+ or -)
 */
export function getSignIndicator(value: number | Decimal): string {
  if (isPositive(value)) return '+';
  if (isNegative(value)) return '-';
  return '';
}

/**
 * Validate decimal string
 */
export function isValidDecimal(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value.trim());
}

/**
 * Parse decimal input (handle variations)
 */
export function parseDecimalInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Handle currency symbols
  const cleaned = trimmed.replace(/[$,]/g, '');

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;

  return Math.round(num * 100) / 100;
}

/**
 * Compare two decimal values for equality
 */
export function decimalEquals(
  a: number | Decimal,
  b: number | Decimal,
  tolerance: number = 0.01
): boolean {
  const numA = typeof a === 'object' ? a.toNumber() : a;
  const numB = typeof b === 'object' ? b.toNumber() : b;

  return Math.abs(numA - numB) < tolerance;
}

/**
 * Get color for transaction amount
 */
export function getAmountColor(
  amount: number | Decimal,
  type: 'income' | 'expense' | 'transfer'
): string {
  const numValue = typeof amount === 'object' ? amount.toNumber() : amount;

  switch (type) {
    case 'income':
      return 'text-green-600';
    case 'transfer':
      return 'text-blue-600';
    case 'expense':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}

/**
 * Get background color for card based on theme
 */
export function getCardBackground(theme: 'light' | 'dark' = 'light'): string {
  return theme === 'dark' ? 'bg-gray-900' : 'bg-white';
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
}

/**
 * Sort transactions by date (descending)
 */
export function sortByDateDesc(
  a: { date: Date | string },
  b: { date: Date | string }
): number {
  const dateA = typeof a.date === 'string' ? new Date(a.date) : a.date;
  const dateB = typeof b.date === 'string' ? new Date(b.date) : b.date;
  return dateB.getTime() - dateA.getTime();
}

/**
 * Group transactions by date
 */
export function groupByDate<T extends { date: Date | string }>(
  items: T[]
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  items.forEach((item) => {
    const date = typeof item.date === 'string' ? new Date(item.date) : item.date;
    const key = format(date, 'yyyy-MM-dd');

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(item);
  });

  return grouped;
}

/**
 * Get month name
 */
export function getMonthName(month: number): string {
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return months[month - 1] || '';
}

/**
 * Calculate days until date
 */
export function daysUntil(date: Date): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
