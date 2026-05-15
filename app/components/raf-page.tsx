'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, RefreshCw, RotateCcw } from 'lucide-react';
import { Card } from './card';
import type { RafPageData } from '@/app/actions/raf';
import { applyRafTransferSuggestion, undoRafTransfer } from '@/app/actions/settings';

interface RafPageContentProps {
  data: RafPageData;
}

function formatTransferTimestampUtc(isoString: string) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'Invalid date';

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes} UTC`;
}

function getBucketFillWidthClass(fillPct: number, hasNoAllocation: boolean) {
  if (hasNoAllocation) {
    return 'w-full';
  }

  if (fillPct >= 100) return 'w-full';
  if (fillPct >= 90) return 'w-[90%]';
  if (fillPct >= 80) return 'w-[80%]';
  if (fillPct >= 70) return 'w-[70%]';
  if (fillPct >= 60) return 'w-[60%]';
  if (fillPct >= 50) return 'w-[50%]';
  if (fillPct >= 40) return 'w-[40%]';
  if (fillPct >= 30) return 'w-[30%]';
  if (fillPct >= 20) return 'w-[20%]';
  if (fillPct >= 10) return 'w-[10%]';
  return 'w-[2%]';
}

export function RafPageContent({ data }: RafPageContentProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState('');

  // Transfer form state
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [transferAmt, setTransferAmt] = useState('');

  const income = Number(data.income);
  const allocationBase = Number(data.allocationBase);
  const buckets = data.raf.buckets;

  const fromBucket = data.categories.find((c) => c.id === fromId);
  const toBucket = data.categories.find((c) => c.id === toId);

  // Derive remaining per bucket (from raf plan)
  const bucketByName = new Map(buckets.map((b) => [b.name, b]));
  const fromRafBucket = fromBucket ? bucketByName.get(fromBucket.name) : undefined;
  const fromSurplus = fromRafBucket ? Math.max(0, Number(fromRafBucket.remaining)) : 0;

  const handleTransfer = () => {
    if (!fromBucket || !toBucket) {
      setStatus('Select both buckets.');
      return;
    }
    if (fromBucket.id === toBucket.id) {
      setStatus('Choose different buckets.');
      return;
    }
    const amount = Number(transferAmt);
    if (!amount || amount <= 0) {
      setStatus('Enter a valid amount.');
      return;
    }
    if (allocationBase <= 0) {
      setStatus('No income or carry-forward available this period.');
      return;
    }
    if (amount > fromSurplus + 0.01) {
      setStatus(`Max transfer from ${fromBucket.name} is $${fromSurplus.toFixed(2)} (current surplus).`);
      return;
    }

    startTransition(async () => {
      setStatus('');
      const result = await applyRafTransferSuggestion({
        fromBucketName: fromBucket.name,
        toBucketName: toBucket.name,
        transferAmount: amount,
      });

      if (!result.success) {
        setStatus(result.error ?? 'Transfer failed.');
        return;
      }

      setStatus(`Moved $${result.data?.movedAmount?.toFixed(2) ?? amount.toFixed(2)} from ${fromBucket.name} to ${toBucket.name}.`);
      setTransferAmt('');
      router.refresh();
    });
  };

  const handleUndoTransfer = (transferId: string) => {
    startTransition(async () => {
      const result = await undoRafTransfer({ transferId });

      if (!result.success) {
        setStatus(result.error ?? 'Could not undo transfer.');
        return;
      }

      setStatus('Transfer undone. Bucket balances restored for this period.');
      router.refresh();
    });
  };

  const bucketStatusColor = (status: string) => {
    if (status === 'EXHAUSTED') return 'text-red-300';
    if (status === 'AT_RISK') return 'text-amber-300';
    return 'text-emerald-300';
  };

  const bucketBarColor = (status: string) => {
    if (status === 'EXHAUSTED') return 'bg-red-500';
    if (status === 'AT_RISK') return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="max-w-screen-sm mx-auto px-4 pt-6 pb-8 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Resource Allocation</h1>
        <p className="text-sm text-muted mt-0.5">Period #{data.periodIndex} · {data.periodRange}</p>
      </div>

      {/* Allocation anchor */}
      <Card className="p-4">
        <p className="text-xs text-muted uppercase tracking-wide mb-1">RAF Allocation Base</p>
        {data.hasIncome ? (
          <>
            <p className={`text-3xl font-bold ${Number(data.allocationBase) >= 0 ? 'text-emerald-400' : 'text-red-300'}`}>
              ${data.allocationBase}
            </p>
            <p className="text-xs text-muted mt-1">
              {data.isReconciled
                ? `Anchored to actual closing balance ${data.carryForward} · ${data.periodProgressPercent}% of period elapsed`
                : `Income ${data.income} + carry forward ${data.carryForward} · ${data.periodProgressPercent}% of period elapsed`}
            </p>
          </>
        ) : (
          <div>
            <p className="text-2xl font-bold text-red-300">${data.allocationBase}</p>
            <p className="text-xs text-amber-300 mt-1">
              Allocation base is not positive. Add income or improve carry forward to restore spendable RAF buckets.
            </p>
          </div>
        )}
      </Card>

      {/* All buckets */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-200">Buckets</h2>
          <span className="text-[10px] text-muted px-2 py-0.5 rounded border border-gray-700">
            {data.raf.profileSource === 'DEFAULT' ? 'Default profile' : 'Configured'}
          </span>
        </div>
        <div className="space-y-2">
          {buckets.map((bucket) => {
            const spent = Number(bucket.spent);
            const allocated = Number(bucket.allocated);
            const remaining = Number(bucket.remaining);
            const hasNoAllocation = allocated <= 0;
            const fillPct = hasNoAllocation ? 100 : Math.min(100, Math.max(0, (spent / allocated) * 100));
            const fillClass = hasNoAllocation ? 'bg-slate-500/70' : bucketBarColor(bucket.status);
            const widthClass = getBucketFillWidthClass(fillPct, hasNoAllocation);
            const isFixedCap = bucket.name === 'Rent';
            const perPeriod = Math.round(allocated);
            const pctDisplay = `${parseFloat(bucket.percent).toFixed(1)}%`;
            const bucketSubtitle = hasNoAllocation
              ? '—'
              : `${isFixedCap ? `$${perPeriod}` : `~$${perPeriod}`} · ${pctDisplay} of period`;

            return (
              <Card key={bucket.categoryId} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold">{bucket.name}</p>
                    <p className="text-[11px] text-muted">{bucketSubtitle}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${bucketStatusColor(bucket.status)}`}>
                      {remaining >= 0 ? `$${remaining.toFixed(2)} left` : `-$${Math.abs(remaining).toFixed(2)} over`}
                    </p>
                    <p className="text-[11px] text-muted">${spent.toFixed(2)} of ${allocated.toFixed(2)}</p>
                  </div>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${fillClass} ${widthClass}`}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Totals row */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg border border-gray-700 px-2 py-2">
          <p className="text-muted">Allocated</p>
          <p className="font-semibold text-emerald-400">${data.raf.allocated}</p>
        </div>
        <div className="rounded-lg border border-gray-700 px-2 py-2">
          <p className="text-muted">Unallocated</p>
          <p className="font-semibold text-amber-300">${data.raf.unallocated}</p>
        </div>
        <div className="rounded-lg border border-gray-700 px-2 py-2">
          <p className="text-muted">Over</p>
          <p className="font-semibold text-red-300">${data.raf.overallocated}</p>
        </div>
      </div>

      {/* Manual transfer */}
      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-semibold">Move Funds Between Buckets</h2>
        <p className="text-xs text-muted">
          Shift budget from a bucket with surplus to one that needs more.
          This move is period-only and keeps your base RAF % profile unchanged.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="raf-transfer-from" className="text-[11px] text-muted block mb-1">From</label>
            <select
              id="raf-transfer-from"
              name="rafTransferFrom"
              className="w-full rounded-lg border border-gray-700 bg-[#2a2a2a] text-sm px-2 py-2 text-gray-100"
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
            >
              <option value="">— bucket —</option>
              {data.categories.map((c) => {
                const b = bucketByName.get(c.name);
                const surplus = b ? Math.max(0, Number(b.remaining)) : 0;
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} (+${surplus.toFixed(0)} surplus)
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label htmlFor="raf-transfer-to" className="text-[11px] text-muted block mb-1">To</label>
            <select
              id="raf-transfer-to"
              name="rafTransferTo"
              className="w-full rounded-lg border border-gray-700 bg-[#2a2a2a] text-sm px-2 py-2 text-gray-100"
              value={toId}
              onChange={(e) => setToId(e.target.value)}
            >
              <option value="">— bucket —</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="raf-transfer-amount" className="text-[11px] text-muted block mb-1">
            Amount ($) {fromSurplus > 0 && fromBucket ? `· max $${fromSurplus.toFixed(2)}` : ''}
          </label>
          <input
            id="raf-transfer-amount"
            name="rafTransferAmount"
            type="number"
            min="0"
            step="10"
            max={fromSurplus || undefined}
            value={transferAmt}
            onChange={(e) => setTransferAmt(e.target.value)}
            placeholder="e.g. 200"
            className="w-full rounded-lg border border-gray-700 bg-[#2a2a2a] text-sm px-3 py-2 text-gray-100 placeholder-gray-500"
          />
        </div>

        {fromBucket && toBucket && fromBucket.id !== toBucket.id && Number(transferAmt) > 0 && income > 0 && (
          <div className="rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-300">
            <ArrowRight size={12} className="inline mr-1 text-sky-400" />
            Move <span className="font-semibold text-sky-300">${Number(transferAmt).toFixed(2)}</span> from{' '}
            <span className="font-semibold">{fromBucket.name}</span> →{' '}
            <span className="font-semibold">{toBucket.name}</span>
            <span className="text-gray-400"> (period-only reallocation)</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleTransfer}
          disabled={isPending || !fromId || !toId || !transferAmt}
          className="w-full py-2.5 rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <RefreshCw size={14} className={isPending ? 'animate-spin' : ''} />
          {isPending ? 'Applying...' : 'Transfer Funds'}
        </button>

        {status && (
          <p className={`text-xs ${status.startsWith('Moved') ? 'text-emerald-300' : 'text-amber-300'}`}>
            {status}
          </p>
        )}
      </Card>

      {/* Transfer history */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Transfer History</h2>
          <span className="text-[11px] text-muted">Current period only</span>
        </div>

        {data.transfers.length === 0 ? (
          <p className="text-xs text-muted">No transfers yet this period.</p>
        ) : (
          <div className="space-y-2">
            {[...data.transfers]
              .reverse()
              .map((transfer) => (
                <div
                  key={transfer.id}
                  className="rounded-lg border border-gray-700 px-3 py-2 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-xs text-gray-100">
                      <span className="font-semibold">${Number(transfer.amount).toFixed(2)}</span>{' '}
                      {transfer.fromCategoryName} to {transfer.toCategoryName}
                    </p>
                    <p className="text-[11px] text-muted">
                      {formatTransferTimestampUtc(transfer.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUndoTransfer(transfer.id)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-600 px-2 py-1 text-[11px] text-gray-100 hover:bg-gray-800 disabled:opacity-50"
                  >
                    <RotateCcw size={12} />
                    Undo
                  </button>
                </div>
              ))}
          </div>
        )}
      </Card>

      {/* Warnings */}
      {data.raf.warnings.filter((w) => !w.startsWith('Consider')).length > 0 && (
        <Card className="p-3 border-yellow-700/40 bg-yellow-950/20">
          <p className="text-xs font-semibold text-yellow-200 mb-1">Notes</p>
          <ul className="space-y-1">
            {data.raf.warnings
              .filter((w) => !w.startsWith('Consider'))
              .map((w) => (
                <li key={w} className="text-xs text-yellow-100">• {w}</li>
              ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
