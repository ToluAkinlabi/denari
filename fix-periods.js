const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPeriods() {
  console.log('\n🔧 Fixing periods with wrong boundaries...\n');
  
  // Delete all periods (they'll be recreated automatically with correct boundaries)
  const deleted = await prisma.period.deleteMany({});
  console.log(`✅ Deleted ${deleted.count} periods with wrong boundaries\n`);
  
  console.log('✅ Periods will be recreated automatically when you refresh the dashboard');
  console.log('   with correct boundaries and opening balances calculated from your data.\n');
  
  await prisma.$disconnect();
}

fixPeriods();
