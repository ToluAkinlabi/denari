import { getRafPageData } from '@/app/actions/raf';
import { RafPageContent } from '@/app/components/raf-page';

export default async function RafPage() {
  const result = await getRafPageData();

  if (!result.success || !result.data) {
    return (
      <div className="max-w-screen-sm mx-auto px-4 pt-8">
        <p className="text-red-400 text-sm">{result.error ?? 'Unable to load RAF data.'}</p>
      </div>
    );
  }

  return <RafPageContent data={result.data} />;
}