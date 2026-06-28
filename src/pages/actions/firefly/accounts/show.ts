import type { APIContext } from 'astro';
import { fireflyAccountHref } from '../../../../server/dashboard';

export function GET({ redirect, request }: APIContext) {
  const accountId = new URL(request.url).searchParams.get('accountId') ?? '';
  const href = fireflyAccountHref(accountId);

  if (!href) {
    return new Response('Missing accountId', { status: 400 });
  }

  return redirect(href, 302);
}
