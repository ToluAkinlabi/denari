# Ledge - Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Step 1: Clone the Repository
```bash
cd ledge
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Get a Neon Database

**Free tier includes:**
- 0.5GB storage
- 100 CPU hours
- Perfect for personal use

1. Go to [console.neon.tech](https://console.neon.tech)
2. Sign up (Google/GitHub)
3. Create a new project
4. Copy the connection string
5. Create `.env.local`:
   ```bash
   echo 'DATABASE_URL="[paste_connection_string]"' > .env.local
   ```

### Step 4: Initialize Database
```bash
npm run db:push
npm run db:seed
```

This creates all tables and adds sample data.

### Step 5: Start Development
```bash
npm run dev
```

Visit `http://localhost:3000` 🎉

## 📱 Mobile Test

### Using Device
1. Build: `npm run build`
2. Start: `npm start`
3. Find your local IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
4. Visit `http://[your_ip]:3000` from mobile
5. Tap menu → Install app (Android/Chrome)
6. Tap Share → Add to Home Screen (iOS/Safari)

### Using Browser DevTools
1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select device: iPhone 12, Pixel 6, etc.
4. Test all pages and interactions

## 🔧 Project Structure

```
ledge/
├── app/                    # Next.js pages and layouts
│   ├── page.tsx           # Dashboard (/)
│   ├── add/page.tsx       # Add transaction (/add)
│   ├── periods/page.tsx   # Periods (/periods)
│   ├── reports/page.tsx   # Reports (/reports)
│   ├── settings/page.tsx  # Settings (/settings)
│   ├── components/        # React components
│   ├── layout.tsx         # Root layout
│   ├── globals.css        # Global styles
│   └── providers.tsx      # Client-side providers
├── lib/
│   ├── finance.ts         # Financial calculations
│   ├── periods.ts         # Period management
│   ├── types.ts           # TypeScript types
│   └── utils.ts           # Utility functions
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.js            # Sample data
├── public/
│   ├── manifest.json      # PWA manifest
│   └── service-worker.js  # Service worker
└── package.json           # Dependencies
```

## 💾 Database Schema Overview

### Key Tables

1. **Categories** - 10 financial categories
2. **Periods** - Biweekly pay periods (auto-calculated)
3. **LedgerEntries** - All transactions (canonical source)
4. **SavingsAllocations** - Savings bucket breakdowns
5. **Notes** - Transaction/period notes

### Important: Single Source of Truth

All financial calculations come from **LedgerEntries** only. No duplicate summary tables.

## 🎯 Financial Concepts

### Cash vs Spending vs Savings vs Wealth

```
Opening Cash: $5,000
Income:       +$3,500
Expenses:     -$655      (marked as spending)
Savings:      -$500      (marked as savings)
─────────────────
Cash Remaining: $6,845

Wealth Created = Income - Expenses
                = $3,500 - $655
                = $2,845
                (Savings does NOT reduce wealth)
```

## 📝 Adding Transactions

### Two Modes

**Quick Entry**
```
Amount: 45
Category: Grocery
→ Creates transaction quickly
```

**Detailed Entry**
```
Type: Income/Expense/Transfer
Amount: 45
Date: Jan 10
Category: Grocery
Description: Farmer's market
→ Full form with all details
```

### Biweekly Periods

Transactions automatically assign to the correct period:
- Jan 9-22 (Period 1)
- Jan 23 - Feb 5 (Period 2)
- Feb 6-19 (Period 3)
- etc.

Manual period override supported.

## 📊 Dashboard Metrics

**Primary Cards**
- Cash Remaining (liquid money)
- Wealth Created (income - spending)
- Savings Allocated (transfers)

**Health**
- Financial Score (0-100)
- Reconciliation Status (matched/mismatch)

**Details**
- Period summary
- Recent transactions
- Category breakdown
- Next period forecast

## 🔄 Reconciliation

This is crucial for trust:

1. **Check Your Bank** - Get actual closing balance
2. **Enter in Ledge** - Input actual cash
3. **Compare** - Expected vs Actual
4. **Adjust** - If mismatch, log missing transaction

Expected = Opening + Income - Expenses - Savings

## 🛠️ Development Commands

```bash
# Development
npm run dev           # Start dev server (port 3000)

# Database
npm run db:push      # Apply schema changes
npm run db:seed      # Load sample data
npm run db:reset     # ⚠️ Wipe & reload database

# Production
npm run build        # Build for production
npm start           # Start production server
npm run lint        # ESLint check

# Maintenance
npm run prisma:generate  # Regenerate Prisma types
```

## 🌐 Environment Variables

Required in `.env.local`:

```bash
# Database (from Neon)
DATABASE_URL="postgresql://..."

# Optional
NEXT_PUBLIC_ENABLE_PWA="true"
NEXT_PUBLIC_FIRST_PAYDAY="2026-01-09"
NEXT_PUBLIC_PAY_CYCLE_DAYS="14"
```

## 🚢 Deployment

### Vercel (Recommended - Free)

1. Push to GitHub
2. Connect repo to Vercel
3. Add DATABASE_URL secret
4. Deploy automatically on push

```bash
npm install -g vercel
vercel
```

### Self-Host

```bash
npm run build
npm start
```

Runs on port 3000 by default.

## 📱 PWA Installation

### What is a PWA?
Progressive Web App = Installable web app that works offline

### How to Install
**Android (Chrome)**
1. Visit app in Chrome
2. Tap menu (≡)
3. Tap "Install app"
4. Confirm "Install"

**iOS (Safari)**
1. Visit app in Safari
2. Tap Share (↑ from bottom)
3. Tap "Add to Home Screen"
4. Confirm

### Offline Support
Service worker caches:
- HTML, CSS, JavaScript
- Database queries are stored in IndexedDB (future)
- Pending entries sync when online

## 🔍 Troubleshooting

### Database Connection Error
```
Error: connect ENOTFOUND ...
```
- Check DATABASE_URL in .env.local
- Verify Neon project is active
- Check your internet connection

**Solution:**
```bash
# Verify connection string
echo $DATABASE_URL
```

### Port 3000 Already in Use
```bash
lsof -ti:3000 | xargs kill -9   # Mac/Linux
netstat -ano | findstr :3000    # Windows
```

### Missing Modules
```bash
rm -rf node_modules
npm install
```

### Prisma Type Errors
```bash
npm run prisma:generate
```

## 📚 Key Files to Understand

1. **prisma/schema.prisma** - Database structure
2. **lib/finance.ts** - Financial math (most important)
3. **lib/periods.ts** - Period calculation logic
4. **app/page.tsx** - Dashboard layout
5. **app/add/page.tsx** - Transaction entry

## 🎓 Learning Resources

### Financial Concepts
- [Wikipedia: Personal Finance](https://en.wikipedia.org/wiki/Personal_finance)
- [YNAB Method](https://www.youneedabudget.com/method/)

### Tech Stack
- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs/)
- [TailwindCSS Docs](https://tailwindcss.com/docs)
- [Neon Docs](https://neon.tech/docs)

### Mobile Development
- [PWA Guide](https://web.dev/progressive-web-apps/)
- [Responsive Design](https://developers.google.com/web/fundamentals/design-and-ux/responsive)

## 🎯 Next Steps

1. ✅ Install and run locally
2. ✅ Test all pages on mobile device
3. ✅ Try adding transactions
4. ✅ Understand period system
5. ✅ Review financial calculations in `lib/finance.ts`
6. ✅ Deploy to Vercel
7. ✅ Install as PWA on phone
8. ✅ Use daily to track finances

## ⚙️ Customization

### Change Categories
Edit `prisma/seed.js` → categories array

### Change First Payday
Edit `lib/periods.ts` → FIRST_PAYDAY constant

### Change Pay Cycle
Edit `lib/periods.ts` → CYCLE_LENGTH_DAYS constant

### Change Colors
Edit `tailwind.config.js` → colors.primary

## 🐛 Reporting Issues

If something doesn't work:

1. Check the console (F12 → Console tab)
2. Check server logs (terminal where `npm run dev` runs)
3. Verify DATABASE_URL is correct
4. Try `npm run db:reset` to reload sample data

## 📞 Support

This is a personal project, so support is limited. But:

- Code is well-documented
- Architecture guide included
- All functions have JSDoc comments
- TypeScript provides compile-time help

## 🚀 Production Checklist

Before going live:

- [ ] Database backups enabled
- [ ] Environment variables set in hosting
- [ ] PWA icons generated
- [ ] Mobile tested on real device
- [ ] Security headers enabled
- [ ] Error logging configured
- [ ] Monitoring set up
- [ ] Rate limiting configured

## 💡 Pro Tips

1. **Reconcile every period** - Ensures data accuracy
2. **Use consistent categories** - Makes reports meaningful
3. **Add notes to unusual entries** - Future you will thank you
4. **Review monthly** - Spot trends and adjust
5. **Test offline mode** - Use DevTools to simulate offline

---

**Questions? Check ARCHITECTURE.md for deep dives into system design.**

**"See where your money stands."**
