'use client';

import { Card } from '@/components/card';
import { getRecentPeriods, reconcilePeriod } from '@/app/actions/periods';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type PeriodItem = {
  id: string;
  label: string;
  index: number;
  startDate: string;
  endDate: string;
  income: string;
  spending: string;
  savings: string;
  wealth: string;
  openingCash: string;
  closingCashExpected: string;
  closingCashActual: string | null;
  isReconciled: boolean;
};

function fmt(val: string) {
  return parseFloat(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ReconcileForm({ period, onDone }: { period: PeriodItem; onDone: () => void }) {
  const [actual, setActual] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ difference: string; hints: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = parseFloat(actual);
    if (isNaN(val) || val < 0) {
      setError('Enter a valid dollar amount');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await reconcilePeriod({ periodId: period.id, actualCash: val.toFixed(2) });
    setLoading(false);
    if (!res.success) {
      setError(res.error ?? 'Reconciliation failed');
    } else {
      setResult({ difference: res.data!.difference, hints: res.data!.hints });
    }
  }

  if (result) {
    const diff = parseFloat(result.difference);
    const diffFmt = Math.abs(diff).toFixed(2);
    return (
      <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm">
        <p className={diff < -0.01 ? 'text-amber-600 font-medium' : diff > 0.01 ? 'text-emerald-600 font-medium' : 'text-emerald-600 font-medium'}>
          {Math.abs(diff) <= 0.01
            ? '✓ Period reconciled — balances match'
            : diff < 0
            ? `⚠ Period reconciled with -$${diffFmt} discrepancy (app over-counted)`
            : `⚠ Period reconciled with +$${diffFmt} discrepancy (app under-counted)`}
        </p>
        {result.hints.length > 0 && (
          <ul className="mt-2 space-y-1 text-muted">
            {result.hints.map((h, i) => <li key={i}>• {h}</li>)}
          </ul>
        )}
        <button onClick={onDone} className="mt-3 text-xs text-blue-600 dark:text-blue-400 underline">
          Reload periods
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2">
      <p className="text-xs text-muted">
        Enter your actual bank balance at the <strong>end of this period</strong>. The app will anchor all subsequent periods to this value.
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={actual}
            onChange={e => setActual(e.target.value)}
            placeholder={fmt(period.closingCashExpected)}
            className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Anchor'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}

export default function PeriodsPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{
    items: PeriodItem[];
    total: number;
    page: number;
    pageSize: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);

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

  useEffect(() => { load(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

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
            const isOpen = reconcilingId === period.id;
            const diff = period.closingCashActual != null
              ? parseFloat(period.closingCashActual) - parseFloat(period.closingCashExpected)
              : null;

            return (
              <Card key={period.id} className="p-4">
                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold">{period.label}</h3>
                  <div className="flex items-center gap-2">
                    {!period.isReconciled && (
                      <button
                        onClick={() => setReconcilingId(isOpen ? null : period.id)}
                        className="text-xs px-2 py-1 rounded-full border border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        {isOpen ? 'Cancel' : 'Reconcile'}
                      </button>
                    )}
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        period.isReconciled ? 'badge-success' : 'badge-warning'
                      }`}
                    >
                      {period.isReconciled ? 'Reconciled' : 'Open'}
                    </span>
                  </div>
                </div>

                {/* Financials grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-muted">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">+${fmt(period.income)}</p>
                    <p>Income</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">-${fmt(period.spending)}</p>
                    <p>Spending</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">${fmt(period.openingCash)}</p>
                    <p>Opens with</p>
                  </div>
                  <div>
                    {period.closingCashActual != null ? (
                      <>
                        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                          ${fmt(period.closingCashActual)}
                          {diff != null && Math.abs(diff) > 0.01 && (
                            <span className={`ml-1 text-xs ${diff < 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                              ({diff < 0 ? '-' : '+'}${Math.abs(diff).toFixed(2)})
                            </span>
                          )}
                        </p>
                        <p>Actual closing</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">${fmt(period.closingCashExpected)}</p>
                        <p>Expected closing</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Reconcile form */}
                {isOpen && (
                  <ReconcileForm
                    period={period}
                    onDone={() => { setReconcilingId(null); load(); }}
                  />
                )}
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
