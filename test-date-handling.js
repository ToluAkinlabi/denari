const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Simulate the parseIsoDateString function
function parseIsoDateString(dateStr) {
  if (!dateStr) return undefined;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

async function main() {
  console.log('\n🧪 Testing Date Handling');
  console.log('='.repeat(80));
  
  // Test 1: Parse ISO date string
  const testDateStr = '2026-03-07';
  const parsedDate = parseIsoDateString(testDateStr);
  
  console.log('\n1. ISO String Parsing:');
  console.log(`   Input: "${testDateStr}"`);
  console.log(`   Parsed Date: ${parsedDate}`);
  console.log(`   ISO String: ${parsedDate.toISOString()}`);
  console.log(`   Local String: ${parsedDate.toLocaleDateString('en-US')}`);
  console.log(`   Date only: ${parsedDate.toISOString().split('T')[0]}`);
  
  // Test 2: Check what Prisma stores and retrieves
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log('\n❌ No user found in database');
    await prisma.$disconnect();
    return;
  }
  
  // Get a category
  const category = await prisma.category.findFirst({
    where: { userId: user.id }
  });
  
  if (!category) {
    console.log('\n❌ No category found in database');
    await prisma.$disconnect();
    return;
  }
  
  // Check existing entry
  const existingEntry = await prisma.ledgerEntry.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  
  if (existingEntry) {
    console.log('\n2. Existing Entry from Database:');
    console.log(`   Stored date: ${existingEntry.date}`);
    console.log(`   ISO: ${existingEntry.date.toISOString()}`);
    console.log(`   Date only: ${existingEntry.date.toISOString().split('T')[0]}`);
    console.log(`   Local: ${existingEntry.date.toLocaleDateString('en-US')}`);
  }
  
  console.log('\n3. Timezone Information:');
  console.log(`   Server Timezone Offset: ${new Date().getTimezoneOffset()} minutes`);
  console.log(`   (Negative = ahead of UTC, Positive = behind UTC)`);
  
  console.log('\n✅ Date handling test complete');
  console.log('='.repeat(80));
  
  await prisma.$disconnect();
}

main().catch(console.error);
