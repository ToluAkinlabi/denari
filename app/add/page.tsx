import { AddEntryClient } from '@/components/add-entry-client';
import { getAddEntryOptions } from '@/app/actions/transactions';

export default async function AddPage() {
  const options = await getAddEntryOptions();

  if (!options.success || !options.data) {
    return (
      <div className="max-w-screen-sm mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold">Add Entry</h1>
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
