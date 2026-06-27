import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUpRight,
  ArrowUp,
  Banknote,
  CalendarClock,
  CheckCircle2,
  Clipboard,
  Copy,
  Gauge,
  GitBranch,
  Landmark,
  Layers3,
  ListChecks,
  Minus,
  PiggyBank,
  Settings,
  ShieldCheck,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import {
  commandCentreFixture,
  type Account,
  type BudgetCard,
  type CommandCentreData,
  type ExpectedEvent,
  type MonthComparison,
  type ReviewItem,
  type Tone,
} from '../data/fixtures';
import { budgetStatus, formatMoney, formatSignedMoney, percentUsed, projectMonthEnd, remainingBudget } from '../lib/money';

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

const toneLabels: Record<Tone, string> = {
  ok: 'Good',
  watch: 'Watch',
  risk: 'Risk',
  neutral: 'Info',
};

const statusLabels = {
  ok: 'On track',
  watch: 'Tight',
  risk: 'Overrun',
  review: 'Review',
};

type TrendDirection = 'up' | 'down' | 'flat';

type LensSignalModel = {
  kind: 'spend' | 'cash' | 'focus';
  label: string;
  value: string;
  detail: string;
  deltaLabel: string;
  tone: Tone;
  trend: TrendDirection;
  current: number;
  previous?: number;
};

type DashboardSettings = {
  showSpend: boolean;
  showCash: boolean;
  showFocus: boolean;
  showCategories: boolean;
};

const defaultDashboardSettings: DashboardSettings = {
  showSpend: true,
  showCash: false,
  showFocus: false,
  showCategories: false,
};

const dashboardSettingsKey = 'firefly-command-centre-dashboard-settings-v1';

function toneClass(tone: Tone | 'review') {
  return `tone-${tone}`;
}

export default function CommandCentre({ initialData }: { initialData?: CommandCentreData }) {
  const [activeTab, setActiveTab] = useState<ViewId>('month');
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings>(defaultDashboardSettings);
  const data = initialData ?? commandCentreFixture;

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
            {activeTab === 'money' && <MoneyMapView groups={data.moneyMap} />}
            {activeTab === 'expected' && <ExpectedView groups={data.expected} />}
            {activeTab === 'ops' && <OpsView ops={data.ops} />}
            {activeTab === 'settings' && (
              <SettingsView settings={dashboardSettings} onChange={updateDashboardSettings} />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function isVisibleMonthBudget(budget: BudgetCard) {
  return !budget.reviewQueue || budget.spent > 0 || budget.merchants.length > 0 || Boolean(budget.unusual);
}

function MonthView({
  activeSpend,
  activeLimit,
  budgets,
  cash,
  comparison,
  dailySpend,
  dashboardSettings,
  paidObligations,
  period,
  reviewCount,
  riskBudgets,
}: {
  activeSpend: number;
  activeLimit: number;
  budgets: BudgetCard[];
  cash: CommandCentreData['cash'];
  comparison?: MonthComparison;
  dailySpend: CommandCentreData['dailySpend'];
  dashboardSettings: DashboardSettings;
  paidObligations: { count: number; total: number };
  period: CommandCentreData['period'];
  reviewCount: number;
  riskBudgets: number;
}) {
  const [showBudgetDetails, setShowBudgetDetails] = useState(dashboardSettings.showCategories);
  const overallPercent = percentUsed(activeSpend, activeLimit);
  const planTone = planToneFor(overallPercent);
  const lensSignals = monthLensSignals({
    activeSpend,
    activeLimit,
    cash,
    comparison,
    paidObligations,
    period,
    reviewCount,
    riskBudgets,
  });
  const visibleSignals = lensSignals.filter((signal) => {
    if (signal.kind === 'cash') return dashboardSettings.showCash;
    if (signal.kind === 'focus') return dashboardSettings.showFocus;
    return false;
  });
  const sortedBudgets = [...budgets].sort((left, right) => {
    const leftStatus = budgetStatus(left.spent, left.limit, projectMonthEnd(left.spent, left.daysElapsed, left.totalDays), left.reviewQueue);
    const rightStatus = budgetStatus(
      right.spent,
      right.limit,
      projectMonthEnd(right.spent, right.daysElapsed, right.totalDays),
      right.reviewQueue,
    );
    const order = { review: 0, risk: 1, watch: 2, ok: 3 };
    return order[leftStatus] - order[rightStatus] || percentUsed(right.spent, right.limit) - percentUsed(left.spent, left.limit);
  });

  useEffect(() => {
    setShowBudgetDetails(dashboardSettings.showCategories);
  }, [dashboardSettings.showCategories]);

  return (
    <div className="view-stack">
      <section className={visibleSignals.length > 0 ? 'month-lens' : 'month-lens solo'} aria-label="Month overview">
        <div className="lens-primary">
          <PlanGauge percent={overallPercent} tone={planTone} spent={activeSpend} plan={activeLimit} />
          <div>
            <p className="eyebrow">{period.isCurrent ? 'Current month' : 'Month archive'}</p>
            <h2>{period.shortLabel}</h2>
            <p className="lens-caption">{monthLensCaption(overallPercent, comparison)}</p>
          </div>
        </div>

        {visibleSignals.length > 0 && (
          <div className="lens-signals compact" aria-label="Key month signals">
            {visibleSignals.map((signal) => (
              <LensSignal key={signal.label} signal={signal} />
            ))}
          </div>
        )}
      </section>

      {dashboardSettings.showSpend && (
        <SpendRhythm
          activeLimit={activeLimit}
          activeSpend={activeSpend}
          dailySpend={dailySpend}
          onToggleDetails={() => setShowBudgetDetails((value) => !value)}
          showDetails={showBudgetDetails}
        />
      )}

      <MonthHistory period={period} />

      {showBudgetDetails && (
        <section className="budget-grid" aria-label="Spend categories">
          {sortedBudgets.map((budget) => (
            <BudgetTile key={budget.id} budget={budget} />
          ))}
        </section>
      )}
    </div>
  );
}

function PlanGauge({ percent, tone, spent, plan }: { percent: number; tone: Tone; spent: number; plan: number }) {
  const degrees = Math.min(140, Math.max(0, percent)) * 3.6;
  const style = { '--gauge-degrees': `${degrees}deg` } as CSSProperties;
  const title = `Plan used: ${percent}%. Spent ${formatMoney(spent)} of ${formatMoney(plan)}.`;

  return (
    <div className={`plan-gauge ${toneClass(tone)}`} style={style} title={title} aria-label={title} role="img">
      <strong>{percent}%</strong>
      <span>Plan</span>
    </div>
  );
}

function LensSignal({ signal }: { signal: LensSignalModel }) {
  const max = Math.max(Math.abs(signal.current), Math.abs(signal.previous ?? 0), 1);
  const currentWidth = Math.max(6, Math.min(100, (Math.abs(signal.current) / max) * 100));
  const previousPosition = signal.previous === undefined ? null : Math.min(100, (Math.abs(signal.previous) / max) * 100);

  return (
    <details className={`lens-signal ${toneClass(signal.tone)}`} title={signal.detail}>
      <summary>
        <span className="signal-row">
          <span>{signal.label}</span>
          <TrendPill direction={signal.trend} label={signal.deltaLabel} tone={signal.tone} />
        </span>
        <strong>{signal.value}</strong>
        <span className="signal-rail" aria-hidden="true">
          <span style={{ width: `${currentWidth}%` }} />
          {previousPosition !== null && <i style={{ left: `${previousPosition}%` }} />}
        </span>
      </summary>
      <p>{signal.detail}</p>
    </details>
  );
}

function SpendRhythm({
  activeLimit,
  activeSpend,
  dailySpend,
  onToggleDetails,
  showDetails,
}: {
  activeLimit: number;
  activeSpend: number;
  dailySpend: CommandCentreData['dailySpend'];
  onToggleDetails: () => void;
  showDetails: boolean;
}) {
  const maxSpend = Math.max(...dailySpend.map((day) => day.amount), 1);
  const averageSpend = dailySpend.length > 0 ? activeSpend / dailySpend.length : 0;
  const targetDaily = dailySpend.length > 0 ? activeLimit / dailySpend.length : 0;
  const targetPercent = Math.min(100, Math.max(0, (targetDaily / maxSpend) * 100));
  const title = `Spend ${formatMoney(activeSpend)} of ${formatMoney(activeLimit)}. Average ${formatMoney(averageSpend)} per active day.`;

  return (
    <section className="spend-rhythm" aria-label="Monthly spend rhythm">
      <button
        aria-label={`${title} ${showDetails ? 'Hide' : 'Show'} categories.`}
        aria-expanded={showDetails}
        className="spend-rhythm-trigger"
        onClick={onToggleDetails}
        title={`${title} Click for categories.`}
        type="button"
      >
        <span className="spend-rhythm-head">
          <span>
            <span className="eyebrow">Spend</span>
            <strong>{formatCompactMoney(activeSpend)}</strong>
          </span>
          <span>{showDetails ? 'Hide categories' : 'Show categories'}</span>
        </span>
        <span
          className="spend-bars"
          aria-hidden="true"
          style={{ '--target-pct': `${targetPercent}%` } as CSSProperties}
        >
          {dailySpend.map((day) => (
            <i
              className={spendBarTone(day.amount, targetDaily)}
              key={day.date}
              style={{ height: `${Math.max(3, (day.amount / maxSpend) * 100)}%` }}
              title={`${day.date}: ${formatMoney(day.amount)}`}
            />
          ))}
        </span>
        <span className="spend-rhythm-foot">
          <span>Avg {formatMoney(averageSpend, true)}</span>
          <span>Daily plan {formatMoney(targetDaily, true)}</span>
        </span>
      </button>
    </section>
  );
}

function spendBarTone(amount: number, targetDaily: number) {
  if (targetDaily <= 0 || amount <= targetDaily) {
    return 'tone-ok';
  }
  if (amount >= targetDaily * 1.6) {
    return 'tone-risk';
  }
  return 'tone-watch';
}

function TrendPill({ direction, label, tone }: { direction: TrendDirection; label: string; tone: Tone }) {
  const Icon = direction === 'up' ? ArrowUp : direction === 'down' ? ArrowDown : Minus;
  return (
    <span className={`trend-pill ${toneClass(tone)}`} aria-label={label}>
      <Icon size={12} aria-hidden="true" />
    </span>
  );
}

function SettingsView({
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

function MonthHistory({ period }: { period: CommandCentreData['period'] }) {
  return (
    <nav className="month-history" aria-label="Month history">
      <span>Past months</span>
      <div>
        {period.history.map((month) => (
          <a
            aria-current={month.key === period.key ? 'page' : undefined}
            className={month.key === period.key ? 'active' : undefined}
            href={month.href}
            key={month.key}
          >
            {month.isCurrent ? 'This month' : month.shortLabel}
          </a>
        ))}
      </div>
    </nav>
  );
}

function BudgetTile({ budget }: { budget: BudgetCard }) {
  const projected = projectMonthEnd(budget.spent, budget.daysElapsed, budget.totalDays);
  const status = budgetStatus(budget.spent, budget.limit, projected, budget.reviewQueue);
  const used = percentUsed(budget.spent, budget.limit);
  const remaining = remainingBudget(budget.limit, budget.spent);
  const variance = budget.reviewQueue
    ? { label: 'Queue', value: 'Open' }
    : remaining < 0
      ? { label: 'Over by', value: formatMoney(Math.abs(remaining)) }
      : { label: 'Left', value: formatMoney(remaining) };
  const progressWidth = budget.reviewQueue ? 100 : Math.min(100, used);

  return (
    <article className={`budget-tile ${budget.reviewQueue ? 'review-queue' : ''}`}>
      <div className="tile-head">
        <div>
          <h3>{budget.name}</h3>
          <span className={`status-chip ${toneClass(status)}`}>{statusLabels[status]}</span>
        </div>
        <span className="tile-percent">{budget.reviewQueue ? formatMoney(budget.spent) : `${used}%`}</span>
      </div>

      <div className="budget-values">
        <span>
          <small>Spent</small>
          <strong>{formatMoney(budget.spent)}</strong>
        </span>
        <span>
          <small>{variance.label}</small>
          <strong>{variance.value}</strong>
        </span>
        <span>
          <small>Projected</small>
          <strong>{formatMoney(projected)}</strong>
        </span>
      </div>

      <div className="progress-track" aria-hidden="true">
        <span className={`progress-fill ${toneClass(status)}`} style={{ width: `${progressWidth}%` }} />
      </div>

      {budget.merchants.length > 0 && (
        <div className="merchant-line">
          {budget.merchants.map((merchant) => (
            <span key={merchant} title={merchant}>{displayMerchantName(merchant)}</span>
          ))}
        </div>
      )}

      {budget.unusual && <p className={`tile-note ${toneClass(status)}`}>{budget.unusual}</p>}
    </article>
  );
}

function ReviewView({ items }: { items: ReviewItem[] }) {
  return (
    <div className="view-stack">
      <ViewHeading
        icon={Clipboard}
        title="Review Inbox"
        meta={`${items.length} rows need a decision`}
      />
      {items.length === 0 ? (
        <EmptyState title="No review rows found" detail="Live Firefly returned no rows matching the current review rules." />
      ) : (
        <div className="review-list">
          {items.map((item) => (
            <article className="review-row" key={item.id}>
              <div className="row-main">
                <span className={`status-chip ${toneClass(item.severity)}`}>{toneLabels[item.severity]}</span>
                <div>
                  <h3>{item.payee}</h3>
                  <p>{item.reason}</p>
                </div>
              </div>
              <div className="row-detail">
                <span>{item.source}</span>
                <strong>{formatSignedMoney(item.amount)}</strong>
                <span>{item.ageDays}d</span>
              </div>
              <div className="suggestion">
                <span>{item.suggestion}</span>
                <div className="icon-actions">
                  <button type="button" title={`Copy ${item.fireflyGroupId}`} aria-label={`Copy ${item.fireflyGroupId}`}>
                    <Copy size={16} />
                  </button>
                  <button type="button" title="Open transaction in Firefly" aria-label="Open transaction in Firefly">
                    <ArrowUpRight size={16} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function MoneyMapView({ groups }: { groups: Record<string, Account[]> }) {
  const budgetableCash = sumAccounts(groups.budgetableCash);
  const netWorth = Object.values(groups).flat().reduce((sum, account) => sum + account.balance, 0);
  const flagged = Object.values(groups)
    .flat()
    .filter((account) => account.tone === 'watch').length;

  return (
    <div className="view-stack">
      <ViewHeading icon={Landmark} title="Accounts" meta={`Cash accounts ${formatMoney(budgetableCash)}`} />
      <section className="split-summary">
        <Metric label="Cash accounts" value={formatMoney(budgetableCash)} tone="ok" />
        <Metric label="Net worth view" value={formatMoney(netWorth)} tone="neutral" />
        <Metric label="Manual/freshness" value={`${flagged} flagged`} tone={flagged > 0 ? 'watch' : 'ok'} />
      </section>
      <div className="map-grid">
        <AccountGroup title="Cash accounts" icon={PiggyBank} accounts={groups.budgetableCash} />
        <AccountGroup title="Credit and liabilities" icon={WalletCards} accounts={groups.creditAndLiabilities} />
        <AccountGroup title="Wealth and manual assets" icon={Banknote} accounts={groups.wealth} />
        <AccountGroup title="Excluded and accounting" icon={GitBranch} accounts={groups.excluded} />
      </div>
    </div>
  );
}

function ExpectedView({ groups }: { groups: Record<string, ExpectedEvent[]> }) {
  return (
    <div className="view-stack">
      <ViewHeading icon={CalendarClock} title="Expected" meta="Live income, bills, tax, and known obligations" />
      <div className="expected-grid">
        <ExpectedGroup title="Income" events={groups.income} empty="No tagged salary or bonus rows this month." />
        <ExpectedGroup title="Bills and tax" events={groups.obligations} empty="No upcoming bills or matched tax rows found." />
        <ExpectedGroup title="Known bills" events={groups.candidates} empty="No additional known bills found." />
      </div>
    </div>
  );
}

function OpsView({ ops }: { ops: CommandCentreData['ops'] }) {
  return (
    <div className="view-stack">
      <ViewHeading icon={Activity} title="Data Trust" meta="What this UI can currently verify itself" />
      <div className="ops-detail-grid">
        {ops.map((item) => (
          <article className="ops-detail" key={item.label}>
            <CheckCircle2 className={toneClass(item.tone)} size={22} aria-hidden="true" />
            <div>
              <h3>{item.label}</h3>
              <p>{item.value}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function AccountGroup({ title, icon: Icon, accounts }: { title: string; icon: LucideIcon; accounts: Account[] }) {
  return (
    <article className="account-group">
      <header>
        <Icon size={18} aria-hidden="true" />
        <h3>{title}</h3>
      </header>
      <div className="account-list">
        {accounts.length === 0 ? (
          <EmptyState title="No live accounts" detail="No matching Firefly accounts were returned for this group." compact />
        ) : (
          accounts.map((account) => (
            <div className="account-row" key={account.name}>
              <div>
                <strong>{account.name}</strong>
                <span>{account.kind}</span>
              </div>
              <div>
                <strong>{formatMoney(account.balance)}</strong>
                <span className={toneClass(account.tone)}>{account.freshness}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

function ExpectedGroup({ title, events, empty }: { title: string; events: ExpectedEvent[]; empty: string }) {
  return (
    <article className="expected-group">
      <h3>{title}</h3>
      {events.length === 0 ? (
        <EmptyState title="Nothing found" detail={empty} compact />
      ) : (
        events.map((event) => (
          <div className="expected-row" key={`${event.name}-${event.due}`}>
            <div>
              <strong>{event.name}</strong>
              <span>{event.due}</span>
            </div>
            <div>
              <strong>{formatMoney(event.actual ?? event.expected)}</strong>
              <span className={toneClass(event.tone)}>{event.status}</span>
            </div>
          </div>
        ))
      )}
    </article>
  );
}

function ViewHeading({
  icon: Icon,
  title,
  meta,
  actionLabel,
}: {
  icon: LucideIcon;
  title: string;
  meta: string;
  actionLabel?: string;
}) {
  return (
    <div className="view-heading">
      <div>
        <Icon size={20} aria-hidden="true" />
        <div>
          <h2>{title}</h2>
          <p>{meta}</p>
        </div>
      </div>
      {actionLabel && (
        <button type="button" className="text-action">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className={`metric ${toneClass(tone)}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyState({ title, detail, compact = false }: { title: string; detail: string; compact?: boolean }) {
  return (
    <div className={compact ? 'empty-state compact' : 'empty-state'}>
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function sumAccounts(accounts: Account[]) {
  return accounts.reduce((sum, account) => sum + account.balance, 0);
}

function planToneFor(percent: number): Tone {
  if (percent > 105) return 'risk';
  if (percent > 92) return 'watch';
  return 'ok';
}

function monthLensCaption(percent: number, comparison?: MonthComparison) {
  if (!comparison) {
    return 'Tap a signal for exact values.';
  }

  const delta = percent - comparison.planUsed;
  if (Math.abs(delta) <= 2) {
    return `In line with ${comparison.previous.shortLabel}.`;
  }

  return `${Math.abs(delta)} pts ${delta > 0 ? 'heavier' : 'lighter'} than ${comparison.previous.shortLabel}.`;
}

function monthLensSignals({
  activeSpend,
  activeLimit,
  cash,
  comparison,
  paidObligations,
  period,
  reviewCount,
  riskBudgets,
}: {
  activeSpend: number;
  activeLimit: number;
  cash: CommandCentreData['cash'];
  comparison?: MonthComparison;
  paidObligations: { count: number; total: number };
  period: CommandCentreData['period'];
  reviewCount: number;
  riskBudgets: number;
}): LensSignalModel[] {
  const focusCount = reviewCount + riskBudgets;
  const previousFocusCount = comparison ? comparison.reviewRows + comparison.riskBudgets : undefined;
  const billLabel = period.isCurrent
    ? `Remaining bills ${formatMoney(cash.committedUntilMonthEnd)}`
    : paidObligations.count > 0
      ? `Bills paid ${formatMoney(paidObligations.total)}`
      : 'No paid bills found';

  return [
    {
      kind: 'spend',
      label: 'Spend',
      value: formatCompactMoney(activeSpend),
      detail: comparison
        ? `${formatMoney(activeSpend)} spent of ${formatMoney(activeLimit)} planned. ${formatSignedMoney(activeSpend - comparison.spend)} vs ${comparison.previous.shortLabel}.`
        : `${formatMoney(activeSpend)} spent of ${formatMoney(activeLimit)} planned.`,
      deltaLabel: moneyDeltaLabel(activeSpend, comparison?.spend),
      tone: comparisonTone(activeSpend, comparison?.spend, true),
      trend: trendDirection(activeSpend, comparison?.spend),
      current: activeSpend,
      previous: comparison?.spend,
    },
    {
      kind: 'cash',
      label: period.isCurrent ? 'Cash' : 'End cash',
      value: formatCompactMoney(cash.projectedLeft),
      detail: comparison
        ? `${period.isCurrent ? 'Cash after bills' : 'Month-end cash'} ${formatMoney(cash.projectedLeft)}. ${billLabel}. ${formatSignedMoney(cash.projectedLeft - comparison.cash)} vs ${comparison.previous.shortLabel}.`
        : `${period.isCurrent ? 'Cash after bills' : 'Month-end cash'} ${formatMoney(cash.projectedLeft)}. ${billLabel}.`,
      deltaLabel: moneyDeltaLabel(cash.projectedLeft, comparison?.cash),
      tone: comparisonTone(cash.projectedLeft, comparison?.cash, false),
      trend: trendDirection(cash.projectedLeft, comparison?.cash),
      current: cash.projectedLeft,
      previous: comparison?.cash,
    },
    {
      kind: 'focus',
      label: 'Focus',
      value: String(focusCount),
      detail: comparison
        ? `${riskBudgets} risk budgets and ${reviewCount} review rows. ${signedCount(focusCount - previousFocusCount!)} vs ${comparison.previous.shortLabel}.`
        : `${riskBudgets} risk budgets and ${reviewCount} review rows need attention.`,
      deltaLabel: countDeltaLabel(focusCount, previousFocusCount),
      tone: focusCount === 0 ? 'ok' : comparisonTone(focusCount, previousFocusCount, true),
      trend: trendDirection(focusCount, previousFocusCount),
      current: focusCount,
      previous: previousFocusCount,
    },
  ];
}

function comparisonTone(current: number, previous: number | undefined, lowerIsBetter: boolean): Tone {
  if (previous === undefined) {
    return 'neutral';
  }

  const delta = current - previous;
  if (Math.abs(delta) < 0.01) {
    return 'ok';
  }

  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  return improved ? 'ok' : 'risk';
}

function trendDirection(current: number, previous: number | undefined): TrendDirection {
  if (previous === undefined || Math.abs(current - previous) < 0.01) {
    return 'flat';
  }

  return current > previous ? 'up' : 'down';
}

function moneyDeltaLabel(current: number, previous: number | undefined) {
  if (previous === undefined) {
    return 'No previous month comparison';
  }

  return `${formatSignedMoney(current - previous)} vs previous month`;
}

function countDeltaLabel(current: number, previous: number | undefined) {
  if (previous === undefined) {
    return 'No previous month comparison';
  }

  return `${signedCount(current - previous)} vs previous month`;
}

function signedCount(value: number) {
  if (value === 0) {
    return '0';
  }

  return `${value > 0 ? '+' : ''}${value}`;
}

function formatCompactMoney(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return `${value < 0 ? '-' : ''}£${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  }

  return formatMoney(value, true);
}

function paidObligationSummary(events: ExpectedEvent[]) {
  return events
    .filter(isSettledObligation)
    .reduce(
      (summary, event) => ({
        count: summary.count + 1,
        total: summary.total + Math.abs(event.actual ?? event.expected),
      }),
      { count: 0, total: 0 },
    );
}

function isSettledObligation(event: ExpectedEvent) {
  return event.status === 'Paid' || (event.actual !== undefined && /paid|matched/i.test(`${event.status} ${event.due}`));
}

function displayMerchantName(value: string) {
  const cleaned = value
    .replace(/\s+/g, ' ')
    .replace(/^AMAZON\.CO\.UK\*.*/i, 'Amazon')
    .replace(/^TFL TRAVEL CHARGE.*/i, 'TfL')
    .replace(/\s+LONDON$/i, '')
    .trim();

  if (cleaned.length <= 34) {
    return cleaned;
  }

  return `${cleaned.slice(0, 31)}...`;
}
