import { loadHealthStatus } from '../../server/dashboard';

export async function GET() {
  return Response.json(await loadHealthStatus());
}
