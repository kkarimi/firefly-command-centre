import { describe, expect, it } from 'vitest';
import {
  accountTone,
  buildMonthPeriod,
  currentMonthKey,
  fireflyBudgetActionHref,
  fireflyBudgetHref,
  fireflyTransactionActionHref,
  fireflyTransactionEditHref,
  isSelectableMonthKey,
  reviewReason,
} from './dashboard';

describe('dashboard period helpers', () => {
  const now = new Date(2026, 5, 27, 14, 30);

  it('builds current month metadata without shifting London dates', () => {
    const period = buildMonthPeriod('2026-06', now);

    expect(period).toMatchObject({
      key: '2026-06',
      label: 'June 2026',
      shortLabel: 'Jun 2026',
      start: '2026-06-01',
      end: '2026-06-30',
      balanceDate: '2026-06-27',
      daysElapsed: 27,
      totalDays: 30,
      isCurrent: true,
    });
    expect(period?.history[0]).toMatchObject({ key: '2026-06', href: '/months/2026-06', isCurrent: true });
    expect(period?.previous).toMatchObject({ key: '2026-05', href: '/months/2026-05' });
  });

  it('builds archived month metadata as a closed month snapshot', () => {
    const period = buildMonthPeriod('2026-05', now);

    expect(period).toMatchObject({
      key: '2026-05',
      label: 'May 2026',
      shortLabel: 'May 2026',
      start: '2026-05-01',
      end: '2026-05-31',
      balanceDate: '2026-05-31',
      daysElapsed: 31,
      totalDays: 31,
      isCurrent: false,
    });
  });

  it('rejects invalid and future month keys', () => {
    expect(currentMonthKey(now)).toBe('2026-06');
    expect(isSelectableMonthKey('2026-07', now)).toBe(false);
    expect(isSelectableMonthKey('2026-13', now)).toBe(false);
    expect(isSelectableMonthKey('not-a-month', now)).toBe(false);
  });
});

describe('dashboard review suggestions', () => {
  it('points review warnings at the Firefly edit surface', () => {
    expect(fireflyTransactionEditHref('304')).toBe('https://firefly.home/transactions/edit/304');
    expect(fireflyTransactionEditHref(' group/1 ')).toBe('https://firefly.home/transactions/edit/group%2F1');
    expect(fireflyTransactionActionHref('304')).toBe('/actions/firefly/transactions/edit?groupId=304');
    expect(fireflyTransactionActionHref(' group/1 ')).toBe('/actions/firefly/transactions/edit?groupId=group%2F1');
  });

  it('points budget warnings at the Firefly budget surface', () => {
    expect(fireflyBudgetHref('12')).toBe('https://firefly.home/budgets/show/12');
    expect(fireflyBudgetHref(' budget/1 ')).toBe('https://firefly.home/budgets/show/budget%2F1');
    expect(fireflyBudgetActionHref('12')).toBe('/actions/firefly/budgets/show?budgetId=12');
    expect(fireflyBudgetActionHref(' budget/1 ')).toBe('/actions/firefly/budgets/show?budgetId=budget%2F1');
  });

  it('keeps generic cash-in rows out of household spend suggestions', () => {
    expect(
      reviewReason({
        amount: '25',
        category_name: 'General',
        description: 'Ahmad Ali',
        type: 'deposit',
      }),
    ).toEqual({
      reason: 'Generic category on material cash-in',
      suggestion: 'Confirm income, transfer, or accounting category instead of General',
    });
  });

  it('keeps generic withdrawals in the household budget review flow', () => {
    expect(
      reviewReason({
        amount: '-25',
        category_name: 'General',
        description: 'Cafe',
        type: 'withdrawal',
      }),
    ).toEqual({
      reason: 'Household spend has no budget',
      suggestion: 'Attach to General / Review or confirm it stays outside budgets',
    });
  });
});

describe('account review tone', () => {
  const now = new Date(2026, 5, 28, 12, 0);

  it('keeps live cash accounts clear when the Firefly type is asset', () => {
    expect(accountTone({ kind: 'asset', name: 'Monzo', now, updatedAt: '2026-06-22T10:00:00+00:00' })).toBe('ok');
  });

  it('keeps AMEX and manual wealth sources in the review set', () => {
    expect(accountTone({ kind: 'asset', name: 'AMEX', now, updatedAt: '2026-06-22T10:00:00+00:00' })).toBe('watch');
    expect(accountTone({ kind: 'asset', name: 'Prosper SIPP', now, updatedAt: '2026-06-22T10:00:00+00:00' })).toBe('watch');
  });

  it('flags otherwise generic accounts when their balance update is stale', () => {
    expect(accountTone({ kind: 'liabilities', name: 'Loan balance', now, updatedAt: '2026-06-19T10:00:00+00:00' })).toBe(
      'watch',
    );
  });
});
