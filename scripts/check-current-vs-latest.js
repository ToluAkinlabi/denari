const { PrismaClient } = require('@prisma/client');
const { startOfDay } = require('date-fns');

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { name: 'Personal' } });
  const today = startOfDay(new Date());

  const current = await prisma.period.findFirst({
    where: { userId: user.id, startDate: { lte: today }, endDate: { gte: today } },
    orderBy: { endDate: 'desc' },
  });

  const latestWithData = await prisma.period.findFirst({
    where: { userId: user.id, ledgerEntries: { some: {} } },
    orderBy: { endDate: 'desc' },
  });

  console.log('Today:', today.toISOString().split('T')[0]);
  console.log('Current period:', current ? current.label : 'none');
  console.log('Latest with data:', latestWithData ? latestWithData.label : 'none');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
