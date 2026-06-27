import { isSelectableMonthKey, loadDashboardData } from '../../server/dashboard';

export async function GET({ url }: { url: URL }) {
  const month = url.searchParams.get('month');
  if (month && !isSelectableMonthKey(month)) {
    return Response.json({ error: 'invalid-month' }, { status: 400 });
  }

  const bypassCache = url.searchParams.get('refresh') === '1';
  const data = await loadDashboardData({ bypassCache, month });

  return Response.json(data, {
    headers: {
      'Cache-Control': 'private, max-age=30',
    },
  });
}
