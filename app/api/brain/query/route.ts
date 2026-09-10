import { authorized, checkOrigin, body, json, fail } from '@/lib/brain/auth';
import { ask } from '@/lib/brain/retrieve';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    await authorized(req);
    const b = await body(req);
    return json(await ask(b.question, b.asOf));
  } catch (e) {
    return fail(e);
  }
}
