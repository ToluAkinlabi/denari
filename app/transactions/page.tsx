'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/card';
import {
  getTransactions,
  deleteTransaction,
  updateTransaction,
  getCurrentPeriodId,
} from '@/app/actions/transactions';
import { Trash2, Edit2, X, Check } from 'lucide-react';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  type: string;
  categoryName?: string;
  categoryId?: string;
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

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

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
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold">Transactions</h1>
        <p className="text-muted mt-2">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold">Transactions</h1>
        <p className="text-red-600 mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-20">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted">Manage entries for current period</p>
        </div>

        {transactions.length === 0 ? (
          <Card className="p-6 text-center text-muted">
            <p>No transactions in this period yet.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {transactions.map((transaction) => {
              const isEditing = editingId === transaction.id;
              const isDeleting = deleteConfirm === transaction.id;
              const typeColor =
                transaction.type === 'INCOME'
                  ? 'text-green-600'
                  : transaction.type === 'EXPENSE'
                  ? 'text-red-600'
                  : 'text-blue-600';

              return (
                <Card key={transaction.id} className="p-4">
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
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0">
                                {transaction.type}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-sm text-muted">
                              <span>{new Date(transaction.date).toLocaleDateString()}</span>
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
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-md text-sm transition-colors ${
                          currentPage === page
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
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
