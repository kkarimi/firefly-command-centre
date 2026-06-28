import { CalendarClock, ExternalLink } from 'lucide-react';
import type { DashboardData, ExpectedEvent, Tone } from '../data/fixtures';
import { formatMoney } from '../lib/money';
import { EmptyState, Metric, toneClass, ViewHeading } from './uiPrimitives';

export function ExpectedView({
  balanceDate,
  cash,
  groups,
  showDetailSignals,
}: {
  balanceDate: string;
  cash: DashboardData['cash'];
  groups: Record<string, ExpectedEvent[]>;
  showDetailSignals: boolean;
}) {
  const incomeSeen = sumActual(groups.income);
  const stillExpectedEvents = groups.obligations.filter(hasOutstandingAmount);
  const stillExpected = sumOutstanding(stillExpectedEvents);
  const openEvents = Object.values(groups).flat().filter(isOpenEvent);
  const timeline = expectedTimeline(groups);
  const openTimelineCount = timeline.filter(isOpenEvent).length;
  const loggedTimelineCount = timeline.length - openTimelineCount;
  const openTimelineTotal = sumOutstanding(timeline.filter(isOpenEvent));
  const nextOpenEvent = timeline.find(isOpenEvent);
  const nextWeekEvents = eventsDueWithinDays({ balanceDate, days: 7, events: openEvents });
  const nextWeekTotal = sumOutstanding(nextWeekEvents);
  const laterOpenEvents = eventsDueAfterDays({ balanceDate, days: 7, events: openEvents });
  const monthPosition = expectedMonthPosition({ incomeSeen, stillExpected });
  const nearTermCover = expectedCover({
    cash: cash.budgetableCash,
    laterEvents: laterOpenEvents,
    nextOpenEvent,
    soonEvents: nextWeekEvents,
  });
  const cashFloor = expectedCashFloor({ cash: cash.budgetableCash, events: openEvents });

  return (
    <div className="view-stack">
      <ViewHeading icon={CalendarClock} title="Expected" meta="Live income, bills, tax, and known obligations" />
      <section className="split-summary expected-summary" aria-label="Expected summary">
        <Metric label="Income seen" value={formatMoney(incomeSeen, true)} tone="ok" />
        <Metric
          label="Still expected"
          value={formatExpectedCountValue({ count: stillExpectedEvents.length, total: stillExpected })}
          tone={stillExpected > 0 ? 'watch' : 'ok'}
        />
        <Metric label="Due next" value={formatNextExpectedDue(nextOpenEvent)} tone={nextOpenEvent ? nextOpenEvent.tone : 'ok'} />
        <Metric
          label="Next 7d"
          value={formatExpectedCountValue({ count: nextWeekEvents.length, total: nextWeekTotal })}
          tone={dueWindowTone({ balanceDate, events: nextWeekEvents })}
        />
      </section>
      <section
        className={`cash-coverage expected-cover ${toneClass(nearTermCover.tone)}`}
        aria-label={nearTermCover.detail}
      >
        <header>
          <div>
            <h3>Near-term cover</h3>
            <p>Open expected items due within 7 days</p>
          </div>
          <strong>{formatMoney(nearTermCover.remainingCash)}</strong>
        </header>
        <span className="cash-coverage-track" aria-hidden="true">
          <span style={{ width: `${nearTermCover.reservedPercent}%` }} />
        </span>
        <div className="cash-coverage-foot">
          <span>Due {formatExpectedCoverCount({ count: nextWeekEvents.length, total: nextWeekTotal })}</span>
          <span>After 7d {formatMoney(nearTermCover.remainingCash, true)}</span>
          <span>{nearTermCover.lead}</span>
          {showDetailSignals && (
            <>
              <span>Later {nearTermCover.laterLabel}</span>
              <span title={nearTermCover.allOpenDetail}>After all {formatMoney(nearTermCover.remainingAfterAll, true)}</span>
              <span className={toneClass(nearTermCover.allOpenTone)} title={nearTermCover.allOpenReserveDetail}>
                Open reserve {nearTermCover.allOpenPercent}%
              </span>
              <span className={toneClass(cashFloor.tone)} title={cashFloor.detail}>
                {cashFloor.label}
              </span>
              <span title={monthPosition.detail}>{monthPosition.label}</span>
            </>
          )}
        </div>
      </section>
      {timeline.length > 0 && (
        <section className="expected-timeline" aria-label="Cash calendar">
          <header>
            <h3>Cash calendar</h3>
            <span>{formatTimelineStatus({ loggedTimelineCount, openTimelineCount, openTimelineTotal })}</span>
          </header>
          <div>
            {timeline.map((event) => {
              const actionHref = expectedEventActionHref(event);

              return (
                <article key={`${event.name}-${event.due}`}>
                  <div>
                    <strong>{event.name}</strong>
                    <span>{event.due}</span>
                  </div>
                  <div>
                    <strong>{formatMoney(event.actual ?? event.expected)}</strong>
                    <span className={toneClass(event.tone)}>{formatTimelineEventStatus({ balanceDate, event })}</span>
                    {actionHref && (
                      <a
                        aria-label={`Open ${event.name} bill in Firefly`}
                        className="expected-action-link"
                        href={actionHref}
                        title={`Open ${event.name} bill in Firefly`}
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
      <div className="expected-grid">
        <ExpectedGroup title="Income" events={groups.income} empty="No tagged salary or bonus rows this month." />
        <ExpectedGroup title="Bills and tax" events={groups.obligations} empty="No upcoming bills or matched tax rows found." />
        <ExpectedGroup title="Known bills" events={groups.candidates} empty="No additional known bills found." />
      </div>
    </div>
  );
}

function ExpectedGroup({ title, events, empty }: { title: string; events: ExpectedEvent[]; empty: string }) {
  return (
    <article className="expected-group">
      <header>
        <div className="expected-group-title">
          <h3>{title}</h3>
          <span>{formatExpectedGroupOpen(events)}</span>
        </div>
        <strong>{formatMoney(sumExpectedEvents(events), true)}</strong>
      </header>
      {events.length === 0 ? (
        <EmptyState title="Nothing found" detail={empty} compact />
      ) : (
        events.map((event) => {
          const actionHref = expectedEventActionHref(event);

          return (
            <div className="expected-row" key={`${event.name}-${event.due}`}>
              <div>
                <strong>{event.name}</strong>
                <span>{event.due}</span>
              </div>
              <div>
                <strong>{formatMoney(event.actual ?? event.expected)}</strong>
                <span className={toneClass(event.tone)}>{event.status}</span>
                {actionHref && (
                  <a
                    aria-label={`Open ${event.name} bill in Firefly`}
                    className="expected-action-link"
                    href={actionHref}
                    title={`Open ${event.name} bill in Firefly`}
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            </div>
          );
        })
      )}
    </article>
  );
}

function sumActual(events: ExpectedEvent[]) {
  return events.reduce((sum, event) => sum + (event.actual ?? 0), 0);
}

function sumOutstanding(events: ExpectedEvent[]) {
  return events.reduce((sum, event) => sum + outstandingAmount(event), 0);
}

function sumExpectedEvents(events: ExpectedEvent[]) {
  return events.reduce((sum, event) => sum + (event.actual ?? event.expected), 0);
}

function formatExpectedGroupOpen(events: ExpectedEvent[]) {
  const openEvents = events.filter(isOpenEvent);
  const openTotal = sumOutstanding(openEvents);

  if (openEvents.length === 0) {
    return '0 open';
  }

  return `${openEvents.length} open / ${formatMoney(openTotal, true)} due`;
}

function expectedMonthPosition({ incomeSeen, stillExpected }: { incomeSeen: number; stillExpected: number }) {
  const net = incomeSeen - stillExpected;
  const isShort = net < 0;

  return {
    label: `${isShort ? 'Month short' : 'Month net'} ${formatMoney(Math.abs(net), true)}`,
    detail: `${formatMoney(incomeSeen)} income seen minus ${formatMoney(stillExpected)} still expected.`,
  };
}

function formatTimelineStatus({
  loggedTimelineCount,
  openTimelineCount,
  openTimelineTotal,
}: {
  loggedTimelineCount: number;
  openTimelineCount: number;
  openTimelineTotal: number;
}) {
  return `${openTimelineCount} open / ${formatMoney(openTimelineTotal, true)} due / ${loggedTimelineCount} logged`;
}

function formatTimelineEventStatus({ balanceDate, event }: { balanceDate: string; event: ExpectedEvent }) {
  const dueTiming = isOpenEvent(event) ? formatDueTiming({ balanceDate, dateKey: event.dateKey }) : null;
  return dueTiming ? `${event.status} / ${dueTiming}` : event.status;
}

function formatNextExpectedDue(event?: ExpectedEvent) {
  if (!event) {
    return 'Clear';
  }

  return `${event.due} / ${formatMoney(outstandingAmount(event), true)}`;
}

function formatExpectedCountValue({ count, total }: { count: number; total: number }) {
  if (count === 0) {
    return 'Clear';
  }

  return `${count} / ${formatMoney(total, true)}`;
}

function formatExpectedCoverCount({ count, total }: { count: number; total: number }) {
  if (count === 0) {
    return 'clear';
  }

  return formatExpectedCountValue({ count, total });
}

export function expectedCashFloor({
  cash,
  events,
}: {
  cash: number;
  events: ExpectedEvent[];
}): { detail: string; label: string; tone: Tone } {
  const sortedOpenEvents = events
    .filter((event) => outstandingAmount(event) > 0)
    .sort((left, right) => expectedEventDateRank(left) - expectedEventDateRank(right) || left.name.localeCompare(right.name));

  if (sortedOpenEvents.length === 0) {
    return {
      detail: 'No open expected items reduce budgetable cash.',
      label: 'Cash floor clear',
      tone: 'ok',
    };
  }

  let runningCash = cash;
  let floorCash = cash;
  let floorEvent = sortedOpenEvents[0];

  for (const event of sortedOpenEvents) {
    runningCash -= outstandingAmount(event);
    if (runningCash < floorCash) {
      floorCash = runningCash;
      floorEvent = event;
    }
  }

  const tone: Tone = floorCash < 0 ? 'risk' : floorCash < Math.max(0, cash) * 0.25 ? 'watch' : 'ok';

  return {
    detail: `Lowest projected cash is ${formatMoney(floorCash)} after ${floorEvent.name}.`,
    label: `Cash floor ${floorEvent.due} / ${formatMoney(floorCash, true)}`,
    tone,
  };
}

function expectedCover({
  cash,
  laterEvents,
  nextOpenEvent,
  soonEvents,
}: {
  cash: number;
  laterEvents: ExpectedEvent[];
  nextOpenEvent?: ExpectedEvent;
  soonEvents: ExpectedEvent[];
}) {
  const dueTotal = sumOutstanding(soonEvents);
  const laterTotal = sumOutstanding(laterEvents);
  const allOpenTotal = dueTotal + laterTotal;
  const dueLabel = formatExpectedCoverCount({ count: soonEvents.length, total: dueTotal });
  const laterLabel = formatExpectedCoverCount({ count: laterEvents.length, total: laterTotal });
  const remainingCash = cash - dueTotal;
  const remainingAfterAll = remainingCash - laterTotal;
  const reservedPercent = cash > 0 ? Math.min(100, Math.max(0, (dueTotal / cash) * 100)) : dueTotal > 0 ? 100 : 0;
  const allOpenPercent = cash > 0 ? Math.min(100, Math.max(0, Math.round((allOpenTotal / cash) * 100))) : allOpenTotal > 0 ? 100 : 0;
  const tone: Tone = remainingCash < 0 ? 'risk' : reservedPercent >= 75 ? 'watch' : 'ok';
  const allOpenTone: Tone = remainingAfterAll < 0 ? 'risk' : allOpenPercent >= 75 ? 'watch' : 'ok';

  return {
    allOpenDetail: `Cash after all open expected items is ${formatMoney(remainingAfterAll)}.`,
    allOpenPercent,
    allOpenReserveDetail: `${formatMoney(allOpenTotal)} of budgetable cash is reserved by all open expected items.`,
    allOpenTone,
    detail: `Near-term cover. ${dueLabel} due within 7 days. ${laterLabel} later.`,
    laterLabel,
    lead: nextOpenEvent ? `Next ${nextOpenEvent.due}` : 'All clear',
    remainingAfterAll,
    remainingCash,
    reservedPercent,
    tone,
  };
}

function hasOutstandingAmount(event: ExpectedEvent) {
  return outstandingAmount(event) > 0;
}

function outstandingAmount(event: ExpectedEvent) {
  return Math.max(event.expected - (event.actual ?? 0), 0);
}

function dueWindowTone({ balanceDate, events }: { balanceDate: string; events: ExpectedEvent[] }) {
  if (events.length === 0) {
    return 'ok';
  }

  return events.some((event) => daysBetweenDateKeys({ from: balanceDate, to: event.dateKey ?? '' }) <= 0) ? 'risk' : 'watch';
}

function formatDueTiming({ balanceDate, dateKey }: { balanceDate: string; dateKey?: string }) {
  if (!dateKey) {
    return null;
  }

  const daysUntilDue = daysBetweenDateKeys({ from: balanceDate, to: dateKey });
  if (!Number.isFinite(daysUntilDue)) {
    return null;
  }

  if (daysUntilDue === 0) {
    return 'due today';
  }

  if (daysUntilDue > 0) {
    return `in ${daysUntilDue}d`;
  }

  return `${Math.abs(daysUntilDue)}d overdue`;
}

function eventsDueWithinDays({ balanceDate, days, events }: { balanceDate: string; days: number; events: ExpectedEvent[] }) {
  return events.filter((event) => {
    const daysUntilDue = daysBetweenDateKeys({ from: balanceDate, to: event.dateKey ?? '' });
    return daysUntilDue <= days;
  });
}

function eventsDueAfterDays({ balanceDate, days, events }: { balanceDate: string; days: number; events: ExpectedEvent[] }) {
  return events.filter((event) => {
    const daysUntilDue = daysBetweenDateKeys({ from: balanceDate, to: event.dateKey ?? '' });
    return daysUntilDue > days;
  });
}

function daysBetweenDateKeys({ from, to }: { from: string; to: string }) {
  const fromTime = dateKeyToUtcTime(from);
  const toTime = dateKeyToUtcTime(to);
  return Math.round((toTime - fromTime) / 86_400_000);
}

function dateKeyToUtcTime(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return Number.NaN;
  }

  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function expectedEventDateRank(event: ExpectedEvent) {
  const time = dateKeyToUtcTime(event.dateKey ?? '');
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function expectedTimeline(groups: Record<string, ExpectedEvent[]>) {
  return Object.values(groups)
    .flat()
    .filter((event) => event.dateKey)
    .sort((left, right) => {
      const leftOpen = isOpenEvent(left);
      const rightOpen = isOpenEvent(right);
      if (leftOpen !== rightOpen) {
        return leftOpen ? -1 : 1;
      }

      const leftTime = Date.parse(left.dateKey ?? '');
      const rightTime = Date.parse(right.dateKey ?? '');
      return leftOpen ? leftTime - rightTime : rightTime - leftTime;
    })
    .slice(0, 5);
}

function isOpenEvent(event: ExpectedEvent) {
  return event.actual === undefined && (event.tone === 'watch' || event.tone === 'risk' || /upcoming|outstanding|awaiting/i.test(event.status));
}

export function expectedEventActionHref(event: ExpectedEvent) {
  if (isOpenEvent(event) && event.fireflyBillHref) {
    return event.fireflyBillHref;
  }

  return null;
}
