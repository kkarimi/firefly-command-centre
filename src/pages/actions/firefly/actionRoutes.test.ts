import type { APIContext } from 'astro';
import { describe, expect, it } from 'vitest';
import { GET as redirectToFirefly } from './index';

describe('Firefly action routes', () => {
  it('redirects the Firefly home action', () => {
    const response = redirectToFirefly(contextFor('/actions/firefly'));

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://firefly.home/');
  });
});

function contextFor(path: string) {
  return {
    redirect: (location: string, status: number) => Response.redirect(location, status),
    request: new Request(`https://finances.home${path}`),
  } as APIContext;
}
