'use client';

import { type FormEvent, useEffect, useMemo, useState, useTransition } from 'react';
import { Card } from '@/components/card';
import { Plus, ArrowUp, ArrowDown } from 'lucide-react';
import { addQuickEntry, addTransaction, importBacklogEntries } from '@/app/actions/transactions';

interface AddEntryClientProps {
  periodId: string;
  categories: Array<{
    id: string;
    name: string;
    type: 'INCOME' | 'EXPENSE' | 'SAVINGS';
  }>;
}

export function AddEntryClient({ periodId, categories }: AddEntryClientProps) {
  const [tab, setTab] = useState<'quick' | 'detailed' | 'backlog'>('quick');
  const [quickInput, setQuickInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [entryType, setEntryType] = useState<'INCOME' | 'EXPENSE' | 'SAVINGS'>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState(() => categories[0]?.id ?? '');
  const [backlogText, setBacklogText] = useState('');
  const [toast, setToast] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  const filteredCategories = useMemo(
    () => categories.filter((c) => (entryType === 'EXPENSE' ? c.type !== 'INCOME' : c.type === entryType)),
    [categories, entryType]
  );

  useEffect(() => {
    if (!filteredCategories.length) {
      setCategoryId('');
      return;
    }

    if (!filteredCategories.some((cat) => cat.id === categoryId)) {
      setCategoryId(filteredCategories[0].id);
    }
  }, [filteredCategories, categoryId]);

  function showResult(success: boolean, text: string) {
    setMessage(`${success ? 'Success' : 'Error'}: ${text}`);
    setToast({ kind: success ? 'success' : 'error', text });
    setTimeout(() => setToast(null), 4500);
  }

  function submitQuick() {
    if (!quickInput.trim()) {
      showResult(false, 'Enter a quick entry like "45 grocery"');
      return;
    }

    startTransition(async () => {
      const result = await addQuickEntry({ input: quickInput, date: new Date(date) });
      if (!result.success) {
        showResult(false, result.error || 'Could not save entry');
        return;
      }
      setQuickInput('');
      showResult(true, `Saved ${result.data?.description ?? 'entry'}`);
    });
  }

  function submitDetailed(e: FormEvent) {
    e.preventDefault();

    if (!categoryId) {
      showResult(false, 'Select a category before saving');
      return;
    }

    startTransition(async () => {
      const result = await addTransaction({
        amount,
        categoryId,
        description,
        entryType,
        date: new Date(date),
        periodId,
      });

      if (!result.success) {
        showResult(false, result.error || 'Could not save entry');
        return;
      }

      setAmount('');
      setDescription('');
      showResult(true, 'Transaction saved');
    });
  }

  function parseBacklogRows(text: string) {
    const parseMoney = (raw: string) => {
      const cleaned = raw.replace(/[$,\s]/g, '').trim();
      if (!cleaned || cleaned === '-') return '';
      // Handle accounting negative values like (827.19)
      if (/^\(.*\)$/.test(cleaned)) {
        return `-${cleaned.slice(1, -1)}`;
      }
      return cleaned;
    };

    const parseDateValue = (raw: string) => {
      const value = raw.trim();
      if (!value) return new Date('invalid');

      // Supports values like "9-Jan", "23-Jan", "2026-01-09"
      if (/^\d{1,2}-[A-Za-z]{3}$/.test(value)) {
        return new Date(`${value}-2026`);
      }

      return new Date(value);
    };

    // Existing simple format: YYYY-MM-DD | Category | Amount | Description | Note | EntryType
    if (text.includes('|')) {
      const lines = text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      const rows = lines.map((line) => {
        const parts = line.split('|').map((p) => p.trim());
        const [dateStr, categoryName, amount, description = '', note = '', entryType = ''] = parts;

        return {
          date: new Date(dateStr),
          categoryName,
          amount,
          description,
          note,
          entryType: entryType ? (entryType.toUpperCase() as 'INCOME' | 'EXPENSE' | 'SAVINGS') : undefined,
        };
      });

      return rows;
    }

    // Spreadsheet format with header row and tab/comma separated columns.
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return [];
    }

    const separator = lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(separator).map((h) => h.trim().toLowerCase());
    const rows: Array<{
      date: Date;
      categoryName: string;
      amount: string;
      description: string;
      note: string;
      entryType?: 'INCOME' | 'EXPENSE' | 'SAVINGS';
    }> = [];

    const categoryColumnMap: Record<string, { categoryName: string; entryType: 'INCOME' | 'EXPENSE' | 'SAVINGS' }> = {
      income: { categoryName: 'Income', entryType: 'INCOME' },
      debt: { categoryName: 'Debt', entryType: 'EXPENSE' },
      partnership: { categoryName: 'Partnership', entryType: 'EXPENSE' },
      groceries: { categoryName: 'Grocery', entryType: 'EXPENSE' },
      rent: { categoryName: 'Rent', entryType: 'EXPENSE' },
      'phone bill': { categoryName: 'Phone', entryType: 'EXPENSE' },
      'other house expenses': { categoryName: 'Other', entryType: 'EXPENSE' },
      'spending money': { categoryName: 'Spend', entryType: 'EXPENSE' },
      miscellaneous: { categoryName: 'Misc', entryType: 'EXPENSE' },
      savings: { categoryName: 'Savings', entryType: 'SAVINGS' },
    };

    for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
      const columns = lines[lineIndex].split(separator).map((c) => c.trim());
      const rowRecord = Object.fromEntries(headers.map((h, idx) => [h, columns[idx] ?? '']));
      const rowDate = parseDateValue(rowRecord.date || '');
      const rowNote = rowRecord.notes || '';
      let noteAttached = false;

      Object.entries(categoryColumnMap).forEach(([columnName, config]) => {
        const amount = parseMoney(rowRecord[columnName] || '');
        if (!amount) return;

        rows.push({
          date: rowDate,
          categoryName: config.categoryName,
          amount,
          description: `${config.categoryName} backlog`,
          note: !noteAttached ? rowNote : '',
          entryType: config.entryType,
        });

        noteAttached = true;
      });
    }

    return rows;
  }

  function submitBacklog() {
    if (!backlogText.trim()) {
      showResult(false, 'Paste backlog rows first');
      return;
    }

    startTransition(async () => {
      const rows = parseBacklogRows(backlogText);
      const result = await importBacklogEntries({ rows });

      if (!result.success || !result.data) {
        showResult(false, result.error || 'Backlog import failed');
        return;
      }

      const summary = `Imported ${result.data.imported}, failed ${result.data.failed}`;
      if (result.data.failed > 0) {
        showResult(false, `${summary}. ${result.data.errors.slice(0, 3).join(' | ')}`);
        return;
      }

      setBacklogText('');
      showResult(true, summary);
    });
  }

  return (
    <div className="max-w-screen-sm mx-auto px-4 py-6">
      {toast && (
        <div className="fixed bottom-24 left-4 right-4 z-50 max-w-screen-sm mx-auto">
          <div
            className={`rounded-lg px-4 py-3 shadow-lg border text-sm font-medium ${
              toast.kind === 'success'
                ? 'bg-green-600 text-white border-green-500'
                : 'bg-red-600 text-white border-red-500'
            }`}
          >
            {toast.text}
          </div>
        </div>
      )}
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Add Entry</h1>
          <p className="text-muted">Log income, spending, or savings transfers</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setTab('quick')}
            className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors ${
              tab === 'quick'
                ? 'bg-sky-500 text-white'
                : 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            }`}
            type="button"
          >
            Quick Entry
          </button>
          <button
            onClick={() => setTab('detailed')}
            className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors ${
              tab === 'detailed'
                ? 'bg-sky-500 text-white'
                : 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            }`}
            type="button"
          >
            Detailed
          </button>
          <button
            onClick={() => setTab('backlog')}
            className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors ${
              tab === 'backlog'
                ? 'bg-sky-500 text-white'
                : 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            }`}
            type="button"
          >
            Backlog
          </button>
        </div>

        {message && (
          <Card className="p-3">
            <p className="text-sm">{message}</p>
          </Card>
        )}

        {tab === 'quick' && (
          <div className="space-y-4">
            <Card className="p-4 space-y-3">
              <label className="text-sm font-medium block">Quick input</label>
              <input
                type="text"
                placeholder='Example: 45 grocery'
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                className="input-field"
              />
              <label className="text-sm font-medium block">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-field"
              />
            </Card>

            <button
              className="w-full btn-primary py-3 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              type="button"
              onClick={submitQuick}
              disabled={isPending}
            >
              <Plus size={20} />
              {isPending ? 'Saving...' : 'Add Quick Entry'}
            </button>
          </div>
        )}

        {tab === 'detailed' && (
          <form className="space-y-4" onSubmit={submitDetailed}>
            <Card className="p-4">
              <p className="text-sm font-medium mb-3">Entry Type</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setEntryType('INCOME')}
                  className={`py-2 px-3 rounded-lg font-medium ${
                    entryType === 'INCOME' ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-800'
                  }`}
                >
                  <ArrowUp size={16} className="mx-auto mb-1" />
                  Income
                </button>
                <button
                  type="button"
                  onClick={() => setEntryType('EXPENSE')}
                  className={`py-2 px-3 rounded-lg font-medium ${
                    entryType === 'EXPENSE' ? 'bg-sky-500 text-white' : 'bg-gray-200 dark:bg-gray-800'
                  }`}
                >
                  <ArrowDown size={16} className="mx-auto mb-1" />
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setEntryType('SAVINGS')}
                  className={`py-2 px-3 rounded-lg font-medium ${
                    entryType === 'SAVINGS' ? 'bg-emerald-600 text-white' : 'bg-gray-200 dark:bg-gray-800'
                  }`}
                >
                  Save
                </button>
              </div>
            </Card>

            <div>
              <label className="text-sm font-medium block mb-2">Amount</label>
              <input
                type="number"
                placeholder="0.00"
                className="input-field"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">Category</label>
              <select
                className="input-field"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                {filteredCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">Date</label>
              <input
                type="date"
                className="input-field"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">Description</label>
              <input
                type="text"
                placeholder="What was this for?"
                className="input-field"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full btn-primary py-3 rounded-lg font-semibold disabled:opacity-60"
            >
              {isPending ? 'Saving...' : 'Save Entry'}
            </button>
          </form>
        )}

        {tab === 'backlog' && (
          <div className="space-y-4">
            <Card className="p-4 space-y-3">
              <p className="text-sm font-medium">Paste historical rows</p>
              <p className="text-xs text-muted">
                Format: <code>YYYY-MM-DD | Category | Amount | Description | Note | EntryType</code>
              </p>
              <p className="text-xs text-muted">EntryType is optional and can be INCOME, EXPENSE, or SAVINGS.</p>
              <p className="text-xs text-muted">Spreadsheet paste also works with columns like Date, Income, Debt, Groceries, Rent, Phone bill, Other house expenses, Spending money, Miscellaneous, Savings, Notes.</p>
              <textarea
                className="input-field min-h-40"
                value={backlogText}
                onChange={(e) => setBacklogText(e.target.value)}
                placeholder={
                  '2026-01-09 | Income | 6417.98 | Paycheck | Carry-over included | INCOME\n2026-01-09 | Debt | 1331.69 | Debt payment | Month close note | EXPENSE'
                }
              />
            </Card>

            <button
              className="w-full btn-primary py-3 rounded-lg font-semibold disabled:opacity-60"
              type="button"
              onClick={submitBacklog}
              disabled={isPending}
            >
              {isPending ? 'Importing...' : 'Import Backlog Rows'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
