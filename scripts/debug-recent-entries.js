const { PrismaClient } = require('@prisma/client');
const { startOfDay } = require('date-fns');

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!user) {
    console.log('No user found');
    return;
  }

  const today = startOfDay(new Date());
  const currentPeriod = await prisma.period.findFirst({
    where: {
      userId: user.id,
      startDate: { lte: today },
      endDate: { gte: today },
    },
    orderBy: { endDate: 'desc' },
  });

  const recent = await prisma.ledgerEntry.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 40,
    include: {
      period: true,
      category: true,
    },
  });

  console.log('Today:', today.toISOString().split('T')[0]);
  console.log('Current period:', currentPeriod ? currentPeriod.label : 'none');
  console.log('Recent entries count:', recent.length);

  const duplicates = new Map();
  for (const e of recent) {
    const day = e.date.toISOString().split('T')[0];
    const key = `${e.description || '(no description)'} | ${e.amount.toString()} | ${day}`;
    duplicates.set(key, (duplicates.get(key) || 0) + 1);
  }

  console.log('Duplicate patterns in last 40 entries:');
  let hasDupes = false;
  for (const [key, count] of duplicates.entries()) {
    if (count > 1) {
      hasDupes = true;
      console.log(`${count}x :: ${key}`);
    }
  }
  if (!hasDupes) console.log('none');

  console.log('--- Top 15 latest entries ---');
  for (const e of recent.slice(0, 15)) {
    console.log([
      e.createdAt.toISOString(),
      e.date.toISOString().split('T')[0],
      e.description || '(no description)',
      e.amount.toString(),
      e.entryType,
      e.category ? e.category.name : 'Unknown',
      e.period ? e.period.label : 'NoPeriod',
    ].join(' | '));
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
