"use client";

import Link from 'next/link';
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
  const paceStatusColorClass =
    data.paceMetrics.status === 'GREEN'
      ? 'text-green-400'
      : data.paceMetrics.status === 'RED'
      ? 'text-red-400'
      : 'text-amber-300';
  const paceCardAccentClass =
    data.paceMetrics.status === 'GREEN'
      ? 'border-green-700 bg-green-950/40'
      : data.paceMetrics.status === 'RED'
      ? 'border-red-700 bg-red-950/40'
      : 'border-yellow-700 bg-yellow-950/40';
  const aiModelBadgeClass =
    data.paceMetrics.status === 'GREEN'
      ? 'bg-green-900 text-green-300'
      : data.paceMetrics.status === 'RED'
      ? 'bg-red-900 text-red-300'
      : 'bg-yellow-900 text-yellow-300';
  const aiSummaryClass =
    data.paceMetrics.status === 'GREEN'
      ? 'text-green-100'
      : data.paceMetrics.status === 'RED'
      ? 'text-red-100'
      : 'text-yellow-100';
  const aiReliabilityClass =
    data.aiInsight.reliability === 'HIGH'
      ? 'bg-green-900 text-green-300'
      : data.aiInsight.reliability === 'LOW'
      ? 'bg-red-900 text-red-300'
      : 'bg-amber-900 text-amber-300';
  const rafCardAccentClass =
    data.raf.exhaustedBuckets.length > 0
      ? 'border-red-700 bg-red-950/40'
      : data.raf.atRiskBuckets.length > 0
      ? 'border-yellow-700 bg-yellow-950/40'
      : 'border-green-700 bg-green-950/40';
  const rafHeadlineClass =
    data.raf.exhaustedBuckets.length > 0
      ? 'text-red-300'
      : data.raf.atRiskBuckets.length > 0
      ? 'text-amber-300'
      : 'text-green-300';
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

      <Card className="p-3 bg-[#232323]">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-gray-700 px-2 py-2">
            <p className="text-[10px] text-muted uppercase tracking-wide">Cash</p>
            <p className="text-sm font-bold text-amber-400">${data.cashMetrics.ending}</p>
          </div>
          <div className="rounded-lg border border-gray-700 px-2 py-2">
            <p className="text-[10px] text-muted uppercase tracking-wide">Pace</p>
            <p className={`text-sm font-bold ${paceStatusColorClass}`}>{data.paceMetrics.status}</p>
          </div>
          <div className="rounded-lg border border-gray-700 px-2 py-2">
            <p className="text-[10px] text-muted uppercase tracking-wide">Flags</p>
              <a href="#daily-ai-briefing" className="text-sm font-bold text-amber-300 underline-offset-2 hover:underline">
              {data.forecast.warnings.length}
            </a>
            <p className="text-[10px] text-muted">Tap to review</p>
          </div>
        </div>
      </Card>

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
              <p className={`text-sm mb-1 ${data.wealthMetrics.isNegative ? 'text-red-900 dark:text-red-200 font-semibold' : isSpenddown ? 'text-amber-800 dark:text-amber-200 font-semibold' : 'text-muted'}`}>
                {data.wealthMetrics.isNegative ? 'Wealth Deficit' : isSpenddown ? 'Net Spenddown' : 'Wealth Created'}
              </p>
              <p className={`text-3xl font-bold ${data.wealthMetrics.isNegative ? 'text-red-400' : isSpenddown ? 'text-amber-300' : 'text-amber-400'}`}>${data.wealthMetrics.created}</p>
              <p className={`text-xs mt-1 ${data.wealthMetrics.isNegative ? 'text-red-800 dark:text-red-300' : isSpenddown ? 'text-amber-800 dark:text-amber-200' : 'text-muted'}`}>
                {data.wealthMetrics.isNegative
                  ? 'Actual running cash is below zero'
                  : isSpenddown
                  ? 'Spending exceeded period income, but carry forward covered it'
                  : 'Income minus real spending (savings + remaining income)'}
              </p>
            </div>
            <TrendingUp size={32} className={data.wealthMetrics.isNegative ? 'text-red-400' : isSpenddown ? 'text-amber-300' : 'text-amber-400'} />
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

      <Link href="/raf">
        <Card className={`p-4 mt-6 ${rafCardAccentClass} hover:opacity-90 transition-opacity cursor-pointer`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted uppercase tracking-wide mb-1">RAF Allocation</p>
              <p className={`text-base font-semibold ${rafHeadlineClass}`}>
                {data.raf.exhaustedBuckets.length > 0
                  ? `${data.raf.exhaustedBuckets.length} bucket${data.raf.exhaustedBuckets.length === 1 ? '' : 's'} exhausted`
                  : data.raf.atRiskBuckets.length > 0
                  ? `${data.raf.atRiskBuckets.length} bucket${data.raf.atRiskBuckets.length === 1 ? '' : 's'} at risk`
                  : 'All buckets healthy'}
              </p>
              <p className="text-xs text-muted mt-0.5">
                ${data.raf.allocated} allocated · ${data.raf.unallocated} free
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted mb-1">View full plan →</p>
              <div className="flex gap-1 justify-end">
                {data.raf.buckets.slice(0, 4).map((b) => (
                  <span
                    key={b.categoryId}
                    className={`w-2 h-2 rounded-full inline-block ${
                      b.status === 'EXHAUSTED' ? 'bg-red-400' : b.status === 'AT_RISK' ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </Card>
      </Link>

      <Card className={`p-4 mt-4 ${data.paceMetrics.status === 'RED' ? 'border-red-700 bg-red-950/50' : data.paceMetrics.status === 'YELLOW' ? 'border-yellow-700 bg-yellow-950/40' : 'border-green-700 bg-green-950/40'}`}>
        <h3 className="text-sm font-semibold mb-3">Period Pace</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">Day {data.paceMetrics.day} of {data.paceMetrics.totalDays}</span>
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
              <p className="text-gray-400 font-medium">Daily Budget</p>
              <p className="font-bold text-sm text-gray-100">${data.paceMetrics.dailyBudget}</p>
            </div>
            <div className="text-center border-l border-r border-gray-600">
              <p className="text-gray-400 font-medium">Expected</p>
              <p className="font-bold text-sm text-gray-100">${data.paceMetrics.expectedSpend}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-400 font-medium">Actual</p>
              <p className="font-bold text-sm text-gray-100">${data.paceMetrics.actualSpend}</p>
            </div>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2.5">
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
                <p className={`text-sm font-semibold ${item.kind === 'income' ? 'text-emerald-400' : item.kind === 'savings' ? 'text-amber-400' : 'text-red-400'}`}>
                  {item.kind === 'expense' ? '-' : '+'}${item.amount}
              </p>
            </div>
          ))}
          {data.categoryBreakdown.length === 0 && (
            <p className="text-sm text-muted">No all-time cashflow entries yet.</p>
          )}
        </div>
      </Card>

      <Card id="daily-ai-briefing" className={`p-4 ${paceCardAccentClass}`}>
        <h3 className="text-sm font-semibold mb-3">
          Daily AI Briefing{' '}
          <span className={`ml-2 text-xs px-2 py-0.5 rounded ${aiModelBadgeClass}`}>
            {data.aiInsight.model}
          </span>
          <span className={`ml-2 text-xs px-2 py-0.5 rounded ${aiReliabilityClass}`}>
            {data.aiInsight.reliability} confidence
          </span>
        </h3>
        <div className="space-y-3">
          <p className={`text-sm leading-relaxed ${aiSummaryClass}`}>
            {data.aiInsight.summary}
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-gray-700 px-2 py-2">
              <p className="text-muted">RAF Profile</p>
              <p className="font-semibold text-sky-300">{data.raf.profileSource}</p>
            </div>
            <div className="rounded-lg border border-gray-700 px-2 py-2">
              <p className="text-muted">Bucket Pressure</p>
              <p className="font-semibold text-amber-300">{data.raf.exhaustedBuckets.length + data.raf.atRiskBuckets.length} at risk</p>
            </div>
          </div>

          <div className="rounded-lg border border-gray-700 px-2 py-2">
            <p className="text-muted text-xs">Reliability Note</p>
            <p className="text-xs text-gray-200">{data.aiInsight.reliabilityReason}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-gray-700 px-2 py-2">
              <p className="text-muted">Income</p>
              <p className="font-semibold text-emerald-400">${data.cashMetrics.income}</p>
            </div>
            <div className="rounded-lg border border-gray-700 px-2 py-2">
              <p className="text-muted">Spending</p>
              <p className="font-semibold text-red-400">${data.cashMetrics.spending}</p>
            </div>
            <div className="rounded-lg border border-gray-700 px-2 py-2">
              <p className="text-muted">Savings</p>
              <p className="font-semibold text-amber-400">${data.cashMetrics.savings}</p>
            </div>
            <div className="rounded-lg border border-gray-700 px-2 py-2">
              <p className="text-muted">Next Cash (Likely)</p>
              <p className="font-semibold text-amber-300">${data.forecast.nextEndingCash}</p>
            </div>
          </div>

          {data.forecast.warnings.length > 0 && (
            <div className={`rounded-lg px-3 py-2 ${
              data.paceMetrics.status === 'GREEN'
                ? 'border border-green-300/40 bg-green-950/20'
                : data.paceMetrics.status === 'RED'
                ? 'border border-red-300/40 bg-red-950/20'
                : 'border border-yellow-300/40 bg-yellow-950/20'
            }`}>
              <p className={`text-xs font-semibold mb-1 ${
                data.paceMetrics.status === 'GREEN'
                  ? 'text-green-200'
                  : data.paceMetrics.status === 'RED'
                  ? 'text-red-200'
                  : 'text-yellow-200'
              }`}>
                {data.forecast.warnings.length} caution flag{data.forecast.warnings.length === 1 ? '' : 's'} to act on
              </p>
              <ul className="space-y-1">
                {data.forecast.warnings.slice(0, 2).map((warning) => (
                  <li key={warning} className={`text-xs ${
                    data.paceMetrics.status === 'GREEN'
                      ? 'text-green-100'
                      : data.paceMetrics.status === 'RED'
                      ? 'text-red-100'
                      : 'text-yellow-100'
                  }`}>
                    • {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[10px] text-muted">Updated {new Date(data.aiInsight.generatedAt).toLocaleString()}</p>
        </div>
      </Card>
    </div>
  );
}
