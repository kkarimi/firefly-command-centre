import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
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
  PiggyBank,
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
  type ReviewItem,
  type Tone,
} from '../data/fixtures';
import { budgetStatus, formatMoney, formatSignedMoney, percentUsed, projectMonthEnd, remainingBudget } from '../lib/money';

type TabId = 'month' | 'review' | 'money' | 'expected' | 'ops';

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

function toneClass(tone: Tone | 'review') {
  return `tone-${tone}`;
}

export default function CommandCentre({ initialData }: { initialData?: CommandCentreData }) {
  const [activeTab, setActiveTab] = useState<TabId>('month');
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
  const fireflyStatus = data.ops.find((item) => item.label === 'Firefly');

  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="top-bar">
          <div>
            <p className="eyebrow">{data.period.range}</p>
            <h1>Finances</h1>
          </div>
          <div className="top-meta" aria-label="Data status">
            <span className={fireflyStatus ? toneClass(fireflyStatus.tone) : 'tone-neutral'}>
              {fireflyStatus?.value ?? 'Unknown'}
            </span>
            <span>{data.period.lastRefresh}</span>
          </div>
        </header>

        <section className="summary-row" aria-label="Month status">
          <Metric
            label={data.period.isCurrent ? 'Cash accounts' : 'Month spend'}
            value={formatMoney(data.period.isCurrent ? data.cash.budgetableCash : activeSpend)}
            tone={data.period.isCurrent ? 'ok' : 'neutral'}
          />
          <Metric
            label={data.period.isCurrent ? 'After month bills' : 'Month-end cash'}
            value={formatMoney(data.cash.projectedLeft)}
            tone="ok"
          />
          <Metric label="Review rows" value={String(reviewCount)} tone={reviewCount > 0 ? 'watch' : 'ok'} />
          <Metric label="Risk budgets" value={String(atRiskBudgets)} tone={atRiskBudgets > 0 ? 'risk' : 'ok'} />
        </section>

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
                paidObligations={paidObligations}
                period={data.period}
              />
            )}
            {activeTab === 'review' && <ReviewView items={data.reviewItems} />}
            {activeTab === 'money' && <MoneyMapView groups={data.moneyMap} />}
            {activeTab === 'expected' && <ExpectedView groups={data.expected} />}
            {activeTab === 'ops' && <OpsView ops={data.ops} />}
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
  paidObligations,
  period,
}: {
  activeSpend: number;
  activeLimit: number;
  budgets: BudgetCard[];
  cash: CommandCentreData['cash'];
  paidObligations: { count: number; total: number };
  period: CommandCentreData['period'];
}) {
  const overallPercent = percentUsed(activeSpend, activeLimit);
  const billsMetric = period.isCurrent
    ? {
        label: 'Remaining month bills',
        value: formatMoney(cash.committedUntilMonthEnd),
        tone: 'watch' as const,
      }
    : {
        label: paidObligations.count > 0 ? 'Bills paid' : 'Bills checked',
        value: paidObligations.count > 0 ? formatMoney(paidObligations.total) : 'None found',
        tone: paidObligations.count > 0 ? ('ok' as const) : ('neutral' as const),
      };
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

  return (
    <div className="view-stack">
      <section className="month-overview">
        <div>
          <p className="eyebrow">{period.isCurrent ? 'Current month' : 'Month archive'}</p>
          <h2>{overallPercent}% of {period.shortLabel} plan used</h2>
        </div>
        <div className="overview-metrics">
          <Metric label="Spent" value={formatMoney(activeSpend)} tone="neutral" />
          <Metric label="Plan" value={formatMoney(activeLimit)} tone="neutral" />
          <Metric label={billsMetric.label} value={billsMetric.value} tone={billsMetric.tone} />
          <Metric label={period.isCurrent ? 'Cash after bills' : 'Month-end cash'} value={formatMoney(cash.projectedLeft)} tone="ok" />
        </div>
      </section>

      <MonthHistory period={period} />

      <section className="budget-grid" aria-label="Budget cards">
        {sortedBudgets.map((budget) => (
          <BudgetTile key={budget.id} budget={budget} />
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
