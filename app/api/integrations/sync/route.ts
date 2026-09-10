import { authorized, checkOrigin, fail, json } from '@/lib/brain/auth';
import { syncSelected } from '@/lib/integrations/sync';

export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const actor = await authorized(req, 'ingest');
    return json(await syncSelected(actor));
  } catch (error) {
    return fail(error);
  }
}
