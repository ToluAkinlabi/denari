'use client';

import { Card } from '@/components/card';
import { getRecentPeriods } from '@/app/actions/periods';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function PeriodsPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{
    items: Array<{
      id: string;
      index: number;
      startDate: string;
      endDate: string;
      income: string;
      wealth: string;
      isReconciled: boolean;
    }>;
    total: number;
    page: number;
    pageSize: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const response = await getRecentPeriods({ page, pageSize: 10 });
      if (response.success && response.data) {
        setData(response.data);
        setError(null);
      } else {
        setError(response.error ?? 'Could not load periods.');
        setData(null);
      }
      setLoading(false);
    }
    load();
  }, [page]);

  if (loading) {
    return (
      <div className="max-w-screen-sm mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold">Periods</h1>
        <p className="text-muted mt-2">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-screen-sm mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold">Periods</h1>
        <p className="text-muted mt-2">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-screen-sm mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold">Periods</h1>
        <p className="text-muted mt-2">No periods found.</p>
      </div>
    );
  }

  const totalPages = Math.ceil(data.total / data.pageSize);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return (
    <div className="max-w-screen-sm mx-auto px-4 py-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Periods</h1>
          <p className="text-muted">Biweekly pay period tracking</p>
        </div>

        <div className="space-y-3">
          {data.items.map((period) => {
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

        {/* Pagination */}
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={!hasPrevPage}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
              hasPrevPage
                ? 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer'
                : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Previous</span>
          </button>

          <span className="text-sm text-muted">
            Page {data.page} of {totalPages} ({data.total} total)
          </span>

          <button
            onClick={() => setPage(p => p + 1)}
            disabled={!hasNextPage}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
              hasNextPage
                ? 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer'
                : 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }`}
          >
            <span className="text-sm font-medium">Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
