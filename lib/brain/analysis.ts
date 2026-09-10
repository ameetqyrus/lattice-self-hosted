import { db, first, rows, stmt } from '@/db';
import { requireValue, hash } from './core';
export async function latestAnalysis() {
  const row = await first(
    'SELECT value FROM settings WHERE key=?',
    'latest_analysis',
  );
  if (!row) return null;
  const report = JSON.parse(row.value);
  const allowed = new Set(
    (
      await rows(
        'SELECT e.id FROM evidence e JOIN sources s ON s.id=e.source_id WHERE s.excluded=0 LIMIT 20000',
      )
    ).map((e) => e.id),
  );
  const items = report.items.filter((i: any) =>
    i.evidenceIds.every((id: string) => allowed.has(id)),
  );
  return {
    ...report,
    items,
    hiddenFindings: report.items.length - items.length,
  };
}
export async function saveAnalysis(input: any, actor: string) {
  requireValue(
    input &&
      typeof input.date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(input.date),
    'Use an ISO report date',
  );
  requireValue(
    typeof input.title === 'string' &&
      input.title.length > 0 &&
      input.title.length <= 150,
    'Give the report a short title',
  );
  requireValue(
    Array.isArray(input.items) &&
      input.items.length > 0 &&
      input.items.length <= 30,
    'Include 1–30 evidenced findings',
  );
  requireValue(
    Array.isArray(input.coverage) &&
      input.coverage.length <= 20 &&
      input.coverage.every(
        (s: any) => typeof s === 'string' && s.length <= 1000,
      ),
    'Describe source coverage and gaps',
  );
  const allowed = new Set(
    (
      await rows(
        'SELECT e.id FROM evidence e JOIN sources s ON s.id=e.source_id WHERE s.excluded=0 LIMIT 20000',
      )
    ).map((e) => e.id),
  );
  for (const item of input.items) {
    requireValue(
      item &&
        typeof item.text === 'string' &&
        item.text.length > 0 &&
        item.text.length <= 3000,
      'Invalid finding',
    );
    requireValue(
      [
        'FACT',
        'INFERENCE',
        'QUESTION',
        'CONTRADICTION_CANDIDATE',
        'OPEN_LOOP',
        'IDEA_EVOLUTION',
      ].includes(item.type),
      'Invalid finding type',
    );
    requireValue(
      Array.isArray(item.evidenceIds) &&
        item.evidenceIds.length > 0 &&
        item.evidenceIds.length <= 12 &&
        item.evidenceIds.every((id: any) => allowed.has(id)),
      'Every finding must reference existing, included evidence',
    );
    requireValue(
      typeof item.caveat === 'string' && item.caveat.length <= 1500,
      'Include a caveat, or an empty string',
    );
  }
  const report = {
    date: input.date,
    title: input.title,
    items: input.items.map((i: any) => ({
      text: i.text,
      type: i.type,
      evidenceIds: [...new Set(i.evidenceIds)],
      caveat: i.caveat,
    })),
    coverage: input.coverage,
    generatedAt: new Date().toISOString(),
    method: 'ChatGPT/Codex subscription analysis',
  };
  const id = await hash(
    JSON.stringify({
      date: report.date,
      title: report.title,
      items: report.items,
      coverage: report.coverage,
    }),
  );
  if (await first('SELECT key FROM settings WHERE key=?', 'analysis:' + id))
    return { ok: true, change: 'UNCHANGED', id };
  await db().batch([
    stmt(
      'INSERT INTO settings(key,value) VALUES(?,?)',
      'analysis:' + id,
      JSON.stringify(report),
    ),
    stmt(
      'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      'latest_analysis',
      JSON.stringify(report),
    ),
    stmt(
      'INSERT INTO audit(id,actor,action,target,created_at,detail) VALUES(?,?,?,?,?,?)',
      crypto.randomUUID(),
      actor,
      'ANALYZED',
      id,
      report.generatedAt,
      JSON.stringify({ date: report.date, findings: report.items.length }),
    ),
  ]);
  return { ok: true, change: 'UPDATED', id, findings: report.items.length };
}
