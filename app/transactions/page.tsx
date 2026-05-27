'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '@/components/card';
import {
  getTransactions,
  deleteTransaction,
  updateTransaction,
  getCurrentPeriodId,
} from '@/app/actions/transactions';
import {
  categorizeImportedTransaction,
  getBankReviewQueue,
  getPlaidConnectionStatus,
  restoreImportedTransaction,
  skipImportedTransaction,
  syncPlaidTransactions,
} from '@/app/actions/plaid';
import { formatDateDisplay } from '@/lib/utils';
import { Trash2, Edit2, X, Check } from 'lucide-react';
import { PageHero } from '@/app/components/page-hero';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  type: string;
  categoryName?: string;
  categoryId?: string;
}

interface BankQueueTransaction {
  id: string;
  date: string;
  amount: string;
  name: string;
  merchantName?: string;
  pending: boolean;
  reviewStatus: string;
  categoryId?: string;
  categoryName?: string;
  includeInRaf: boolean;
  duplicateCategoryCounts: Array<{ categoryId: string; categoryName: string; count: number }>;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPeriodId, setCurrentPeriodId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    amount: '',
    description: '',
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [recentlyAddedIds, setRecentlyAddedIds] = useState<Set<string>>(new Set());
  const [bankConnected, setBankConnected] = useState(false);
  const [bankQueue, setBankQueue] = useState<BankQueueTransaction[]>([]);
  const [bankCategories, setBankCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [bankStatus, setBankStatus] = useState<string | null>(null);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankCategorySelections, setBankCategorySelections] = useState<Record<string, string>>({});
  const hasHydratedOnce = useRef(false);
  const seenTransactionIds = useRef<Set<string>>(new Set());

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const loadTransactionPage = useCallback(async (periodId: string, page: number) => {
    setLoading(true);
    try {
      const offset = (page - 1) * ITEMS_PER_PAGE;
      const response = await getTransactions(periodId, {
        limit: ITEMS_PER_PAGE,
        offset,
      });
      if (response.success && response.data) {
        const nextIds = new Set(response.data.transactions.map((tx) => tx.id));

        if (!hasHydratedOnce.current) {
          hasHydratedOnce.current = true;
          seenTransactionIds.current = nextIds;
        } else {
          const newlyVisible = [...nextIds].filter((id) => !seenTransactionIds.current.has(id));
          if (newlyVisible.length > 0) {
            setRecentlyAddedIds((prev) => {
              const merged = new Set(prev);
              newlyVisible.forEach((id) => merged.add(id));
              return merged;
            });

            setTimeout(() => {
              setRecentlyAddedIds((prev) => {
                const next = new Set(prev);
                newlyVisible.forEach((id) => next.delete(id));
                return next;
              });
            }, 7000);
          }

          seenTransactionIds.current = nextIds;
        }

        setTransactions(response.data.transactions);
        setTotalCount(response.data.total);
        setError(null);
      } else {
        setError(response.error ?? 'Could not load transactions');
      }
    } catch {
      setError('Unexpected error loading transactions');
    }
    setLoading(false);
  }, []);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const periodResponse = await getCurrentPeriodId();
      if (!periodResponse.success || !periodResponse.data) {
        setError('Could not load current period');
        setLoading(false);
        return;
      }

      const periodId = periodResponse.data.periodId;
      setCurrentPeriodId(periodId);

      // Load first page
      await loadTransactionPage(periodId, 1);
      setCurrentPage(1);
    } catch {
      setError('Unexpected error loading transactions');
      setLoading(false);
    }
  }, [loadTransactionPage]);

  const loadBankQueue = useCallback(async () => {
    const [connection, queue] = await Promise.all([
      getPlaidConnectionStatus(),
      getBankReviewQueue(),
    ]);

    if (connection.success && connection.data) {
      setBankConnected(connection.data.connected);
    }

    if (queue.success && queue.data) {
      setBankQueue(queue.data.transactions);
      setBankCategories(queue.data.categories);
      const nextSelections: Record<string, string> = {};
      queue.data.transactions.forEach((tx) => {
        if (tx.categoryId) {
          nextSelections[tx.id] = tx.categoryId;
        }
      });
      setBankCategorySelections(nextSelections);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
    void loadBankQueue();
  }, [loadTransactions, loadBankQueue]);

  useEffect(() => {
    const refresh = () => {
      void loadTransactions();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };

    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [loadTransactions]);

  // Reload when page changes
  useEffect(() => {
    if (currentPeriodId && currentPage > 0) {
      loadTransactionPage(currentPeriodId, currentPage);
    }
  }, [currentPage, currentPeriodId, loadTransactionPage]);

  async function handleDelete(id: string) {
    const response = await deleteTransaction(id);
    if (response.success) {
      // Refresh list
      await loadTransactions();
      setDeleteConfirm(null);
    } else {
      alert(response.error ?? 'Could not delete transaction');
    }
  }

  function startEdit(transaction: Transaction) {
    setEditingId(transaction.id);
    setEditForm({
      amount: transaction.amount,
      description: transaction.description,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({ amount: '', description: '' });
  }

  async function saveEdit(id: string) {
    const response = await updateTransaction(id, {
      amount: editForm.amount,
      description: editForm.description,
    });

    if (response.success) {
      await loadTransactions();
      setEditingId(null);
      setEditForm({ amount: '', description: '' });
    } else {
      alert(response.error ?? 'Could not update transaction');
    }
  }

  if (loading) {
    return (
      <div className="max-w-screen-sm mx-auto px-4 py-6">
        <PageHero title="Transactions" description="Review cash activity, resolve bank imports, and keep the current period clean." />
        <p className="text-muted mt-2">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-screen-sm mx-auto px-4 py-6">
        <PageHero title="Transactions" description="Review cash activity, resolve bank imports, and keep the current period clean." />
        <p className="text-red-600 mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-screen-sm mx-auto px-4 py-6 pb-20">
      <div className="space-y-6">
        <PageHero title="Transactions" description="Manage current-period entries, review Plaid imports, and keep cashflow aligned." />

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Bank Review Queue</h2>
              <p className="text-xs text-muted">
                Pending items are included. Skip is reversible.
              </p>
            </div>
            <button
              type="button"
              disabled={!bankConnected || bankLoading}
              className="text-xs px-3 py-1.5 rounded-md bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white"
              onClick={async () => {
                setBankLoading(true);
                setBankStatus(null);
                const result = await syncPlaidTransactions();
                if (!result.success) {
                  setBankStatus(result.error ?? 'Could not sync bank transactions.');
                } else {
                  setBankStatus(
                    `Synced: +${result.data?.added ?? 0} added, ${result.data?.modified ?? 0} updated, ${result.data?.removed ?? 0} removed.`
                  );
                  await Promise.all([loadTransactions(), loadBankQueue()]);
                }
                setBankLoading(false);
              }}
            >
              {bankLoading ? 'Syncing...' : 'Sync Bank'}
            </button>
          </div>

          {!bankConnected ? (
            <p className="text-xs text-amber-300">No bank connected yet. Plaid Link UI is the next step.</p>
          ) : bankQueue.length === 0 ? (
            <p className="text-xs text-muted">No floating transactions to review.</p>
          ) : (
            <div className="space-y-2">
              {bankQueue.map((tx) => {
                const selectedCategoryId = bankCategorySelections[tx.id] ?? tx.categoryId ?? '';
                const duplicateMatch = tx.duplicateCategoryCounts.find((item) => item.categoryId === selectedCategoryId);
                return (
                  <div key={tx.id} className="rounded-lg border border-gray-700 px-3 py-2 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-100">{tx.merchantName || tx.name}</p>
                        <p className="text-xs text-muted">
                          {formatDateDisplay(tx.date)} • ${tx.amount}
                          {tx.pending ? ' • Pending' : ' • Posted'}
                        </p>
                        <p className="text-[11px] text-muted">
                          {tx.reviewStatus === 'SKIPPED'
                            ? 'Skipped (excluded from RAF)'
                            : tx.reviewStatus === 'UNASSIGNED'
                            ? 'Unassigned (included in RAF)'
                            : `Categorized: ${tx.categoryName ?? 'Unknown'}`}
                        </p>
                        {duplicateMatch && (
                          <p className="mt-1 inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
                            Possible duplicate: {duplicateMatch.count} existing {duplicateMatch.count === 1 ? 'entry' : 'entries'} in {duplicateMatch.categoryName}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={selectedCategoryId}
                        onChange={(e) =>
                          setBankCategorySelections((prev) => ({
                            ...prev,
                            [tx.id]: e.target.value,
                          }))
                        }
                        aria-label={`Select category for ${tx.merchantName || tx.name}`}
                        className="rounded-md border border-gray-700 bg-[#2a2a2a] text-xs px-2 py-1.5 text-gray-100"
                      >
                        <option value="">Select category</option>
                        {bankCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        className="text-xs px-2 py-1.5 rounded-md border border-emerald-700 text-emerald-300 hover:bg-emerald-950/30"
                        onClick={async () => {
                          if (!selectedCategoryId) {
                            setBankStatus('Choose a category first.');
                            return;
                          }
                          const result = await categorizeImportedTransaction({
                            transactionId: tx.id,
                            categoryId: selectedCategoryId,
                          });
                          if (!result.success) {
                            setBankStatus(result.error ?? 'Could not categorize transaction.');
                            return;
                          }
                          setBankStatus('Transaction categorized.');
                          await Promise.all([loadTransactions(), loadBankQueue()]);
                        }}
                      >
                        Categorize
                      </button>

                      {tx.reviewStatus === 'SKIPPED' ? (
                        <button
                          type="button"
                          className="text-xs px-2 py-1.5 rounded-md border border-sky-700 text-sky-300 hover:bg-sky-950/30"
                          onClick={async () => {
                            const result = await restoreImportedTransaction({ transactionId: tx.id });
                            if (!result.success) {
                              setBankStatus(result.error ?? 'Could not restore transaction.');
                              return;
                            }
                            setBankStatus('Transaction restored to Unassigned.');
                            await Promise.all([loadTransactions(), loadBankQueue()]);
                          }}
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="text-xs px-2 py-1.5 rounded-md border border-amber-700 text-amber-300 hover:bg-amber-950/30"
                          onClick={async () => {
                            const result = await skipImportedTransaction({ transactionId: tx.id });
                            if (!result.success) {
                              setBankStatus(result.error ?? 'Could not skip transaction.');
                              return;
                            }
                            setBankStatus('Transaction skipped (excluded from RAF).');
                            await Promise.all([loadTransactions(), loadBankQueue()]);
                          }}
                        >
                          Skip
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {bankStatus && <p className="text-xs text-muted">{bankStatus}</p>}
        </Card>

        {transactions.length === 0 ? (
          <Card className="p-6 text-center text-muted">
            <p>No transactions in this period yet.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {transactions.map((transaction) => {
              const isEditing = editingId === transaction.id;
              const isDeleting = deleteConfirm === transaction.id;
              const isRecentlyAdded = recentlyAddedIds.has(transaction.id);
              const typeColor =
                transaction.type === 'INCOME'
                  ? 'text-green-600'
                  : transaction.type === 'EXPENSE'
                  ? 'text-red-600'
                  : 'text-blue-600';

              return (
                <Card
                  key={transaction.id}
                  className={`p-4 transition-colors ${
                    isRecentlyAdded
                      ? 'border-emerald-300 bg-emerald-50/70 dark:bg-emerald-900/20'
                      : ''
                  }`}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editForm.description}
                              onChange={(e) =>
                                setEditForm({ ...editForm, description: e.target.value })
                              }
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                              placeholder="Description"
                            />
                            <input
                              type="number"
                              step="0.01"
                              value={editForm.amount}
                              onChange={(e) =>
                                setEditForm({ ...editForm, amount: e.target.value })
                              }
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                              placeholder="Amount"
                            />
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold truncate">{transaction.description}</h3>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 border border-blue-200 dark:border-blue-800 shrink-0 font-medium">
                                {transaction.type}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-sm text-slate-700 dark:text-slate-300">
                              <span>{formatDateDisplay(transaction.date)}</span>
                              {transaction.categoryName && (
                                <>
                                  <span>•</span>
                                  <span>{transaction.categoryName}</span>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      {!isEditing && (
                        <span className={`text-lg font-bold shrink-0 ${typeColor}`}>
                          {transaction.type === 'EXPENSE' ? '-' : '+'}${transaction.amount}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(transaction.id)}
                            className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors"
                            title="Save"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                            title="Cancel"
                          >
                            <X size={18} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(transaction)}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={18} />
                          </button>
                          {isDeleting ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleDelete(transaction.id)}
                                className="px-3 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-3 py-1 text-xs bg-gray-300 dark:bg-gray-600 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(transaction.id)}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
            {/* Pagination Controls */}
            {totalCount > 0 && (
              <div className="flex items-center justify-between gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="text-sm text-muted">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                  {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Previous
                  </button>
                    <span className="flex items-center text-sm text-muted px-2">
                      {currentPage}/{totalPages}
                    </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
