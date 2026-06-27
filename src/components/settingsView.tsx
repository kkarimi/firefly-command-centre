import { Settings } from 'lucide-react';
import type { DashboardSettings } from './dashboardSettings';
import { ViewHeading } from './uiPrimitives';

export function SettingsView({
  settings,
  onChange,
}: {
  settings: DashboardSettings;
  onChange: (settings: DashboardSettings) => void;
}) {
  const rows: Array<{ key: keyof DashboardSettings; label: string; value: boolean }> = [
    { key: 'showSpend', label: 'Spend chart', value: settings.showSpend },
    { key: 'showCash', label: 'Cash signal', value: settings.showCash },
    { key: 'showFocus', label: 'Focus signal', value: settings.showFocus },
    { key: 'showCategories', label: 'Categories by default', value: settings.showCategories },
  ];

  return (
    <div className="view-stack">
      <ViewHeading icon={Settings} title="Settings" meta="First page" />
      <section className="settings-grid" aria-label="First page settings">
        {rows.map((row) => (
          <label className="setting-row" key={row.key}>
            <span>{row.label}</span>
            <input
              checked={row.value}
              onChange={(event) => onChange({ ...settings, [row.key]: event.currentTarget.checked })}
              type="checkbox"
            />
          </label>
        ))}
      </section>
    </div>
  );
}
