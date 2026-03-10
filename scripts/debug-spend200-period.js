const { PrismaClient } = require('@prisma/client');
const { startOfDay } = require('date-fns');

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { name: 'Personal' }, orderBy: { createdAt: 'asc' } });
  if (!user) {
    console.log('No Personal user found');
    return;
  }

  const today = startOfDay(new Date());
  const currentPeriod = await prisma.period.findFirst({
    where: { userId: user.id, startDate: { lte: today }, endDate: { gte: today } },
    orderBy: { endDate: 'desc' },
  });

  const recentEntries = await prisma.ledgerEntry.findMany({
    where: {
      userId: user.id,
    },
    include: { period: true },
    orderBy: { createdAt: 'desc' },
    take: 120,
  });

  const spend200 = recentEntries.filter((entry) => {
    const amount = entry.amount.toString();
    const description = (entry.description || '').trim().toLowerCase();
    const day = entry.date.toISOString().split('T')[0];
    return description === 'spend' && (amount === '200' || amount === '200.00') && day === '2026-03-10';
  });

  console.log('Current period id:', currentPeriod ? currentPeriod.id : 'none');
  console.log('Current period label:', currentPeriod ? currentPeriod.label : 'none');
  console.log('Spend200 rows:', spend200.length);
  for (const e of spend200) {
    console.log(
      `${e.id} | periodId=${e.periodId} | periodLabel=${e.period ? e.period.label : 'none'} | userId=${e.userId} | created=${e.createdAt.toISOString()}`
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
