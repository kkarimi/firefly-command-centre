import { ArrowUpRight, Clipboard, Copy } from 'lucide-react';
import type { ReviewItem } from '../data/fixtures';
import { formatSignedMoney } from '../lib/money';
import { EmptyState, toneClass, toneLabels, ViewHeading } from './uiPrimitives';

export function ReviewView({ items }: { items: ReviewItem[] }) {
  return (
    <div className="view-stack">
      <ViewHeading icon={Clipboard} title="Review Inbox" meta={`${items.length} rows need a decision`} />
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
