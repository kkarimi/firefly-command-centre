import { describe, expect, it } from 'vitest';
import { dashboardFixture } from '../data/fixtures';
import { nearbyHistoryMonthKeys } from './FinanceApp';

describe('month history preloading', () => {
  it('preloads the three nearest archived months from the current month', () => {
    expect(nearbyHistoryMonthKeys(dashboardFixture.period.history, '2026-06', 3)).toEqual([
      '2026-05',
      '2026-04',
      '2026-03',
    ]);
  });

  it('preloads nearby months around an archive without including the active month', () => {
    expect(nearbyHistoryMonthKeys(dashboardFixture.period.history, '2026-05', 3)).toEqual([
      '2026-06',
      '2026-04',
      '2026-03',
    ]);
  });
});
