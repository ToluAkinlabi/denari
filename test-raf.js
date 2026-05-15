import { Decimal } from '@prisma/client/runtime/library';
import { calculateRafPlan } from '@/lib/finance/raf';

// Test rent-cap logic
const result = calculateRafPlan({
  income: '1762.37',
  carryForward: '147.03',
  entries: [],
  categories: [
    {
      id: 'rent-id',
      name: 'Rent',
      type: 'RENT',
      expectedFrequency: 'MONTHLY',
      countsAsExpense: true,
      countsAsSavings: false,
      rafPercent: 0,
    },
    {
      id: 'grocery-id',
      name: 'Grocery',
      type: 'EXPENSE',
      expectedFrequency: null,
      countsAsExpense: true,
      countsAsSavings: false,
      rafPercent: 0,
    },
    {
      id: 'spend-id',
      name: 'Spend',
      type: 'EXPENSE',
      expectedFrequency: null,
      countsAsExpense: true,
      countsAsSavings: false,
      rafPercent: 0,
    },
  ],
});

console.log('Allocation Base:', result.allocationBase);
console.log('\nRent Bucket:');
const rentBucket = result.buckets.find((b) => b.name === 'Rent');
console.log('  Percent:', rentBucket?.percent);
console.log('  Allocated:', rentBucket?.allocated);
console.log('  Expected: 31% of base, $600 allocated\n');

console.log('Warnings:');
result.warnings.forEach((w) => console.log(' -', w));
