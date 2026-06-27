import { describe, expect, it } from 'vitest';
import { buildMonthPeriod, currentMonthKey, isSelectableMonthKey } from './dashboard';

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
