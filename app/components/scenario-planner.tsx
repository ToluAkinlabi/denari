'use client';

import { useState } from 'react';
import { Card } from '@/components/card';

interface ScenarioPlannerProps {
  baseIncome: number;
  baseSpending: number;
  baseSavings: number;
  title?: string;
}

export function ScenarioPlanner({
  baseIncome,
  baseSpending,
  baseSavings,
  title = 'Scenario Planner (What-If)',
}: ScenarioPlannerProps) {
  const [mode, setMode] = useState<'DELTA' | 'ABSOLUTE'>('DELTA');
  const [deltaScenario, setDeltaScenario] = useState({
    incomeDelta: '0',
    spendingDelta: '0',
    savingsDelta: '0',
  });
  const [absoluteScenario, setAbsoluteScenario] = useState({
    income: baseIncome.toFixed(2),
    spending: baseSpending.toFixed(2),
    savings: baseSavings.toFixed(2),
  });

  const incomeDelta = Number(deltaScenario.incomeDelta || 0);
  const spendingDelta = Number(deltaScenario.spendingDelta || 0);
  const savingsDelta = Number(deltaScenario.savingsDelta || 0);

  const likelyIncome =
    mode === 'DELTA' ? baseIncome + incomeDelta : Number(absoluteScenario.income || 0);
  const likelySpending =
    mode === 'DELTA' ? baseSpending + spendingDelta : Number(absoluteScenario.spending || 0);
  const likelySavings =
    mode === 'DELTA' ? baseSavings + savingsDelta : Number(absoluteScenario.savings || 0);
  const likelyWealth = likelyIncome - likelySpending;

  const worstIncome = likelyIncome * 0.9;
  const worstSpending = likelySpending * 1.1;
  const worstSavings = likelySavings * 0.95;
  const worstWealth = worstIncome - worstSpending;

  const bestIncome = likelyIncome * 1.1;
  const bestSpending = likelySpending * 0.9;
  const bestSavings = likelySavings * 1.05;
  const bestWealth = bestIncome - bestSpending;

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-4">{title}</h3>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-xs text-muted">
          {mode === 'DELTA'
            ? 'Delta mode: enter changes from your baseline totals.'
            : 'Absolute mode: enter the exact totals you expect this month.'}
        </p>
        <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setMode('DELTA')}
            className={`px-3 py-1 text-xs font-medium ${
              mode === 'DELTA'
                ? 'bg-sky-600 text-white'
                : 'bg-transparent text-gray-700 dark:text-gray-300'
            }`}
          >
            Delta
          </button>
          <button
            type="button"
            onClick={() => setMode('ABSOLUTE')}
            className={`px-3 py-1 text-xs font-medium ${
              mode === 'ABSOLUTE'
                ? 'bg-sky-600 text-white'
                : 'bg-transparent text-gray-700 dark:text-gray-300'
            }`}
          >
            Absolute
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {mode === 'DELTA' ? (
          <>
            <label className="text-xs text-muted">
              Income Delta ($)
              <input
                type="number"
                value={deltaScenario.incomeDelta}
                onChange={(e) =>
                  setDeltaScenario((prev) => ({ ...prev, incomeDelta: e.target.value }))
                }
                className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent text-sm"
              />
            </label>
            <label className="text-xs text-muted">
              Spending Delta ($)
              <input
                type="number"
                value={deltaScenario.spendingDelta}
                onChange={(e) =>
                  setDeltaScenario((prev) => ({ ...prev, spendingDelta: e.target.value }))
                }
                className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent text-sm"
              />
            </label>
            <label className="text-xs text-muted">
              Savings Delta ($)
              <input
                type="number"
                value={deltaScenario.savingsDelta}
                onChange={(e) =>
                  setDeltaScenario((prev) => ({ ...prev, savingsDelta: e.target.value }))
                }
                className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent text-sm"
              />
            </label>
          </>
        ) : (
          <>
            <label className="text-xs text-muted">
              Expected Income ($)
              <input
                type="number"
                value={absoluteScenario.income}
                onChange={(e) =>
                  setAbsoluteScenario((prev) => ({ ...prev, income: e.target.value }))
                }
                className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent text-sm"
              />
            </label>
            <label className="text-xs text-muted">
              Expected Spending ($)
              <input
                type="number"
                value={absoluteScenario.spending}
                onChange={(e) =>
                  setAbsoluteScenario((prev) => ({ ...prev, spending: e.target.value }))
                }
                className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent text-sm"
              />
            </label>
            <label className="text-xs text-muted">
              Expected Savings ($)
              <input
                type="number"
                value={absoluteScenario.savings}
                onChange={(e) =>
                  setAbsoluteScenario((prev) => ({ ...prev, savings: e.target.value }))
                }
                className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-transparent text-sm"
              />
            </label>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3">
          <p className="font-semibold text-red-700 dark:text-red-300 mb-1">Worst Case</p>
          <p>Income: ${worstIncome.toFixed(2)}</p>
          <p>Spending: ${worstSpending.toFixed(2)}</p>
          <p>Savings: ${worstSavings.toFixed(2)}</p>
          <p className="font-semibold">Wealth: ${worstWealth.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-3">
          <p className="font-semibold text-blue-700 dark:text-blue-300 mb-1">Likely</p>
          <p>Income: ${likelyIncome.toFixed(2)}</p>
          <p>Spending: ${likelySpending.toFixed(2)}</p>
          <p>Savings: ${likelySavings.toFixed(2)}</p>
          <p className="font-semibold">Wealth: ${likelyWealth.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-3">
          <p className="font-semibold text-green-700 dark:text-green-300 mb-1">Best Case</p>
          <p>Income: ${bestIncome.toFixed(2)}</p>
          <p>Spending: ${bestSpending.toFixed(2)}</p>
          <p>Savings: ${bestSavings.toFixed(2)}</p>
          <p className="font-semibold">Wealth: ${bestWealth.toFixed(2)}</p>
        </div>
      </div>
    </Card>
  );
}
