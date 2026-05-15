'use client';

import { type FormEvent, useEffect, useMemo, useState, useTransition } from 'react';
import { Card } from '@/components/card';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { addTransaction, addDirectedIncomeEntry } from '@/app/actions/transactions';

interface AddEntryClientProps {
  periodId: string;
  categories: Array<{
    id: string;
    name: string;
    type: 'INCOME' | 'EXPENSE' | 'SAVINGS';
  }>;
}

export function AddEntryClient({ periodId, categories }: AddEntryClientProps) {
  const formatLocalDateForInput = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [isPending, startTransition] = useTransition();
  const [entryType, setEntryType] = useState<'INCOME' | 'EXPENSE' | 'SAVINGS'>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [categoryId, setCategoryId] = useState(() => categories[0]?.id ?? '');
  const [directToBucket, setDirectToBucket] = useState(false);
  const [directToBucketId, setDirectToBucketId] = useState('');
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const filteredCategories = useMemo(
    () => categories.filter((c) => (entryType === 'EXPENSE' ? c.type !== 'INCOME' : c.type === entryType)),
    [categories, entryType]
  );

  const bucketCategories = useMemo(
    () => categories.filter((c) => c.type !== 'INCOME'),
    [categories]
  );

  useEffect(() => {
    if (!date) setDate(formatLocalDateForInput(new Date()));
  }, [date]);

  useEffect(() => {
    if (!filteredCategories.length) { setCategoryId(''); return; }
    if (!filteredCategories.some((cat) => cat.id === categoryId)) {
      setCategoryId(filteredCategories[0].id);
    }
  }, [filteredCategories, categoryId]);

  useEffect(() => {
    if (bucketCategories.length && !directToBucketId) {
      setDirectToBucketId(bucketCategories[0].id);
    }
  }, [bucketCategories, directToBucketId]);

  // Reset direct-to-bucket when switching away from INCOME
  useEffect(() => {
    if (entryType !== 'INCOME') setDirectToBucket(false);
  }, [entryType]);

  function showResult(success: boolean, text: string) {
    setToast({ kind: success ? 'success' : 'error', text });
    setTimeout(() => setToast(null), 4500);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!categoryId) { showResult(false, 'Select a category before saving'); return; }

    startTransition(async () => {
      const entryDate = date || formatLocalDateForInput(new Date());

      if (entryType === 'INCOME' && directToBucket && directToBucketId) {
        const result = await addDirectedIncomeEntry({
          amount,
          categoryId,
          description,
          date: entryDate,
          periodId,
          directToBucketId,
        });
        if (!result.success) { showResult(false, result.error || 'Could not save entry'); return; }
        setAmount('');
        setDescription('');
        showResult(true, 'Income saved and directed to bucket');
        return;
      }

      const result = await addTransaction({
        amount,
        categoryId,
        description,
        entryType,
        date: entryDate,
        periodId,
      });
      if (!result.success) { showResult(false, result.error || 'Could not save entry'); return; }
      setAmount('');
      setDescription('');
      showResult(true, 'Entry saved');
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

        <form className="space-y-4" onSubmit={handleSubmit}>
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
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {entryType === 'INCOME' && (
            <Card className="p-4 space-y-3 border-green-700/40 bg-green-950/20">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-green-500"
                  checked={directToBucket}
                  onChange={(e) => setDirectToBucket(e.target.checked)}
                />
                <span className="text-sm font-medium">Direct all to one bucket (skip RAF split)</span>
              </label>
              {directToBucket && (
                <div>
                  <label className="text-xs text-muted block mb-1">Target bucket</label>
                  <select
                    className="input-field"
                    value={directToBucketId}
                    onChange={(e) => setDirectToBucketId(e.target.value)}
                  >
                    {bucketCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted mt-1">
                    RAF transfers will be created automatically to route 100% of this income to the selected bucket.
                  </p>
                </div>
              )}
            </Card>
          )}

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
      </div>
    </div>
  );
}


interface AddEntryClientProps {
  periodId: string;
  categories: Array<{
    id: string;
    name: string;
    type: 'INCOME' | 'EXPENSE' | 'SAVINGS';
  }>;
}

export function AddEntryClient({ periodId, categories }: AddEntryClientProps) {
  const formatLocalDateForInput = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [tab, setTab] = useState<'quick' | 'detailed' | 'backlog'>('quick');
  const [quickInput, setQuickInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [entryType, setEntryType] = useState<'INCOME' | 'EXPENSE' | 'SAVINGS'>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [categoryId, setCategoryId] = useState(() => categories[0]?.id ?? '');
  const [toast, setToast] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  const filteredCategories = useMemo(
    () => categories.filter((c) => (entryType === 'EXPENSE' ? c.type !== 'INCOME' : c.type === entryType)),
    [categories, entryType]
  );

  useEffect(() => {
    if (!date) {
      setDate(formatLocalDateForInput(new Date()));
    }
  }, [date]);

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
      const entryDate = date || formatLocalDateForInput(new Date());
      const result = await addQuickEntry({ input: quickInput, date: entryDate });
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
      const entryDate = date || formatLocalDateForInput(new Date());
      const result = await addTransaction({
        amount,
        categoryId,
        description,
        entryType,
        date: entryDate,
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
          {/* Backlog import is intentionally hidden for now.
              Keep this block for easy re-enable later.
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
          */}
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

        {/* Backlog import panel intentionally disabled for now.
            Keep this block for easy re-enable later.
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
        */}
      </div>
    </div>
  );
}
