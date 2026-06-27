import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [data, setData] = useState<DashboardData>(initialData ?? dashboardFixture);
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings>(defaultDashboardSettings);
  const [pendingMonthKey, setPendingMonthKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const monthCache = useRef(new Map<string, DashboardData>([[data.period.key, data]]));
  const monthRequests = useRef(new Map<string, Promise<DashboardData>>());

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

  const prefetchMonth = useCallback(async (monthKey: string) => {
    const cached = monthCache.current.get(monthKey);
    if (cached) {
      return cached;
    }

    const existing = monthRequests.current.get(monthKey);
    if (existing) {
      return existing;
    }

    const request = fetch(`/api/dashboard.json?month=${encodeURIComponent(monthKey)}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Month ${monthKey} returned HTTP ${response.status}`);
        }
        return response.json() as Promise<DashboardData>;
      })
      .then((nextData) => {
        monthCache.current.set(nextData.period.key, nextData);
        return nextData;
      })
      .finally(() => {
        monthRequests.current.delete(monthKey);
      });

    monthRequests.current.set(monthKey, request);
    return request;
  }, []);

  const prefetchMonthSilently = useCallback(
    (monthKey: string) => {
      void prefetchMonth(monthKey).catch(() => undefined);
    },
    [prefetchMonth],
  );

  const navigateToMonth = useCallback(
    async (monthKey: string, href: string, updateHistory = true) => {
      if (monthKey === data.period.key) {
        if (updateHistory && window.location.pathname !== href) {
          window.history.pushState({ monthKey }, '', href);
        }
        return;
      }

      setPendingMonthKey(monthKey);
      setLoadError(null);

      try {
        const nextData = await prefetchMonth(monthKey);
        setData(nextData);
        setActiveTab('month');
        if (updateHistory) {
          window.history.pushState({ monthKey }, '', href);
        }
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Month load failed');
      } finally {
        setPendingMonthKey(null);
      }
    },
    [data.period.key, prefetchMonth],
  );

  useEffect(() => {
    monthCache.current.set(data.period.key, data);
    const activeIndex = data.period.history.findIndex((month) => month.key === data.period.key);
    const nearbyMonths = [data.period.history[activeIndex - 1], data.period.history[activeIndex + 1]].filter(
      (month): month is DashboardData['period']['history'][number] => Boolean(month),
    );

    if (window.requestIdleCallback) {
      window.requestIdleCallback(() => {
        for (const month of nearbyMonths) {
          prefetchMonthSilently(month.key);
        }
      });
      return;
    }

    window.setTimeout(() => {
      for (const month of nearbyMonths) {
        prefetchMonthSilently(month.key);
      }
    }, 250);
  }, [data, prefetchMonthSilently]);

  useEffect(() => {
    function handlePopState() {
      const match = window.location.pathname.match(/^\/months\/(\d{4}-\d{2})$/);
      const monthKey = match?.[1] ?? monthCache.current.get(data.period.key)?.period.history[0]?.key;
      const href = match ? window.location.pathname : '/';
      if (monthKey) {
        void navigateToMonth(monthKey, href, false);
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [data.period.key, navigateToMonth]);

  function updateDashboardSettings(next: DashboardSettings) {
    setDashboardSettings(next);
    window.localStorage.setItem(dashboardSettingsKey, JSON.stringify(next));
  }

  return (
    <main aria-busy={pendingMonthKey !== null} className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="top-bar">
          <div>
            <h1>Finances</h1>
          </div>
          <div className="top-actions">
            {loadError && <span className="load-error">{loadError}</span>}
            <span className={pendingMonthKey ? 'period-pill loading' : 'period-pill'}>
              {pendingMonthKey ? 'Loading' : data.period.label}
            </span>
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
                pendingMonthKey={pendingMonthKey}
                onMonthPrefetch={prefetchMonthSilently}
                onMonthSelect={(monthKey, href) => {
                  void navigateToMonth(monthKey, href);
                }}
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
