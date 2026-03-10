const { PrismaClient } = require('@prisma/client');
const { startOfDay } = require('date-fns');

const prisma = new PrismaClient();

function scorePeriod(period, windowStart, windowEnd) {
  const hasExactRange =
    period.startDate.getTime() === windowStart.getTime() &&
    period.endDate.getTime() === windowEnd.getTime();
  return (hasExactRange ? 100000 : 0) + period.ledgerEntries.length;
}

async function main() {
  const user = await prisma.user.findFirst({ where: { name: 'Personal' }, orderBy: { createdAt: 'asc' } });
  const today = startOfDay(new Date());

  const overlaps = await prisma.period.findMany({
    where: {
      userId: user.id,
      startDate: { lte: today },
      endDate: { gte: today },
    },
    include: {
      ledgerEntries: true,
    },
  });

  console.log('Overlapping periods today:', overlaps.length);

  overlaps.forEach((p) => {
    const s = scorePeriod(p, new Date(2026, 2, 7), new Date(2026, 2, 20));
    console.log(`${p.id} | ${p.label} | start=${p.startDate.toISOString()} | end=${p.endDate.toISOString()} | entries=${p.ledgerEntries.length} | score=${s}`);
  });

  const sorted = [...overlaps].sort((a, b) => scorePeriod(b, new Date(2026, 2, 7), new Date(2026, 2, 20)) - scorePeriod(a, new Date(2026, 2, 7), new Date(2026, 2, 20)));
  if (sorted[0]) {
    console.log('Selected by new logic:', sorted[0].id, sorted[0].label, 'entries=', sorted[0].ledgerEntries.length);
  }
}

main().catch(console.error).finally(async () => prisma.$disconnect());
