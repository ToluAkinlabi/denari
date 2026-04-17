import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const apply = process.argv.includes('--apply');

const CANONICAL_CATEGORY_FLAGS = {
  income: { countsAsExpense: false, countsAsSavings: false },
  rent: { countsAsExpense: true, countsAsSavings: false },
  grocery: { countsAsExpense: true, countsAsSavings: false },
  phone: { countsAsExpense: true, countsAsSavings: false },
  other: { countsAsExpense: true, countsAsSavings: false },
  debt: { countsAsExpense: true, countsAsSavings: false },
  spend: { countsAsExpense: true, countsAsSavings: false },
  misc: { countsAsExpense: true, countsAsSavings: false },
  partnership: { countsAsExpense: true, countsAsSavings: false },
  savings: { countsAsExpense: false, countsAsSavings: true },
  investment: { countsAsExpense: false, countsAsSavings: true },
};

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function money(num) {
  return Number(num).toFixed(2);
}

function toDateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

async function normalizeCategoryFlags(userId) {
  const categories = await db.category.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
  });

  let changed = 0;
  const notes = [];

  for (const category of categories) {
    const key = normalizeKey(category.name);
    const expected = CANONICAL_CATEGORY_FLAGS[key];

    if (!expected) continue;

    const mismatch =
      category.countsAsExpense !== expected.countsAsExpense ||
      category.countsAsSavings !== expected.countsAsSavings;

    if (!mismatch) continue;

    notes.push(
      `${category.name}: expense ${category.countsAsExpense} -> ${expected.countsAsExpense}, savings ${category.countsAsSavings} -> ${expected.countsAsSavings}`
    );

    if (apply) {
      await db.category.update({
        where: { id: category.id },
        data: {
          countsAsExpense: expected.countsAsExpense,
          countsAsSavings: expected.countsAsSavings,
        },
      });
    }

    changed += 1;
  }

  return { changed, notes };
}

async function findAnomalies(userId) {
  const entries = await db.ledgerEntry.findMany({
    where: { userId },
    include: {
      category: true,
      period: { select: { label: true } },
    },
    orderBy: { date: 'asc' },
  });

  const uncountedOutflows = [];
  const typeCategoryMismatches = [];

  for (const entry of entries) {
    const category = entry.category;

    if ((entry.entryType === 'EXPENSE' || entry.entryType === 'TRANSFER') && !category.countsAsExpense && !category.countsAsSavings) {
      uncountedOutflows.push(entry);
    }

    if (entry.entryType === 'INCOME' && (category.countsAsExpense || category.countsAsSavings)) {
      typeCategoryMismatches.push({ entry, issue: 'INCOME linked to outflow/savings category' });
    }

    if (entry.entryType === 'EXPENSE' && category.countsAsSavings) {
      typeCategoryMismatches.push({ entry, issue: 'EXPENSE linked to savings category' });
    }

    if (entry.entryType === 'TRANSFER' && category.countsAsExpense) {
      typeCategoryMismatches.push({ entry, issue: 'TRANSFER linked to expense category' });
    }
  }

  const duplicateBuckets = new Map();
  for (const entry of entries) {
    const key = [
      toDateKey(entry.date),
      entry.entryType,
      entry.categoryId,
      money(entry.amount),
      normalizeKey(entry.description),
    ].join('|');

    if (!duplicateBuckets.has(key)) duplicateBuckets.set(key, []);
    duplicateBuckets.get(key).push(entry);
  }

  const duplicates = Array.from(duplicateBuckets.values()).filter((bucket) => bucket.length > 1);

  return {
    uncountedOutflows,
    typeCategoryMismatches,
    duplicates,
  };
}

async function normalizeSavingsEntryTypes(userId) {
  const savingsExpenses = await db.ledgerEntry.findMany({
    where: {
      userId,
      entryType: 'EXPENSE',
      category: { countsAsSavings: true },
    },
    select: { id: true },
  });

  if (apply && savingsExpenses.length > 0) {
    await db.ledgerEntry.updateMany({
      where: {
        userId,
        entryType: 'EXPENSE',
        category: { countsAsSavings: true },
      },
      data: { entryType: 'TRANSFER' },
    });
  }

  return savingsExpenses.length;
}

async function recalculatePeriods(userId) {
  const periods = await db.period.findMany({
    where: { userId },
    orderBy: { startDate: 'asc' },
    include: {
      ledgerEntries: { include: { category: true } },
    },
  });

  if (periods.length === 0) return { updated: 0, rows: [] };

  let carry = Number(periods[0].openingCash);
  let updated = 0;
  const rows = [];

  for (const period of periods) {
    const income = period.ledgerEntries
      .filter((e) => e.entryType === 'INCOME')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const spending = period.ledgerEntries
      .filter((e) => e.category?.countsAsExpense)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const savings = period.ledgerEntries
      .filter((e) => e.category?.countsAsSavings)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const expected = carry + income - spending - savings;
    const openingChanged = Number(period.openingCash) !== Number(carry.toFixed(2));
    const closingChanged = Number(period.closingCashExpected) !== Number(expected.toFixed(2));

    rows.push({
      label: period.label,
      openingOld: Number(period.openingCash),
      openingNew: Number(carry.toFixed(2)),
      closingOld: Number(period.closingCashExpected),
      closingNew: Number(expected.toFixed(2)),
      anchored: period.closingCashActual !== null,
    });

    if (openingChanged || closingChanged) {
      updated += 1;
      if (apply) {
        await db.period.update({
          where: { id: period.id },
          data: {
            openingCash: carry,
            closingCashExpected: expected,
          },
        });
      }
    }

    carry = period.closingCashActual !== null ? Number(period.closingCashActual) : Number(expected.toFixed(2));
  }

  return { updated, rows };
}

async function main() {
  const user = await db.user.findFirst({ where: { name: 'Personal' } });
  if (!user) {
    console.log('No Personal user found.');
    return;
  }

  console.log(apply ? 'Running salvage in APPLY mode' : 'Running salvage in DRY-RUN mode');
  console.log(`User: ${user.name} (${user.id})`);

  const categoryResult = await normalizeCategoryFlags(user.id);
  const normalizedSavingsTypes = await normalizeSavingsEntryTypes(user.id);
  const anomalies = await findAnomalies(user.id);
  const periodResult = await recalculatePeriods(user.id);

  console.log('\nCategory flag updates:', categoryResult.changed);
  console.log('Savings type normalizations:', normalizedSavingsTypes);
  if (categoryResult.notes.length > 0) {
    categoryResult.notes.slice(0, 12).forEach((note) => console.log(`- ${note}`));
  }

  console.log(`\nUncounted outflows: ${anomalies.uncountedOutflows.length}`);
  console.log(`Type/category mismatches: ${anomalies.typeCategoryMismatches.length}`);
  console.log(`Possible duplicate clusters: ${anomalies.duplicates.length}`);

  if (anomalies.typeCategoryMismatches.length > 0) {
    console.log('\nMismatch samples:');
    anomalies.typeCategoryMismatches.slice(0, 10).forEach(({ entry, issue }, idx) => {
      console.log(
        `${idx + 1}. ${toDateKey(entry.date)} [${entry.period.label}] ${entry.entryType} $${money(entry.amount)} cat=${entry.category.name} :: ${issue}`
      );
    });
  }

  if (anomalies.duplicates.length > 0) {
    const sample = anomalies.duplicates.slice(0, 5);
    console.log('\nDuplicate samples:');
    sample.forEach((cluster, idx) => {
      const first = cluster[0];
      console.log(
        `${idx + 1}. ${toDateKey(first.date)} ${first.entryType} ${first.category.name} $${money(first.amount)} x${cluster.length} (${first.description || 'no desc'})`
      );
    });
  }

  console.log(`\nPeriods recalculated: ${periodResult.updated}`);
  const changedRows = periodResult.rows.filter((r) => r.openingOld !== r.openingNew || r.closingOld !== r.closingNew).slice(0, 8);
  changedRows.forEach((row) => {
    const anchor = row.anchored ? ' [ANCHOR]' : '';
    console.log(`- ${row.label}${anchor}: open ${money(row.openingOld)} -> ${money(row.openingNew)}, close ${money(row.closingOld)} -> ${money(row.closingNew)}`);
  });

  if (!apply) {
    console.log('\nNo database writes were made. Re-run with --apply to persist safe fixes.');
  } else {
    console.log('\nSalvage apply complete. Safe fixes have been written.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
