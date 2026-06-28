import { describe, expect, it } from 'vitest';
import { dashboardFixture } from '../data/fixtures';
import { budgetActionId, budgetReviewCopyText, findBudgetReviewTarget } from './budgetReview';

describe('budget review helpers', () => {
  it('finds a budget from an internal budget action link', () => {
    const target = findBudgetReviewTarget({ budgetId: 'eating-out', budgets: dashboardFixture.budgets });

    expect(target).toMatchObject({
      budgetId: 'eating-out',
      status: 'risk',
      statusLabel: 'Overrun',
    });
    expect(target?.budget.name).toBe('Eating Out');
    expect(target?.guidance).toContain('over plan');
  });

  it('extracts budget ids from action hrefs', () => {
    expect(budgetActionId('/actions/firefly/budgets/show?budgetId=groceries')).toBe('groceries');
    expect(budgetActionId('https://finances.home/actions/firefly/budgets/show?budgetId=budget%2F1')).toBe('budget/1');
    expect(budgetActionId(undefined)).toBe('');
  });

  it('builds a copyable budget review note', () => {
    const target = findBudgetReviewTarget({ budgetId: 'eating-out', budgets: dashboardFixture.budgets });
    expect(target).not.toBeNull();

    const copyText = budgetReviewCopyText({ fireflyHref: 'https://firefly.home/budgets/show/eating-out', target: target! });

    expect(copyText).toContain('Firefly budget: eating-out');
    expect(copyText).toContain('Name: Eating Out');
    expect(copyText).toContain('Status: Overrun');
    expect(copyText).toContain('Open: https://firefly.home/budgets/show/eating-out');
  });
});
