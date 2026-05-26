# Denari Architecture Guide

## System Design Overview

Denari is built on a **single canonical ledger** architecture where all financial truth derives from ledger entries. This ensures financial data integrity and prevents drift.

## 1. Core Philosophy

### Financial Truth

There are four distinct financial concepts that must never be mixed:

```
Cash       = Liquid money in accounts
Spending   = Money consumed and gone (real expenses)
Savings    = Money transferred to wealth accounts (not spending)
Wealth     = Income - Real Spending (not affected by savings)
```

### Single Source of Truth

The **LedgerEntry** table is canonical. All financial calculations derive from ledger entries, never from separate summary tables.

```
No duplicate summary tables.
No denormalized totals.
All math is derived, never stored.
```

## 2. Database Architecture

### Normalized Schema

**Users**
- Single user for personal use
- Future: Multi-user support via user_id foreign keys

**Categories**
- 10 core categories (Income, Spend, Misc, Partnership, Other, Grocery, Phone, Savings, Rent, Debt)
- Grouped for organization (Essential, Lifestyle, Avoidable, Values, Wealth, Income)
- Flags: countsAsExpense, countsAsSavings
- Colors and icons for UI

**Periods**
- Biweekly pay periods
- Start/end dates, opening cash, expected/actual closing cash
- Status: OPEN, CLOSED, RECONCILED
- Indexed by payDate for queries

**LedgerEntries** (Canonical)
- Every money movement represented here
- Types: INCOME, EXPENSE, TRANSFER, SUMMARY_ENTRY, ADJUSTMENT
- Always linked to Period
- Always linked to Category
- Indexed by date, periodId, categoryId for fast queries

**SavingsAllocations**
- Bucket breakdown for savings entries
- References LedgerEntry (one savings entry → multiple buckets)
- Ensures allocation totals match entry amount

**Notes**
- Can attach to periods or transactions
- Rich text support for future enhancement

## 3. Financial Calculation Engine

### Calculation Strategy

All calculations:
1. Fetch ledger entries for period
2. Filter by category flags (countsAsExpense, countsAsSavings)
3. Sum amounts
4. Derive insights

### Core Functions

```typescript
// Aggregation
calculatePeriodIncome(entries)        // Sum INCOME entries
calculatePeriodExpenses(entries)      // Sum entries where countsAsExpense=true
calculateSavingsTransfers(entries)    // Sum entries where countsAsSavings=true

// Derived Metrics
calculateWealthCreated(entries)       // Income - Spending (savings don't affect)
calculateCashRemaining(entries)       // Cash - Expenses - Savings
calculateSavingsRate(income, savings) // (Savings / Income) × 100

// Reconciliation
reconcilePeriod(...)                  // Compare expected vs actual cash

// Scoring
calculateFinancialScore(...)          // 0-100 score with components
```

### Key Insight: Wealth vs Savings

```
Wealth Created  = Income - Real Spending
                (Savings does NOT reduce this)

Cash Remaining  = Opening Cash + Income - Spending - Savings
                (Savings IS a cash outflow)
```

This distinction is critical.

## 4. Biweekly Pay Period System

### Automatic Period Assignment

```
First Payday: January 9, 2026
Cycle Length: 14 days

For any date D:
  days_since_payday = (D - first_payday).days
  period_index = floor(days_since_payday / 14)
  period_start = first_payday + (period_index * 14)
  period_end = period_start + 13

Example:
  Jan 9 → Jan 22   (period 0)
  Jan 23 → Feb 5   (period 1)
  Feb 6 → Feb 19   (period 2)
```

### Transaction Assignment

Transactions are automatically assigned to periods via this calculation. Manual override is supported via periodId.

## 5. API Layer

### Server Actions (Preferred for simplicity)

```typescript
// app/actions/finance.ts
export async function addTransaction(input: TransactionInput)
export async function addSummaryEntry(input: SummaryEntryInput)
export async function reconcilePeriod(periodId: string, actualCash: Decimal)
export async function getPeriodFinancials(periodId: string)
```

### Alternative: API Routes

For future mobile app support:
```
POST /api/transactions      - Add transaction
POST /api/summary-entries   - Add summary entry
GET /api/periods/:id        - Get period details
POST /api/reconcile         - Reconcile period
GET /api/dashboard          - Dashboard data
```

## 6. Type Safety

### TypeScript Definitions

```typescript
// lib/types.ts defines:
- Category
- Period & PeriodWithFinancials
- LedgerEntry & LedgerEntryWithDetails
- CategoryBreakdown
- PeriodFinancials
- DashboardData
- API response wrappers
```

### Zod Validation

Server actions validate input with Zod schemas before database operations.

## 7. UI Architecture

### Mobile-First Components

```
Layout
  ├── Navigation (sticky bottom)
  └── Main Content
      ├── Dashboard
      ├── Periods
      ├── Add (Transaction/Summary)
      ├── Reports
      └── Settings

Dialog/Modals
  ├── Quick Add (floating button)
  ├── Add Transaction Detail
  └── Add Summary Entry
```

### Dashboard Design

```
Primary Metrics (stacked cards)
├── Cash Remaining
├── Wealth Created
└── Savings Allocated

Health Indicators
├── Financial Score
└── Reconciliation Status

Details (tabbed/scrollable)
├── Period Summary
├── Recent Transactions
├── Category Breakdown
└── Forecast
```

## 8. Data Integrity

### Constraints

1. **Category-Period Uniqueness**
   - Cannot create same category twice per user
   - Enforced at database level

2. **Period Uniqueness**
   - Cannot have overlapping periods
   - Unique(userId, startDate, endDate)

3. **Allocation Totals**
   - Sum of allocations must equal savings entry amount
   - Enforced in application logic

4. **Ledger Completeness**
   - Every entry must have category, period, amount
   - No NULL amounts
   - Date must fall within period date range

### Validation

Application-level validation via Zod:
```typescript
TransactionInput
  amount: Decimal (positive)
  categoryId: string (exists)
  periodId: string (optional, auto-assigned)
  date: Date (in period range)
  description: string (max 255 chars)
```

## 9. Performance Considerations

### Queries

- **Indexed on**: user_id, period_id, category_id, date, entry_type
- **Aggregation**: In-memory summation (safe due to Decimal precision)
- **Pagination**: Transaction lists paginated (100 per page)

### Decimal Math

- Use Prisma Decimal type (arbitrary precision)
- Never use JavaScript floats for currency
- Convert to numbers only for display

### Caching

- Dashboard: Cache for 5 minutes (background refresh)
- Periods list: Cache for 1 day (invalidate after entry add)
- Categories: Cache for session (static)

## 10. Hybrid Input Model

### Transaction vs Summary Entry

**Transaction Mode**
```
Date + Category + Amount + Description
→ Single LedgerEntry
→ Manually entered by user
```

**Summary Mode**
```
Category + Amount (for entire period)
→ Single LedgerEntry (source: summary)
→ Manual total entry
```

**Hybrid Period** (same period can have both)
```
Spend → Transactions (detail)
Misc → Transactions (detail)
Rent → Summary (total)
Savings → Summary (total)
→ No double counting
→ Both sources in single report
```

## 11. Reconciliation Process

### Step 1: Predict Expected Cash
```
Expected Cash = Opening Cash
              + Income
              - Expenses
              - Savings Transfers
```

### Step 2: Get Actual Cash
```
User enters: actual closing cash
(verified against bank statement)
```

### Step 3: Calculate Difference
```
Difference = Expected - Actual
Status: MATCHED (diff = 0) or MISMATCH
```

### Step 4: Alert User
If mismatch, show:
- Expected vs Actual
- Difference amount
- Likely causes (unlogged transaction, spending not categorized)
- Adjustment dialog

## 12. Forecast Module

### Simple Deterministic Forecast

```
Inputs:
- Last 4 period financials (average)
- Next period projected income

Output:
- Projected expenses (avg of last 4)
- Projected savings (avg of last 4)
- Projected cash remaining
```

No ML. Deterministic and transparent.

## 13. Financial Score Components

Out of 100:

```
Savings Discipline (20 pts)   - 15% target savings rate
Expense Control (20 pts)       - 70% target expense ratio
Misc Leakage (15 pts)          - Minimize avoidable spending
Wealth Growth (20 pts)         - Positive wealth creation
Category Balance (15 pts)      - Well-distributed spending
Reconciliation (10 pts)        - Accurate tracking
─────────────────────────────
Total (100 pts)
```

Transparent breakdown shown to user.

## 14. Monthly Aggregation

### Automatic Roll-Up

```
1. Fetch all periods in calendar month
2. Sum income, expenses, savings from each period
3. Group transactions by category for breakdown
4. Generate monthly summary
```

Happens on-demand (not stored).

## 15. PWA Architecture

### Service Worker Strategy

**Cache-First for HTML/CSS/JS**
```
1. Try cache
2. If miss, fetch from network
3. Cache for next time
```

**Network-First for API Calls**
```
1. Try network
2. If offline, return cached data
3. If no cache, show offline message
```

**Data Persistence**
- IndexedDB for pending entries (future)
- Sync pending entries when online

### Installable

```
manifest.json → App icon
service-worker.js → Offline support
Display: standalone → Full-screen app
```

## 16. Security

### Data Protection

- No authentication required (personal use)
- All data stored in user's Neon account
- SQL injection prevention (Prisma parameterized queries)
- XSS prevention (React escaping)
- CSRF protection (Next.js built-in)

### Input Validation

- Zod schemas for all user input
- Type checking prevent invalid data

## 17. Testing Strategy

### Unit Tests (to add)
```
finance.ts calculations
period.ts date logic
utils.ts formatting
```

### Integration Tests (to add)
```
Database operations via Prisma
Server actions with mocked data
Period assignment algorithm
Reconciliation logic
```

### Manual Testing
```
Mobile browser testing (320px+)
Period boundary transitions
Reconciliation workflows
Offline functionality
```

## 18. Future Enhancements

1. **Multiple Users** - Separate user_id hierarchies
2. **Budget Alerts** - Warn when spending exceeds budget
3. **Analytics** - Trend analysis, spending patterns
4. **Exports** - CSV, PDF reports
5. **Multi-Wallet** - Track multiple accounts
6. **Investments** - Track investment performance
7. **Goals** - Savings goals tracking
8. **Notifications** - Push alerts for transactions
9. **Mobile Apps** - Native iOS/Android (via API)
10. **Sync** - Multiple devices sync

## 19. Database Optimization

### Indices
```sql
-- Financial queries
CREATE INDEX idx_ledger_user_date ON ledgerentries(user_id, date DESC);
CREATE INDEX idx_ledger_period_category ON ledgerentries(period_id, category_id);

-- Reconciliation queries
CREATE INDEX idx_periods_user_status ON periods(user_id, status);

-- Notes
CREATE INDEX idx_notes_period ON notes(period_id);
CREATE INDEX idx_notes_entry ON notes(ledger_entry_id);
```

### Query Patterns
```typescript
// Fast: Employees with index
ledger_entries.filter(e => e.period_id === "xyz")

// Fast: Range with index
ledger_entries.filter(e => e.date >= start && e.date <= end)

// Avoid: Full table scans
ledger_entries.filter(e => e.description.contains("grocery"))
```

## 20. Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Seed data loaded
- [ ] Service worker registered
- [ ] Manifest linked in HTML
- [ ] PWA icons generated
- [ ] Mobile tested on real devices
- [ ] Accessibility audit passed
- [ ] Performance optimized
- [ ] Security headers configured
- [ ] HTTPS enabled
- [ ] Database backups scheduled

---

**Architecture built for reliability, clarity, and trustworthy financial math.**
