import { useState } from 'react';
import { ArrowUpRight, Clipboard, Copy } from 'lucide-react';
import type { ReviewItem, Tone } from '../data/fixtures';
import { formatMoney, formatSignedMoney } from '../lib/money';
import { EmptyState, Metric, toneClass, toneLabels, ViewHeading } from './uiPrimitives';

export function ReviewView({ activeSpend, items }: { activeSpend: number; items: ReviewItem[] }) {
  const [copiedGroupId, setCopiedGroupId] = useState<string | null>(null);
  const totalQueued = items.reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const oldestAgeDays = items.reduce((oldest, item) => Math.max(oldest, item.ageDays), 0);
  const staleItems = items.filter((item) => item.ageDays >= staleAgeDays);
  const staleTotal = staleItems.reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const groups = reviewGroups(items);
  const riskItems = groups.find((group) => group.tone === 'risk')?.items ?? [];
  const riskCount = riskItems.length;
  const riskTotal = riskItems.reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const summaryTone: Tone = riskCount > 0 ? 'risk' : items.length > 0 ? 'watch' : 'ok';
  const actionBuckets = reviewActionBuckets(items);
  const spendImpact = reviewSpendImpact({ activeSpend, reviewTotal: totalQueued });

  async function copyFireflyGroupId(groupId: string) {
    await navigator.clipboard.writeText(groupId);
    setCopiedGroupId(groupId);
  }

  return (
    <div className="view-stack">
      <ViewHeading icon={Clipboard} title="Review Inbox" meta={`${items.length} rows need a decision`} />
      {items.length === 0 ? (
        <EmptyState title="No review rows found" detail="Live Firefly returned no rows matching the current review rules." />
      ) : (
        <>
          <section className="split-summary review-summary" aria-label="Review summary">
            <Metric
              label="Risk"
              value={formatReviewValueSummary({ count: riskCount, total: riskTotal })}
              tone={riskCount > 0 ? 'risk' : 'ok'}
            />
            <Metric label="Queued" value={formatMoney(totalQueued, true)} tone={summaryTone} />
            <Metric label="Oldest" value={`${oldestAgeDays}d`} tone={oldestAgeDays >= 7 ? 'watch' : 'ok'} />
            <Metric
              label="Stale"
              value={formatStaleSummary({ count: staleItems.length, total: staleTotal })}
              tone={staleItems.length > 0 ? 'watch' : 'ok'}
            />
          </section>
          <section className="review-actions" aria-label="Suggested fixes">
            <header>
              <h3>Suggested fixes</h3>
              <span title={spendImpact.detail}>
                {formatRowCount(items.length)} / source {primaryReviewSource(items)} / {spendImpact.label}
              </span>
            </header>
            <div>
              {actionBuckets.map((bucket) => (
                <span className={`status-chip ${toneClass(bucket.tone)}`} key={bucket.label}>
                  {bucket.label} {bucket.count} / {formatMoney(bucket.total, true)}
                </span>
              ))}
            </div>
          </section>
          <div className="review-groups">
            {groups.map((group) => (
              <section className="review-group" key={group.label} aria-label={`${group.label} review rows`}>
                <header>
                  <span className={`status-chip ${toneClass(group.tone)}`}>{group.label}</span>
                  <span>{formatReviewGroupSummary(group.items)}</span>
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
                        <span className={item.ageDays >= staleAgeDays ? toneClass('watch') : undefined}>{item.ageDays}d</span>
                      </div>
                      <div className="suggestion">
                        <span>{item.suggestion}</span>
                        <div className="icon-actions">
                          <button
                            type="button"
                            title={`Copy ${item.fireflyGroupId}`}
                            aria-label={
                              copiedGroupId === item.fireflyGroupId ? `Copied ${item.fireflyGroupId}` : `Copy ${item.fireflyGroupId}`
                            }
                            onClick={() => {
                              void copyFireflyGroupId(item.fireflyGroupId);
                            }}
                          >
                            <Copy size={16} />
                          </button>
                          <button
                            type="button"
                            title="Firefly link not configured"
                            aria-label="Open transaction in Firefly unavailable"
                            disabled
                          >
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
    { label: 'Handle first', tone: 'risk', items: prioritySortedItems(items.filter((item) => item.severity === 'risk')) },
    { label: 'Watch next', tone: 'watch', items: prioritySortedItems(items.filter((item) => item.severity === 'watch')) },
    { label: 'Reference', tone: 'neutral', items: prioritySortedItems(items.filter((item) => item.severity === 'neutral')) },
  ];

  return groups.filter((group) => group.items.length > 0);
}

function prioritySortedItems(items: ReviewItem[]) {
  return [...items].sort((left, right) => {
    const valueDelta = Math.abs(right.amount) - Math.abs(left.amount);
    if (valueDelta !== 0) {
      return valueDelta;
    }

    return right.ageDays - left.ageDays;
  });
}

function formatRowCount(count: number) {
  return `${count} ${count === 1 ? 'row' : 'rows'}`;
}

function formatStaleSummary({ count, total }: { count: number; total: number }) {
  return formatReviewValueSummary({ count, total });
}

function formatReviewValueSummary({ count, total }: { count: number; total: number }) {
  if (count === 0) {
    return '0 rows';
  }

  return `${count} / ${formatMoney(total, true)}`;
}

function reviewSpendImpact({ activeSpend, reviewTotal }: { activeSpend: number; reviewTotal: number }) {
  if (activeSpend <= 0) {
    return {
      label: 'affects n/a',
      detail: 'No visible month spend is available for comparison.',
    };
  }

  const percent = Math.round((reviewTotal / activeSpend) * 100);

  return {
    label: `affects ${percent}% spend`,
    detail: `${formatMoney(reviewTotal)} in review against ${formatMoney(activeSpend)} visible month spend.`,
  };
}

function formatReviewGroupSummary(items: ReviewItem[]) {
  const queued = items.reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const oldestAgeDays = items.reduce((oldest, item) => Math.max(oldest, item.ageDays), 0);
  return `${formatRowCount(items.length)} / ${formatMoney(queued, true)} / oldest ${oldestAgeDays}d / source ${primaryReviewSource(items)}`;
}

function primaryReviewSource(items: ReviewItem[]) {
  const sources = new Map<string, { count: number; total: number }>();

  for (const item of items) {
    const current = sources.get(item.source) ?? { count: 0, total: 0 };
    sources.set(item.source, {
      count: current.count + 1,
      total: current.total + Math.abs(item.amount),
    });
  }

  const [primary, ...rest] = [...sources.entries()].sort((left, right) => {
    const totalDelta = right[1].total - left[1].total;
    if (totalDelta !== 0) {
      return totalDelta;
    }

    const countDelta = right[1].count - left[1].count;
    if (countDelta !== 0) {
      return countDelta;
    }

    return left[0].localeCompare(right[0]);
  });

  if (!primary) {
    return 'None';
  }

  return rest.length === 0 ? primary[0] : `${primary[0]} lead`;
}

function reviewActionBuckets(items: ReviewItem[]) {
  const buckets: Array<{ label: string; tone: Tone; count: number; total: number }> = reviewActionMatchers.map((matcher) => ({
    label: matcher.label,
    tone: matcher.tone,
    count: 0,
    total: 0,
  }));

  for (const item of items) {
    const match = reviewActionMatchers.find((matcher) => matcher.test.test(`${item.reason} ${item.suggestion}`));
    const bucket = buckets.find((entry) => entry.label === (match?.label ?? 'Clean payee'));
    if (bucket) {
      bucket.count += 1;
      bucket.total += Math.abs(item.amount);
    }
  }

  return buckets.filter((bucket) => bucket.count > 0);
}

const reviewActionMatchers = [
  { label: 'Classify movement', tone: 'watch', test: /transfer|investment|cash-movement/i },
  { label: 'Set category', tone: 'risk', test: /category|budget|tag/i },
  { label: 'Rule candidate', tone: 'watch', test: /rule/i },
  { label: 'Clean payee', tone: 'neutral', test: /payee|metadata/i },
] satisfies Array<{ label: string; tone: Tone; test: RegExp }>;

const staleAgeDays = 7;
