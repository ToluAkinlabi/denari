import { Decimal } from '@prisma/client/runtime/library';

// Default percentage weights — each value is a relative weight.
// Allocation = allocationBase × weight / totalWeight, so these scale with any income.
export const DEFAULT_RAF_PERCENT_BY_NAME: Record<string, number> = {
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

function toDecimal(value: Decimal | number | string | null | undefined) {
  return new Decimal(String(value ?? 0));
}

/**
 * Returns the effective RAF weight for a category.
 * Uses configured rafPercent if set, otherwise falls back to DEFAULT_RAF_PERCENT_BY_NAME.
 */
export function getEffectiveRafWeight(category: {
  name: string;
  rafPercent?: Decimal | number | string | null;
}): number {
  const configured = Number(category.rafPercent ?? 0);
  if (configured > 0) return configured;
  return DEFAULT_RAF_PERCENT_BY_NAME[category.name] ?? 0;
}

function formatPercent(value: Decimal) {
  return `${value.toFixed(2)}%`;
}

export interface RafCategoryInput {
  id: string;
  name: string;
  type: string;
  expectedFrequency?: string | null;
  countsAsExpense: boolean;
  countsAsSavings: boolean;
  rafPercent?: Decimal | number | string | null;
}

export interface RafEntryInput {
  categoryId: string | null;
  amount: Decimal | number | string;
}

export interface RafBucketSummary {
  categoryId: string;
  name: string;
  percent: string;
  allocated: string;
  spent: string;
  remaining: string;
  remainingPercent: string;
  status: 'OPEN' | 'AT_RISK' | 'EXHAUSTED';
  kind: 'expense' | 'savings' | 'other';
}

export interface RafPlan {
  totalIncome: string;
  carryForward: string;
  allocationBase: string;
  totalPercent: string;
  allocated: string;
  unallocated: string;
  overallocated: string;
  profileSource: 'DEFAULT' | 'CONFIGURED';
  warnings: string[];
  buckets: RafBucketSummary[];
  exhaustedBuckets: RafBucketSummary[];
  atRiskBuckets: RafBucketSummary[];
  transferSuggestions: RafTransferSuggestion[];
}

export interface RafTransferSuggestion {
  fromBucket: string;
  toBucket: string;
  amount: string;
  reason: string;
}

export interface RafPeriodTransferInput {
  fromCategoryId: string;
  toCategoryId: string;
  amount: Decimal | number | string;
}

export interface RafGuidanceConfidence {
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
}

export function buildRafTransferSuggestions(plan: Pick<RafPlan, 'buckets'>) {
  const deficits = plan.buckets
    .filter((bucket) => bucket.status === 'EXHAUSTED' || bucket.status === 'AT_RISK')
    .map((bucket) => ({
      ...bucket,
      deficit: Decimal.max(new Decimal(bucket.remaining).negated(), new Decimal(0)),
    }))
    .filter((bucket) => bucket.deficit.greaterThan(0))
    .sort((left, right) => right.deficit.comparedTo(left.deficit));

  const donors = plan.buckets
    .filter((bucket) => bucket.status === 'OPEN')
    .map((bucket) => ({
      ...bucket,
      remaining: new Decimal(bucket.remaining),
    }))
    .filter((bucket) => bucket.remaining.greaterThan(0))
    .sort((left, right) => right.remaining.comparedTo(left.remaining));

  const suggestions: RafTransferSuggestion[] = [];

  for (const deficitBucket of deficits) {
    if (suggestions.length >= 3) break;
    for (const donorBucket of donors) {
      if (donorBucket.remaining.lessThanOrEqualTo(0)) continue;
      const safeDonorShare = donorBucket.remaining.times(0.35);
      const transferAmount = Decimal.min(deficitBucket.deficit, safeDonorShare);
      if (transferAmount.lessThan(10)) continue;

      donorBucket.remaining = donorBucket.remaining.minus(transferAmount);
      deficitBucket.deficit = deficitBucket.deficit.minus(transferAmount);

      suggestions.push({
        fromBucket: donorBucket.name,
        toBucket: deficitBucket.name,
        amount: transferAmount.toFixed(2),
        reason: `${deficitBucket.name} is under pressure while ${donorBucket.name} has surplus capacity.`,
      });

      if (suggestions.length >= 3 || deficitBucket.deficit.lessThanOrEqualTo(0)) {
        break;
      }
    }
  }

  return suggestions;
}

export function getRafGuidanceConfidence(input: {
  profileSource: 'DEFAULT' | 'CONFIGURED';
  warningCount: number;
  exhaustedCount: number;
  atRiskCount: number;
  historyPeriods: number;
  forecastConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
}): RafGuidanceConfidence {
  let score = 0;

  if (input.profileSource === 'CONFIGURED') score += 1;
  if (input.warningCount === 0) score += 1;
  if (input.exhaustedCount === 0) score += 1;
  if (input.atRiskCount <= 1) score += 1;
  if (input.historyPeriods >= 4) score += 1;
  if (input.forecastConfidence === 'HIGH') score += 1;
  if (input.forecastConfidence === 'LOW') score -= 1;

  if (score >= 5) {
    return {
      level: 'HIGH',
      reason: 'Configured RAF profile with stable bucket pressure and enough history depth.',
    };
  }

  if (score >= 3) {
    return {
      level: 'MEDIUM',
      reason: 'Guidance is usable but bucket pressure or data depth still adds some uncertainty.',
    };
  }

  return {
    level: 'LOW',
    reason: 'High pressure or limited history means recommendations should be treated as directional.',
  };
}

export function calculateRafPlan(input: {
  income: Decimal | number | string;
  carryForward?: Decimal | number | string;
  entries: RafEntryInput[];
  categories: RafCategoryInput[];
}): RafPlan {
  const income = toDecimal(input.income);
  const carryForward = toDecimal(input.carryForward);
  const allocationBase = income.plus(carryForward);
  const configuredTotal = input.categories.reduce(
    (sum, category) => sum.plus(toDecimal(category.rafPercent)),
    new Decimal(0)
  );
  const useDefaultProfile = configuredTotal.equals(0);

  const spendingCategories = input.categories.filter((category) => category.type !== 'INCOME');
  const weightedCategoryTotal = spendingCategories.reduce((sum, category) => {
    const weight = useDefaultProfile
      ? new Decimal(DEFAULT_RAF_PERCENT_BY_NAME[category.name] ?? 0)
      : toDecimal(category.rafPercent);
    return sum.plus(weight);
  }, new Decimal(0));

  const buckets = input.categories
    .filter((category) => category.type !== 'INCOME')
    .map((category) => {
      const weight = useDefaultProfile
        ? new Decimal(DEFAULT_RAF_PERCENT_BY_NAME[category.name] ?? 0)
        : toDecimal(category.rafPercent);

      const allocated = weightedCategoryTotal.greaterThan(0)
        ? allocationBase.times(weight).dividedBy(weightedCategoryTotal)
        : new Decimal(0);

      const percent = allocationBase.greaterThan(0)
        ? allocated.dividedBy(allocationBase).times(100)
        : new Decimal(0);

      const spent = input.entries
        .filter((entry) => entry.categoryId === category.id)
        .reduce((sum, entry) => sum.plus(toDecimal(entry.amount)), new Decimal(0));
      const remaining = allocated.minus(spent);
      const remainingPercent = allocated.equals(0)
        ? new Decimal(0)
        : remaining.dividedBy(allocated).times(100);
      const status: RafBucketSummary['status'] = remaining.lessThanOrEqualTo(0)
        ? 'EXHAUSTED'
        : remainingPercent.lessThanOrEqualTo(15)
        ? 'AT_RISK'
        : 'OPEN';

      return {
        categoryId: category.id,
        name: category.name,
        percent: formatPercent(percent),
        allocated: allocated.toFixed(2),
        spent: spent.toFixed(2),
        remaining: remaining.toFixed(2),
        remainingPercent: formatPercent(remainingPercent),
        status,
        kind: category.countsAsSavings ? 'savings' : category.countsAsExpense ? 'expense' : 'other',
        sortKey: remaining.toNumber(),
      } satisfies RafBucketSummary & { sortKey: number };
    })
    .sort((left, right) => left.sortKey - right.sortKey)
    .map((bucket) => ({
      categoryId: bucket.categoryId,
      name: bucket.name,
      percent: bucket.percent,
      allocated: bucket.allocated,
      spent: bucket.spent,
      remaining: bucket.remaining,
      remainingPercent: bucket.remainingPercent,
      status: bucket.status,
      kind: bucket.kind,
    }));

  const exhaustedBuckets = buckets.filter((bucket) => bucket.status === 'EXHAUSTED');
  const atRiskBuckets = buckets.filter((bucket) => bucket.status === 'AT_RISK');
  const totalAllocated = buckets.reduce((sum, bucket) => sum.plus(bucket.allocated), new Decimal(0));
  const unallocated = allocationBase.minus(totalAllocated);
  const overallocated = totalAllocated.minus(allocationBase);
  const warnings: string[] = [];
  const transferSuggestions = buildRafTransferSuggestions({ buckets });

  if (!configuredTotal.equals(0) && !configuredTotal.equals(100)) {
    warnings.push(`RAF categories currently total ${configuredTotal.toFixed(2)}%, not 100%.`);
  }

  if (useDefaultProfile) {
    warnings.push('Using the default RAF allocation profile because no category percentages are configured yet.');
  }

  if (!carryForward.equals(0)) {
    warnings.push(
      `Carry forward ${carryForward.greaterThan(0) ? '+' : ''}$${carryForward.toFixed(2)} is distributed across RAF buckets by your percentage profile.`
    );
  }

  if (overallocated.greaterThan(0)) {
    warnings.push(`RAF allocations exceed allocation base by $${overallocated.toFixed(2)}.`);
  } else if (unallocated.greaterThan(0)) {
    warnings.push(`$${unallocated.toFixed(2)} of allocation base is not assigned to any RAF bucket.`);
  }

  exhaustedBuckets.forEach((bucket) => {
    warnings.push(`${bucket.name} is exhausted by $${new Decimal(bucket.remaining).abs().toFixed(2)}.`);
  });

  transferSuggestions.forEach((suggestion) => {
    warnings.push(
      `Consider moving about $${suggestion.amount} from ${suggestion.fromBucket} to ${suggestion.toBucket}.`
    );
  });

  return {
    totalIncome: income.toFixed(2),
    carryForward: carryForward.toFixed(2),
    allocationBase: allocationBase.toFixed(2),
    totalPercent: allocationBase.equals(0)
      ? new Decimal(0).toFixed(2)
      : buckets.reduce((sum, bucket) => sum.plus(new Decimal(bucket.percent.replace('%', ''))), new Decimal(0)).toFixed(2),
    allocated: totalAllocated.toFixed(2),
    unallocated: Decimal.max(unallocated, new Decimal(0)).toFixed(2),
    overallocated: Decimal.max(overallocated, new Decimal(0)).toFixed(2),
    profileSource: useDefaultProfile ? 'DEFAULT' : 'CONFIGURED',
    warnings,
    buckets,
    exhaustedBuckets,
    atRiskBuckets,
    transferSuggestions,
  };
}

export function applyRafPeriodTransfers(
  plan: RafPlan,
  transfers: RafPeriodTransferInput[]
): RafPlan {
  if (transfers.length === 0) {
    return plan;
  }

  const outboundByCategory = new Map<string, Decimal>();
  const inboundByCategory = new Map<string, Decimal>();

  transfers.forEach((transfer) => {
    const amount = toDecimal(transfer.amount);
    if (amount.lessThanOrEqualTo(0)) return;

    outboundByCategory.set(
      transfer.fromCategoryId,
      (outboundByCategory.get(transfer.fromCategoryId) ?? new Decimal(0)).plus(amount)
    );
    inboundByCategory.set(
      transfer.toCategoryId,
      (inboundByCategory.get(transfer.toCategoryId) ?? new Decimal(0)).plus(amount)
    );
  });

  const buckets = plan.buckets
    .map((bucket) => {
      const allocated = toDecimal(bucket.allocated);
      const spent = toDecimal(bucket.spent);
      const outbound = outboundByCategory.get(bucket.categoryId) ?? new Decimal(0);
      const inbound = inboundByCategory.get(bucket.categoryId) ?? new Decimal(0);

      const adjustedAllocated = allocated.minus(outbound).plus(inbound);
      const remaining = adjustedAllocated.minus(spent);
      const remainingPercent = adjustedAllocated.equals(0)
        ? new Decimal(0)
        : remaining.dividedBy(adjustedAllocated).times(100);
      const status: RafBucketSummary['status'] = remaining.lessThanOrEqualTo(0)
        ? 'EXHAUSTED'
        : remainingPercent.lessThanOrEqualTo(15)
        ? 'AT_RISK'
        : 'OPEN';

      return {
        ...bucket,
        allocated: adjustedAllocated.toFixed(2),
        remaining: remaining.toFixed(2),
        remainingPercent: formatPercent(remainingPercent),
        status,
        sortKey: remaining.toNumber(),
      };
    })
    .sort((left, right) => left.sortKey - right.sortKey)
    .map((bucket) => ({
      categoryId: bucket.categoryId,
      name: bucket.name,
      percent: bucket.percent,
      allocated: bucket.allocated,
      spent: bucket.spent,
      remaining: bucket.remaining,
      remainingPercent: bucket.remainingPercent,
      status: bucket.status,
      kind: bucket.kind,
    }));

  const exhaustedBuckets = buckets.filter((bucket) => bucket.status === 'EXHAUSTED');
  const atRiskBuckets = buckets.filter((bucket) => bucket.status === 'AT_RISK');
  const transferSuggestions = buildRafTransferSuggestions({ buckets });

  return {
    ...plan,
    buckets,
    exhaustedBuckets,
    atRiskBuckets,
    transferSuggestions,
  };
}