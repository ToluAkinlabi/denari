import { Card } from '@/components/card';
import { Bell, Moon, HelpCircle, LogOut } from 'lucide-react';
import { SettingsDataActions } from '@/app/components/settings-data-actions';
import { SettingsBankConnection } from '@/app/components/settings-bank-connection';
import { DemoModeToggle } from '@/app/components/demo-mode-toggle';
import { DenariMark } from '@/components/denari-mark';
import { PageHero } from '@/app/components/page-hero';
import { getDemoModeEnabled } from '@/app/actions/settings';

export default async function SettingsPage() {
  const demoMode = await getDemoModeEnabled();

  return (
    <div className="max-w-screen-sm mx-auto px-4 py-6">
      <div className="space-y-6 pb-10">
        <PageHero title="Settings" description="Manage Denari's preferences, connected bank data, and daily operating defaults." />

        <Card className="overflow-hidden border-slate-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(29,78,216,0.94),rgba(15,118,110,0.9))] p-5 text-white">
          <div className="flex items-center justify-between gap-4">
            <DenariMark
              showLabel
              markClassName="h-12 w-12 rounded-2xl bg-white/10 ring-1 ring-white/20"
              labelClassName="text-white"
            />
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.22em] text-amber-200">Denari Profile</p>
              <p className="mt-1 text-sm text-blue-100">Brand, preferences, connected data, and finance workflow settings.</p>
            </div>
          </div>
        </Card>

        <div>
          <h3 className="text-sm font-semibold mb-2 text-muted uppercase">Demo Mode</h3>
          <DemoModeToggle initialEnabled={demoMode.success ? demoMode.data?.enabled ?? false : false} />
        </div>

        {/* Appearance */}
        <div>
          <h3 className="text-sm font-semibold mb-2 text-muted uppercase">Appearance</h3>
          <Card className="p-4">
            <div className="w-full flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-800 last:border-0">
              <div className="flex items-center gap-3">
                <Moon size={20} className="text-gray-600 dark:text-gray-400" />
                <span>Dark Mode</span>
              </div>
              <label className="sr-only" htmlFor="settings-dark-mode">Dark Mode</label>
              <input id="settings-dark-mode" type="checkbox" defaultChecked className="w-5 h-5" />
            </div>
          </Card>
        </div>

        {/* Notifications */}
        <div>
          <h3 className="text-sm font-semibold mb-2 text-muted uppercase">Notifications</h3>
          <Card className="p-4">
            <div className="w-full flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-800 last:border-0">
              <div className="flex items-center gap-3">
                <Bell size={20} className="text-gray-600 dark:text-gray-400" />
                <span>Period Reminders</span>
              </div>
              <label className="sr-only" htmlFor="settings-period-reminders">Period Reminders</label>
              <input id="settings-period-reminders" type="checkbox" defaultChecked className="w-5 h-5" />
            </div>
          </Card>
        </div>

        {/* Bank Connection */}
        <SettingsBankConnection demoMode={demoMode.success ? demoMode.data?.enabled ?? false : false} />

        <SettingsDataActions />

        {/* Support */}
        <div>
          <h3 className="text-sm font-semibold mb-2 text-muted uppercase">Support</h3>
          <Card className="p-4">
            <button className="w-full flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <HelpCircle size={20} className="text-gray-600 dark:text-gray-400" />
                <span>Help & Feedback</span>
              </div>
              <span className="text-xl">→</span>
            </button>
            <button className="w-full flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm">v1.0.0</span>
              </div>
              <span className="text-xs text-muted">Version</span>
            </button>
          </Card>
        </div>

        {/* Logout */}
        <button className="w-full py-3 px-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg font-medium flex items-center justify-center gap-2">
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
