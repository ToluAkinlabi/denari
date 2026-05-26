import { AddEntryClient } from '@/components/add-entry-client';
import { getAddEntryOptions } from '@/app/actions/transactions';
import { PageHero } from '@/app/components/page-hero';

export default async function AddPage() {
  const options = await getAddEntryOptions();

  if (!options.success || !options.data) {
    return (
      <div className="max-w-screen-sm mx-auto px-4 py-6">
        <PageHero title="Add Entry" description="Capture income, spending, or savings transfers quickly without losing period context." />
        <p className="text-muted mt-2">{options.error ?? 'Could not load categories and period.'}</p>
      </div>
    );
  }

  return (
    <AddEntryClient
      periodId={options.data.periodId}
      categories={options.data.categories}
    />
  );
}
