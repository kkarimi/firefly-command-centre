import { describe, expect, it } from 'vitest';
import type { BudgetCard } from '../data/fixtures';
import { budgetActionHref } from './monthView';

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
