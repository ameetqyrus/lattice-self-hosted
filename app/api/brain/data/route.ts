import { authorized, json, fail } from '@/lib/brain/auth';
import { graph, insights } from '@/lib/brain/retrieve';
import { ensureOntology } from '@/lib/brain/ingest';
import { rows, first, runtime } from '@/db';
import { latestAnalysis } from '@/lib/brain/analysis';
import { modelReady } from '@/lib/brain/model';
export async function GET(req: Request) {
  try {
    await authorized(req);
    await ensureOntology();
    const [
      g,
      sources,
      connectors,
      ontology,
      changes,
      views,
      signals,
      settings,
    ] = await Promise.all([
      graph(),
      rows(
        'SELECT s.*, (SELECT COUNT(*) FROM revisions r WHERE r.source_id=s.id) AS revision_count FROM sources s ORDER BY s.updated_at DESC LIMIT 1000',
      ),
      rows('SELECT * FROM connectors'),
      first(
        'SELECT * FROM ontology WHERE status=? ORDER BY version DESC LIMIT 1',
        'ACTIVE',
      ),
      rows(
        'SELECT * FROM audit WHERE action IN (?,?,?,?) ORDER BY created_at DESC LIMIT 40',
        'NEW',
        'UPDATED',
        'CORRECTED',
        'CONFIRMED',
      ),
      rows('SELECT * FROM saved_views'),
      insights(),
      rows('SELECT key,value FROM settings'),
    ]);
    const config = Object.fromEntries(
      settings.map((s: any) => [s.key, s.value]),
    );
    return json({
      ...g,
      sources,
      connectors,
      ontology: JSON.parse(ontology!.schema),
      changes,
      views,
      insights: signals,
      scheduler:
        connectors.find((c: any) => c.id === 'nightly-analysis') || null,
      report: await latestAnalysis(),
      profile: config.profile ? JSON.parse(config.profile) : null,
      aiReady: modelReady(),
      aiIssue: runtime().AI_DISABLED_REASON || null,
      now: new Date().toISOString(),
    });
  } catch (e) {
    return fail(e);
  }
}
