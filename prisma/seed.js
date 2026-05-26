const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Define all default categories for Denari
const categories = [
  // Income
  { name: 'Income', type: 'INCOME', group: 'INCOME', color: '#10b981', icon: 'TrendingUp', countsAsExpense: false, countsAsSavings: false, rafPercent: 0 },

  { name: 'Spend', type: 'SPEND', group: 'LIFESTYLE', color: '#06b6d4', icon: 'ShoppingBag', countsAsExpense: true, countsAsSavings: false, rafPercent: 20 },
  { name: 'Partnership', type: 'PARTNERSHIP', group: 'VALUES', color: '#f59e0b', icon: 'Heart', countsAsExpense: true, countsAsSavings: false, rafPercent: 10 },
  { name: 'Debt', type: 'DEBT', group: 'ESSENTIAL', color: '#dc2626', icon: 'CreditCard', countsAsExpense: true, countsAsSavings: false, rafPercent: 15 },
  { name: 'Phone', type: 'PHONE', group: 'ESSENTIAL', color: '#3b82f6', icon: 'Smartphone', countsAsExpense: true, countsAsSavings: false, rafPercent: 5 },
  { name: 'Other bills', type: 'OTHER', group: 'ESSENTIAL', color: '#64748b', icon: 'Receipt', countsAsExpense: true, countsAsSavings: false, rafPercent: 5 },
  { name: 'Gifts & Donations', type: 'MISC', group: 'VALUES', color: '#ec4899', icon: 'Gift', countsAsExpense: true, countsAsSavings: false, rafPercent: 5 },
  { name: 'Savings', type: 'SAVINGS', group: 'WEALTH', color: '#14b8a6', icon: 'PiggyBank', countsAsExpense: false, countsAsSavings: true, rafPercent: 15 },
  { name: 'Investments', type: 'SAVINGS', group: 'WEALTH', color: '#0ea5e9', icon: 'LineChart', countsAsExpense: false, countsAsSavings: true, rafPercent: 15 },
  { name: 'Groceries', type: 'GROCERY', group: 'ESSENTIAL', color: '#f97316', icon: 'ShoppingCart', countsAsExpense: true, countsAsSavings: false, rafPercent: 10 },
];

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

  console.log('🎉 Database seeded successfully!');
  console.log('');
  console.log('ℹ️  Periods will be created automatically when you add transactions.');
  console.log('   Opening balance will default to $5000 for the first period.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
