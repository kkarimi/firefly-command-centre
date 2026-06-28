import { describe, expect, it } from 'vitest';
import type { ExpectedEvent } from '../data/fixtures';
import { expectedCashFloor } from './expectedView';

describe('expected cash floor', () => {
  it('uses the lowest running cash point across dated open items', () => {
    const events: ExpectedEvent[] = [
      { name: 'Later tax', expected: 2000, due: '31 Jul', dateKey: '2026-07-31', status: 'Outstanding', tone: 'watch' },
      { name: 'Card bill', expected: 1434.82, due: '4 Jul', dateKey: '2026-07-04', status: 'Outstanding', tone: 'watch' },
    ];

    expect(expectedCashFloor({ cash: 4930.24, events })).toEqual({
      detail: 'Lowest projected cash is £1,495.42 after Later tax.',
      label: 'Cash floor 31 Jul / £1,495',
      tone: 'ok',
    });
  });

  it('turns risky when open items exceed cash', () => {
    const events: ExpectedEvent[] = [
      { name: 'Tax call', expected: 1200, due: '31 Jul', dateKey: '2026-07-31', status: 'Outstanding', tone: 'watch' },
    ];

    expect(expectedCashFloor({ cash: 1000, events }).tone).toBe('risk');
  });
});
