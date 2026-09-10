import { authorized, checkOrigin, body, json, fail } from '@/lib/brain/auth';
import { mutate } from '@/lib/brain/mutate';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const actor = await authorized(req, 'ingest');
    const input = await body(req);
    return json(
      await mutate(
        { action: 'connector-config', connectors: input.connectors },
        actor,
      ),
    );
  } catch (e) {
    return fail(e);
  }
}
