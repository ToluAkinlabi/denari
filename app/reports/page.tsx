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
              <p className="text-xs text-muted mb-2">Spending Trend</p>
              <div className="flex items-end gap-1 h-12">
                {data.trendSpending.map((val, i) => {
                  const num = Number(val);
                  const max = Math.max(...data.trendSpending.map(Number), 1);
                  return (
                    <div
                      key={`${val}-${i}`}
                      className="flex-1 bg-sky-500 rounded-t opacity-70"
                      style={{ height: `${(num / max) * 100}%` }}
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
