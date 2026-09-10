import { authorized, json, fail } from '@/lib/brain/auth';
import { modelReady } from '@/lib/brain/model';
import { rows, first, runtime } from '@/db';
export async function GET(req: Request) {
  try {
    await authorized(req);
    return json({
      jobs: await rows('SELECT * FROM jobs ORDER BY updated_at DESC LIMIT 100'),
      audit: await rows(
        'SELECT * FROM audit ORDER BY created_at DESC LIMIT 100',
      ),
      quality: {
        unsupported: (
          await first(
            'SELECT COUNT(*) AS count FROM assertions a WHERE NOT EXISTS(SELECT 1 FROM evidence e WHERE e.assertion_id=a.id)',
          )
        )?.count,
        unresolvedPeople: (
          await first(
            "SELECT COUNT(*) AS count FROM entities WHERE type='Person' AND identity LIKE 'unresolved:%'",
          )
        )?.count,
      },
      services: {
        database: !!runtime().DB,
        sourceStorage: !!runtime().SOURCES,
        liveAI: modelReady(),
        cloudScheduler: !!(await first(
          "SELECT id FROM connectors WHERE id='nightly-analysis' AND status='SCHEDULED'",
        )),
        hostedConnectors: false,
        backupVerified: false,
      },
    });
  } catch (e) {
    return fail(e);
  }
}
