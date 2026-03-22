'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/card';
import { getMonthlyReport } from '@/app/actions/reports';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { MonthlyReportData } from '@/app/actions/reports';

export default function ReportsPage() {
  const [report, setReport] = useState<{ success: boolean; data?: MonthlyReportData; error?: string }>({ success: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReport = async () => {
      const result = await getMonthlyReport(new Date());
      setReport(result);
      setLoading(false);
    };
    loadReport();
  }, []);

  if (loading) {
    return (
      <div className="max-w-screen-sm mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted mt-2">Loading...</p>
      </div>
    );
  }

  if (!report.success || !report.data) {
    return (
      <div className="max-w-screen-sm mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted mt-2">{report.error ?? 'Could not load monthly report.'}</p>
      </div>
    );
  }

  const data = report.data;

  // Prepare trend data for Recharts
  const trendData = data.periodLabels.map((label, i) => ({
    period: label,
    income: Number(data.trendIncome[i] ?? 0),
    spending: Number(data.trendSpending[i] ?? 0),
    savings: Number(data.trendSavings[i] ?? 0),
    wealth: Number(data.trendWealth[i] ?? 0),
    endingCash: Number(data.trendEndingCash[i] ?? 0),
  }));

  const categoryData = data.categoryBreakdown.map((item) => ({
    name: item.category,
    amount: Number(item.amount),
    kind: item.kind,
    percentage: item.percentage,
  }));
  const pieColorClasses = {
    income: ['fill-emerald-700', 'fill-emerald-500', 'fill-emerald-400', 'fill-emerald-300'],
    expense: ['fill-red-600', 'fill-orange-500', 'fill-amber-500', 'fill-rose-400'],
  };
  const dotColorClasses = {
    income: ['bg-emerald-700', 'bg-emerald-500', 'bg-emerald-400', 'bg-emerald-300'],
    expense: ['bg-red-600', 'bg-orange-500', 'bg-amber-500', 'bg-rose-400'],
  };

  return (
    <div className="max-w-screen-sm mx-auto px-4 py-6 pb-20">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted">Analyze your finances</p>
        </div>

        <Card className="p-4">
          <h3 className="font-semibold mb-4">{data.monthLabel}</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">Totals from all periods overlapping this month</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted">Income</span>
              <span className="font-semibold">${data.income}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted">Spending</span>
              <span className="font-semibold">${data.spending}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted">Savings</span>
              <span className="font-semibold text-green-600">${data.savings}</span>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-800 pt-3 flex justify-between items-center">
              <span className="text-sm font-semibold">Wealth Created</span>
              <span className="font-bold text-sky-600">${data.wealthCreated}</span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-4">Performance Mix</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={[{
              name: 'Monthly',
              income: Number(data.income),
              spending: Number(data.spending),
              savings: Number(data.savings),
            }]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis width={55} tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(value) => `$${value}`} />
              <Legend />
              <Bar dataKey="income" fill="#10b981" name="Income" />
              <Bar dataKey="spending" fill="#ef4444" name="Spending" />
              <Bar dataKey="savings" fill="#3b82f6" name="Savings" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-4">Income vs Expense Mix</h3>
          <div className="grid gap-6 md:grid-cols-[minmax(0,320px)_1fr] items-center">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="amount"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell
                        key={`${entry.kind}-${entry.name}`}
                        className={pieColorClasses[entry.kind][index % pieColorClasses[entry.kind].length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {categoryData.map((category, index) => (
                <div
                  key={`${category.kind}-${category.name}`}
                  className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-block h-3 w-3 rounded-full ${dotColorClasses[category.kind][index % dotColorClasses[category.kind].length]}`}
                    />
                    <div>
                      <p className="text-sm font-medium">{category.name}</p>
                      <p className="text-xs text-muted">
                        {category.kind === 'income' ? 'Income' : 'Expense'} • {category.percentage}
                      </p>
                    </div>
                  </div>
                  <p className={`text-sm font-semibold ${category.kind === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {category.kind === 'income' ? '+' : '-'}${category.amount.toFixed(2)}
                  </p>
                </div>
              ))}
              {categoryData.length === 0 && (
                <p className="text-sm text-muted">No income or expense data for this month yet.</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-4">Trends (Recent Periods)</h3>
          <div className="space-y-6">
            <div>
              <p className="text-xs text-muted mb-3">Income vs Spending vs Savings</p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 9 }} interval={0} angle={-35} textAnchor="end" height={48} />
                    <YAxis width={55} tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(value) => `$${value}`} />
                  <Legend />
                  <Bar dataKey="income" fill="#10b981" name="Income" />
                  <Bar dataKey="spending" fill="#ef4444" name="Spending" />
                  <Bar dataKey="savings" fill="#3b82f6" name="Savings" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div>
              <p className="text-xs text-muted mb-3">Wealth Trajectory</p>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 9 }} interval={0} angle={-35} textAnchor="end" height={48} />
                    <YAxis width={55} tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(value) => `$${value}`} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="wealth"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ fill: '#8b5cf6', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Wealth Created"
                  />
                  <Line
                    type="monotone"
                    dataKey="endingCash"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    dot={{ fill: '#0ea5e9', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Ending Cash"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
