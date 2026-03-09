const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const periods = await prisma.period.findMany({
    take: 6,
    orderBy: { startDate: 'asc' },
    select: {
      label: true,
      startDate: true,
      endDate: true,
      payDate: true,
    },
  });

  console.log('\n📅 First 6 periods:');
  console.log('='.repeat(80));
  periods.forEach((p, i) => {
    const start = p.startDate.toISOString().split('T')[0];
    const end = p.endDate.toISOString().split('T')[0];
    const pay = p.payDate.toISOString().split('T')[0];
    console.log(`Period ${i + 1}: ${start} to ${end} (payday: ${pay}) - "${p.label}"`);
  });
  console.log('='.repeat(80));
  
  await prisma.$disconnect();
}

main().catch(console.error);
