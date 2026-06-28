import { describe, expect, it } from 'vitest';
import { reviewSpendImpact } from './reviewView';

describe('review spend impact', () => {
  it('keeps sub-1% review impact visible when review value is non-zero', () => {
    expect(reviewSpendImpact({ activeSpend: 10_000, reviewTotal: 25 }).label).toBe('affects <1% spend');
  });

  it('rounds material review impact to the nearest whole percent', () => {
    expect(reviewSpendImpact({ activeSpend: 4610.62, reviewTotal: 2245.99 }).label).toBe('affects 49% spend');
  });
});
