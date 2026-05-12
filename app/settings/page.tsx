import { Card } from '@/components/card';
import { Bell, Moon, HelpCircle, LogOut } from 'lucide-react';
import { getCategoryForecastSettings } from '@/app/actions/settings';
import { SettingsForecastControls } from '@/app/components/settings-forecast-controls';
import { SettingsDataActions } from '@/app/components/settings-data-actions';
import { SettingsBankConnection } from '@/app/components/settings-bank-connection';

export default async function SettingsPage() {
  const settingsResult = await getCategoryForecastSettings();
  const forecastSettings = settingsResult.success && settingsResult.data ? settingsResult.data : [];

  return (
    <div className="max-w-screen-sm mx-auto px-4 py-6">
      <div className="space-y-6 pb-10">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted">Preferences and data</p>
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
        <SettingsBankConnection />

        <SettingsDataActions />

        <SettingsForecastControls initialSettings={forecastSettings} />

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
