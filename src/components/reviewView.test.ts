import { describe, expect, it } from 'vitest';
import type { ReviewItem } from '../data/fixtures';
import { reviewFixBrief, reviewRuleReadyImpact, reviewSpendImpact } from './reviewView';

describe('review spend impact', () => {
  it('keeps sub-1% review impact visible when review value is non-zero', () => {
    expect(reviewSpendImpact({ activeSpend: 10_000, cashInTotal: 0, withdrawalTotal: 25 }).label).toBe('affects <1% spend');
  });

  it('rounds material review impact to the nearest whole percent', () => {
    expect(reviewSpendImpact({ activeSpend: 4610.62, cashInTotal: 0, withdrawalTotal: 2245.99 }).label).toBe(
      'affects 49% spend',
    );
  });

  it('keeps cash-in review value separate from spend impact', () => {
    expect(reviewSpendImpact({ activeSpend: 10_000, cashInTotal: 25, withdrawalTotal: 0 }).label).toBe('cash-in £25');
  });
});

describe('review rule-ready impact', () => {
  it('summarises payee and rule cleanup rows', () => {
    expect(reviewRuleReadyImpact([reviewItem({ amount: -42.8 }), reviewItem({ amount: -18.99, reason: 'Generated metadata' })]).label).toBe(
      'rule-ready 2 / £62',
    );
  });

  it('stays clear when there are no rule-ready rows', () => {
    expect(reviewRuleReadyImpact([reviewItem({ reason: 'Missing category', suggestion: 'Set category' })]).label).toBe(
      'rule-ready clear',
    );
  });
});

describe('review fix brief', () => {
  it('extracts category and tag guidance from category warnings', () => {
    expect(
      reviewFixBrief(
        reviewItem({
          reason: 'Missing category and statement marker',
          suggestion: 'Travel & Holidays, tag statement-review',
        }),
      ),
    ).toEqual([
      { label: 'Category', value: 'Travel & Holidays' },
      { label: 'Tag', value: 'statement-review' },
    ]);
  });

  it('extracts rule and transfer follow-up guidance', () => {
    expect(reviewFixBrief(reviewItem({ suggestion: 'Eating Out, create deterministic payee rule' }))).toEqual([
      { label: 'Category', value: 'Eating Out' },
      { label: 'Next', value: 'Rule' },
    ]);
    expect(reviewFixBrief(reviewItem({ suggestion: 'Transfers, Savings & Investments; tag cash-movement' }))).toEqual([
      { label: 'Category', value: 'Transfers' },
      { label: 'Tag', value: 'cash-movement' },
      { label: 'Movement', value: 'Confirm type' },
    ]);
  });
});

function reviewItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: 'tx-test',
    source: 'Monzo',
    payee: 'Test merchant',
    amount: -10,
    ageDays: 1,
    reason: 'Payee not mapped by rules',
    suggestion: 'Create deterministic payee rule',
    severity: 'watch',
    fireflyGroupId: '100',
    fireflyEditHref: '/actions/firefly/transactions/edit?groupId=100',
    ...overrides,
  };
}
