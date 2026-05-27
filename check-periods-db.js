const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!user) { console.log('no user'); return; }
  console.log('userId:', user.id);
  
  const periods = await prisma.period.findMany({
    where: { userId: user.id },
    orderBy: { startDate: 'desc' },
    take: 14,
    include: { _count: { select: { ledgerEntries: true } } }
  });
  
  for (const p of periods) {
    const start = p.startDate.toISOString().split('T')[0];
    const end = p.endDate.toISOString().split('T')[0];
    const days = Math.round((p.endDate.getTime() - p.startDate.getTime()) / 86400000) + 1;
    console.log(start + ' to ' + end + ' (' + days + 'd) label=' + p.label + ' entries=' + p._count.ledgerEntries);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
