# Ledge - Personal Financial Command Center

A mobile-first personal finance web application that replaces complex Excel financial trackers.

## 🎯 Product Goals

- **Fast transaction entry** - Log expenses in seconds
- **Biweekly financial tracking** - Aligned to your pay cycle
- **Reliable financial math** - Always trustworthy numbers
- **Visual dashboards** - See where your money stands
- **Wealth tracking** - Monitor real wealth creation
- **Reconciliation** - Verify cash against bank balance
- **Hybrid input** - Transactions + summary entries

## 📚 Core Concepts

### Financial Distinction

Ledge maintains strict separation of four financial concepts:

- **Cash** - Money in checking/liquid accounts
- **Spending** - Money consumed and gone
- **Savings** - Money transferred to wealth accounts
- **Wealth Created** - Income minus real spending

### Design Principles

1. **Reconciliation First** - Verify expected vs. actual cash
2. **Hybrid Input Model** - Support both transaction and summary entry
3. **Decision First Dashboard** - Prioritize insight over bookkeeping

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: TailwindCSS, shadcn/ui
- **Database**: Prisma ORM + Neon PostgreSQL
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **Mobile**: PWA support, installable

## 📦 Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- Neon PostgreSQL account (free tier)

### Setup

1. **Clone the repository**
   ```bash
   cd ledge
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your Neon database URL:
   ```
   DATABASE_URL="postgresql://user:password@ep-xxxxx.us-east-1.neon.tech/neondb?sslmode=require"
   ```

4. **Initialize database**
   ```bash
   npm run db:push
   npm run db:seed
   ```

5. **Run development server**
   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000`

## 📱 Mobile Install

### iOS
1. Open app in Safari
2. Tap Share → Add to Home Screen
3. Enter "Ledge" as name
4. Tap Add

### Android
1. Open app in Chrome
2. Tap menu → Install app
3. Confirm

## 🗄️ Database Schema

### Users
Single user for personal use

### Categories
- Income, Spend, Misc, Partnership, Other
- Grocery, Phone, Savings, Rent, Debt
- Grouped: Essential, Lifestyle, Avoidable, Values, Wealth, Income

### Periods
Biweekly pay periods (14-day cycles)
- First payday: January 9, 2026
- Auto-calculated period tracking

### LedgerEntries
Canonical source of all money movements
- Income, Expense, Transfer, Summary Entry, Adjustment
- Links transactions to periods and categories

### SavingsAllocations
Bucket breakdown for savings entries
- Emergency Fund, Investments, Short Term Savings, Custom

### Notes
Flexible notes on transactions and periods

## 💰 Financial Calculations

All calculations derive from ledger entries:

```typescript
Cash Remaining = Opening Cash + Income - Expenses - Savings

Wealth Created = Income - Real Spending

Savings Rate = (Savings / Income) × 100%

Financial Score = Multi-factor evaluation (0-100)
```

## 📊 Dashboard Features

- **Cash Remaining** - Primary metric
- **Wealth Created** - Income minus real spending
- **Savings Allocated** - Wealth relocation tracking
- **Financial Score** - Discipline evaluation
- **Reconciliation Status** - Expected vs. actual cash
- **Recent Transactions** - Quick view
- **Forecast** - Next period projection

## 🔄 Biweekly Pay Period System

Pay periods are automatically calculated:

- **First payday**: January 9, 2026
- **Cycle length**: 14 days
- **Period formula**: 
  ```
  period_index = floor((date - first_payday) / 14)
  period_start = first_payday + (period_index * 14)
  period_end = period_start + 13 days
  ```

Transactions automatically map to the correct period.

## 🎨 Mobile UX

- Mobile-first responsive design
- Works on 320px to 430px+ screens
- Large tap targets for easy mobile input
- Sticky bottom navigation
- Floating quick-add button
- Bottom sheet forms
- Dark mode support
- Optimized charts for small screens

## 🚀 Features by Priority

### Phase 1 (Core)
- [x] Data schema
- [x] Finance calculations
- [x] Mobile navigation
- [ ] Dashboard
- [ ] Add transaction/summary
- [ ] Reconciliation
- [ ] Basic reports

### Phase 2 (Enhancement)
- [ ] Forecast module
- [ ] Advanced scoring
- [ ] Monthly aggregation
- [ ] Savings allocations UI
- [ ] Notes system
- [ ] Better charts

### Phase 3 (Polish)
- [ ] Mobile optimizations
- [ ] PWA installation flow
- [ ] Export/import
- [ ] Data backup
- [ ] Advanced analytics

## 🔐 Security

- Client-side validation with Zod
- SQL injection prevention via Prisma
- CSRF protection via Next.js
- Secure headers via Next.js
- PWA with offline support (local data only)

## 📈 Performance

- Optimized database queries with Prisma
- Efficient ledger calculations
- Lazy-loaded components
- Image optimization
- CSS minification
- Decimal arithmetic for money (no floating point)

## 🚢 Deployment

### Neon Database
1. Create free Neon project
2. Get connection string
3. Set DATABASE_URL in environment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Self-Hosting
```bash
npm run build
npm start
```

## 📝 Project Structure

```
ledge/
├── app/                    # Next.js App Router
│   ├── components/         # React components
│   ├── add/               # Add transaction page
│   ├── periods/           # Periods page
│   ├── reports/           # Reports page
│   ├── settings/          # Settings page
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Dashboard
│   └── globals.css        # Global styles
├── lib/
│   ├── finance.ts         # Financial calculations
│   ├── periods.ts         # Period utilities
│   ├── types.ts           # TypeScript definitions
│   └── utils.ts           # Helper functions
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.js            # Seed data
├── public/
│   ├── manifest.json      # PWA manifest
│   └── service-worker.js  # Service worker
└── package.json           # Dependencies
```

## 🐛 Troubleshooting

### Database connection fails
- Verify DATABASE_URL in .env.local
- Check Neon project is active
- Ensure IP whitelist allows current IP

### Dependencies issues
```bash
rm -rf node_modules package-lock.json
npm install
```

### Prisma schema updates
```bash
npm run db:push
```

## 📄 License

Personal use only. Not for commercial distribution.

## 🤝 Contributing

This is a personal project, but improvements are welcome.

## 📞 Support

Refer to the inline code documentation for API details.

---

**See where your money stands.**
