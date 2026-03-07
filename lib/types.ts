/**
 * Shared TypeScript types
 */

import {
  Category as PrismaCategory,
  Period as PrismaPeriod,
  LedgerEntry as PrismaLedgerEntry,
  User as PrismaUser,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * API Response Wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

/**
 * Extended Category with computed properties
 */
export interface Category extends PrismaCategory {
  transactionCount?: number;
  totalAmount?: Decimal;
}

/**
 * Extended Period with computed financials
 */
export interface PeriodWithFinancials extends PrismaPeriod {
  income: Decimal;
  expenses: Decimal;
  savings: Decimal;
  wealthCreated: Decimal;
  cashRemaining: Decimal;
  savingsRate: Decimal;
  expenseRate: Decimal;
  reconciliationDifference: Decimal;
  reconciliationStatus: 'MATCHED' | 'MISMATCH' | 'PENDING_ACTUAL';
  financialScore?: number;
  transactionCount: number;
  categoryBreakdown: CategoryBreakdown[];
}

/**
 * Ledger Entry with related data
 */
export interface LedgerEntryWithDetails extends PrismaLedgerEntry {
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  periodLabel: string;
  savingsAllocations?: SavingsAllocationDetail[];
  notes?: NoteDetail[];
}

/**
 * Category breakdown for visualization
 */
export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  categoryColor?: string;
  categoryIcon?: string;
  amount: Decimal | number;
  percentage: Decimal | number;
  count: number;
}

/**
 * Savings allocation detail
 */
export interface SavingsAllocationDetail {
  id: string;
  bucket: string;
  amount: Decimal | number;
}

/**
 * Note detail
 */
export interface NoteDetail {
  id: string;
  content: string;
  createdAt: Date;
}

/**
 * Monthly aggregate
 */
export interface MonthlyAggregate {
  year: number;
  month: number;
  monthLabel: string;
  income: Decimal | number;
  expenses: Decimal | number;
  savings: Decimal | number;
  wealthCreated: Decimal | number;
  categoryBreakdown: CategoryBreakdown[];
}

/**
 * Financial dashboard data
 */
export interface DashboardData {
  currentPeriod: PeriodWithFinancials;
  previousPeriods: PeriodWithFinancials[];
  monthlyData: MonthlyAggregate[];
  savingsBuckets: SavingsBucketSummary[];
  financialScore: FinancialScoreDetail;
  recentTransactions: LedgerEntryWithDetails[];
  forecast?: ForecastDetail;
}

/**
 * Savings bucket summary
 */
export interface SavingsBucketSummary {
  bucket: string;
  amount: Decimal | number;
  percentage: Decimal | number;
  transactions: number;
}

/**
 * Financial score detail
 */
export interface FinancialScoreDetail {
  overallScore: number;
  savingsDiscipline: number;
  expenseControl: number;
  miscLeakage: number;
  wealthGrowth: number;
  categoryBalance: number;
  reconciliationAccuracy: number;
  benchmarks: {
    targetSavingsRate: number;
    targetExpenseRate: number;
    targetSavingBuckets: number;
  };
}

/**
 * Forecast detail
 */
export interface ForecastDetail {
  periodLabel: string;
  projectedIncome: Decimal | number;
  projectedExpenses: Decimal | number;
  projectedSavings: Decimal | number;
  projectedCashRemaining: Decimal | number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  basedOnPeriods: number;
}

/**
 * Quick transaction input
 */
export interface QuickTransactionInput {
  amount: number;
  categoryId: string;
  description?: string;
  date?: Date;
}

/**
 * Summary entry input
 */
export interface SummaryEntryInput {
  categoryId: string;
  amount: number;
  date?: Date;
  description?: string;
}

/**
 * Period reconciliation input
 */
export interface PeriodReconciliationInput {
  actualClosingCash: number;
  notes?: string;
}

/**
 * Transaction filter options
 */
export interface TransactionFilterOptions {
  periodId?: string;
  categoryId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  entryType?: string;
  searchText?: string;
  limit?: number;
  offset?: number;
}

/**
 * Period filter options
 */
export interface PeriodFilterOptions {
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

/**
 * User settings
 */
export interface UserSettings {
  currencySymbol: string;
  dateFormat: string;
  darkMode: boolean;
  defaultTab: string;
}
