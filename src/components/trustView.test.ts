import { describe, expect, it } from 'vitest';
import { trustActionHref } from './trustView';

describe('trust action links', () => {
  it('links warning rows to their action target', () => {
    expect(trustActionHref({ label: 'Firefly', value: 'API failed', tone: 'risk', href: 'https://firefly.home' })).toBe(
      'https://firefly.home',
    );
  });

  it('keeps clear rows passive', () => {
    expect(trustActionHref({ label: 'Firefly', value: 'Online', tone: 'ok', href: 'https://firefly.home' })).toBeNull();
  });
});
