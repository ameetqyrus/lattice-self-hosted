import { authorized, json, fail } from '@/lib/brain/auth';
import { rows } from '@/db';
export async function GET(req: Request) {
  try {
    await authorized(req);
    const tables = [
      'sources',
      'revisions',
      'entities',
      'assertions',
      'evidence',
      'ontology',
      'feedback',
      'metrics',
      'saved_views',
    ];
    const exported: Record<string, any> = {
      format: 'second-brain-v1',
      exportedAt: new Date().toISOString(),
    };
    for (const table of tables)
      exported[table] = await rows(`SELECT * FROM ${table} LIMIT 100000`);
    return new Response(JSON.stringify(exported, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition':
          'attachment; filename="second-brain-export.json"',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    return fail(e);
  }
}
