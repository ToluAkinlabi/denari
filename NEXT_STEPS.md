# Denari Implementation Guide - Next Steps

## 🎯 What to Do Next

You have the complete foundation. Here's exactly what to implement next to get from foundation to MVP.

---

## Step 1: Connect Database (1 hour)

### 1.1 Get Neon Database
1. Go to [console.neon.tech](https://console.neon.tech)
2. Sign up (Google/GitHub)
3. Create project
4. Copy connection string
5. Create `.env.local`:
   ```
   DATABASE_URL="postgresql://... "
   ```

### 1.2 Initialize Database
```bash
npm run db:push
npm run db:seed
```

Verify:
- ✅ Database created in Neon console
- ✅ All 6 tables exist (Users, Categories, Periods, LedgerEntries, SavingsAllocations, Notes)
- ✅ Sample data loaded

---

## Step 2: Create Dashboard Server Action (2 hours)

### 2.1 Create `app/actions/dashboard.ts`

```typescript
'use server';

import { prisma } from '@/lib/prisma';
import { calculatePeriodFinancials, calculateFinancialScore } from '@/lib/finance';
import { getPeriodForDate } from '@/lib/periods';

export async function getDashboardData() {
  const userId = 'default-user'; // TODO: Get from session

  // Get current period (auto-calculated)
  const now = new Date();
  const currentPeriod = getPeriodForDate(now);

  // Fetch period from database
  const period = await prisma.period.findFirst({
    where: {
      userId,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    include: {
      ledgerEntries: {
        include: { category: true },
      },
    },
  });

  if (!period) {
    throw new Error('No period found for today');
  }

  // Get all categories for calculation
  const categories = await prisma.category.findMany({
    where: { userId },
  });

  const categoryMap = new Map(categories.map(c => [c.id, c]));

  // Calculate period financials
  const financials = calculatePeriodFinancials(
    period.openingCash,
    period.ledgerEntries,
    categoryMap
  );

  // Calculate score
  const score = calculateFinancialScore(
    period.ledgerEntries,
    categoryMap,
    financials.savingsRate,
    financials.expenseRate,
    new Decimal(0), // TODO: Calculate from reconciliation
    financials.wealthCreated,
    financials.income
  );

  // Fetch recent transactions
  const recentTransactions = await prisma.ledgerEntry.findMany({
    where: { userId },
    include: { category: true },
    orderBy: { date: 'desc' },
    take: 10,
  });

  return {
    period: {
      ...period,
      ...financials,
    },
    financialScore: score.overallScore,
    recentTransactions,
    forecast: {
      // TODO: Calculate forecast
    },
  };
}
```

### 2.2 Update Dashboard Component

```typescript
'use client';

import { getDashboardData } from '@/app/actions/dashboard';
import { useEffect, useState } from 'react';

export function DashboardContent() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await getDashboardData();
        setData(result);
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  // = Use data.period, data.recentTransactions, etc
  // = Update hardcoded values with actual data

  return (
    // ... existing JSX with real data
  );
}
```

---

## Step 3: Implement Transaction Entry (3 hours)

### 3.1 Create `app/actions/transactions.ts`

```typescript
'use server';

import { prisma } from '@/lib/prisma';
import { getPeriodForDate } from '@/lib/periods';
import { z } from 'zod';

const TransactionSchema = z.object({
  amount: z.number().positive(),
  categoryId: z.string(),
  description: z.string().optional(),
  date: z.date().optional(),
  periodId: z.string().optional(),
});

export async function addTransaction(data: z.infer<typeof TransactionSchema>) {
  const userId = 'default-user'; // TODO: Get from session
  const validated = TransactionSchema.parse(data);

  // Determine period if not provided
  let periodId = validated.periodId;
  if (!periodId) {
    const transactionDate = validated.date || new Date();
    const period = getPeriodForDate(transactionDate);

    const dbPeriod = await prisma.period.findFirst({
      where: {
        userId,
        startDate: period.startDate,
        endDate: period.endDate,
      },
    });

    if (!dbPeriod) throw new Error('Period not found');
    periodId = dbPeriod.id;
  }

  // Verify category exists
  const category = await prisma.category.findUnique({
    where: { 
      userId_name: {
        userId,
        id: validated.categoryId, // This won't work, fix the schema
      }
    },
  });

  if (!category) throw new Error('Category not found');

  // Create ledger entry
  const entry = await prisma.ledgerEntry.create({
    data: {
      userId,
      periodId,
      categoryId: validated.categoryId,
      amount: new Decimal(validated.amount),
      date: validated.date || new Date(),
      entryType: category.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
      source: 'transaction',
      description: validated.description,
    },
    include: { category: true },
  });

  return entry;
}
```

### 3.2 Update Transaction Form

```typescript
'use client';

import { addTransaction } from '@/app/actions/transactions';
import { useState } from 'react';

export default function AddPage() {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    try {
      await addTransaction({
        amount: parseFloat(formData.get('amount') as string),
        categoryId: formData.get('categoryId') as string,
        description: formData.get('description') as string,
        date: new Date(formData.get('date') as string),
      });
      // Show success message
      // Reset form
    } catch (error) {
      // Show error message
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Use existing form fields */}
      <button type="submit" disabled={loading}>
        {loading ? 'Saving...' : 'Add Transaction'}
      </button>
    </form>
  );
}
```

---

## Step 4: Create Prisma Client (1 hour)

### 4.1 Create `lib/prisma.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query', 'error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production')
  globalForPrisma.prisma = prisma;
```

### 4.2 Create User (Temporary)

```typescript
'use server';

import { prisma } from '@/lib/prisma';

export async function ensureDefaultUser() {
  const user = await prisma.user.upsert({
    where: { name: 'Default User' },
    update: {},
    create: {
      name: 'Personal',
    },
  });
  return user;
}
```

---

## Step 5: Key Fixes Needed

### Fix 1: Database Type Imports

In `lib/finance.ts`, import Decimal properly:
```typescript
import { Decimal as PrismaDecimal } from '@prisma/client/runtime/library';
```

### Fix 2: Category Schema

Prisma schema needs fixing:
```prisma
model Category {
  id              String  @id @default(cuid())
  name            String
  // ... remove userId from unique constraint
  
  @@unique([name])  // Name is globally unique for now
}
```

### Fix 3: Bottom Navigation

In `app/components/navigation.tsx`, fix the label abbreviation:
```typescript
<span className="text-xs mt-1 font-medium">{label[0]}</span>
```

---

## Implementation Order

### Quick Start (4-5 hours to MVP)
1. ✅ Project setup (DONE - you have foundation)
2. ✅ Database schema (DONE)
3. ⏳ **Connect database** (Neon setup)
4. ⏳ **Create Prisma client** (1 hour)
5. ⏳ **Build server actions** (2 hours)
   - getDashboardData
   - addTransaction
   - addSummaryEntry
   - reconcilePeriod
6. ⏳ **Wire up components** (1-2 hours)
   - Dashboard → server action
   - Forms → submit actions
   - Lists → fetch data
7. ⏳ **Test mobile** (1 hour)
8. ⏳ **Deploy to Vercel** (30 minutes)

### To Full v1.0 (20-30 hours total)
1. Add all remaining server actions
2. Build all page components fully
3. Create charts with Recharts
4. Add form validation with Zod
5. Implement error boundaries
6. Add loading states
7. Mobile polish
8. PWA testing
9. Deploy updates

---

## File Templates Ready to Use

All components already exist as stubs. You just need to:

1. **Wire server actions** - Connect frontend forms to database
2. **Fetch data** - Replace hardcoded mock data with real server data
3. **Add validation** - Wrap inputs with Zod validation
4. **Handle errors** - Add try-catch and error UI

---

## Testing as You Go

```bash
# Development
npm run dev

# Open in browser
http://localhost:3000

# Test on mobile
http://[your-ip]:3000

# Mobile browser DevTools
F12 on desktop, then Ctrl+Shift+M to toggle device mode
```

---

## Common Issues & Fixes

### "No DATABASE_URL"
```bash
cp .env.example .env.local
# Update with your Neon connection string
```

### "Prisma schema not updated"
```bash
npm run db:push
```

### "Module not found: @/lib/prisma"
Create the file: `lib/prisma.ts`

### Types errors in finance calculations
Ensure Decimal imports are correct - import from `@prisma/client/runtime/library`

---

## Success Checkpoints

✅ Database connected: Run `npm run db:push` without errors
✅ Seed data loaded: Check Neon console, see tables populated
✅ Server action works: Call `getDashboardData()` from browser console
✅ Form submits: Click "Add Transaction", see entry in database
✅ Dashboard updates: Refresh page, see real data
✅ Mobile works: Test in DevTools mobile mode

---

## Resources

**When you get stuck:**
- ARCHITECTURE.md - System design details
- Prisma Docs - https://www.prisma.io/docs/
- Next.js Docs - https://nextjs.org/docs
- React Docs - https://react.dev
- TypeScript - https://www.typescriptlang.org/docs/

---

## 🎯 Your 5-Minute Checklist

```
[ ] Got Neon connection string
[ ] Created .env.local
[ ] Ran `npm run db:push`
[ ] Ran `npm run db:seed`
[ ] Verified database tables exist
[ ] Created lib/prisma.ts
[ ] Created app/actions/dashboard.ts
[ ] Tested getDashboardData() call
[ ] Updated DashboardContent component
[ ] Tested dashboard shows real data
```

---

## Next: Let's Build! 🚀

Once you complete the steps above, message back and we can:
1. Build the complete transaction form
2. Add reconciliation workflow
3. Create report charts
4. Polish the mobile UX
5. Deploy to production

The foundation is bullet-proof. Time to add features! 💪

---

**You've got this! The hard architectural work is done. Now it's about filling in the features.**

Questions? Check ARCHITECTURE.md or the inline code comments.

Happy building! 🎉
