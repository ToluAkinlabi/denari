import { Decimal } from '@prisma/client/runtime/library';

type LedgerEntryLike = {
  amount: Decimal;
  entryType: string;
  categoryId: string;
};

export function calculateCashflowByCategory(
  entries: LedgerEntryLike[],
  categoryMap: Map<
    string,
    { name: string; countsAsExpense: boolean; countsAsSavings?: boolean }
  >
): Array<{
  categoryId: string;
  categoryName: string;
  amount: Decimal;
  count: number;
  percentage: Decimal;
  kind: 'income' | 'expense' | 'savings';
}> {
  const breakdown = new Map<
    string,
    {
      categoryId: string;
      categoryName: string;
      amount: Decimal;
      count: number;
      kind: 'income' | 'expense' | 'savings';
    }
  >();

  entries.forEach((entry) => {
    const category = categoryMap.get(entry.categoryId);

    let kind: 'income' | 'expense' | 'savings' | null = null;
    if (entry.entryType === 'INCOME') {
      kind = 'income';
    } else if (category?.countsAsSavings) {
      kind = 'savings';
    } else if (category?.countsAsExpense) {
      kind = 'expense';
    }

    if (!kind) {
      return;
    }

    const key = `${kind}:${entry.categoryId}`;
    const existing = breakdown.get(key) || {
      categoryId: entry.categoryId,
      categoryName: category?.name || (kind === 'income' ? 'Income' : 'Unknown'),
      amount: new Decimal(0),
      count: 0,
      kind,
    };

    breakdown.set(key, {
      ...existing,
      amount: existing.amount.plus(entry.amount),
      count: existing.count + 1,
    });
  });

  const totalsByKind = Array.from(breakdown.values()).reduce(
    (totals, item) => {
      totals[item.kind] = totals[item.kind].plus(item.amount);
      return totals;
    },
    {
      income: new Decimal(0),
      expense: new Decimal(0),
      savings: new Decimal(0),
    }
  );

  return Array.from(breakdown.values())
    .map((item) => ({
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      amount: item.amount,
      count: item.count,
      percentage: totalsByKind[item.kind].equals(0)
        ? new Decimal(0)
        : item.amount.dividedBy(totalsByKind[item.kind]).times(100).toDecimalPlaces(2),
      kind: item.kind,
    }))
    .sort((a, b) => {
      if (a.kind !== b.kind) {
        const order: Record<'income' | 'expense' | 'savings', number> = {
          income: 0,
          expense: 1,
          savings: 2,
        };
        return order[a.kind] - order[b.kind];
      }

      return b.amount.comparedTo(a.amount);
    });
}