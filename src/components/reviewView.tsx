import { useState } from 'react';
import { ArrowUpRight, Clipboard, Copy } from 'lucide-react';
import type { ReviewItem, Tone } from '../data/fixtures';
import { formatMoney, formatSignedMoney } from '../lib/money';
import { EmptyState, Metric, toneClass, toneLabels, ViewHeading } from './uiPrimitives';

type ReviewFixBriefEntry = { label: string; value: string };

export function ReviewView({
  activeSpend,
  items,
  showDetailSignals,
}: {
  activeSpend: number;
  items: ReviewItem[];
  showDetailSignals: boolean;
}) {
  const [copiedReviewId, setCopiedReviewId] = useState<string | null>(null);
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
  const spendImpact = reviewSpendImpact({
    activeSpend,
    cashInTotal: cashInReviewTotal(items),
    withdrawalTotal: withdrawalReviewTotal(items),
  });
  const netImpact = reviewNetImpact(items);
  const staleShare = reviewStaleShare({ itemCount: items.length, staleCount: staleItems.length });
  const ruleReadyImpact = reviewRuleReadyImpact(items);
  const reviewSummaryClass = showDetailSignals ? 'split-summary review-summary' : 'split-summary review-summary minimal';
  const detailActionSummary = [
    formatRowCount(items.length),
    primaryReviewOrigin(items),
    netImpact.label,
    spendImpact.label,
    staleShare.label,
    ruleReadyImpact.label,
  ].join(' / ');
  const actionSummary = showDetailSignals ? detailActionSummary : formatRowCount(items.length);
  const actionSummaryDetail = showDetailSignals
    ? `${netImpact.detail} ${spendImpact.detail} ${staleShare.detail} ${ruleReadyImpact.detail}`
    : undefined;

  async function copyReviewFix(item: ReviewItem) {
    await navigator.clipboard.writeText(reviewClipboardText(item));
    setCopiedReviewId(item.id);
  }

  return (
    <div className="view-stack">
      <ViewHeading icon={Clipboard} title="Review Inbox" meta={`${items.length} rows need a decision`} />
      {items.length === 0 ? (
        <EmptyState title="No review rows found" detail="Live Firefly returned no rows matching the current review rules." />
      ) : (
        <>
          <section className={reviewSummaryClass} aria-label="Review summary">
            <Metric
              label="Risk"
              value={formatReviewValueSummary({ count: riskCount, total: riskTotal })}
              tone={riskCount > 0 ? 'risk' : 'ok'}
            />
            <Metric label="Queued" value={formatMoney(totalQueued, true)} tone={summaryTone} />
            <Metric label="Oldest" value={`${oldestAgeDays}d`} tone={oldestAgeDays >= 7 ? 'watch' : 'ok'} />
            {showDetailSignals && (
              <Metric
                label="Stale"
                value={formatStaleSummary({ count: staleItems.length, total: staleTotal })}
                tone={staleItems.length > 0 ? 'watch' : 'ok'}
              />
            )}
          </section>
          <section className="review-actions" aria-label="Suggested fixes">
            <header>
              <h3>Suggested fixes</h3>
              <span title={actionSummaryDetail}>{actionSummary}</span>
            </header>
            {showDetailSignals && (
              <div>
                {actionBuckets.map((bucket) => (
                  <span className={`status-chip ${toneClass(bucket.tone)}`} key={bucket.label}>
                    {bucket.label} {bucket.count} / {formatMoney(bucket.total, true)}
                  </span>
                ))}
              </div>
            )}
          </section>
          <div className="review-groups">
            {groups.map((group) => (
              <section className="review-group" key={group.label} aria-label={`${group.label} review rows`}>
                <header>
                  <span className={`status-chip ${toneClass(group.tone)}`}>{group.label}</span>
                  <span>{formatReviewGroupSummary({ items: group.items, showDetailSignals })}</span>
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
                        <div className="suggestion-copy">
                          <span>{item.suggestion}</span>
                          {showDetailSignals && (
                            <div className="fix-brief" aria-label={`Fix brief for ${item.payee}`}>
                              {reviewFixBrief(item).map((entry) => (
                                <span key={`${entry.label}-${entry.value}`}>
                                  <strong>{entry.label}</strong>
                                  {entry.value}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="icon-actions">
                          <button
                            type="button"
                            title="Copy review fix"
                            aria-label={
                              copiedReviewId === item.id ? `Copied review fix for ${item.payee}` : `Copy review fix for ${item.payee}`
                            }
                            onClick={() => {
                              void copyReviewFix(item);
                            }}
                          >
                            <Copy size={16} />
                          </button>
                          {item.fireflyEditHref && (
                            <a
                              href={item.fireflyEditHref}
                              title="Open transaction in Firefly"
                              aria-label="Open transaction in Firefly"
                            >
                              <ArrowUpRight size={16} />
                            </a>
                          )}
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

export function reviewSpendImpact({
  activeSpend,
  cashInTotal,
  withdrawalTotal,
}: {
  activeSpend: number;
  cashInTotal: number;
  withdrawalTotal: number;
}) {
  const labels = [
    withdrawalTotal > 0 ? formatWithdrawalImpact({ activeSpend, withdrawalTotal }) : null,
    cashInTotal > 0 ? `cash-in ${formatMoney(cashInTotal, true)}` : null,
  ].filter((label): label is string => Boolean(label));
  const detail = [
    withdrawalTotal > 0
      ? `${formatMoney(withdrawalTotal)} withdrawal review against ${formatMoney(activeSpend)} visible month spend.`
      : 'No withdrawal review rows found.',
    cashInTotal > 0 ? `${formatMoney(cashInTotal)} cash-in review.` : null,
  ].filter((entry): entry is string => Boolean(entry));

  return {
    label: labels.length > 0 ? labels.join(' / ') : 'spend clear',
    detail: detail.join(' '),
  };
}

function formatWithdrawalImpact({ activeSpend, withdrawalTotal }: { activeSpend: number; withdrawalTotal: number }) {
  if (activeSpend <= 0) {
    return 'spend n/a';
  }

  const roundedPercent = Math.round((withdrawalTotal / activeSpend) * 100);
  const percentLabel = withdrawalTotal > 0 && roundedPercent === 0 ? '<1' : String(roundedPercent);

  return `affects ${percentLabel}% spend`;
}

function withdrawalReviewTotal(items: ReviewItem[]) {
  return items.reduce((sum, item) => (item.amount < 0 ? sum + Math.abs(item.amount) : sum), 0);
}

function cashInReviewTotal(items: ReviewItem[]) {
  return items.reduce((sum, item) => (item.amount > 0 ? sum + item.amount : sum), 0);
}

function reviewNetImpact(items: ReviewItem[]) {
  const net = items.reduce((sum, item) => sum + item.amount, 0);

  if (net === 0) {
    return {
      label: 'net flat',
      detail: 'Review queue nets to zero.',
    };
  }

  return {
    label: `${net < 0 ? 'net out' : 'net in'} ${formatMoney(Math.abs(net), true)}`,
    detail: `Signed review queue total is ${formatSignedMoney(net)}.`,
  };
}

function reviewStaleShare({ itemCount, staleCount }: { itemCount: number; staleCount: number }) {
  const share = itemCount > 0 ? Math.round((staleCount / itemCount) * 100) : 0;

  return {
    label: `stale ${share}%`,
    detail: `${staleCount} of ${itemCount} review rows are ${staleAgeDays}d or older.`,
  };
}

export function reviewRuleReadyImpact(items: ReviewItem[]) {
  const ruleReadyItems = items.filter((item) => /rule|payee|metadata/i.test(`${item.reason} ${item.suggestion}`));
  const total = ruleReadyItems.reduce((sum, item) => sum + Math.abs(item.amount), 0);

  return {
    label: ruleReadyItems.length > 0 ? `rule-ready ${ruleReadyItems.length} / ${formatMoney(total, true)}` : 'rule-ready clear',
    detail:
      ruleReadyItems.length > 0
        ? `${ruleReadyItems.length} review rows look suitable for payee or rule cleanup.`
        : 'No review rows currently look rule-ready.',
  };
}

export function reviewFixBrief(item: ReviewItem) {
  const entries = [
    categoryFixEntry(item),
    budgetFixEntry(item.suggestion),
    tagFixEntry(item.suggestion),
    ruleFixEntry(item.suggestion),
    movementFixEntry(item),
  ].filter((entry): entry is ReviewFixBriefEntry => Boolean(entry));

  return dedupeFixBrief(entries).slice(0, 3);
}

export function reviewClipboardText(item: ReviewItem) {
  const fixBrief = reviewFixBrief(item)
    .map((entry) => `${entry.label}: ${entry.value}`)
    .join('\n');
  const lines = [
    `Firefly group: ${item.fireflyGroupId}`,
    `Payee: ${item.payee}`,
    `Source: ${item.source}`,
    `Amount: ${formatSignedMoney(item.amount)}`,
    `Reason: ${item.reason}`,
    `Suggested fix: ${item.suggestion}`,
    fixBrief ? `Fix brief:\n${fixBrief}` : null,
    item.fireflyEditHref ? `Open: ${item.fireflyEditHref}` : null,
  ].filter((line): line is string => Boolean(line));

  return lines.join('\n');
}

function categoryFixEntry(item: ReviewItem) {
  const suggestion = item.suggestion;
  const firstDirective = suggestion.split(/[;,]/)[0]?.trim();
  const startsWithAction = /^(Attach|Create|Rewrite|Confirm|Assign|Replace|Decide)\b/i.test(firstDirective ?? '');
  if (firstDirective && /^[A-Z][\w &/-]+$/.test(firstDirective) && !startsWithAction) {
    return { label: 'Category', value: firstDirective };
  }

  if (/Assign a category|Decide category/i.test(suggestion)) {
    return { label: 'Category', value: 'Decide' };
  }

  if (/Replace General/i.test(suggestion)) {
    return { label: 'Category', value: 'Specific household category' };
  }

  if (/income, transfer, or accounting category/i.test(suggestion)) {
    return { label: 'Category', value: 'Income / transfer' };
  }

  if (/Missing category|Generic category/i.test(item.reason)) {
    return { label: 'Category', value: 'Resolve' };
  }

  return null;
}

function budgetFixEntry(suggestion: string) {
  const budget = suggestion.match(/\bAttach to ([^;.]+?)(?: or|$)/i)?.[1]?.trim();
  return budget ? { label: 'Budget', value: budget } : null;
}

function tagFixEntry(suggestion: string) {
  const tag = suggestion.match(/\btag\s+([^;,]+)/i)?.[1]?.trim();
  return tag ? { label: 'Tag', value: tag } : null;
}

function ruleFixEntry(suggestion: string) {
  if (/rule/i.test(suggestion)) {
    return { label: 'Next', value: 'Rule' };
  }

  if (/payee|metadata/i.test(suggestion)) {
    return { label: 'Next', value: 'Payee cleanup' };
  }

  return null;
}

function movementFixEntry(item: ReviewItem) {
  if (/transfer|accounting|cash-movement|investment/i.test(`${item.reason} ${item.suggestion}`)) {
    return { label: 'Movement', value: 'Confirm type' };
  }

  return null;
}

function dedupeFixBrief(entries: ReviewFixBriefEntry[]) {
  const seen = new Set<string>();

  return entries.filter((entry) => {
    const key = `${entry.label}:${entry.value}`.toLowerCase();
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function formatReviewGroupSummary({ items, showDetailSignals }: { items: ReviewItem[]; showDetailSignals: boolean }) {
  const queued = items.reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const oldestAgeDays = items.reduce((oldest, item) => Math.max(oldest, item.ageDays), 0);
  const core = `${formatRowCount(items.length)} / ${formatMoney(queued, true)} / oldest ${oldestAgeDays}d`;
  return showDetailSignals ? `${core} / ${primaryReviewOrigin(items)}` : core;
}

function primaryReviewOrigin(items: ReviewItem[]) {
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
    return 'source none';
  }

  const prefix = items.every((item) => item.amount > 0) ? 'from' : 'source';

  return rest.length === 0 ? `${prefix} ${primary[0]}` : `${prefix} ${primary[0]} lead`;
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
