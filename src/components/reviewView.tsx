import { ArrowUpRight, Clipboard, Copy } from 'lucide-react';
import type { ReviewItem, Tone } from '../data/fixtures';
import { formatMoney, formatSignedMoney } from '../lib/money';
import { EmptyState, Metric, toneClass, toneLabels, ViewHeading } from './uiPrimitives';

export function ReviewView({ items }: { items: ReviewItem[] }) {
  const totalQueued = items.reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const oldestAgeDays = items.reduce((oldest, item) => Math.max(oldest, item.ageDays), 0);
  const groups = reviewGroups(items);
  const riskCount = groups.find((group) => group.tone === 'risk')?.items.length ?? 0;
  const summaryTone: Tone = riskCount > 0 ? 'risk' : items.length > 0 ? 'watch' : 'ok';
  const actionBuckets = reviewActionBuckets(items);

  return (
    <div className="view-stack">
      <ViewHeading icon={Clipboard} title="Review Inbox" meta={`${items.length} rows need a decision`} />
      {items.length === 0 ? (
        <EmptyState title="No review rows found" detail="Live Firefly returned no rows matching the current review rules." />
      ) : (
        <>
          <section className="split-summary review-summary" aria-label="Review summary">
            <Metric label="Risk" value={formatRowCount(riskCount)} tone={riskCount > 0 ? 'risk' : 'ok'} />
            <Metric label="Queued" value={formatMoney(totalQueued, true)} tone={summaryTone} />
            <Metric label="Oldest" value={`${oldestAgeDays}d`} tone={oldestAgeDays >= 7 ? 'watch' : 'ok'} />
          </section>
          <section className="review-actions" aria-label="Suggested fixes">
            <header>
              <h3>Suggested fixes</h3>
              <span>{formatRowCount(items.length)}</span>
            </header>
            <div>
              {actionBuckets.map((bucket) => (
                <span className={`status-chip ${toneClass(bucket.tone)}`} key={bucket.label}>
                  {bucket.label} {bucket.count}
                </span>
              ))}
            </div>
          </section>
          <div className="review-groups">
            {groups.map((group) => (
              <section className="review-group" key={group.label} aria-label={`${group.label} review rows`}>
                <header>
                  <span className={`status-chip ${toneClass(group.tone)}`}>{group.label}</span>
                  <span>{formatRowCount(group.items.length)}</span>
                </header>
                <div className="review-list">
                  {group.items.map((item) => (
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
                          <button
                            type="button"
                            title={`Copy ${item.fireflyGroupId}`}
                            aria-label={`Copy ${item.fireflyGroupId}`}
                          >
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
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function reviewGroups(items: ReviewItem[]) {
  const groups: Array<{ label: string; tone: Tone; items: ReviewItem[] }> = [
    { label: 'Handle first', tone: 'risk', items: items.filter((item) => item.severity === 'risk') },
    { label: 'Watch next', tone: 'watch', items: items.filter((item) => item.severity === 'watch') },
    { label: 'Reference', tone: 'neutral', items: items.filter((item) => item.severity === 'neutral') },
  ];

  return groups.filter((group) => group.items.length > 0);
}

function formatRowCount(count: number) {
  return `${count} ${count === 1 ? 'row' : 'rows'}`;
}

function reviewActionBuckets(items: ReviewItem[]) {
  const buckets = [
    { label: 'Set category', tone: 'risk', test: /category|budget|tag/i },
    { label: 'Rule candidate', tone: 'watch', test: /rule/i },
    { label: 'Classify movement', tone: 'watch', test: /transfer|investment|cash-movement/i },
    { label: 'Clean payee', tone: 'neutral', test: /payee|metadata/i },
  ] satisfies Array<{ label: string; tone: Tone; test: RegExp }>;

  return buckets
    .map((bucket) => ({
      label: bucket.label,
      tone: bucket.tone,
      count: items.filter((item) => bucket.test.test(`${item.reason} ${item.suggestion}`)).length,
    }))
    .filter((bucket) => bucket.count > 0);
}
