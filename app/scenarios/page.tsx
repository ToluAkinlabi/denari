'use client';

import { useEffect, useState } from 'react';
import { getMonthlyReport } from '@/app/actions/reports';
import { ScenarioPlanner } from '@/app/components/scenario-planner';
import { Card } from '@/components/card';
import { PageHero } from '@/app/components/page-hero';

export default function ScenariosPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baseline, setBaseline] = useState({ income: 0, spending: 0, savings: 0, monthLabel: '' });

  useEffect(() => {
    async function loadBaseline() {
      setLoading(true);
      const result = await getMonthlyReport(new Date());
      if (!result.success || !result.data) {
        setError(result.error ?? 'Could not load baseline report data.');
        setLoading(false);
        return;
      }

      setBaseline({
        income: Number(result.data.income),
        spending: Number(result.data.spending),
        savings: Number(result.data.savings),
        monthLabel: result.data.monthLabel,
      });
      setError(null);
      setLoading(false);
    }

    loadBaseline();
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <PageHero title="Scenarios" description="Pressure-test future decisions before they touch your real cash plan." />
        <p className="text-muted mt-2">Loading scenario baseline...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <PageHero title="Scenarios" description="Pressure-test future decisions before they touch your real cash plan." />
        <p className="text-muted mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-20 space-y-6">
      <PageHero title="Scenarios" description="Model what-if outcomes before you commit spending decisions or rework your RAF plan." />

      <Card className="p-4">
        <h3 className="font-semibold mb-2">Baseline</h3>
        <p className="text-xs text-muted mb-3">Current baseline source: {baseline.monthLabel}</p>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-muted">Income</p>
            <p className="font-semibold">${baseline.income.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted">Spending</p>
            <p className="font-semibold">${baseline.spending.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted">Savings</p>
            <p className="font-semibold">${baseline.savings.toFixed(2)}</p>
          </div>
        </div>
      </Card>

      <ScenarioPlanner
        baseIncome={baseline.income}
        baseSpending={baseline.spending}
        baseSavings={baseline.savings}
      />
    </div>
  );
}
