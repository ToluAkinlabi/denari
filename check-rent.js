const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const rent = await prisma.category.findFirst({
    where: { name: { equals: 'Rent', mode: 'insensitive' } },
  });
  console.log(JSON.stringify(rent, null, 2));
  await prisma.$disconnect();
})();
