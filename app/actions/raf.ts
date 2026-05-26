'use server';

import { differenceInCalendarDays, startOfDay } from 'date-fns';
import { getPayCycleIndex } from '@/lib/periods';
import * as periodsRepo from '@/lib/repositories/periods';
import * as ledgerRepo from '@/lib/repositories/ledger';
import * as categoriesRepo from '@/lib/repositories/categories';
import * as rafTransfersRepo from '@/lib/repositories/raf-transfers';
import * as plaidRepo from '@/lib/repositories/plaid';
import * as usersRepo from '@/lib/repositories/users';
import { calculateIncome } from '@/lib/finance/wealth';
import { Decimal } from '@prisma/client/runtime/library';
import { applyRafPeriodTransfers, buildRafTransferSuggestions, calculateRafPlan, type RafPlan } from '@/lib/finance/raf';
import { createDemoRafPageData, isDemoModeEnabled } from '@/lib/demo-mode';

export interface RafPageData {
  periodId: string;
  periodIndex: number;
  periodRange: string;
  income: string;
  carryForward: string;
  allocationBase: string;
  isReconciled: boolean;
  hasIncome: boolean;
  raf: RafPlan;
  transfers: Array<{
    id: string;
    fromCategoryId: string;
    fromCategoryName: string;
    toCategoryId: string;
    toCategoryName: string;
    amount: string;
    createdAt: string;
  }>;
  categories: Array<{
    id: string;
    name: string;
    rafPercent: number;
    type: string;
  }>;
  periodProgressPercent: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const DB_RETRY_ATTEMPTS = 2;
const DB_RETRY_DELAY_MS = 1200;

const RAF_BUCKET_ORDER = [
  'Spend',
  'Partnership',
  'Debt',
  'Phone',
  'Other bills',
  'Gifts & Donations',
  'Savings',
  'Investments',
  'Groceries',
] as const;

const RAF_BUCKET_ORDER_INDEX = new Map<string, number>(
  RAF_BUCKET_ORDER.map((name, index) => [name, index])
);

function canonicalizeRafBucketName(name: string): string {
  const normalized = name.trim().toLowerCase();

  if (normalized === 'spend') return 'Spend';
  if (normalized === 'partnership') return 'Partnership';
  if (normalized === 'debt') return 'Debt';
  if (normalized === 'phone') return 'Phone';
  if (normalized === 'other' || normalized === 'others' || normalized === 'rent') return 'Other bills';
  if (normalized === 'gifts' || normalized === 'gift' || normalized === 'misc') return 'Gifts & Donations';
  if (normalized === 'savings') return 'Savings';
  if (normalized === 'investment' || normalized === 'investments') return 'Investments';
  if (normalized === 'grocery' || normalized === 'groceries') return 'Groceries';

  return name;
}

function getStatusSeverity(status: 'OPEN' | 'AT_RISK' | 'EXHAUSTED'): number {
  if (status === 'EXHAUSTED') return 3;
  if (status === 'AT_RISK') return 2;
  return 1;
}

function normalizeRafPlan(plan: RafPlan): RafPlan {
  const bucketMap = new Map<
    string,
    {
      categoryId: string;
      name: string;
      percent: Decimal;
      allocated: Decimal;
      spent: Decimal;
      remaining: Decimal;
      status: 'OPEN' | 'AT_RISK' | 'EXHAUSTED';
      kind: 'expense' | 'savings' | 'other';
    }
  >();

  for (const bucket of plan.buckets) {
    const canonicalName = canonicalizeRafBucketName(bucket.name);
    const existing = bucketMap.get(canonicalName);

    if (!existing) {
      bucketMap.set(canonicalName, {
        categoryId: bucket.categoryId,
        name: canonicalName,
        percent: new Decimal(bucket.percent.replace('%', '') || '0'),
        allocated: new Decimal(bucket.allocated),
        spent: new Decimal(bucket.spent),
        remaining: new Decimal(bucket.remaining),
        status: bucket.status,
        kind: bucket.kind,
      });
      continue;
    }

    existing.percent = existing.percent.plus(new Decimal(bucket.percent.replace('%', '') || '0'));
    existing.allocated = existing.allocated.plus(new Decimal(bucket.allocated));
    existing.spent = existing.spent.plus(new Decimal(bucket.spent));
    existing.remaining = existing.remaining.plus(new Decimal(bucket.remaining));
    if (getStatusSeverity(bucket.status) > getStatusSeverity(existing.status)) {
      existing.status = bucket.status;
    }
  }

  const normalizedBuckets = Array.from(bucketMap.values())
    .map((bucket) => {
      const remainingPercent = bucket.allocated.equals(0)
        ? new Decimal(0)
        : bucket.remaining.dividedBy(bucket.allocated).times(100);

      return {
        categoryId: bucket.categoryId,
        name: bucket.name,
        percent: `${bucket.percent.toFixed(2)}%`,
        allocated: bucket.allocated.toFixed(2),
        spent: bucket.spent.toFixed(2),
        remaining: bucket.remaining.toFixed(2),
        remainingPercent: `${remainingPercent.toFixed(2)}%`,
        status: bucket.status,
        kind: bucket.kind,
      };
    })
    .sort((left, right) => {
      const leftOrder = RAF_BUCKET_ORDER_INDEX.get(left.name) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = RAF_BUCKET_ORDER_INDEX.get(right.name) ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.name.localeCompare(right.name);
    });

  const normalizedTransferSuggestions = buildRafTransferSuggestions({ buckets: normalizedBuckets });
  const baseWarnings = plan.warnings.filter(
    (warning) => !warning.includes(' is exhausted by $') && !warning.startsWith('Consider moving about $')
  );
  const exhaustedWarnings = normalizedBuckets
    .filter((bucket) => bucket.status === 'EXHAUSTED')
    .map((bucket) => `${bucket.name} is exhausted by $${new Decimal(bucket.remaining).abs().toFixed(2)}.`);
  const transferWarnings = normalizedTransferSuggestions.map(
    (suggestion) => `Consider moving about $${suggestion.amount} from ${suggestion.fromBucket} to ${suggestion.toBucket}.`
  );

  return {
    ...plan,
    buckets: normalizedBuckets,
    exhaustedBuckets: normalizedBuckets.filter((bucket) => bucket.status === 'EXHAUSTED'),
    atRiskBuckets: normalizedBuckets.filter((bucket) => bucket.status === 'AT_RISK'),
    transferSuggestions: normalizedTransferSuggestions,
    warnings: [...baseWarnings, ...exhaustedWarnings, ...transferWarnings],
  };
}

function normalizeCategoriesForRaf(
  categories: Array<{ id: string; name: string; type: string; rafPercent: number }>
): Array<{ id: string; name: string; type: string; rafPercent: number }> {
  const deduped = new Map<string, { id: string; name: string; type: string; rafPercent: number }>();

  for (const category of categories) {
    const canonicalName = canonicalizeRafBucketName(category.name);
    const existing = deduped.get(canonicalName);
    if (!existing) {
      deduped.set(canonicalName, {
        ...category,
        name: canonicalName,
      });
    }
  }

  return Array.from(deduped.values()).sort((left, right) => {
    const leftOrder = RAF_BUCKET_ORDER_INDEX.get(left.name) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = RAF_BUCKET_ORDER_INDEX.get(right.name) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.name.localeCompare(right.name);
  });
}

function isDatabaseUnavailableError(error: unknown): boolean {
  const message = (error as Error)?.message ?? '';
  return (
    message.includes("Can't reach database server") ||
    message.includes('ECONNREFUSED') ||
    message.includes('ENOTFOUND') ||
    message.includes('ETIMEDOUT')
  );
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withDatabaseRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= DB_RETRY_ATTEMPTS; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isDatabaseUnavailableError(error) || attempt === DB_RETRY_ATTEMPTS) {
        throw error;
      }

      await wait(DB_RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unknown database error');
}

export async function getRafPageData(userId?: string): Promise<ApiResponse<RafPageData>> {
  try {
    if (await isDemoModeEnabled()) {
      return { success: true, data: createDemoRafPageData() };
    }

    const resolvedUserId = await withDatabaseRetry(() => usersRepo.resolveUserId(userId));

    const currentPeriod = await periodsRepo.getCurrentPeriodForUser(resolvedUserId);
    if (!currentPeriod) {
      return { success: false, error: 'No current period found' };
    }

    const periodStart = startOfDay(new Date(currentPeriod.startDate));
    const periodEnd = startOfDay(new Date(currentPeriod.endDate));

    const [currentEntries, importedEntries, categories, periodTransfers] = await Promise.all([
      ledgerRepo.getLedgerEntriesForPeriod(currentPeriod.id),
      plaidRepo.getIncludedImportedTransactionsForDateRange(resolvedUserId, periodStart, periodEnd),
      categoriesRepo.getCategoryForecastSettingsForUser(resolvedUserId),
      rafTransfersRepo.getRafTransfersForPeriodDetailed(resolvedUserId, currentPeriod.id),
    ]);

    const allEntries = [
      ...currentEntries,
      ...importedEntries.map((entry) => ({
        categoryId: entry.categoryId ?? '',
        amount: entry.amount,
        entryType: 'EXPENSE',
      })),
    ];

    const currentIncome = calculateIncome(allEntries);
    const effectiveCashBalance = currentPeriod.status === 'RECONCILED' && currentPeriod.closingCashActual != null
      ? currentPeriod.closingCashActual
      : currentPeriod.openingCash;
    const allocationBase = currentPeriod.status === 'RECONCILED' && currentPeriod.closingCashActual != null
      ? currentPeriod.closingCashActual
      : currentIncome.plus(currentPeriod.openingCash);

    const baseRafPlan = calculateRafPlan({
      income: currentIncome,
      carryForward: currentPeriod.openingCash,
      entries: allEntries.map((e) => ({ categoryId: e.categoryId, amount: e.amount })),
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        expectedFrequency: c.expectedFrequency,
        countsAsExpense: c.countsAsExpense ?? false,
        countsAsSavings: c.countsAsSavings ?? false,
        rafPercent: c.rafPercent,
      })),
    });
    const rafPlan = normalizeRafPlan(applyRafPeriodTransfers(
      baseRafPlan,
      periodTransfers.map((transfer) => ({
        fromCategoryId: transfer.fromCategoryId,
        toCategoryId: transfer.toCategoryId,
        amount: transfer.amount,
      }))
    ));

    const today = startOfDay(new Date());
    const totalDays = differenceInCalendarDays(periodEnd, periodStart) + 1;
    const daysElapsed = Math.max(0, Math.min(differenceInCalendarDays(today, periodStart) + 1, totalDays));
    const periodProgressPercent = totalDays > 0 ? Math.round((daysElapsed / totalDays) * 100) : 0;

    const startStr = new Date(currentPeriod.startDate).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
    const endStr = new Date(currentPeriod.endDate).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });

    const defaultRafByName: Record<string, number> = {
      Spend: 20,
      Partnership: 15,
      Debt: 14,
      Phone: 6,
      'Other bills': 10,
      'Gifts & Donations': 6,
      Savings: 12,
      Investments: 8,
      Groceries: 9,
    };
    const rafTotal = categories.reduce((sum, c) => sum + Number(c.rafPercent ?? 0), 0);
    const hasConfiguredRaf = rafTotal > 0;

    return {
      success: true,
      data: {
        periodId: currentPeriod.id,
        periodIndex: getPayCycleIndex(currentPeriod.startDate) + 1,
        periodRange: `${startStr} – ${endStr}`,
        isReconciled: currentPeriod.status === 'RECONCILED',
        income: currentIncome.toFixed(2),
        carryForward: effectiveCashBalance.toFixed(2),
        allocationBase: allocationBase.toFixed(2),
        hasIncome: allocationBase.greaterThan(0),
        raf: rafPlan,
        transfers: periodTransfers.map((transfer) => ({
          id: transfer.id,
          fromCategoryId: transfer.fromCategoryId,
          fromCategoryName: transfer.fromCategory.name,
          toCategoryId: transfer.toCategoryId,
          toCategoryName: transfer.toCategory.name,
          amount: transfer.amount.toFixed(2),
          createdAt: transfer.createdAt.toISOString(),
        })),
        categories: normalizeCategoriesForRaf(
          categories
            .filter((c) => c.type !== 'INCOME')
            .map((c) => {
              const canonicalName = canonicalizeRafBucketName(c.name);
              return {
                id: c.id,
                name: canonicalName,
                type: c.type,
                rafPercent: hasConfiguredRaf
                  ? Number(c.rafPercent ?? 0)
                  : defaultRafByName[canonicalName] ?? Number(c.rafPercent ?? 0),
              };
            })
        ),
        periodProgressPercent,
      },
    };
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return {
        success: false,
        error:
          'Database is temporarily unreachable. If you use Neon, wake the project and verify DATABASE_URL, then refresh RAF.',
      };
    }

    return { success: false, error: `Server error: ${(error as Error).message}` };
  }
}
