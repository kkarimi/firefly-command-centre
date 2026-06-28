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
  incomeSeen,
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
  incomeSeen: number;
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
  const projectedSpend = projectMonthEnd(activeSpend, period.daysElapsed, period.totalDays);
  const planTone = planToneFor({ percent: overallPercent, plan: activeLimit, projectedSpend });
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
              <MonthStatusChip percent={overallPercent} plan={activeLimit} projectedSpend={projectedSpend} tone={planTone} />
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
          budgets={sortedBudgets}
          cash={cash}
          comparison={comparison}
          dailySpend={dailySpend}
          onToggleDetails={() => setShowBudgetDetails((value) => !value)}
          incomeSeen={incomeSeen}
          paidObligations={paidObligations}
          period={period}
          showDetailSignals={dashboardSettings.showDetailSignals}
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
  budgets,
  cash,
  comparison,
  dailySpend,
  incomeSeen,
  onToggleDetails,
  paidObligations,
  period,
  showDetailSignals,
  showDetails,
}: {
  activeLimit: number;
  activeSpend: number;
  budgets: BudgetCard[];
  cash: DashboardData['cash'];
  comparison?: MonthComparison;
  dailySpend: DashboardData['dailySpend'];
  incomeSeen: number;
  onToggleDetails: () => void;
  paidObligations: { count: number; total: number };
  period: DashboardData['period'];
  showDetailSignals: boolean;
  showDetails: boolean;
}) {
  const dailySpendAmounts = dailySpend.map((day) => day.amount);
  const maxSpend = Math.max(...dailySpendAmounts, 1);
  const averageSpend = dailySpend.length > 0 ? activeSpend / dailySpend.length : 0;
  const peakSpend = dailySpendAmounts.length > 0 ? Math.max(...dailySpendAmounts) : 0;
  const targetDaily = dailySpend.length > 0 ? activeLimit / dailySpend.length : 0;
  const projectedSpend = projectMonthEnd(activeSpend, period.daysElapsed, period.totalDays);
  const remainingDays = Math.max(1, period.totalDays - period.daysElapsed);
  const remainingDaily = Math.max(0, (activeLimit - activeSpend) / remainingDays);
  const recentSpend = monthRecentSpend({ dailySpend, days: 7 });
  const paceGap = monthPaceGap({ averageSpend, period, remainingDaily });
  const allowanceLabel = period.isCurrent ? `Left/day ${formatMoney(remainingDaily, true)}` : 'Month closed';
  const allowanceDetail = period.isCurrent
    ? `Remaining daily allowance ${formatMoney(remainingDaily)}.`
    : 'This archived month is closed.';
  const projectedLabel = period.isCurrent ? `Projected ${formatMoney(projectedSpend, true)}` : `Closed ${formatMoney(activeSpend, true)}`;
  const projectedDetail = period.isCurrent
    ? `Projected month-end spend is ${formatMoney(projectedSpend)}.`
    : `Closed month spend was ${formatMoney(activeSpend)}.`;
  const planGap = monthPlanGap({ activeLimit, activeSpend, period, projectedSpend });
  const billPosition = formatBillPosition({ cash, paidObligations, period });
  const cashFlow = monthCashFlow({ activeSpend, incomeSeen });
  const cashTrend = monthCashTrend({ cash, comparison });
  const focusCategory = monthFocusCategory(budgets);
  const targetPercent = Math.min(100, Math.max(0, (targetDaily / maxSpend) * 100));
  const cashTrendDetail = cashTrend ? `${cashTrend.detail} ` : '';
  const recentSpendDetail = recentSpend ? `${recentSpend.detail} ` : '';
  const paceGapDetail = paceGap ? `${paceGap.detail} ` : '';
  const title = `Spend ${formatMoney(activeSpend)} of ${formatMoney(activeLimit)}. Average ${formatMoney(averageSpend)} per active day. Peak ${formatMoney(peakSpend)}. ${recentSpendDetail}${paceGapDetail}${projectedDetail} ${planGap.detail} ${allowanceDetail} ${billPosition.detail} ${cashFlow.detail} ${cashTrendDetail}${focusCategory.detail}`;

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
          {dailySpend.length > 0 && <span>Peak {formatMoney(peakSpend, true)}</span>}
          {showDetailSignals && (
            <>
              {recentSpend && <span title={recentSpend.detail}>{recentSpend.label}</span>}
              {paceGap && (
                <span className={toneClass(paceGap.tone)} title={paceGap.detail}>
                  {paceGap.label}
                </span>
              )}
            </>
          )}
          <span>{projectedLabel}</span>
          {showDetailSignals && <span title={planGap.detail}>{planGap.label}</span>}
          <span>{allowanceLabel}</span>
          {showDetailSignals && (
            <>
              <span>{billPosition.label}</span>
              <span title={cashFlow.detail}>{cashFlow.label}</span>
              {cashTrend && <span title={cashTrend.detail}>{cashTrend.label}</span>}
              <span title={focusCategory.detail}>{focusCategory.label}</span>
            </>
          )}
        </span>
      </button>
    </section>
  );
}

function monthRecentSpend({ dailySpend, days }: { dailySpend: DashboardData['dailySpend']; days: number }) {
  if (dailySpend.length === 0) {
    return null;
  }

  const visibleDays = Math.min(days, dailySpend.length);
  const total = dailySpend.slice(-visibleDays).reduce((sum, day) => sum + day.amount, 0);

  return {
    label: `${visibleDays}d spend ${formatMoney(total, true)}`,
    detail: `Trailing ${visibleDays}-day spend is ${formatMoney(total)}.`,
  };
}

function monthPaceGap({
  averageSpend,
  period,
  remainingDaily,
}: {
  averageSpend: number;
  period: DashboardData['period'];
  remainingDaily: number;
}): { label: string; detail: string; tone: Tone } | null {
  if (!period.isCurrent || averageSpend <= 0) {
    return null;
  }

  const gap = averageSpend - remainingDaily;

  if (Math.abs(gap) < 0.5) {
    return {
      label: 'Pace on room',
      detail: `Average daily spend matches the remaining daily allowance of ${formatMoney(remainingDaily)}.`,
      tone: 'ok',
    };
  }

  return {
    label: `Pace ${gap > 0 ? 'over' : 'spare'} ${formatMoney(Math.abs(gap), true)}/d`,
    detail: `Average daily spend is ${formatMoney(averageSpend)} versus ${formatMoney(remainingDaily)} remaining daily allowance.`,
    tone: gap > 0 ? 'risk' : 'ok',
  };
}

function monthPlanGap({
  activeLimit,
  activeSpend,
  period,
  projectedSpend,
}: {
  activeLimit: number;
  activeSpend: number;
  period: DashboardData['period'];
  projectedSpend: number;
}) {
  if (activeLimit <= 0) {
    return {
      label: 'No plan',
      detail: 'No monthly spend plan is configured.',
    };
  }

  const spend = period.isCurrent ? projectedSpend : activeSpend;
  const gap = activeLimit - spend;
  const isOverPlan = gap < 0;
  let labelPrefix = isOverPlan ? 'Closed over' : 'Closed spare';
  if (period.isCurrent) {
    labelPrefix = isOverPlan ? 'Forecast over' : 'Forecast spare';
  }

  return {
    label: `${labelPrefix} ${formatMoney(Math.abs(gap), true)}`,
    detail: `${period.isCurrent ? 'Projected' : 'Closed'} spend is ${formatMoney(Math.abs(gap))} ${isOverPlan ? 'over' : 'under'} plan.`,
  };
}

function formatBillPosition({
  cash,
  paidObligations,
  period,
}: {
  cash: DashboardData['cash'];
  paidObligations: { count: number; total: number };
  period: DashboardData['period'];
}) {
  if (period.isCurrent) {
    if (cash.committedUntilMonthEnd <= 0) {
      return {
        label: 'Bills clear',
        detail: 'No known obligations are still reserved for the rest of this month.',
      };
    }

    return {
      label: `Bills left ${formatMoney(cash.committedUntilMonthEnd, true)}`,
      detail: `Known obligations still reserved for this month total ${formatMoney(cash.committedUntilMonthEnd)}.`,
    };
  }

  if (paidObligations.count === 0) {
    return {
      label: `Bills paid ${formatMoney(0, true)}`,
      detail: 'No settled bill obligations were found for this archived month.',
    };
  }

  return {
    label: `Bills paid ${formatMoney(paidObligations.total, true)}`,
    detail: `${paidObligations.count} settled ${paidObligations.count === 1 ? 'bill' : 'bills'} found for this archived month.`,
  };
}

function monthCashFlow({ activeSpend, incomeSeen }: { activeSpend: number; incomeSeen: number }) {
  if (incomeSeen <= 0) {
    return {
      label: 'Net flow n/a',
      detail: 'No income rows have been seen for this month.',
    };
  }

  const netFlow = incomeSeen - activeSpend;

  return {
    label: `Net flow ${formatMoney(netFlow, true)}`,
    detail: `${formatMoney(incomeSeen)} income seen minus ${formatMoney(activeSpend)} visible month spend.`,
  };
}

function monthCashTrend({ cash, comparison }: { cash: DashboardData['cash']; comparison?: MonthComparison }) {
  if (!comparison) {
    return null;
  }

  const delta = cash.projectedLeft - comparison.cash;

  return {
    label: `Cash trend ${formatSignedCompactMoney(delta)}`,
    detail: `Cash after bills is ${formatSignedMoney(delta)} vs ${comparison.previous.shortLabel}.`,
  };
}

function monthFocusCategory(budgets: BudgetCard[]) {
  const focus = budgets
    .map((budget) => {
      const projected = projectMonthEnd(budget.spent, budget.daysElapsed, budget.totalDays);
      const status = budgetStatus(budget.spent, budget.limit, projected, budget.reviewQueue);
      const remaining = remainingBudget(budget.limit, budget.spent);
      const projectedOver = budget.limit > 0 && remaining >= 0 && projected > budget.limit ? projected - budget.limit : 0;
      return { budget, projected, projectedOver, remaining, status };
    })
    .find((entry) => entry.status !== 'ok');

  if (!focus) {
    return {
      label: 'Focus clear',
      detail: 'No budget category currently needs attention.',
    };
  }

  if (focus.status === 'review') {
    return {
      label: 'Focus Review queue',
      detail: `${focus.budget.name} has ${formatMoney(focus.budget.spent)} waiting for cleanup.`,
    };
  }

  if (focus.remaining < 0) {
    return {
      label: `Focus ${focus.budget.name}`,
      detail: `${focus.budget.name} is ${formatMoney(Math.abs(focus.remaining))} over plan.`,
    };
  }

  if (focus.projectedOver > 0) {
    return {
      label: `Focus ${focus.budget.name}`,
      detail: `${focus.budget.name} is projected ${formatMoney(focus.projectedOver)} over plan.`,
    };
  }

  return {
    label: `Focus ${focus.budget.name}`,
    detail: `${focus.budget.name} is close to plan at ${formatMoney(focus.projected)} projected spend.`,
  };
}

function TrendPill({ direction, label, tone }: { direction: TrendDirection; label: string; tone: Tone }) {
  const Icon = direction === 'up' ? ArrowUp : direction === 'down' ? ArrowDown : Minus;
  return (
    <span className={`trend-pill ${toneClass(tone)}`} aria-label={label}>
      <Icon size={12} aria-hidden="true" />
    </span>
  );
}

function MonthStatusChip({
  percent,
  plan,
  projectedSpend,
  tone,
}: {
  percent: number;
  plan: number;
  projectedSpend: number;
  tone: Tone;
}) {
  const detail = `${monthStatusLabel(tone)}. ${percent}% of the monthly plan is used. Projected month-end spend is ${formatMoney(projectedSpend)} against ${formatMoney(plan)} plan.`;

  return (
    <span aria-label={detail} className={`month-status-chip ${toneClass(tone)}`} title={detail}>
      {tone === 'ok' && <Check size={13} aria-hidden="true" />}
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
  const projectedOver = budget.limit > 0 && remaining >= 0 && projected > budget.limit ? projected - budget.limit : 0;
  const pace = budgetDailyRoom({ budget, projected, remaining });
  const variance = budget.reviewQueue
    ? { label: 'Queue', value: 'Open' }
    : remaining < 0
      ? { label: 'Over by', value: formatMoney(Math.abs(remaining)) }
      : projectedOver > 0
        ? { label: 'Forecast over', value: formatMoney(projectedOver) }
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

      <div className="budget-pace" title={pace.detail}>
        <span>{pace.label}</span>
        <strong className={toneClass(pace.tone)}>{pace.value}</strong>
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

function budgetDailyRoom({
  budget,
  projected,
  remaining,
}: {
  budget: BudgetCard;
  projected: number;
  remaining: number;
}): { label: string; value: string; tone: Tone | 'review'; detail: string } {
  if (budget.reviewQueue) {
    return {
      label: 'Pace',
      value: 'Review only',
      tone: 'review',
      detail: 'This leakage queue is reviewed manually rather than paced against a budget.',
    };
  }

  if (budget.daysElapsed >= budget.totalDays) {
    return {
      label: 'Daily room',
      value: 'Closed',
      tone: remaining < 0 ? 'risk' : 'ok',
      detail: `Month closed with ${formatMoney(Math.abs(remaining))} ${remaining < 0 ? 'over plan' : 'left'}.`,
    };
  }

  if (remaining <= 0) {
    return {
      label: 'Daily room',
      value: 'No room',
      tone: 'risk',
      detail: `${budget.name} is ${formatMoney(Math.abs(remaining))} over plan.`,
    };
  }

  const remainingDays = Math.max(1, budget.totalDays - budget.daysElapsed);
  const dailyRoom = remaining / remainingDays;
  const tone: Tone = projected > budget.limit * 0.95 ? 'watch' : 'ok';

  return {
    label: 'Daily room',
    value: `${formatMoney(dailyRoom, true)}/day`,
    tone,
    detail: `${formatMoney(remaining)} left for ${remainingDays} ${remainingDays === 1 ? 'day' : 'days'}. Projected month-end spend is ${formatMoney(projected)}.`,
  };
}

function planToneFor({
  percent,
  plan,
  projectedSpend,
}: {
  percent: number;
  plan: number;
  projectedSpend: number;
}): Tone {
  if (plan <= 0) {
    return percent > 0 ? 'risk' : 'ok';
  }

  if (percent > 100 || projectedSpend >= plan * 1.08) return 'risk';
  if (projectedSpend > plan * 0.95) return 'watch';
  return 'ok';
}

function monthStatusLabel(tone: Tone) {
  if (tone === 'risk') return 'Over plan';
  if (tone === 'watch') return 'Tight';
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

function formatSignedCompactMoney(value: number) {
  if (Math.abs(value) < 0.5) {
    return formatMoney(0, true);
  }

  return `${value > 0 ? '+' : '-'}${formatMoney(Math.abs(value), true)}`;
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
