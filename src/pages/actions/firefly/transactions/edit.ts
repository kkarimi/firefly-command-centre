import type { APIContext } from 'astro';
import { fireflyTransactionEditHref } from '../../../../server/dashboard';

export function GET({ redirect, request }: APIContext) {
  const groupId = new URL(request.url).searchParams.get('groupId') ?? '';
  const href = fireflyTransactionEditHref(groupId);

  if (!href) {
    return new Response('Missing groupId', { status: 400 });
  }

  return redirect(href, 302);
}
