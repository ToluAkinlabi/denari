'use client';

import { type FormEvent, useMemo, useState, useTransition } from 'react';
import { Card } from '@/components/card';
import { Plus, ArrowUp, ArrowDown } from 'lucide-react';
import { addQuickEntry, addTransaction } from '@/app/actions/transactions';

interface AddEntryClientProps {
  periodId: string;
  categories: Array<{
    id: string;
    name: string;
    type: 'INCOME' | 'EXPENSE' | 'SAVINGS';
  }>;
}

export function AddEntryClient({ periodId, categories }: AddEntryClientProps) {
  const [tab, setTab] = useState<'quick' | 'detailed'>('quick');
  const [quickInput, setQuickInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [entryType, setEntryType] = useState<'INCOME' | 'EXPENSE' | 'SAVINGS'>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState(() => categories[0]?.id ?? '');

  const filteredCategories = useMemo(
    () => categories.filter((c) => (entryType === 'EXPENSE' ? c.type !== 'INCOME' : c.type === entryType)),
    [categories, entryType]
  );

  function showResult(success: boolean, text: string) {
    setMessage(`${success ? 'Success' : 'Error'}: ${text}`);
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

  return (
    <div className="max-w-screen-sm mx-auto px-4 py-6">
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
      </div>
    </div>
  );
}
