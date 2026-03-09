const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Deleting all periods...');
  
  // First delete all ledger entries (foreign key constraint)
  const deletedEntries = await prisma.ledgerEntry.deleteMany({});
  console.log(`   Deleted ${deletedEntries.count} ledger entries`);
  
  // Then delete all periods
  const deletedPeriods = await prisma.period.deleteMany({});
  console.log(`   Deleted ${deletedPeriods.count} periods`);
  
  console.log('✅ Database cleaned!');
  
  await prisma.$disconnect();
}

main().catch(console.error);
