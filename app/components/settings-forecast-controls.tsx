'use client';

import { useMemo, useState, useTransition } from 'react';
import type { ForecastStrategy } from '@prisma/client';
import { Card } from '@/app/components/card';
import { updateCategoryForecastSetting } from '@/app/actions/settings';

type CategoryForecastSetting = {
  id: string;
  name: string;
  defaultStrategy: ForecastStrategy;
  expectedFrequency: string;
  isDiscretionary: boolean;
  rafPercent: number;
  countsAsExpense: boolean;
  countsAsSavings: boolean;
  type: string;
};

type Props = {
  initialSettings: CategoryForecastSetting[];
};

const STRATEGIES: ForecastStrategy[] = [
  'KNOWN_RECURRING',
  'KNOWN_VARIABLE',
  'KNOWN_IRREGULAR',
  'UNKNOWN',
  'ONE_TIME',
];

const FREQUENCIES = ['BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'ANNUAL', 'VARIABLE'];

function strategyLabel(strategy: ForecastStrategy) {
  return strategy.replace(/_/g, ' ');
}

export function SettingsForecastControls({ initialSettings }: Props) {
  const [isPending, startTransition] = useTransition();
  const [settings, setSettings] = useState(initialSettings);
  const [status, setStatus] = useState<string>('');

  const forecastCategories = useMemo(
    () => settings.filter((s) => s.countsAsExpense || s.countsAsSavings || s.type === 'INCOME'),
    [settings]
  );

  const onUpdate = (
    categoryId: string,
    patch: Partial<
      Pick<CategoryForecastSetting, 'defaultStrategy' | 'expectedFrequency' | 'isDiscretionary' | 'rafPercent'>
    >
  ) => {
    setSettings((prev) => prev.map((item) => (item.id === categoryId ? { ...item, ...patch } : item)));

    const current = settings.find((item) => item.id === categoryId);
    if (!current) return;

    const next = {
      ...current,
      ...patch,
    };

    startTransition(async () => {
      const result = await updateCategoryForecastSetting({
        categoryId,
        defaultStrategy: next.defaultStrategy,
        expectedFrequency: next.expectedFrequency,
        isDiscretionary: next.isDiscretionary,
        rafPercent: next.rafPercent,
      });

      if (!result.success) {
        setStatus(result.error || 'Could not save setting');
        return;
      }

      setStatus(`Saved ${next.name}`);
    });
  };

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2 text-muted uppercase">Forecast Tuning and RAF</h3>
      <Card className="p-4 space-y-3">
        <p className="text-xs text-muted">
          Strategy controls affect forecast behavior. RAF percentages control how income is pre-assigned to each category.
        </p>

        {forecastCategories.map((item) => (
          <div key={item.id} className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-sm">{item.name}</p>
              <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-muted">
                {item.type}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <label className="text-xs text-muted">
                Strategy
                <select
                  className="mt-1 w-full rounded border border-gray-300 dark:border-gray-700 bg-transparent px-2 py-1 text-sm"
                  value={item.defaultStrategy}
                  onChange={(e) =>
                    onUpdate(item.id, {
                      defaultStrategy: e.target.value as ForecastStrategy,
                    })
                  }
                  disabled={isPending}
                >
                  {STRATEGIES.map((strategy) => (
                    <option key={strategy} value={strategy}>
                      {strategyLabel(strategy)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-muted">
                Expected Frequency
                <select
                  className="mt-1 w-full rounded border border-gray-300 dark:border-gray-700 bg-transparent px-2 py-1 text-sm"
                  value={item.expectedFrequency}
                  onChange={(e) =>
                    onUpdate(item.id, {
                      expectedFrequency: e.target.value,
                    })
                  }
                  disabled={isPending}
                >
                  {FREQUENCIES.map((freq) => (
                    <option key={freq} value={freq}>
                      {freq}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-xs text-muted mt-5 md:mt-6">
                <input
                  type="checkbox"
                  checked={item.isDiscretionary}
                  onChange={(e) =>
                    onUpdate(item.id, {
                      isDiscretionary: e.target.checked,
                    })
                  }
                  disabled={isPending}
                />
                Discretionary
              </label>

              <label className="text-xs text-muted">
                RAF %
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className="mt-1 w-full rounded border border-gray-300 dark:border-gray-700 bg-transparent px-2 py-1 text-sm"
                  value={item.rafPercent}
                  onChange={(e) =>
                    onUpdate(item.id, {
                      rafPercent: Number.parseFloat(e.target.value) || 0,
                    })
                  }
                  disabled={isPending}
                />
              </label>
            </div>
          </div>
        ))}

        <p className="text-xs text-muted">{isPending ? 'Saving...' : status || 'Ready'}</p>
      </Card>
    </div>
  );
}
