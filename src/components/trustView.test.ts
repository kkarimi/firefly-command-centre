import { describe, expect, it } from 'vitest';
import { trustActionHref } from './trustView';

describe('trust action links', () => {
  it('links warning rows to their action target', () => {
    expect(trustActionHref({ label: 'Firefly', value: 'API failed', tone: 'risk', href: '/actions/firefly' })).toBe(
      '/actions/firefly',
    );
  });

  it('keeps clear rows passive', () => {
    expect(trustActionHref({ label: 'Firefly', value: 'Online', tone: 'ok', href: '/actions/firefly' })).toBeNull();
  });
});
