import type { ReviewItem } from '../data/fixtures';
import { formatSignedMoney } from './money';

export type ReviewFixBriefEntry = { label: string; value: string };

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
