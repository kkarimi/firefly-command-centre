import { useEffect, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowUp, Check, Minus } from 'lucide-react';
import type { BudgetCard, DashboardData, ExpectedEvent, MonthComparison, Tone } from '../data/fixtures';
import { budgetStatus, formatMoney, formatSignedMoney, percentUsed, projectMonthEnd, remainingBudget } from '../lib/money';
import type { DashboardSettings } from './dashboardSettings';
import { EmptyState, toneClass } from './uiPrimitives';

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

const statusLabels = {
  ok: 'On track',
  watch: 'Tight',
  risk: 'Overrun',
  review: 'Review',
};

export function MonthView({
  activeSpend,
  activeLimit,
  budgets,
  cash,
  comparison,
  dailySpend,
  dashboardSettings,
  paidObligations,
  period,
  pendingMonthKey,
  onMonthPrefetch,
  onMonthSelect,
  reviewCount,
  riskBudgets,
}: {
  activeSpend: number;
  activeLimit: number;
  budgets: BudgetCard[];
  cash: DashboardData['cash'];
  comparison?: MonthComparison;
  dailySpend: DashboardData['dailySpend'];
  dashboardSettings: DashboardSettings;
  paidObligations: { count: number; total: number };
  period: DashboardData['period'];
  pendingMonthKey: string | null;
  onMonthPrefetch: (monthKey: string) => void;
  onMonthSelect: (monthKey: string, href: string) => void;
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
      <section
        className={visibleSignals.length > 0 ? 'month-lens' : 'month-lens solo'}
        aria-label={`Month overview for ${period.label}${period.isCurrent ? ', current month' : ', archived month'}`}
      >
        <div className="lens-primary">
          <PlanGauge percent={overallPercent} tone={planTone} spent={activeSpend} plan={activeLimit} />
          <div className="lens-heading">
            <div className="lens-title-row">
              <h2>{period.shortLabel}</h2>
              <MonthStatusChip percent={overallPercent} tone={planTone} />
            </div>
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

      <MonthHistory
        onMonthPrefetch={onMonthPrefetch}
        onMonthSelect={onMonthSelect}
        pendingMonthKey={pendingMonthKey}
        period={period}
      />

      {showBudgetDetails && (
        <section className="budget-grid" aria-label="Spend categories">
          {sortedBudgets.length === 0 ? (
            <div className="budget-grid-empty">
              <EmptyState title="No visible categories" detail="No budget categories matched the current month filters." compact />
            </div>
          ) : (
            sortedBudgets.map((budget) => <BudgetTile key={budget.id} budget={budget} />)
          )}
        </section>
      )}
    </div>
  );
}

export function isVisibleMonthBudget(budget: BudgetCard) {
  return !budget.reviewQueue || budget.spent > 0 || budget.merchants.length > 0 || Boolean(budget.unusual);
}

export function paidObligationSummary(events: ExpectedEvent[]) {
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

function PlanGauge({ percent, tone, spent, plan }: { percent: number; tone: Tone; spent: number; plan: number }) {
  const degrees = Math.min(140, Math.max(0, percent)) * 3.6;
  const style = { '--gauge-degrees': `${degrees}deg` } as CSSProperties;
  const title = `Plan used: ${percent}%. Spent ${formatMoney(spent)} of ${formatMoney(plan)}.`;

  return (
    <div
      aria-label={title}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.min(100, percent)}
      className={`plan-gauge ${toneClass(tone)}`}
      role="meter"
      style={style}
      title={title}
    >
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
  dailySpend: DashboardData['dailySpend'];
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
          aria-hidden={dailySpend.length > 0}
          style={{ '--target-pct': `${targetPercent}%` } as CSSProperties}
        >
          {dailySpend.length === 0 ? (
            <span className="spend-bars-empty">No daily spend</span>
          ) : (
            dailySpend.map((day) => (
              <i
                className={spendBarTone(day.amount, targetDaily)}
                key={day.date}
                style={{ height: `${Math.max(3, (day.amount / maxSpend) * 100)}%` }}
                title={`${day.date}: ${formatMoney(day.amount)}`}
              />
            ))
          )}
        </span>
        <span className="spend-rhythm-foot">
          <span>Avg {formatMoney(averageSpend, true)}</span>
          <span>Daily plan {formatMoney(targetDaily, true)}</span>
        </span>
      </button>
    </section>
  );
}

function TrendPill({ direction, label, tone }: { direction: TrendDirection; label: string; tone: Tone }) {
  const Icon = direction === 'up' ? ArrowUp : direction === 'down' ? ArrowDown : Minus;
  return (
    <span className={`trend-pill ${toneClass(tone)}`} aria-label={label}>
      <Icon size={12} aria-hidden="true" />
    </span>
  );
}

function MonthStatusChip({ percent, tone }: { percent: number; tone: Tone }) {
  const displayTone = tone === 'risk' ? 'risk' : 'ok';
  const detail = `${monthStatusLabel(tone)}. ${percent}% of the monthly plan is used.`;

  return (
    <span aria-label={detail} className={`month-status-chip ${toneClass(displayTone)}`} title={detail}>
      {displayTone === 'ok' && <Check size={13} aria-hidden="true" />}
      <span>{monthStatusLabel(tone)}</span>
    </span>
  );
}

function MonthHistory({
  onMonthPrefetch,
  onMonthSelect,
  pendingMonthKey,
  period,
}: {
  onMonthPrefetch: (monthKey: string) => void;
  onMonthSelect: (monthKey: string, href: string) => void;
  pendingMonthKey: string | null;
  period: DashboardData['period'];
}) {
  return (
    <nav className="month-history" aria-label="Month history">
      <span>Past months</span>
      <div>
        {period.history.map((month) => (
          <a
            aria-current={month.key === period.key ? 'page' : undefined}
            aria-disabled={pendingMonthKey === month.key ? 'true' : undefined}
            className={[
              month.key === period.key ? 'active' : '',
              pendingMonthKey === month.key ? 'loading' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            href={month.href}
            key={month.key}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
                return;
              }
              event.preventDefault();
              onMonthSelect(month.key, month.href);
            }}
            onFocus={() => onMonthPrefetch(month.key)}
            onMouseEnter={() => onMonthPrefetch(month.key)}
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
            <span key={merchant} title={merchant}>
              {displayMerchantName(merchant)}
            </span>
          ))}
        </div>
      )}

      {budget.unusual && <p className={`tile-note ${toneClass(status)}`}>{budget.unusual}</p>}
    </article>
  );
}

function planToneFor(percent: number): Tone {
  if (percent > 100) return 'risk';
  return 'ok';
}

function monthStatusLabel(tone: Tone) {
  if (tone === 'risk') return 'Over plan';
  return 'On track';
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
  cash: DashboardData['cash'];
  comparison?: MonthComparison;
  paidObligations: { count: number; total: number };
  period: DashboardData['period'];
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

function spendBarTone(amount: number, targetDaily: number) {
  if (targetDaily <= 0 || amount <= targetDaily) {
    return 'tone-ok';
  }
  if (amount >= targetDaily * 1.6) {
    return 'tone-risk';
  }
  return 'tone-watch';
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
