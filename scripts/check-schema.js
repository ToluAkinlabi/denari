const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSchema() {
  try {
    // Check if new fields exist
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'LedgerEntry'
      ORDER BY ordinal_position;
    `;
    
    console.log('\n📋 LedgerEntry Table Columns:');
    console.log(JSON.stringify(result, null, 2));
    
    // Check Category table
    const categoryResult = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'Category'
      ORDER BY ordinal_position;
    `;
    
    console.log('\n📋 Category Table Columns:');
    console.log(JSON.stringify(categoryResult, null, 2));
    
    // Check for new enum
    const enumResult = await prisma.$queryRaw`
      SELECT n.nspname AS enum_schema,
             t.typname AS enum_name,
             e.enumlabel AS enum_value
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typname = 'ForecastStrategy'
      ORDER BY e.enumsortorder;
    `;
    
    console.log('\n📋 ForecastStrategy Enum:');
    console.log(JSON.stringify(enumResult, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSchema();
