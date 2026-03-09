const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('\n🧹 Cleaning seed data...');
  console.log('='.repeat(80));
  
  // Delete all ledger entries (sample data)
  const deletedEntries = await prisma.ledgerEntry.deleteMany({});
  console.log(`✅ Deleted ${deletedEntries.count} ledger entries`);
  
  // Delete all savings allocations
  const deletedAllocations = await prisma.savingsAllocation.deleteMany({});
  console.log(`✅ Deleted ${deletedAllocations.count} savings allocations`);
  
  // Delete all notes
  const deletedNotes = await prisma.note.deleteMany({});
  console.log(`✅ Deleted ${deletedNotes.count} notes`);
  
  // Delete all periods (they'll be created on-demand)
  const deletedPeriods = await prisma.period.deleteMany({});
  console.log(`✅ Deleted ${deletedPeriods.count} periods`);
  
  console.log('\n✅ Database cleaned! Categories and user remain.');
  console.log('   Periods will be created automatically when you add transactions.');
  console.log('='.repeat(80));
  
  await prisma.$disconnect();
}

main().catch(console.error);
