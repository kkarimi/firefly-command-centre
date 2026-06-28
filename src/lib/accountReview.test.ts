import { describe, expect, it } from 'vitest';
import { dashboardFixture } from '../data/fixtures';
import { accountActionId, accountReviewCopyText, findAccountReviewTarget } from './accountReview';

describe('account review helpers', () => {
  it('finds an account from an internal account action link', () => {
    const target = findAccountReviewTarget({ accountId: 'amex', data: dashboardFixture });

    expect(target).toMatchObject({
      accountId: 'amex',
      groupLabel: 'Credit and liabilities',
      statusLabel: 'Needs review',
      tone: 'watch',
    });
    expect(target?.account.name).toBe('AMEX');
    expect(target?.guidance).toContain('Verify the latest balance');
  });

  it('extracts account ids from action hrefs', () => {
    expect(accountActionId('/actions/firefly/accounts/show?accountId=prosper-sipp')).toBe('prosper-sipp');
    expect(accountActionId('https://finances.home/actions/firefly/accounts/show?accountId=account%2F1')).toBe('account/1');
    expect(accountActionId(undefined)).toBe('');
  });

  it('builds a copyable account review note', () => {
    const target = findAccountReviewTarget({ accountId: 'amex', data: dashboardFixture });
    expect(target).not.toBeNull();

    const copyText = accountReviewCopyText({ fireflyHref: 'https://firefly.home/accounts/show/amex', target: target! });

    expect(copyText).toContain('Firefly account: amex');
    expect(copyText).toContain('Group: Credit and liabilities');
    expect(copyText).toContain('Status: Needs review');
    expect(copyText).toContain('Open: https://firefly.home/accounts/show/amex');
  });
});
