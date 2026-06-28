import type { Account, DashboardData, Tone } from '../data/fixtures';
import { formatMoney } from './money';

export type AccountReviewTarget = {
  account: Account;
  accountId: string;
  action: string;
  groupLabel: string;
  guidance: string;
  statusLabel: string;
  tone: Tone;
};

const groupLabels: Record<string, string> = {
  budgetableCash: 'Cash accounts',
  creditAndLiabilities: 'Credit and liabilities',
  wealth: 'Wealth and manual assets',
  excluded: 'Excluded and accounting',
};

export function findAccountReviewTarget({ accountId, data }: { accountId: string; data: DashboardData }) {
  const cleanId = accountId.trim();
  if (!cleanId) {
    return null;
  }

  for (const [groupKey, accounts] of Object.entries(data.moneyMap)) {
    const account = accounts.find((entry) => accountActionId(entry.fireflyAccountHref) === cleanId);
    if (account) {
      return accountReviewTarget({ account, accountId: cleanId, groupKey });
    }
  }

  return null;
}

export function accountActionId(href: string | undefined) {
  if (!href) {
    return '';
  }

  try {
    return new URL(href, 'https://finances.home').searchParams.get('accountId') ?? '';
  } catch {
    return '';
  }
}

export function accountReviewCopyText({ fireflyHref, target }: { fireflyHref: string | undefined; target: AccountReviewTarget }) {
  return [
    `Firefly account: ${target.accountId}`,
    `Name: ${target.account.name}`,
    `Group: ${target.groupLabel}`,
    `Balance: ${formatMoney(target.account.balance)}`,
    `Freshness: ${target.account.freshness}`,
    `Status: ${target.statusLabel}`,
    `Action: ${target.action}`,
    fireflyHref ? `Open: ${fireflyHref}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function accountReviewTarget({
  account,
  accountId,
  groupKey,
}: {
  account: Account;
  accountId: string;
  groupKey: string;
}): AccountReviewTarget {
  return {
    account,
    accountId,
    action: accountAction(account),
    groupLabel: groupLabels[groupKey] ?? groupKey,
    guidance: accountGuidance(account),
    statusLabel: accountStatusLabel(account.tone),
    tone: account.tone,
  };
}

function accountStatusLabel(tone: Tone) {
  if (tone === 'watch') {
    return 'Needs review';
  }

  if (tone === 'risk') {
    return 'Risk';
  }

  if (tone === 'neutral') {
    return 'Info';
  }

  return 'Clear';
}

function accountGuidance(account: Account) {
  if (account.tone === 'watch') {
    return 'Verify the latest balance or source update in Firefly, then refresh this dashboard.';
  }

  if (account.tone === 'risk') {
    return 'Resolve the account issue in Firefly before relying on this balance.';
  }

  return 'No account warning is active. Use Firefly only if the ledger row needs inspection.';
}

function accountAction(account: Account) {
  if (account.tone === 'watch') {
    return 'Check the account balance, source import, and last updated date in Firefly.';
  }

  if (account.tone === 'risk') {
    return 'Fix the account state in Firefly, then rerun the finance review.';
  }

  return 'No review action is currently queued for this account.';
}
