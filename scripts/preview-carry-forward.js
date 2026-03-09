const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { name: 'Personal' } });
  if (!user) {
    console.log('No user found.');
    return;
  }

  const latestWithData = await prisma.period.findFirst({
    where: { userId: user.id, ledgerEntries: { some: {} } },
    orderBy: { endDate: 'desc' },
    include: {
      ledgerEntries: { include: { category: true } },
    },
  });

  if (!latestWithData) {
    console.log('No period with data found.');
    return;
  }

  const income = latestWithData.ledgerEntries
    .filter((e) => e.entryType === 'INCOME')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const spending = latestWithData.ledgerEntries
    .filter((e) => e.category && e.category.countsAsExpense)
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const savings = latestWithData.ledgerEntries
    .filter((e) => e.category && e.category.countsAsSavings)
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const opening = Number(latestWithData.openingCash);
  const computedClosing = opening + income - spending - savings;

  console.log('Latest period with data:', latestWithData.label);
  console.log('Opening:', opening.toFixed(2));
  console.log('Income:', income.toFixed(2));
  console.log('Spending:', spending.toFixed(2));
  console.log('Savings:', savings.toFixed(2));
  console.log('Computed closing (carry-forward):', computedClosing.toFixed(2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
