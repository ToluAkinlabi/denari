import { Card } from '@/components/card';
import { getMonthlyReport } from '@/app/actions/reports';

export const metadata = {
  title: 'Reports - Ledge',
  description: 'Financial reports and analysis',
};

export default async function ReportsPage() {
  const report = await getMonthlyReport(new Date());

  if (!report.success || !report.data) {
    return (
      <div className="max-w-screen-sm mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted mt-2">{report.error ?? 'Could not load monthly report.'}</p>
      </div>
    );
  }

  const data = report.data;
  const trendMax = Math.max(
    1,
    ...data.trendIncome.map(Number),
    ...data.trendSpending.map(Number),
    ...data.trendSavings.map(Number)
  );

  return (
    <div className="max-w-screen-sm mx-auto px-4 py-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted">Analyze your finances</p>
        </div>

        <Card className="p-4">
          <h3 className="font-semibold mb-4">{data.monthLabel}</h3>
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
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted">Income</span>
                <span>${data.income}</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${(Number(data.income) / trendMax) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted">Spending</span>
                <span>${data.spending}</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500" style={{ width: `${(Number(data.spending) / trendMax) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted">Savings</span>
                <span>${data.savings}</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-sky-500" style={{ width: `${(Number(data.savings) / trendMax) * 100}%` }} />
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-4">Spending by Category</h3>
          <div className="space-y-2">
            {data.categoryBreakdown.map((item) => (
              <div key={item.category} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span>{item.category}</span>
                    <span className="font-medium">${item.amount}</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500" style={{ width: item.percentage }} />
                  </div>
                </div>
              </div>
            ))}
            {data.categoryBreakdown.length === 0 && (
              <p className="text-sm text-muted">No spending data for this month yet.</p>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-4">Trends (Recent Periods)</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted mb-2">Income vs Spending vs Savings</p>
              <div className="flex items-end gap-1 h-12">
                {data.trendSpending.map((_, i) => {
                  const income = Number(data.trendIncome[i] ?? 0);
                  const spending = Number(data.trendSpending[i] ?? 0);
                  const savings = Number(data.trendSavings[i] ?? 0);
                  return (
                    <div key={`trend-${i}`} className="flex-1 flex items-end gap-0.5 h-full">
                      <div
                        className="w-1/3 bg-emerald-500 rounded-t opacity-80"
                        style={{ height: `${(income / trendMax) * 100}%` }}
                        title={`Income: $${data.trendIncome[i]}`}
                      />
                      <div
                        className="w-1/3 bg-rose-500 rounded-t opacity-80"
                        style={{ height: `${(spending / trendMax) * 100}%` }}
                        title={`Spending: $${data.trendSpending[i]}`}
                      />
                      <div
                        className="w-1/3 bg-sky-500 rounded-t opacity-80"
                        style={{ height: `${(savings / trendMax) * 100}%` }}
                        title={`Savings: $${data.trendSavings[i]}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-muted">
                <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />Income</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-rose-500" />Spending</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-sky-500" />Savings</span>
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-muted">
                <span>{data.periodLabels[0] ?? '-'}</span>
                <span>{data.periodLabels[data.periodLabels.length - 1] ?? '-'}</span>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted mb-2">Wealth Trend</p>
              <div className="flex items-end gap-1 h-10">
                {data.trendWealth.map((val, i) => {
                  const num = Math.max(Number(val), 0);
                  const max = Math.max(...data.trendWealth.map((x) => Math.max(Number(x), 0)), 1);
                  return (
                    <div
                      key={`wealth-${i}`}
                      className="flex-1 bg-violet-500 rounded-t opacity-80"
                      style={{ height: `${(num / max) * 100}%` }}
                      title={`Wealth: $${val}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
