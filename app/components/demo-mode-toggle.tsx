'use client';

import { useState, useTransition } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/card';
import { setDemoModeEnabled } from '@/app/actions/settings';

interface DemoModeToggleProps {
  initialEnabled: boolean;
}

export function DemoModeToggle({ initialEnabled }: DemoModeToggleProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState('');

  const toggle = () => {
    const nextEnabled = !enabled;
    setEnabled(nextEnabled);
    setStatus('');

    startTransition(async () => {
      const result = await setDemoModeEnabled({ enabled: nextEnabled });
      if (!result.success) {
        setEnabled(!nextEnabled);
        setStatus(result.error ?? 'Could not update demo mode.');
        return;
      }

      setStatus(nextEnabled ? 'Demo mode enabled. Real data is hidden.' : 'Demo mode disabled. Live data restored.');
      router.refresh();
    });
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className={enabled ? 'text-emerald-400' : 'text-gray-500'} />
            <p className="font-medium">Demo Mode</p>
          </div>
          <p className="text-xs text-muted mt-1">
            Show synthetic data throughout the app so you can demo Ledge without exposing your real finances.
          </p>
          {status && <p className="text-xs mt-2 text-emerald-300">{status}</p>}
        </div>

        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          className={`relative inline-flex h-7 w-14 items-center rounded-full border transition-colors ${
            enabled ? 'bg-emerald-600 border-emerald-500' : 'bg-gray-700 border-gray-600'
          } ${pending ? 'opacity-70' : ''}`}
          aria-label="Toggle demo mode"
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      {pending && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted">
          <RefreshCw size={12} className="animate-spin" />
          Updating demo mode...
        </div>
      )}
    </Card>
  );
}
