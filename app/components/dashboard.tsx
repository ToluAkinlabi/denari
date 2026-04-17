import { TrendingUp, CheckCircle, ArrowDownCircle, ArrowUpCircle, Calendar } from 'lucide-react';
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
  const periodEnd = new Date(data.currentPeriod.endDate).toLocaleDateString('en-US', { timeZone: 'UTC' });
  const periodRange = `${periodStart} - ${periodEnd}`;
  const carryForward = Number(data.cashMetrics.opening);
  const carryForwardSign = carryForward > 0 ? '+' : '';
  const carryForwardClass =
    carryForward < 0 ? 'text-red-600' : carryForward > 0 ? 'text-emerald-600' : 'text-gray-700 dark:text-gray-200';
  const paceActual = Number(data.paceMetrics.actualSpend);
  const paceExpected = Number(data.paceMetrics.expectedSpend);
  const pacePercent = paceExpected > 0 ? Math.min(100, (paceActual / paceExpected) * 100) : 0;
  const wealthChange = Number(data.wealthMetrics.created);
  const isSpenddown = !data.wealthMetrics.isNegative && wealthChange < 0;
  const paceWidthClass =
    pacePercent >= 100 ? 'w-full' :
    pacePercent >= 90 ? 'w-11/12' :
    pacePercent >= 80 ? 'w-10/12' :
    pacePercent >= 70 ? 'w-9/12' :
    pacePercent >= 60 ? 'w-8/12' :
    pacePercent >= 50 ? 'w-7/12' :
    pacePercent >= 40 ? 'w-6/12' :
    pacePercent >= 30 ? 'w-5/12' :
    pacePercent >= 20 ? 'w-4/12' :
    pacePercent >= 10 ? 'w-3/12' :
    pacePercent > 0 ? 'w-2/12' :
    'w-0';

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
            <div className="text-4xl">&#x1F4B0;</div>
          </div>
        </Card>

        <Card className={data.wealthMetrics.isNegative ? 'p-6 border-red-400 bg-red-100 dark:bg-red-950/40' : 'p-6'}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm mb-1 ${data.wealthMetrics.isNegative ? 'text-red-900 dark:text-red-200 font-semibold' : isSpenddown ? 'text-amber-700 dark:text-amber-300 font-semibold' : 'text-muted'}`}>
                {data.wealthMetrics.isNegative ? 'Wealth Deficit' : isSpenddown ? 'Net Spenddown' : 'Wealth Created'}
              </p>
              <p className={`text-3xl font-bold ${data.wealthMetrics.isNegative ? 'text-red-700 dark:text-red-300' : isSpenddown ? 'text-amber-600 dark:text-amber-300' : 'text-sky-600'}`}>${data.wealthMetrics.created}</p>
              <p className={`text-xs mt-1 ${data.wealthMetrics.isNegative ? 'text-red-800 dark:text-red-300' : isSpenddown ? 'text-amber-700 dark:text-amber-300' : 'text-muted'}`}>
                {data.wealthMetrics.isNegative
                  ? 'Actual running cash is below zero'
                  : isSpenddown
                  ? 'Spending exceeded period income, but carry forward covered it'
                  : 'Income minus real spending (savings + remaining income)'}
              </p>
            </div>
            <TrendingUp size={32} className={data.wealthMetrics.isNegative ? 'text-red-700 dark:text-red-300' : isSpenddown ? 'text-amber-600 dark:text-amber-300' : 'text-sky-500'} />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted mb-1">Savings This Period</p>
              <p className="text-3xl font-bold text-emerald-600">${data.cashMetrics.savings}</p>
              <p className="text-xs text-muted mt-1">{data.wealthMetrics.savingsRate} of income</p>
            </div>
            <div className="text-4xl">&#x1F3E6;</div>
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
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-sm font-semibold">Period Summary</h3>
          <span className="text-xs text-muted whitespace-nowrap">
            #{data.currentPeriod.index} ({periodRange})
          </span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2">
            <div>
              <p className="text-sm font-medium">Carry Forward</p>
              <p className="text-xs text-muted">Brought in from previous pay period</p>
            </div>
            <p className={`text-sm font-semibold ${carryForwardClass}`}>
              {carryForwardSign}${data.cashMetrics.opening}
            </p>
          </div>
          <StatCard label="Period Income" value={`$${data.cashMetrics.income}`} icon={<ArrowUpCircle size={24} />} />
          <StatCard
            label="Total Expenses"
            value={`$${data.cashMetrics.spending}`}
            subtitle={`(${data.wealthMetrics.spendingPercentage} of income)`}
            icon={<ArrowDownCircle size={24} />}
          />
          <StatCard
            label="Period"
            value={`#${data.currentPeriod.index}`}
            subtitle={periodRange}
            icon={<Calendar size={24} />}
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
            } ${paceWidthClass}`}></div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-4">Cashflow by Category (All Time)</h3>
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
                <p className={`text-sm font-semibold ${item.kind === 'income' ? 'text-emerald-600' : item.kind === 'savings' ? 'text-sky-600' : 'text-red-600'}`}>
                  {item.kind === 'expense' ? '-' : '+'}${item.amount}
              </p>
            </div>
          ))}
          {data.categoryBreakdown.length === 0 && (
            <p className="text-sm text-muted">No all-time cashflow entries yet.</p>
          )}
        </div>
      </Card>

      <Card className="p-4 bg-gradient-to-br from-sky-50 dark:from-sky-950 to-transparent">
        <h3 className="text-sm font-semibold mb-3">
          Next Period Forecast{' '}
          <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
            data.forecast.confidence === 'HIGH' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' :
            data.forecast.confidence === 'MEDIUM' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' :
            'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
          }`}>
            {data.forecast.confidence}
          </span>
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between items-baseline gap-2 text-sm flex-wrap">
            <span className="text-muted shrink-0">Income:</span>
            <span className="font-medium text-right">
              ${data.forecast.income.min}&#x2013;${data.forecast.income.max}
              <span className="text-xs text-muted-foreground ml-1">(~${data.forecast.income.likely})</span>
            </span>
          </div>
          <div className="flex justify-between items-baseline gap-2 text-sm flex-wrap">
            <span className="text-muted shrink-0">Expenses:</span>
            <span className="font-medium text-right">
              ${data.forecast.spending.min}&#x2013;${data.forecast.spending.max}
              <span className="text-xs text-muted-foreground ml-1">(~${data.forecast.spending.likely})</span>
            </span>
          </div>
          <div className="flex justify-between items-baseline gap-2 text-sm flex-wrap">
            <span className="text-muted shrink-0">Savings:</span>
            <span className="font-medium text-right">
              ${data.forecast.savings.min}&#x2013;${data.forecast.savings.max}
              <span className="text-xs text-muted-foreground ml-1">(~${data.forecast.savings.likely})</span>
            </span>
          </div>
          {parseFloat(data.forecast.discretionaryBuffer.likely) > 0 && (
            <div className="flex justify-between items-baseline gap-2 text-sm flex-wrap">
              <span className="text-muted shrink-0">Buffer (unknowns):</span>
              <span className="font-medium text-right text-amber-600 dark:text-amber-400">
                ~${data.forecast.discretionaryBuffer.likely}
              </span>
            </div>
          )}
          <div className="flex justify-between items-baseline gap-2 text-sm pt-2 border-t border-sky-200 dark:border-sky-800 flex-wrap">
            <span className="font-medium shrink-0">Projected Cash:</span>
            <div className="text-right">
              <div className="font-bold">${data.forecast.endingCash.likely}</div>
              <div className="text-xs text-muted-foreground">
                (${data.forecast.endingCash.min}&#x2013;${data.forecast.endingCash.max})
              </div>
            </div>
          </div>
          {data.forecast.warnings.length > 0 && (
            <ul className="pt-2 text-xs space-y-1">
              {data.forecast.warnings.slice(0, 3).map((warning) => (
                <li key={warning} className={
                  warning.includes('🚨') ? 'text-red-700 dark:text-red-400 font-medium' :
                  'text-amber-700 dark:text-amber-400'
                }>
                  {warning}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
