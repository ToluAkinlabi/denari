import { DashboardContent } from '@/components/dashboard';
import { getDashboardData } from '@/app/actions/dashboard';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard - Denari',
  description: 'Your financial overview at a glance',
};

export default async function DashboardPage() {
  const dashboard = await getDashboardData({ includeProjection: true });

  if (!dashboard.success || !dashboard.data) {
    return (
      <div className="max-w-screen-sm mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted mt-2">{dashboard.error ?? 'Could not load dashboard data.'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-screen-sm mx-auto px-4 py-6">
      <DashboardContent data={dashboard.data} />
    </div>
  );
}
