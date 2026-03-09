import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { buildCategoryHistory, buildSavingsHistory } from '../lib/finance/forecast-builder';
import { forecastNextPeriodEnhanced } from '../lib/finance/forecast-enhanced';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('No user found');
    return;
  }

  const recentPeriods = await prisma.period.findMany({
    where: { userId: user.id },
    orderBy: { startDate: 'desc' },
    take: 6,
    include: {
      ledgerEntries: {
        include: { category: true },
      },
    },
  });

  if (recentPeriods.length < 2) {
    console.log('Not enough periods to test forecast (need at least 2).');
    return;
  }

  const currentPeriod = recentPeriods[0];

  const currentEntries = currentPeriod.ledgerEntries;
  const currentIncome = currentEntries
    .filter((e) => e.entryType === 'INCOME')
    .reduce((sum, e) => sum.plus(e.amount), new Decimal(0));

  const currentSpending = currentEntries
    .filter((e) => e.entryType === 'EXPENSE')
    .reduce((sum, e) => sum.plus(e.amount), new Decimal(0));

  const currentSavings = currentEntries
    .filter((e) => e.entryType === 'TRANSFER' || e.category.countsAsSavings)
    .reduce((sum, e) => sum.plus(e.amount), new Decimal(0));

  const currentCashEnding = currentPeriod.openingCash
    .plus(currentIncome)
    .minus(currentSpending)
    .minus(currentSavings);

  const allRecentEntries = recentPeriods.flatMap((p) => p.ledgerEntries);

  const incomeCategories = buildCategoryHistory(
    allRecentEntries as any,
    'INCOME'
  );

  const spendingCategories = buildCategoryHistory(
    allRecentEntries as any,
    'EXPENSE'
  );

  const savingsCategories = buildSavingsHistory(allRecentEntries as any);

  const result = forecastNextPeriodEnhanced({
    currentCash: currentCashEnding,
    incomeCategories,
    spendingCategories,
    savingsCategories,
    periodIncome: currentIncome,
  });

  const fmt = (n: Decimal) => n.toFixed(2);

  console.log('Enhanced Forecast Validation (Real Data)');
  console.log('=======================================');
  console.log(`User: ${user.name} (${user.id})`);
  console.log(`Periods analyzed: ${recentPeriods.length}`);
  console.log(`Entries analyzed: ${allRecentEntries.length}`);
  console.log('');

  console.log('Summary');
  console.log(`Confidence: ${result.confidence}`);
  console.log(`Income range: $${fmt(result.income.min)} - $${fmt(result.income.max)} (likely $${fmt(result.income.likely)})`);
  console.log(`Spending range: $${fmt(result.spending.min)} - $${fmt(result.spending.max)} (likely $${fmt(result.spending.likely)})`);
  console.log(`Savings range: $${fmt(result.savings.min)} - $${fmt(result.savings.max)} (likely $${fmt(result.savings.likely)})`);
  console.log(`Buffer range: $${fmt(result.discretionaryBuffer.min)} - $${fmt(result.discretionaryBuffer.max)} (likely $${fmt(result.discretionaryBuffer.likely)})`);
  console.log(`Ending cash range: $${fmt(result.endingCash.min)} - $${fmt(result.endingCash.max)} (likely $${fmt(result.endingCash.likely)})`);
  console.log('');

  const strategyCount = result.categoryBreakdown.reduce<Record<string, number>>((acc, c) => {
    acc[c.strategy] = (acc[c.strategy] || 0) + 1;
    return acc;
  }, {});

  console.log('Strategy Distribution');
  Object.entries(strategyCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([strategy, count]) => {
      console.log(`- ${strategy}: ${count}`);
    });
  console.log('');

  const topByLikely = [...result.categoryBreakdown]
    .sort((a, b) => b.forecast.likely.comparedTo(a.forecast.likely))
    .slice(0, 10);

  console.log('Top Categories by Likely Forecast');
  topByLikely.forEach((c) => {
    console.log(
      `- ${c.categoryName}: $${fmt(c.forecast.likely)} [${c.strategy}, ${c.confidence}]`
    );
  });
  console.log('');

  if (result.warnings.length > 0) {
    console.log('Warnings');
    result.warnings.forEach((w) => console.log(`- ${w}`));
  } else {
    console.log('Warnings: none');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
