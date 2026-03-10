const { PrismaClient } = require('@prisma/client');
const { startOfDay } = require('date-fns');

const prisma = new PrismaClient();

async function resolveAppUser() {
  const personalUser = await prisma.user.findFirst({
    where: { name: 'Personal' },
    orderBy: { createdAt: 'asc' },
  });
  if (personalUser) return { reason: 'name=Personal', user: personalUser };

  const legacyUser = await prisma.user.findFirst({
    where: { name: 'Default User' },
    orderBy: { createdAt: 'asc' },
  });
  if (legacyUser) return { reason: 'name=Default User', user: legacyUser };

  const userWithData = await prisma.user.findFirst({
    where: {
      categories: { some: {} },
      periods: { some: {} },
    },
    orderBy: { createdAt: 'asc' },
  });
  if (userWithData) return { reason: 'first user with data', user: userWithData };

  const anyUser = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (anyUser) return { reason: 'first user fallback', user: anyUser };

  return { reason: 'none', user: null };
}

async function main() {
  const today = startOfDay(new Date());
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      _count: {
        select: { periods: true, categories: true, ledgerEntries: true },
      },
    },
  });

  console.log('User summary:');
  for (const u of users) {
    console.log(
      `${u.id} | ${u.name} | periods=${u._count.periods} categories=${u._count.categories} entries=${u._count.ledgerEntries}`
    );
  }

  const resolved = await resolveAppUser();
  if (!resolved.user) {
    console.log('No resolvable app user.');
    return;
  }

  console.log('---');
  console.log(`App resolves user via: ${resolved.reason}`);
  console.log(`Resolved user: ${resolved.user.id} (${resolved.user.name})`);

  const currentPeriod = await prisma.period.findFirst({
    where: {
      userId: resolved.user.id,
      startDate: { lte: today },
      endDate: { gte: today },
    },
    orderBy: { endDate: 'desc' },
  });

  if (!currentPeriod) {
    console.log('No current period for resolved user.');
    return;
  }

  console.log(`Current period: ${currentPeriod.label} (${currentPeriod.id})`);

  const periodEntries = await prisma.ledgerEntry.findMany({
    where: { userId: resolved.user.id, periodId: currentPeriod.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  console.log(`Entries in current period: ${periodEntries.length}`);

  const spend200 = periodEntries.filter(
    (e) => (e.description || '').toLowerCase() === 'spend' && e.amount.toString() === '200'
  );
  console.log(`"Spend 200" entries in current period: ${spend200.length}`);

  if (spend200.length > 0) {
    console.log('Spend 200 createdAt values:');
    spend200.forEach((e) => console.log(e.createdAt.toISOString()));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
