import type { APIContext } from 'astro';
import { fireflyBillHref } from '../../../../server/dashboard';

export function GET({ redirect, request }: APIContext) {
  const billId = new URL(request.url).searchParams.get('billId') ?? '';
  const href = fireflyBillHref(billId);

  if (!href) {
    return new Response('Missing billId', { status: 400 });
  }

  return redirect(href, 302);
}
