import { describe, expect, it } from 'vitest';
import type { BudgetCard } from '../data/fixtures';
import { budgetActionHref, monthBillAdjustedRoom } from './monthView';

describe('month budget actions', () => {
  const budget = {
    id: 'groceries',
    name: 'Groceries',
    limit: 720,
    spent: 696,
    daysElapsed: 27,
    totalDays: 30,
    merchants: [],
    fireflyBudgetHref: '/actions/firefly/budgets/show?budgetId=groceries',
  } satisfies BudgetCard;

  it('links warning budgets to their Firefly budget', () => {
    expect(budgetActionHref({ budget, status: 'watch' })).toBe('/actions/firefly/budgets/show?budgetId=groceries');
    expect(budgetActionHref({ budget, status: 'risk' })).toBe('/actions/firefly/budgets/show?budgetId=groceries');
    expect(budgetActionHref({ budget, status: 'review' })).toBe('/actions/firefly/budgets/show?budgetId=groceries');
  });

  it('keeps clear budgets passive', () => {
    expect(budgetActionHref({ budget, status: 'ok' })).toBeNull();
  });
});

describe('month bill-adjusted room signal', () => {
  const period = {
    key: '2026-06',
    label: 'June 2026',
    shortLabel: 'Jun 2026',
    range: '1-30 Jun',
    start: '2026-06-01',
    end: '2026-06-30',
    balanceDate: '2026-06-27',
    lastRefresh: '27 Jun 2026, 18:40',
    daysElapsed: 27,
    totalDays: 30,
    isCurrent: true,
    previous: null,
    history: [],
  };

  it('shows daily spend room after reserving known bills', () => {
    expect(
      monthBillAdjustedRoom({
        activeLimit: 1000,
        activeSpend: 700,
        cash: {
          monzoBalance: 1500,
          fireflyDrift: 0,
          budgetableCash: 1200,
          committedUntilMonthEnd: 450,
          projectedLeft: 750,
        },
        period,
      }),
    ).toMatchObject({
      label: 'After bills -£50/d',
      tone: 'risk',
    });
  });

  it('stays hidden when there are no current-month bills left', () => {
    expect(
      monthBillAdjustedRoom({
        activeLimit: 1000,
        activeSpend: 700,
        cash: {
          monzoBalance: 1500,
          fireflyDrift: 0,
          budgetableCash: 1200,
          committedUntilMonthEnd: 0,
          projectedLeft: 750,
        },
        period,
      }),
    ).toBeNull();
  });
});
