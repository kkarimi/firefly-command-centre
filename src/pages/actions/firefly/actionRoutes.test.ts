import type { APIContext } from 'astro';
import { describe, expect, it } from 'vitest';
import { GET as redirectToFirefly } from './index';
import { GET as redirectToBudget } from './budgets/show';
import { GET as redirectToTransaction } from './transactions/edit';

describe('Firefly action routes', () => {
  it('redirects internal transaction action links to Firefly', () => {
    const response = redirectToTransaction(contextFor('/actions/firefly/transactions/edit?groupId=grp_9A2F'));

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://firefly.home/transactions/edit/grp_9A2F');
  });

  it('redirects internal budget action links to Firefly', () => {
    const response = redirectToBudget(contextFor('/actions/firefly/budgets/show?budgetId=groceries'));

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://firefly.home/budgets/show/groceries');
  });

  it('redirects the Firefly home action', () => {
    const response = redirectToFirefly(contextFor('/actions/firefly'));

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://firefly.home/');
  });

  it('rejects incomplete action links', () => {
    expect(redirectToTransaction(contextFor('/actions/firefly/transactions/edit')).status).toBe(400);
    expect(redirectToBudget(contextFor('/actions/firefly/budgets/show')).status).toBe(400);
  });
});

function contextFor(path: string) {
  return {
    redirect: (location: string, status: number) => Response.redirect(location, status),
    request: new Request(`https://finances.home${path}`),
  } as APIContext;
}
