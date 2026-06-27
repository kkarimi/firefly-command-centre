import { CalendarClock } from 'lucide-react';
import type { ExpectedEvent } from '../data/fixtures';
import { formatMoney } from '../lib/money';
import { EmptyState, toneClass, ViewHeading } from './uiPrimitives';

export function ExpectedView({ groups }: { groups: Record<string, ExpectedEvent[]> }) {
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
