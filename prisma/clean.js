const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning database data...');

  await prisma.note.deleteMany();
  await prisma.savingsAllocation.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.period.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  console.log('Database cleaned.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
