import { Card } from '@/components/card';
import { getRecentPeriods } from '@/app/actions/periods';

export const metadata = {
  title: 'Periods - Ledge',
  description: 'Manage your pay periods',
};

export default async function PeriodsPage() {
  const response = await getRecentPeriods(12);

  if (!response.success || !response.data) {
    return (
      <div className="max-w-screen-sm mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold">Periods</h1>
        <p className="text-muted mt-2">{response.error ?? 'Could not load periods.'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-screen-sm mx-auto px-4 py-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Periods</h1>
          <p className="text-muted">Biweekly pay period tracking</p>
        </div>

        <div className="space-y-3">
          {response.data.map((period) => {
            const status = period.isReconciled ? 'Reconciled' : 'Open';
            return (
              <Card key={period.id} className="p-4 cursor-pointer hover:shadow-md">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold">
                    {new Date(period.startDate).toLocaleDateString()} - {new Date(period.endDate).toLocaleDateString()}
                  </h3>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      status === 'Reconciled' ? 'badge-success' : 'badge-warning'
                    }`}
                  >
                    {status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">${period.income}</p>
                    <p>Income</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">${period.wealth}</p>
                    <p>Wealth</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
