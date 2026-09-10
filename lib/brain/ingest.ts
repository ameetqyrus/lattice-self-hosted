import { db, stmt, first, rows, runtime } from '@/db';
import {
  hash,
  validateInput,
  entityIdentity,
  segment,
  safeUrl,
  INITIAL_ONTOLOGY,
  type SourceInput,
  BrainError,
} from './core';
import { extract, modelReady, embed } from './model';
export async function ensureOntology() {
  await stmt(
    'INSERT OR IGNORE INTO ontology(version,schema,status,created_at,approved_by) VALUES(?,?,?,?,?)',
    1,
    JSON.stringify(INITIAL_ONTOLOGY),
    'ACTIVE',
    new Date().toISOString(),
    'owner:build-specification',
  ).run();
}
export async function ingest(input: SourceInput, actor: string) {
  await ensureOntology();
  const current = await first(
    'SELECT * FROM ontology WHERE status=? ORDER BY version DESC LIMIT 1',
    'ACTIVE',
  );
  validateInput(input, JSON.parse(current!.schema));
  const now = new Date().toISOString(),
    sid =
      's_' + (await hash(`${input.provider}:${input.externalId}`)).slice(0, 24),
    digest = await hash(input.body),
    rid = 'r_' + (await hash(`${sid}:${digest}`)).slice(0, 24);
  const source = await first('SELECT * FROM sources WHERE id=?', sid);
  if (source?.excluded)
    throw new BrainError(
      409,
      'This source is excluded. Restore it explicitly before importing.',
    );
  const prior = await first('SELECT id,status FROM revisions WHERE id=?', rid);
  if (prior)
    return {
      sourceId: sid,
      revisionId: rid,
      change: 'UNCHANGED',
      status: prior.status,
    };
  const job = crypto.randomUUID();
  await stmt(
    'INSERT INTO jobs(id,kind,source_id,status,attempts,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',
    job,
    'INGEST',
    sid,
    'RUNNING',
    1,
    now,
    now,
  ).run();
  let x = input;
  let extractionError: string | null = null;
  try {
    if (!x.claims?.length && modelReady()) {
      try {
        x = await extract(input);
        validateInput(x, JSON.parse(current!.schema));
      } catch (e) {
        x = input;
        extractionError =
          e instanceof BrainError ? e.message : 'Extraction failed';
      }
    }
    const raw = runtime().SOURCES as R2Bucket;
    if (!raw) throw new BrainError(503, 'Private source storage unavailable');
    const key = `sources/${sid}/${rid}.json`;
    await raw.put(
      key,
      JSON.stringify({
        body: input.body,
        kind: input.kind,
        metadata: input.metadata || {},
      }),
      { httpMetadata: { contentType: 'application/json' } },
    );
    const chunks = segment(x.body);
    let embeddings: null | { model: string; vectors: number[][] } = null;
    if (modelReady()) {
      try {
        embeddings = await embed(chunks.map((c) => c.body));
      } catch {}
    }
    const status = extractionError
      ? 'EXTRACTION_FAILED'
      : x.claims?.length
        ? 'READY'
        : 'AWAITING_EXTRACTION';
    const ops: D1PreparedStatement[] = [];
    ops.push(
      stmt(
        'INSERT INTO sources(id,provider,external_id,title,url,domain,created_at,updated_at,metadata) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,url=excluded.url,updated_at=excluded.updated_at,metadata=excluded.metadata',
        sid,
        x.provider,
        x.externalId,
        x.title,
        safeUrl(x.url),
        x.domain,
        now,
        now,
        JSON.stringify(x.metadata || {}),
      ),
    );
    ops.push(
      stmt(
        'INSERT INTO revisions(id,source_id,content_hash,object_key,source_created_at,observed_at,ingested_at,status,metadata) VALUES(?,?,?,?,?,?,?,?,?)',
        rid,
        sid,
        digest,
        key,
        x.sourceCreatedAt || null,
        x.observedAt || now,
        now,
        status,
        JSON.stringify({
          kind: x.kind,
          extractionError,
          extractionMethod: x.metadata?.extractionMethod || 'supplied',
          chars: x.body.length,
          embeddingStatus: embeddings ? 'READY' : 'UNAVAILABLE',
        }),
      ),
    );
    chunks.forEach((c, i) =>
      ops.push(
        stmt(
          'INSERT INTO passages(id,revision_id,source_id,body,start,end,locator,embedding,embedding_model) VALUES(?,?,?,?,?,?,?,?,?)',
          `${rid}_p${i}`,
          rid,
          sid,
          c.body,
          c.start,
          c.end,
          `Characters ${c.start}–${c.end}`,
          embeddings ? JSON.stringify(embeddings.vectors[i]) : null,
          embeddings?.model || null,
        ),
      ),
    );
    const nodeIds: Record<string, string> = {};
    for (const n of x.entities || []) {
      const identity = entityIdentity(n, sid),
        id = 'n_' + (await hash(n.type + ':' + identity)).slice(0, 24);
      nodeIds[n.key] = id;
      ops.push(
        stmt(
          'INSERT INTO entities(id,label,type,domain,identity,aliases,created_at,updated_at,metadata) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at',
          id,
          n.label,
          n.type,
          n.domain || x.domain,
          identity,
          JSON.stringify(n.aliases || []),
          now,
          now,
          JSON.stringify(n.metadata || {}),
        ),
      );
    }
    for (let i = 0; i < (x.claims || []).length; i++) {
      const c = x.claims![i],
        aid = `${rid}_a${i}`,
        start = x.body.indexOf(c.quote);
      ops.push(
        stmt(
          'INSERT INTO assertions(id,subject,predicate,object,statement,assertion_type,memory_type,confidence,rationale,valid_from,valid_to,observed_at,source_created_at,ingested_at,ontology_version,metadata) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          aid,
          nodeIds[c.subject],
          c.predicate,
          nodeIds[c.object],
          c.statement,
          c.type,
          c.memoryType ||
            (['ACTION', 'PREDICTION'].includes(c.type)
              ? 'PROSPECTIVE'
              : 'SEMANTIC'),
          c.confidence,
          c.rationale,
          c.validFrom || x.sourceCreatedAt || now,
          c.validTo || null,
          x.observedAt || now,
          x.sourceCreatedAt || null,
          now,
          current!.version,
          JSON.stringify(c.metadata || {}),
        ),
      );
      ops.push(
        stmt(
          'INSERT INTO evidence(id,assertion_id,source_id,revision_id,quote,start,end,locator,kind) VALUES(?,?,?,?,?,?,?,?,?)',
          `${aid}_e`,
          aid,
          sid,
          rid,
          c.quote,
          start,
          start + c.quote.length,
          `Characters ${start}–${start + c.quote.length}`,
          String(c.metadata?.evidenceKind || x.kind),
        ),
      );
    }
    ops.push(
      stmt(
        'UPDATE jobs SET status=?,error=?,updated_at=? WHERE id=?',
        extractionError
          ? 'FAILED'
          : status === 'READY'
            ? 'SUCCEEDED'
            : 'AWAITING_MODEL',
        extractionError,
        now,
        job,
      ),
    );
    ops.push(
      stmt(
        'INSERT INTO audit(id,actor,action,target,created_at,detail) VALUES(?,?,?,?,?,?)',
        crypto.randomUUID(),
        actor,
        source ? 'UPDATED' : 'NEW',
        sid,
        now,
        JSON.stringify({
          revisionId: rid,
          claims: x.claims?.length || 0,
          entities: x.entities?.length || 0,
        }),
      ),
    );
    await db().batch(ops);
    return {
      sourceId: sid,
      revisionId: rid,
      change: source ? 'UPDATED' : 'NEW',
      status,
      claims: x.claims?.length || 0,
      entities: x.entities?.length || 0,
    };
  } catch (e) {
    if (await first('SELECT id FROM revisions WHERE id=?', rid))
      return { sourceId: sid, revisionId: rid, change: 'UNCHANGED' };
    await stmt(
      'UPDATE jobs SET status=?,error=?,updated_at=? WHERE id=?',
      'FAILED',
      e instanceof BrainError ? e.message : 'Ingestion failed',
      new Date().toISOString(),
      job,
    ).run();
    throw e;
  }
}
export async function sourceDetail(id: string) {
  const source = await first('SELECT * FROM sources WHERE id=?', id);
  if (!source) throw new BrainError(404, 'Source not found');
  const revisions = await rows(
    'SELECT * FROM revisions WHERE source_id=? ORDER BY ingested_at DESC',
    id,
  );
  return {
    source,
    revisions,
    evidence: await rows('SELECT * FROM evidence WHERE source_id=?', id),
  };
}
