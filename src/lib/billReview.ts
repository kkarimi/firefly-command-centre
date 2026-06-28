import type { DashboardData, ExpectedEvent } from '../data/fixtures';
import { formatMoney } from './money';

export type BillReviewTarget = {
  action: string;
  billId: string;
  event: ExpectedEvent;
  groupLabel: string;
  guidance: string;
  openAmount: number;
  statusLabel: string;
};

const groupLabels: Record<string, string> = {
  candidates: 'Known bills',
  income: 'Income',
  obligations: 'Bills and tax',
};

export function findBillReviewTarget({ billId, groups }: { billId: string; groups: DashboardData['expected'] }) {
  const cleanId = billId.trim();
  if (!cleanId) {
    return null;
  }

  for (const [groupKey, events] of Object.entries(groups)) {
    const event = events.find((entry) => billActionId(entry.fireflyBillHref) === cleanId);
    if (event) {
      return billReviewTarget({ billId: cleanId, event, groupKey });
    }
  }

  return null;
}

export function billActionId(href: string | undefined) {
  if (!href) {
    return '';
  }

  try {
    return new URL(href, 'https://finances.home').searchParams.get('billId') ?? '';
  } catch {
    return '';
  }
}

export function billReviewCopyText({ fireflyHref, target }: { fireflyHref: string | undefined; target: BillReviewTarget }) {
  return [
    `Firefly bill: ${target.billId}`,
    `Name: ${target.event.name}`,
    `Group: ${target.groupLabel}`,
    `Due: ${target.event.due}`,
    `Expected: ${formatMoney(target.event.expected)}`,
    target.event.actual === undefined ? null : `Actual: ${formatMoney(target.event.actual)}`,
    `Open: ${formatMoney(target.openAmount)}`,
    `Status: ${target.statusLabel}`,
    `Action: ${target.action}`,
    fireflyHref ? `Open in Firefly: ${fireflyHref}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function billReviewTarget({
  billId,
  event,
  groupKey,
}: {
  billId: string;
  event: ExpectedEvent;
  groupKey: string;
}): BillReviewTarget {
  return {
    action: billAction(event),
    billId,
    event,
    groupLabel: groupLabels[groupKey] ?? groupKey,
    guidance: billGuidance(event),
    openAmount: Math.max(0, event.expected - (event.actual ?? 0)),
    statusLabel: event.status,
  };
}

function billGuidance(event: ExpectedEvent) {
  if (event.actual !== undefined) {
    return 'This expected item is already logged. Use Firefly only if the bill record needs inspection.';
  }

  if (/awaiting|outstanding|upcoming/i.test(event.status)) {
    return 'Confirm whether the expected payment has landed, then match or update the bill in Firefly.';
  }

  return 'Review the expected bill state in Firefly before relying on this cashflow item.';
}

function billAction(event: ExpectedEvent) {
  if (event.actual !== undefined) {
    return 'Check the bill history in Firefly if the logged amount looks wrong.';
  }

  return 'Open the Firefly bill to confirm due date, expected amount, and matching transaction state.';
}
