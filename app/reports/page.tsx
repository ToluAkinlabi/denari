'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/card';
import { getMonthlyReport } from '@/app/actions/reports';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted mt-2">Loading...</p>
      </div>
    );
  }

  if (!report.success || !report.data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted mt-2">{report.error ?? 'Could not load monthly report.'}</p>
      </div>
    );
  }

  const data = report.data;

  // Prepare trend data for Recharts
  const trendData = data.periodLabels.map((label, i) => ({
    period: new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    income: Number(data.trendIncome[i] ?? 0),
    spending: Number(data.trendSpending[i] ?? 0),
    savings: Number(data.trendSavings[i] ?? 0),
    wealth: Math.max(Number(data.trendWealth[i] ?? 0), 0),
  }));

  // Prepare category data for heatmap
  const categoryData = data.categoryBreakdown.map((item) => ({
    name: item.category,
    amount: Number(item.amount),
  }));

  const maxCategoryAmount = Math.max(...categoryData.map((c) => c.amount), 1);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-20">
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
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => `$${value}`} />
              <Legend />
              <Bar dataKey="income" fill="#10b981" name="Income" />
              <Bar dataKey="spending" fill="#ef4444" name="Spending" />
              <Bar dataKey="savings" fill="#3b82f6" name="Savings" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-4">Spending by Category (Heatmap)</h3>
          <div className="grid grid-cols-2 gap-3">
            {categoryData.map((category) => {
              const intensity = (category.amount / maxCategoryAmount) * 100;
              const bgColor = intensity > 70 ? 'bg-red-200 dark:bg-red-900' : intensity > 40 ? 'bg-yellow-200 dark:bg-yellow-900' : 'bg-green-200 dark:bg-green-900';
              return (
                <div
                  key={category.name}
                  className={`p-3 rounded-lg ${bgColor} transition-colors`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-medium">{category.name}</span>
                    <span className="text-xs font-bold">${category.amount}</span>
                  </div>
                  <div className="w-full bg-gray-300 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className="h-full rounded-full bg-gray-600 dark:bg-gray-400"
                      style={{ width: `${intensity}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {categoryData.length === 0 && (
              <p className="text-sm text-muted col-span-2">No spending data for this month yet.</p>
            )}
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
                  <XAxis dataKey="period" />
                  <YAxis />
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
                  <XAxis dataKey="period" />
                  <YAxis />
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
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
