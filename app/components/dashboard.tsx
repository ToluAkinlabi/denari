import { TrendingUp, CheckCircle } from 'lucide-react';
import { Card } from './card';
import { StatCard } from './stat-card';
import type { DashboardData } from '@/app/actions/dashboard';
import { getHealthIndicator } from '@/lib/utils';

interface DashboardContentProps {
  data: DashboardData;
}

export function DashboardContent({ data }: DashboardContentProps) {
  const score = Number(data.scorecard.overall);
  const health = getHealthIndicator(score);
  const periodStart = new Date(data.currentPeriod.startDate).toLocaleDateString('en-US', { timeZone: 'UTC' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Ledge</h1>
        <p className="text-muted">See where your money stands</p>
      </div>

      <div className="space-y-3">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted mb-1">Cash Remaining</p>
              <p className="text-3xl font-bold text-green-600">${data.cashMetrics.ending}</p>
            </div>
            <div className="text-4xl">💰</div>
          </div>
        </Card>

        <Card className={data.wealthMetrics.isNegative ? 'p-6 border-red-200 bg-red-50' : 'p-6'}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted mb-1">{data.wealthMetrics.isNegative ? 'Wealth Deficit' : 'Wealth Created'}</p>
              <p className={`text-3xl font-bold ${data.wealthMetrics.isNegative ? 'text-red-600' : 'text-sky-600'}`}>${data.wealthMetrics.created}</p>
              <p className="text-xs text-muted mt-1">{data.wealthMetrics.isNegative ? 'Spending exceeds income - deficit period' : 'Income - Real Spending (Savings + Remaining Income)'}</p>
            </div>
            <TrendingUp size={32} className={data.wealthMetrics.isNegative ? 'text-red-500' : 'text-sky-500'} />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted mb-1">Savings This Period</p>
              <p className="text-3xl font-bold text-emerald-600">${data.cashMetrics.savings}</p>
              <p className="text-xs text-muted mt-1">{data.wealthMetrics.savingsRate} of income</p>
            </div>
            <div className="text-4xl">🏦</div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted mb-2">Financial Score</p>
          <div className="flex items-center gap-2">
            <p className={`text-2xl font-bold ${health.color}`}>{data.scorecard.overall}</p>
            <span className="text-xs badge badge-success">{health.label}</span>
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-muted mb-2">Reconciliation</p>
          <div className="flex items-center gap-2">
            <CheckCircle size={20} className={data.cashMetrics.isBalanced ? 'text-green-600' : 'text-yellow-600'} />
            <span className="text-xs font-medium">
              {data.currentPeriod.isReconciled ? 'Reconciled' : data.cashMetrics.isBalanced ? 'Balanced' : 'Review'}
            </span>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-4">Period Summary</h3>
        <div className="space-y-3">
          <StatCard label="Period Income" value={`$${data.cashMetrics.income}`} icon="📥" />
          <StatCard
            label="Total Expenses"
            value={`$${data.cashMetrics.spending}`}
            subtitle={`(${data.wealthMetrics.spendingPercentage} of income)`}
            icon="📤"
          />
          <StatCard
            label="Period"
            value={`#${data.currentPeriod.index}`}
            subtitle={periodStart}
            icon="📅"
          />
        </div>
      </Card>

      <Card className={`p-4 ${data.paceMetrics.status === 'RED' ? 'border-red-300 bg-red-50 dark:bg-red-950/30' : data.paceMetrics.status === 'YELLOW' ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30' : 'border-green-300 bg-green-50 dark:bg-green-950/30'}`}>
        <h3 className="text-sm font-semibold mb-3">Period Pace</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Day {data.paceMetrics.day} of {data.paceMetrics.totalDays}</span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${
              data.paceMetrics.status === 'RED'
                ? 'bg-red-600 text-white'
                : data.paceMetrics.status === 'YELLOW'
                ? 'bg-yellow-600 text-white'
                : 'bg-green-600 text-white'
            }`}>
              {data.paceMetrics.status === 'RED' ? 'Overspending' : data.paceMetrics.status === 'YELLOW' ? 'On Pace' : 'Under Budget'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 font-medium">Daily Budget</p>
              <p className="font-bold text-sm text-gray-900 dark:text-gray-100">${data.paceMetrics.dailyBudget}</p>
            </div>
            <div className="text-center border-l border-r border-gray-400 dark:border-gray-500">
              <p className="text-gray-600 dark:text-gray-400 font-medium">Expected</p>
              <p className="font-bold text-sm text-gray-900 dark:text-gray-100">${data.paceMetrics.expectedSpend}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 font-medium">Actual</p>
              <p className="font-bold text-sm text-gray-900 dark:text-gray-100">${data.paceMetrics.actualSpend}</p>
            </div>
          </div>
          <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-full h-2.5">
            <div className={`h-2.5 rounded-full ${
              data.paceMetrics.status === 'RED'
                ? 'bg-red-600'
                : data.paceMetrics.status === 'YELLOW'
                ? 'bg-yellow-600'
                : 'bg-green-600'
            }`} style={{ width: `${Math.min(100, (parseFloat(data.paceMetrics.actualSpend) / parseFloat(data.paceMetrics.expectedSpend)) * 100)}%` }}></div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-4">Spending by Category (All Time)</h3>
        <div className="space-y-2">
          {data.categoryBreakdown.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-800 last:border-0"
            >
              <div>
                <p className="text-sm font-medium">{item.emoji ? `${item.emoji} ` : ''}{item.name}</p>
                <p className="text-xs text-muted">{item.percentage}</p>
              </div>
              <p className="text-sm font-semibold text-red-600">-${item.amount}</p>
            </div>
          ))}
          {data.categoryBreakdown.length === 0 && (
            <p className="text-sm text-muted">No spending entries in this period yet.</p>
          )}
        </div>
      </Card>

      <Card className="p-4 bg-gradient-to-br from-sky-50 dark:from-sky-950 to-transparent">
        <h3 className="text-sm font-semibold mb-3">Next Period Forecast ({data.forecast.confidence})</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Projected Expenses:</span>
            <span className="font-medium">${data.forecast.nextSpending}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Projected Savings:</span>
            <span className="font-medium">${data.forecast.nextSavings}</span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-sky-200 dark:border-sky-800">
            <span className="font-medium">Projected Cash:</span>
            <span className="font-bold">${data.forecast.nextEndingCash}</span>
          </div>
          {data.forecast.warnings.length > 0 && (
            <ul className="pt-2 text-xs text-amber-700 dark:text-amber-400 space-y-1">
              {data.forecast.warnings.slice(0, 2).map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
