import type { APIContext } from 'astro';
import { fireflyHomeHref } from '../../../server/dashboard';

export function GET({ redirect }: APIContext) {
  return redirect(fireflyHomeHref(), 302);
}
