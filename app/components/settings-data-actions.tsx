'use client';

import { useState } from 'react';
import { Database, Download } from 'lucide-react';
import { Card } from '@/components/card';
import { getTransactionsForDateRange } from '@/app/actions/transactions';

function escapeCsvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function SettingsDataActions() {
  const [exporting, setExporting] = useState(false);

  async function handleExportCsv() {
    setExporting(true);
    try {
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1);

      const transactions = await getTransactionsForDateRange(yearStart, now);
      if (!transactions.success || !transactions.data) {
        throw new Error(transactions.error ?? 'Could not load transactions');
      }

      const headers = ['Date', 'Description', 'Amount', 'Type', 'Category'];
      const lines = transactions.data.transactions.map((tx) => {
        const date = new Date(tx.date).toISOString().slice(0, 10);
        return [
          escapeCsvCell(date),
          escapeCsvCell(tx.description || ''),
          escapeCsvCell(tx.amount),
          escapeCsvCell(tx.type),
          escapeCsvCell(tx.categoryName || ''),
        ].join(',');
      });

      const csv = [headers.join(','), ...lines].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `denari-${now.getFullYear()}-ytd-transactions.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CSV export failed';
      alert(message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2 text-muted uppercase">Data</h3>
      <Card className="p-4">
        <button
          onClick={handleExportCsv}
          disabled={exporting}
          className="w-full flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-800 disabled:opacity-60"
        >
          <div className="flex items-center gap-3">
            <Download size={20} className="text-gray-600 dark:text-gray-400" />
            <div className="text-left">
              <span className="block">Export Data</span>
              <span className="text-xs text-muted">Export year-to-date as CSV</span>
            </div>
          </div>
          <span className="text-sm text-muted">{exporting ? 'Exporting...' : 'Download'}</span>
        </button>
        <button className="w-full flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-800" disabled>
          <div className="flex items-center gap-3">
            <Database size={20} className="text-gray-600 dark:text-gray-400" />
            <div className="text-left">
              <span className="block">Backup</span>
              <span className="text-xs text-muted">Create a backup (coming soon)</span>
            </div>
          </div>
          <span className="text-xl">→</span>
        </button>
        <button className="w-full flex items-center justify-between py-3" disabled>
          <div className="flex items-center gap-3">
            <Database size={20} className="text-orange-600" />
            <div className="text-left">
              <span className="block text-orange-600">Reset All Data</span>
              <span className="text-xs text-muted">Irreversible (disabled)</span>
            </div>
          </div>
          <span className="text-xl">→</span>
        </button>
      </Card>
    </div>
  );
}
