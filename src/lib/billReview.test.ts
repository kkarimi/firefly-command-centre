import { describe, expect, it } from 'vitest';
import { dashboardFixture } from '../data/fixtures';
import { billActionId, billReviewCopyText, findBillReviewTarget } from './billReview';

describe('bill review helpers', () => {
  it('finds a bill from an internal bill action link', () => {
    const target = findBillReviewTarget({ billId: 'amex-statement-payment', groups: dashboardFixture.expected });

    expect(target).toMatchObject({
      billId: 'amex-statement-payment',
      groupLabel: 'Bills and tax',
      statusLabel: 'Awaiting bank-side transfer',
    });
    expect(target?.event.name).toBe('AMEX statement payment');
    expect(target?.guidance).toContain('expected payment');
  });

  it('extracts bill ids from action hrefs', () => {
    expect(billActionId('/actions/firefly/bills/show?billId=amex')).toBe('amex');
    expect(billActionId('https://finances.home/actions/firefly/bills/show?billId=bill%2F1')).toBe('bill/1');
    expect(billActionId(undefined)).toBe('');
  });

  it('builds a copyable bill review note', () => {
    const target = findBillReviewTarget({ billId: 'amex-statement-payment', groups: dashboardFixture.expected });
    expect(target).not.toBeNull();

    const copyText = billReviewCopyText({ fireflyHref: 'https://firefly.home/bills/show/amex', target: target! });

    expect(copyText).toContain('Firefly bill: amex-statement-payment');
    expect(copyText).toContain('Name: AMEX statement payment');
    expect(copyText).toContain('Status: Awaiting bank-side transfer');
    expect(copyText).toContain('Open in Firefly: https://firefly.home/bills/show/amex');
  });
});
