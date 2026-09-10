import { authorized, checkOrigin, body, json, fail } from '@/lib/brain/auth';
import { latestAnalysis, saveAnalysis } from '@/lib/brain/analysis';
export async function GET(req: Request) {
  try {
    await authorized(req);
    return json(await latestAnalysis());
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const actor = await authorized(req, 'ingest');
    return json(await saveAnalysis(await body(req), actor));
  } catch (e) {
    return fail(e);
  }
}
