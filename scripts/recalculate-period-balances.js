let prisma;

async function main() {
  const { PrismaClient } = await import('@prisma/client');
  prisma = new PrismaClient();
  const user = await prisma.user.findFirst({ where: { name: 'Personal' } });
  if (!user) {
    console.log('No user found.');
    return;
  }

  const periods = await prisma.period.findMany({
    where: { userId: user.id },
    orderBy: { startDate: 'asc' },
    include: {
      ledgerEntries: { include: { category: true } },
    },
  });

  if (periods.length === 0) {
    console.log('No periods found.');
    return;
  }

  let carry = 0;

  for (const period of periods) {
    const income = period.ledgerEntries
      .filter((e) => e.entryType === 'INCOME')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const spending = period.ledgerEntries
      .filter((e) => e.category && e.category.countsAsExpense)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const savings = period.ledgerEntries
      .filter((e) => e.category && e.category.countsAsSavings)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const closingExpected = carry + income - spending - savings;
    const closingActual = period.closingCashActual == null ? null : Number(period.closingCashActual);

    await prisma.period.update({
      where: { id: period.id },
      data: {
        openingCash: carry,
        closingCashExpected: closingExpected,
      },
    });

    console.log(
      `${period.label}: opening=${carry.toFixed(2)} income=${income.toFixed(2)} spending=${spending.toFixed(2)} savings=${savings.toFixed(2)} closingExpected=${closingExpected.toFixed(2)} closingActual=${closingActual === null ? 'null' : closingActual.toFixed(2)}`
    );

    carry = closingActual ?? closingExpected;
  }

  console.log('Recalculated opening/closing balances for all periods.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });
