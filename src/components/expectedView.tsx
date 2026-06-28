import { CalendarClock } from 'lucide-react';
import type { ExpectedEvent } from '../data/fixtures';
import { formatMoney } from '../lib/money';
import { EmptyState, Metric, toneClass, ViewHeading } from './uiPrimitives';

export function ExpectedView({ balanceDate, groups }: { balanceDate: string; groups: Record<string, ExpectedEvent[]> }) {
  const incomeSeen = sumActual(groups.income);
  const stillExpected = sumOutstanding(groups.obligations);
  const openEvents = Object.values(groups).flat().filter(isOpenEvent);
  const timeline = expectedTimeline(groups);
  const openTimelineCount = timeline.filter(isOpenEvent).length;
  const loggedTimelineCount = timeline.length - openTimelineCount;
  const openTimelineTotal = sumOutstanding(timeline.filter(isOpenEvent));
  const nextOpenEvent = timeline.find(isOpenEvent);
  const nextWeekTotal = sumDueWithinDays({ balanceDate, days: 7, events: openEvents });

  return (
    <div className="view-stack">
      <ViewHeading icon={CalendarClock} title="Expected" meta="Live income, bills, tax, and known obligations" />
      <section className="split-summary expected-summary" aria-label="Expected summary">
        <Metric label="Income seen" value={formatMoney(incomeSeen, true)} tone="ok" />
        <Metric label="Still expected" value={formatMoney(stillExpected, true)} tone={stillExpected > 0 ? 'watch' : 'ok'} />
        <Metric label="Due next" value={nextOpenEvent?.due ?? 'Clear'} tone={nextOpenEvent ? nextOpenEvent.tone : 'ok'} />
        <Metric label="Next 7d" value={formatMoney(nextWeekTotal, true)} tone={nextWeekTotal > 0 ? 'watch' : 'ok'} />
      </section>
      {timeline.length > 0 && (
        <section className="expected-timeline" aria-label="Cash calendar">
          <header>
            <h3>Cash calendar</h3>
            <span>{formatTimelineStatus({ loggedTimelineCount, openTimelineCount, openTimelineTotal })}</span>
          </header>
          <div>
            {timeline.map((event) => (
              <article key={`${event.name}-${event.due}`}>
                <div>
                  <strong>{event.name}</strong>
                  <span>{event.due}</span>
                </div>
                <div>
                  <strong>{formatMoney(event.actual ?? event.expected)}</strong>
                  <span className={toneClass(event.tone)}>{formatTimelineEventStatus({ balanceDate, event })}</span>
                </div>
              </article>
            ))}
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

function sumActual(events: ExpectedEvent[]) {
  return events.reduce((sum, event) => sum + (event.actual ?? 0), 0);
}

function sumOutstanding(events: ExpectedEvent[]) {
  return events.reduce((sum, event) => sum + Math.max(event.expected - (event.actual ?? 0), 0), 0);
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

function sumDueWithinDays({ balanceDate, days, events }: { balanceDate: string; days: number; events: ExpectedEvent[] }) {
  return events.reduce((sum, event) => {
    const daysUntilDue = daysBetweenDateKeys({ from: balanceDate, to: event.dateKey ?? '' });
    if (daysUntilDue < 0 || daysUntilDue > days) {
      return sum;
    }

    return sum + Math.max(event.expected - (event.actual ?? 0), 0);
  }, 0);
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
