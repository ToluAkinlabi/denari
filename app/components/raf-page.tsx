'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { Card } from './card';
import type { RafPageData } from '@/app/actions/raf';
import { applyRafTransferSuggestion } from '@/app/actions/settings';

interface RafPageContentProps {
  data: RafPageData;
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
    if (income <= 0) {
      setStatus('No income logged this period.');
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
        income,
      });

      if (!result.success) {
        setStatus(result.error ?? 'Transfer failed.');
        return;
      }

      setStatus(`Moved ${result.data?.movedPercent}% from ${fromBucket.name} to ${toBucket.name}.`);
      setTransferAmt('');
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

      {/* Income anchor */}
      <Card className="p-4">
        <p className="text-xs text-muted uppercase tracking-wide mb-1">Period Income</p>
        {data.hasIncome ? (
          <>
            <p className="text-3xl font-bold text-emerald-400">${data.income}</p>
            <p className="text-xs text-muted mt-1">
              RAF split below is based on this income · {data.periodProgressPercent}% of period elapsed
            </p>
          </>
        ) : (
          <div>
            <p className="text-2xl font-bold text-gray-400">$0.00</p>
            <p className="text-xs text-amber-300 mt-1">No income logged yet. Log income to activate RAF allocation.</p>
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
            const fillPct = allocated > 0 ? Math.min(100, (spent / allocated) * 100) : 0;

            return (
              <Card key={bucket.categoryId} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold">{bucket.name}</p>
                    <p className="text-[11px] text-muted">{bucket.percent} of income</p>
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
                    className={`h-1.5 rounded-full ${bucketBarColor(bucket.status)}`}
                    style={{ width: `${fillPct}%` }}
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
          This updates your RAF % split permanently for this profile.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-muted block mb-1">From</label>
            <select
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
            <label className="text-[11px] text-muted block mb-1">To</label>
            <select
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
          <label className="text-[11px] text-muted block mb-1">
            Amount ($) {fromSurplus > 0 && fromBucket ? `· max $${fromSurplus.toFixed(2)}` : ''}
          </label>
          <input
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
            {income > 0 && (
              <span className="text-gray-400">
                {' '}(shifts ~{((Number(transferAmt) / income) * 100).toFixed(1)}%)
              </span>
            )}
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
