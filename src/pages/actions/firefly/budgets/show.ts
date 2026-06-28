import type { APIContext } from 'astro';
import { fireflyBudgetHref } from '../../../../server/dashboard';

export function GET({ redirect, request }: APIContext) {
  const budgetId = new URL(request.url).searchParams.get('budgetId') ?? '';
  const href = fireflyBudgetHref(budgetId);

  if (!href) {
    return new Response('Missing budgetId', { status: 400 });
  }

  return redirect(href, 302);
}
