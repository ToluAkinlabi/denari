const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CANONICAL_ORDER = [
  'Spend',
  'Partnership',
  'Debt',
  'Phone',
  'Other bills',
  'Gifts & Donations',
  'Savings',
  'Investments',
  'Groceries',
];

const NAME_ALIASES = {
  spend: 'Spend',
  partnership: 'Partnership',
  debt: 'Debt',
  phone: 'Phone',
  other: 'Other bills',
  others: 'Other bills',
  rent: 'Other bills',
  misc: 'Gifts & Donations',
  gift: 'Gifts & Donations',
  gifts: 'Gifts & Donations',
  'gifts & donations': 'Gifts & Donations',
  savings: 'Savings',
  investment: 'Investments',
  investments: 'Investments',
  grocery: 'Groceries',
  groceries: 'Groceries',
};

const CANONICAL_CONFIG = {
  Spend: { type: 'SPEND', group: 'LIFESTYLE', countsAsExpense: true, countsAsSavings: false },
  Partnership: { type: 'PARTNERSHIP', group: 'VALUES', countsAsExpense: true, countsAsSavings: false },
  Debt: { type: 'DEBT', group: 'ESSENTIAL', countsAsExpense: true, countsAsSavings: false },
  Phone: { type: 'PHONE', group: 'ESSENTIAL', countsAsExpense: true, countsAsSavings: false },
  'Other bills': { type: 'OTHER', group: 'ESSENTIAL', countsAsExpense: true, countsAsSavings: false },
  'Gifts & Donations': { type: 'MISC', group: 'VALUES', countsAsExpense: true, countsAsSavings: false },
  Savings: { type: 'SAVINGS', group: 'WEALTH', countsAsExpense: false, countsAsSavings: true },
  Investments: { type: 'SAVINGS', group: 'WEALTH', countsAsExpense: false, countsAsSavings: true },
  Groceries: { type: 'GROCERY', group: 'ESSENTIAL', countsAsExpense: true, countsAsSavings: false },
};

const DEFAULT_PERCENT = {
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

function canonicalize(name) {
  return NAME_ALIASES[name.trim().toLowerCase()] || null;
}

async function ensureMissingCanonicalCategories(userId, categoriesByCanonical) {
  for (const canonical of CANONICAL_ORDER) {
    if (categoriesByCanonical.get(canonical)?.length) continue;

    const config = CANONICAL_CONFIG[canonical];
    const created = await prisma.category.create({
      data: {
        userId,
        name: canonical,
        type: config.type,
        group: config.group,
        countsAsExpense: config.countsAsExpense,
        countsAsSavings: config.countsAsSavings,
        rafPercent: DEFAULT_PERCENT[canonical],
      },
    });

    categoriesByCanonical.set(canonical, [created]);
  }
}

async function mergeIntoTarget(userId, canonicalName, categories) {
  if (categories.length <= 1) {
    const target = categories[0];
    const canonicalConfig = CANONICAL_CONFIG[canonicalName];
    await prisma.category.update({
      where: { id: target.id },
      data: {
        name: canonicalName,
        type: canonicalConfig.type,
        group: canonicalConfig.group,
        countsAsExpense: canonicalConfig.countsAsExpense,
        countsAsSavings: canonicalConfig.countsAsSavings,
      },
    });
    return;
  }

  // Prefer already-canonical category as merge target when available.
  const target =
    categories.find((c) => c.name === canonicalName) ||
    categories.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

  const sourceCategories = categories.filter((c) => c.id !== target.id);

  let mergedRafPercent = Number(target.rafPercent || 0);
  let mergedExpectedFrequency = target.expectedFrequency;
  let mergedDefaultStrategy = target.defaultStrategy;
  let mergedIsDiscretionary = !!target.isDiscretionary;

  for (const source of sourceCategories) {
    mergedRafPercent += Number(source.rafPercent || 0);
    mergedIsDiscretionary = mergedIsDiscretionary || !!source.isDiscretionary;

    if (!mergedExpectedFrequency || mergedExpectedFrequency === 'VARIABLE') {
      mergedExpectedFrequency = source.expectedFrequency;
    }

    if (!mergedDefaultStrategy || mergedDefaultStrategy === 'UNKNOWN') {
      mergedDefaultStrategy = source.defaultStrategy;
    }

    await prisma.ledgerEntry.updateMany({
      where: { userId, categoryId: source.id },
      data: { categoryId: target.id },
    });

    await prisma.importedBankTransaction.updateMany({
      where: { userId, categoryId: source.id },
      data: { categoryId: target.id },
    });

    await prisma.rafTransfer.updateMany({
      where: { userId, fromCategoryId: source.id },
      data: { fromCategoryId: target.id },
    });

    await prisma.rafTransfer.updateMany({
      where: { userId, toCategoryId: source.id },
      data: { toCategoryId: target.id },
    });

    await prisma.category.delete({ where: { id: source.id } });
  }

  const canonicalConfig = CANONICAL_CONFIG[canonicalName];

  await prisma.category.update({
    where: { id: target.id },
    data: {
      name: canonicalName,
      type: canonicalConfig.type,
      group: canonicalConfig.group,
      countsAsExpense: canonicalConfig.countsAsExpense,
      countsAsSavings: canonicalConfig.countsAsSavings,
      rafPercent: mergedRafPercent,
      expectedFrequency: mergedExpectedFrequency || 'VARIABLE',
      defaultStrategy: mergedDefaultStrategy || 'UNKNOWN',
      isDiscretionary: mergedIsDiscretionary,
    },
  });
}

async function normalizeUser(user) {
  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });

  const categoriesByCanonical = new Map();

  for (const category of categories) {
    const canonicalName = canonicalize(category.name);
    if (!canonicalName) continue;

    const current = categoriesByCanonical.get(canonicalName) || [];
    current.push(category);
    categoriesByCanonical.set(canonicalName, current);
  }

  await ensureMissingCanonicalCategories(user.id, categoriesByCanonical);

  for (const canonicalName of CANONICAL_ORDER) {
    const grouped = categoriesByCanonical.get(canonicalName) || [];
    if (grouped.length === 0) continue;
    await mergeIntoTarget(user.id, canonicalName, grouped);
  }

  const finalCategories = await prisma.category.findMany({
    where: { userId: user.id, name: { in: CANONICAL_ORDER } },
    select: { name: true, rafPercent: true },
  });

  const byName = new Map(finalCategories.map((c) => [c.name, Number(c.rafPercent || 0)]));
  const total = CANONICAL_ORDER.reduce((sum, name) => sum + (byName.get(name) || 0), 0);

  console.log(`\nUser: ${user.name} (${user.id})`);
  for (const name of CANONICAL_ORDER) {
    console.log(`  ${name}: ${((byName.get(name) || 0)).toFixed(2)}%`);
  }
  console.log(`  Total RAF %: ${total.toFixed(2)}%`);
}

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, name: true } });

  if (users.length === 0) {
    console.log('No users found.');
    return;
  }

  console.log('Normalizing RAF categories to canonical bucket names...');

  for (const user of users) {
    await prisma.$transaction(async () => {
      await normalizeUser(user);
    });
  }

  console.log('\nDone. RAF categories are now canonicalized in the database.');
}

main()
  .catch((error) => {
    console.error('Normalization failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
