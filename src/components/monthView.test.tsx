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
    fireflyBudgetHref: 'https://firefly.home/budgets/show/groceries',
  } satisfies BudgetCard;

  it('links warning budgets to their Firefly budget', () => {
    expect(budgetActionHref({ budget, status: 'watch' })).toBe('https://firefly.home/budgets/show/groceries');
    expect(budgetActionHref({ budget, status: 'risk' })).toBe('https://firefly.home/budgets/show/groceries');
    expect(budgetActionHref({ budget, status: 'review' })).toBe('https://firefly.home/budgets/show/groceries');
  });

  it('keeps clear budgets passive', () => {
    expect(budgetActionHref({ budget, status: 'ok' })).toBeNull();
  });
});
