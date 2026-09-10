import { authorized, checkOrigin, body, json, fail } from '@/lib/brain/auth';
import { mutate } from '@/lib/brain/mutate';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const actor = await authorized(req, 'write');
    return json(await mutate(await body(req), actor));
  } catch (e) {
    return fail(e);
  }
}
