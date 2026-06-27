import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Gauge, Layers3, ListChecks, Settings, ShieldCheck, type LucideIcon } from 'lucide-react';
import { dashboardFixture, type DashboardData } from '../data/fixtures';
import { AccountsView } from './accountsView';
import { defaultDashboardSettings, dashboardSettingsKey, type DashboardSettings } from './dashboardSettings';
import { ExpectedView } from './expectedView';
import { isVisibleMonthBudget, MonthView, paidObligationSummary } from './monthView';
import { ReviewView } from './reviewView';
import { SettingsView } from './settingsView';
import { TrustView } from './trustView';
import { budgetStatus, projectMonthEnd } from '../lib/money';

type TabId = 'month' | 'review' | 'money' | 'expected' | 'ops';
type ViewId = TabId | 'settings';

type Tab = {
  id: TabId;
  label: string;
  icon: LucideIcon;
};

const tabs: Tab[] = [
  { id: 'month', label: 'Month', icon: Gauge },
  { id: 'review', label: 'Review', icon: ListChecks },
  { id: 'money', label: 'Accounts', icon: Layers3 },
  { id: 'expected', label: 'Expected', icon: CalendarClock },
  { id: 'ops', label: 'Trust', icon: ShieldCheck },
];

export default function FinanceApp({ initialData }: { initialData?: DashboardData }) {
  const [activeTab, setActiveTab] = useState<ViewId>('month');
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings>(defaultDashboardSettings);
  const data = initialData ?? dashboardFixture;

  const monthBudgets = useMemo(() => data.budgets.filter(isVisibleMonthBudget), [data.budgets]);
  const activeSpend = useMemo(() => monthBudgets.reduce((sum, budget) => sum + budget.spent, 0), [monthBudgets]);
  const activeLimit = useMemo(() => monthBudgets.reduce((sum, budget) => sum + budget.limit, 0), [monthBudgets]);
  const paidObligations = useMemo(() => paidObligationSummary(data.expected.obligations), [data.expected.obligations]);
  const reviewCount = data.reviewItems.length;
  const atRiskBudgets = monthBudgets.filter((budget) => {
    const projected = projectMonthEnd(budget.spent, budget.daysElapsed, budget.totalDays);
    return budgetStatus(budget.spent, budget.limit, projected, budget.reviewQueue) === 'risk';
  }).length;

  useEffect(() => {
    const stored = window.localStorage.getItem(dashboardSettingsKey);
    if (!stored) {
      return;
    }

    try {
      setDashboardSettings({ ...defaultDashboardSettings, ...JSON.parse(stored) });
    } catch {
      window.localStorage.removeItem(dashboardSettingsKey);
    }
  }, []);

  function updateDashboardSettings(next: DashboardSettings) {
    setDashboardSettings(next);
    window.localStorage.setItem(dashboardSettingsKey, JSON.stringify(next));
  }

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="top-bar">
          <div>
            <h1>Finances</h1>
          </div>
          <div className="top-actions">
            <span className="period-pill">{data.period.label}</span>
            <button
              aria-label="Open dashboard settings"
              className={activeTab === 'settings' ? 'settings-button active' : 'settings-button'}
              onClick={() => setActiveTab('settings')}
              title="Dashboard settings"
              type="button"
            >
              <Settings size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="workspace">
          <nav className="tab-rail" aria-label="Dashboard sections">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  className={activeTab === tab.id ? 'tab-button active' : 'tab-button'}
                  type="button"
                  aria-pressed={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <section className="content-surface">
            {activeTab === 'month' && (
              <MonthView
                activeSpend={activeSpend}
                activeLimit={activeLimit}
                budgets={monthBudgets}
                cash={data.cash}
                comparison={data.comparison}
                dailySpend={data.dailySpend}
                dashboardSettings={dashboardSettings}
                paidObligations={paidObligations}
                period={data.period}
                reviewCount={reviewCount}
                riskBudgets={atRiskBudgets}
              />
            )}
            {activeTab === 'review' && <ReviewView items={data.reviewItems} />}
            {activeTab === 'money' && <AccountsView groups={data.moneyMap} />}
            {activeTab === 'expected' && <ExpectedView groups={data.expected} />}
            {activeTab === 'ops' && <TrustView ops={data.ops} />}
            {activeTab === 'settings' && <SettingsView settings={dashboardSettings} onChange={updateDashboardSettings} />}
          </section>
        </div>
      </div>
    </main>
  );
}
