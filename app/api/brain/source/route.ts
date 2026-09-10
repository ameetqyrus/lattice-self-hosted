import { authorized, json, fail } from '@/lib/brain/auth';
import { sourceDetail } from '@/lib/brain/ingest';
import { first, runtime } from '@/db';
import { BrainError } from '@/lib/brain/core';
export async function GET(req: Request) {
  try {
    await authorized(req);
    const u = new URL(req.url);
    const id = u.searchParams.get('id') || '';
    const data = await sourceDetail(id);
    const rid = u.searchParams.get('revision');
    const revision = rid
      ? data.revisions.find((r) => r.id === rid)
      : data.revisions[0];
    if (!revision) throw new BrainError(404, 'Revision not found');
    const object = await (runtime().SOURCES as R2Bucket).get(
      revision.object_key,
    );
    return json({
      ...data,
      selectedRevision: revision,
      body: object ? (await object.json<any>()).body : null,
    });
  } catch (e) {
    return fail(e);
  }
}
