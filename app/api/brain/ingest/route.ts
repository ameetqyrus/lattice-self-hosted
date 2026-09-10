import { authorized, checkOrigin, body, json, fail } from '@/lib/brain/auth';
import { ingest } from '@/lib/brain/ingest';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const actor = await authorized(req, 'ingest');
    const data = await body(req);
    return json(await ingest(data, actor));
  } catch (e) {
    return fail(e);
  }
}
