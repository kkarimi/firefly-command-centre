import { CalendarClock } from 'lucide-react';
import type { ExpectedEvent } from '../data/fixtures';
import { formatMoney } from '../lib/money';
import { EmptyState, Metric, toneClass, ViewHeading } from './uiPrimitives';

export function ExpectedView({ groups }: { groups: Record<string, ExpectedEvent[]> }) {
  const incomeSeen = sumActual(groups.income);
  const stillExpected = sumOutstanding(groups.obligations);
  const watchCount = Object.values(groups)
    .flat()
    .filter((event) => event.tone === 'watch' || event.tone === 'risk').length;

  return (
    <div className="view-stack">
      <ViewHeading icon={CalendarClock} title="Expected" meta="Live income, bills, tax, and known obligations" />
      <section className="split-summary expected-summary" aria-label="Expected summary">
        <Metric label="Income seen" value={formatMoney(incomeSeen, true)} tone="ok" />
        <Metric label="Still expected" value={formatMoney(stillExpected, true)} tone={stillExpected > 0 ? 'watch' : 'ok'} />
        <Metric label="Watch" value={formatRowCount(watchCount)} tone={watchCount > 0 ? 'watch' : 'ok'} />
      </section>
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

function sumActual(events: ExpectedEvent[]) {
  return events.reduce((sum, event) => sum + (event.actual ?? 0), 0);
}

function sumOutstanding(events: ExpectedEvent[]) {
  return events.reduce((sum, event) => sum + Math.max(event.expected - (event.actual ?? 0), 0), 0);
}

function formatRowCount(count: number) {
  return `${count} ${count === 1 ? 'row' : 'rows'}`;
}
