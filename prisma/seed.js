const { PrismaClient } = require('@prisma/client');
const { addDays } = require('date-fns');

const prisma = new PrismaClient();

// Define all default categories
const categories = [
  // Income
  { name: 'Income', type: 'INCOME', group: 'INCOME', color: '#10b981', icon: 'TrendingUp', countsAsExpense: false, countsAsSavings: false },

  // Essential
  { name: 'Rent', type: 'RENT', group: 'ESSENTIAL', color: '#ef4444', icon: 'Home', countsAsExpense: true, countsAsSavings: false },
  { name: 'Grocery', type: 'GROCERY', group: 'ESSENTIAL', color: '#f97316', icon: 'ShoppingCart', countsAsExpense: true, countsAsSavings: false },
  { name: 'Phone', type: 'PHONE', group: 'ESSENTIAL', color: '#3b82f6', icon: 'Smartphone', countsAsExpense: true, countsAsSavings: false },
  { name: 'Other', type: 'OTHER', group: 'ESSENTIAL', color: '#8b5cf6', icon: 'Zap', countsAsExpense: true, countsAsSavings: false },
  { name: 'Debt', type: 'DEBT', group: 'ESSENTIAL', color: '#dc2626', icon: 'CreditCard', countsAsExpense: true, countsAsSavings: false },

  // Lifestyle
  { name: 'Spend', type: 'SPEND', group: 'LIFESTYLE', color: '#06b6d4', icon: 'ShoppingBag', countsAsExpense: true, countsAsSavings: false },

  // Avoidable
  { name: 'Misc', type: 'MISC', group: 'AVOIDABLE', color: '#ec4899', icon: 'HelpCircle', countsAsExpense: true, countsAsSavings: false },

  // Values
  { name: 'Partnership', type: 'PARTNERSHIP', group: 'VALUES', color: '#f59e0b', icon: 'Heart', countsAsExpense: true, countsAsSavings: false },

  // Wealth
  { name: 'Savings', type: 'SAVINGS', group: 'WEALTH', color: '#14b8a6', icon: 'PiggyBank', countsAsExpense: false, countsAsSavings: true },
];

// First payday: January 9, 2026
const firstPayday = new Date('2026-01-09');

async function generatePeriods(startDate, endDate) {
  const periods = [];
  let currentPayDate = new Date(firstPayday);

  while (currentPayDate < endDate) {
    const periodStart = new Date(currentPayDate);
    const periodEnd = addDays(currentPayDate, 13);
    
    if (periodStart < endDate) {
      periods.push({
        label: `${periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${periodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        payDate: new Date(currentPayDate),
        startDate: periodStart,
        endDate: periodEnd,
        openingCash: 5000,
        closingCashExpected: 0,
        closingCashActual: null,
        status: 'OPEN',
        notes: null,
      });
    }

    currentPayDate = addDays(currentPayDate, 14);
  }

  return periods;
}

async function main() {
  console.log('🌱 Starting database seed...');

  // Create or get default user
  let user = await prisma.user.findFirst({
    where: { name: 'Personal' },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: 'Personal',
      },
    });
  }

  console.log(`✅ User: ${user.name} (${user.id})`);

  // Create default categories
  for (const cat of categories) {
    await prisma.category.upsert({
      where: {
        userId_name: {
          userId: user.id,
          name: cat.name,
        },
      },
      update: {},
      create: {
        userId: user.id,
        ...cat,
      },
    });
  }

  console.log(`✅ Created ${categories.length} categories`);

  // Generate sample periods for 2026
  const periods = await generatePeriods(
    new Date('2026-01-01'),
    new Date('2026-12-31')
  );

  for (const period of periods) {
    await prisma.period.upsert({
      where: {
        userId_startDate_endDate: {
          userId: user.id,
          startDate: period.startDate,
          endDate: period.endDate,
        },
      },
      update: {},
      create: {
        userId: user.id,
        ...period,
      },
    });
  }

  console.log(`✅ Created ${periods.length} sample periods for 2026`);

  // Create sample ledger entries for the first period
  const firstPeriod = await prisma.period.findFirst({
    where: { userId: user.id },
    orderBy: { startDate: 'asc' },
  });

  if (firstPeriod) {
    const incomeCategory = await prisma.category.findFirst({
      where: { userId: user.id, name: 'Income' },
    });

    const spendCategory = await prisma.category.findFirst({
      where: { userId: user.id, name: 'Spend' },
    });

    const groceryCategory = await prisma.category.findFirst({
      where: { userId: user.id, name: 'Grocery' },
    });

    const savingsCategory = await prisma.category.findFirst({
      where: { userId: user.id, name: 'Savings' },
    });

    // Sample income entry
    await prisma.ledgerEntry.create({
      data: {
        userId: user.id,
        periodId: firstPeriod.id,
        date: firstPeriod.payDate,
        amount: 3500,
        categoryId: incomeCategory.id,
        entryType: 'INCOME',
        source: 'manual',
        description: 'Biweekly paycheck',
      },
    });

    // Sample expense entries
    await prisma.ledgerEntry.create({
      data: {
        userId: user.id,
        periodId: firstPeriod.id,
        date: addDays(firstPeriod.startDate, 2),
        amount: 45,
        categoryId: groceryCategory.id,
        entryType: 'EXPENSE',
        source: 'transaction',
        description: 'Farmer\'s market',
      },
    });

    await prisma.ledgerEntry.create({
      data: {
        userId: user.id,
        periodId: firstPeriod.id,
        date: addDays(firstPeriod.startDate, 3),
        amount: 75,
        categoryId: spendCategory.id,
        entryType: 'EXPENSE',
        source: 'transaction',
        description: 'Coffee & lunch',
      },
    });

    // Sample savings entry with allocations
    const savingsEntry = await prisma.ledgerEntry.create({
      data: {
        userId: user.id,
        periodId: firstPeriod.id,
        date: addDays(firstPeriod.startDate, 5),
        amount: 500,
        categoryId: savingsCategory.id,
        entryType: 'TRANSFER',
        source: 'manual',
        description: 'Transfer to investments',
      },
    });

    // Create savings allocation
    await prisma.savingsAllocation.create({
      data: {
        userId: user.id,
        ledgerEntryId: savingsEntry.id,
        bucket: 'Investments',
        amount: 350,
      },
    });

    await prisma.savingsAllocation.create({
      data: {
        userId: user.id,
        ledgerEntryId: savingsEntry.id,
        bucket: 'Emergency Fund',
        amount: 150,
      },
    });

    console.log(`✅ Created sample ledger entries for first period`);
  }

  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
