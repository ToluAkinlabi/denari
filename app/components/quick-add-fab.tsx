'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Plus, X, Zap, SlidersHorizontal } from 'lucide-react';
import { addTransaction, getAddEntryOptions } from '@/app/actions/transactions';

type QuickCategory = {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE' | 'SAVINGS';
};

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function QuickAddFab() {
  const pathname = usePathname();
  const router = useRouter();
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'quick' | 'detailed' | null>(null);
  const [entryType, setEntryType] = useState<'INCOME' | 'EXPENSE' | 'SAVINGS'>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(formatDateInput(new Date()));
  const [periodId, setPeriodId] = useState<string>('');
  const [categories, setCategories] = useState<QuickCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hiddenRoutes = ['/add'];
  const shouldHide = hiddenRoutes.includes(pathname);

  const filteredCategories = useMemo(
    () => categories.filter((c) => (entryType === 'EXPENSE' ? c.type !== 'INCOME' : c.type === entryType)),
    [categories, entryType]
  );

  useEffect(() => {
    if (!activeModal) return;

    let cancelled = false;
    startTransition(async () => {
      const options = await getAddEntryOptions();
      if (cancelled) return;

      if (!options.success || !options.data) {
        setError(options.error ?? 'Could not load quick add options.');
        return;
      }

      setCategories(options.data.categories);
      setPeriodId(options.data.periodId);
      const initialCategory = options.data.categories.find((c) => c.type !== 'INCOME') ?? options.data.categories[0];
      setCategoryId(initialCategory?.id ?? '');
      setError(null);
    });

    return () => {
      cancelled = true;
    };
  }, [activeModal]);

  useEffect(() => {
    if (!filteredCategories.length) {
      setCategoryId('');
      return;
    }
    if (!filteredCategories.some((c) => c.id === categoryId)) {
      setCategoryId(filteredCategories[0].id);
    }
  }, [filteredCategories, categoryId]);

  if (shouldHide) return null;

  const resetAndClose = () => {
    setActiveModal(null);
    setLauncherOpen(false);
    setAmount('');
    setDescription('');
    setEntryType('EXPENSE');
    setDate(formatDateInput(new Date()));
    setError(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || Number(amount) <= 0) {
      setError('Enter a valid amount greater than zero.');
      return;
    }

    if (!categoryId) {
      setError('Choose a category.');
      return;
    }

    if (!description.trim()) {
      setError('Add a short description.');
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await addTransaction({
        amount,
        categoryId,
        description,
        entryType,
        date,
        periodId,
      });

      if (!result.success) {
        setError(result.error ?? 'Could not save entry.');
        return;
      }

      resetAndClose();
      setToast('Quick entry saved');
      setTimeout(() => setToast(null), 2600);
      router.refresh();
    });
  };

  return (
    <>
      {toast && (
        <div className="fixed bottom-28 left-4 right-4 z-[70] max-w-screen-sm mx-auto pointer-events-none">
          <div className="rounded-lg px-4 py-3 text-sm font-medium text-white bg-emerald-600 shadow-lg border border-emerald-500">
            {toast}
          </div>
        </div>
      )}

      {launcherOpen && (
        <div className="fixed right-5 bottom-40 z-[65] flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => {
              setLauncherOpen(false);
              setActiveModal('quick');
              setEntryType('EXPENSE');
            }}
            className="inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-[#232323] px-3 py-2 text-xs font-semibold text-gray-100 shadow-md"
          >
            <Zap size={14} className="text-amber-300" />
            Quick Add
          </button>
          <button
            type="button"
            onClick={() => {
              setLauncherOpen(false);
              setActiveModal('detailed');
            }}
            className="inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-[#232323] px-3 py-2 text-xs font-semibold text-gray-100 shadow-md"
          >
            <SlidersHorizontal size={14} className="text-amber-300" />
            Detailed Add
          </button>
        </div>
      )}

      <button
        type="button"
        aria-label="Open add options"
        onClick={() => setLauncherOpen((prev) => !prev)}
        className="fixed right-5 bottom-24 z-[60] h-14 w-14 rounded-full text-white border border-amber-300/60 shadow-[0_14px_26px_-14px_rgba(245,158,11,0.9)] bg-[#232323] flex items-center justify-center active:scale-95"
      >
        {launcherOpen ? <X size={22} /> : <Plus size={24} />}
      </button>

      {activeModal && (
        <div className="fixed inset-0 z-[80]">
          <button
            type="button"
            aria-label="Close quick add"
            className="absolute inset-0 bg-black/45"
            onClick={resetAndClose}
          />

          <div className="absolute inset-x-0 bottom-0 max-w-screen-sm mx-auto rounded-t-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 pb-6 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">{activeModal === 'quick' ? 'Quick Add' : 'Detailed Add'}</h3>
              <button
                type="button"
                aria-label="Close quick add panel"
                title="Close quick add panel"
                onClick={resetAndClose}
                className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              {activeModal === 'detailed' && (
                <div className="grid grid-cols-3 gap-2">
                  {(['EXPENSE', 'INCOME', 'SAVINGS'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setEntryType(type)}
                      className={`rounded-lg py-2 text-xs font-semibold border transition-colors ${
                        entryType === type
                          ? type === 'INCOME'
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : type === 'SAVINGS'
                            ? 'bg-sky-600 text-white border-sky-500'
                            : 'bg-amber-700 text-white border-amber-600'
                          : 'bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {type === 'EXPENSE' ? 'Expense' : type === 'INCOME' ? 'Income' : 'Savings'}
                    </button>
                  ))}
                </div>
              )}

              <div className={`grid gap-2 ${activeModal === 'detailed' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount"
                  className="input-field"
                  required
                />
                {activeModal === 'detailed' && (
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    aria-label="Entry date"
                    title="Entry date"
                    className="input-field"
                  />
                )}
              </div>

              <select
                className="input-field"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                aria-label="Category"
                title="Category"
                required
              >
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description"
                className="input-field"
                required
              />

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn-primary w-full"
                >
                  {isPending ? 'Saving...' : activeModal === 'quick' ? 'Save Quick Entry' : 'Save Detailed Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
