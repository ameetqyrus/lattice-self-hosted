import { db, rows, first, stmt, runtime } from '@/db';
import {
  requireValue,
  BrainError,
  closeAllowed,
  CLAIM_TYPES,
  INITIAL_ONTOLOGY,
} from './core';
import { ingest } from './ingest';
export async function mutate(b: any, actor: string) {
  requireValue(b && typeof b.action === 'string', 'Missing action');
  const now = new Date().toISOString(),
    ops: D1PreparedStatement[] = [];
  const target = String(b.id || '');
  if (b.action === 'capture') {
    requireValue(
      typeof b.text === 'string' && b.text.trim().length >= 12,
      'Capture at least 12 characters',
    );
    const type = CLAIM_TYPES.includes(b.type) ? b.type : 'IDEA';
    const profile = await first(
      'SELECT value FROM settings WHERE key=?',
      'profile',
    );
    let ownerLabel = 'Workspace owner';
    try {
      ownerLabel = JSON.parse(profile?.value || '{}').displayName || ownerLabel;
    } catch {}
    return ingest(
      {
        provider: 'manual',
        externalId: crypto.randomUUID(),
        title: b.title || b.text.slice(0, 80),
        domain: b.domain || 'IDEAS',
        body: b.text,
        kind: 'owner-capture',
        sourceCreatedAt: now,
        entities: [
          {
            key: 'owner',
            label: ownerLabel,
            type: 'Person',
            identity: 'owner',
          },
          {
            key: 'capture',
            label: b.title || b.text.slice(0, 80),
            type:
              type === 'ACTION'
                ? 'Commitment'
                : type === 'DECISION'
                  ? 'Decision'
                  : type === 'QUESTION'
                    ? 'Question'
                    : 'Idea',
            metadata: {
              lifecycle: type === 'IDEA' ? 'SEED' : 'COMMITTED',
              ownerScope: 'ME',
            },
          },
        ],
        claims: [
          {
            subject: 'owner',
            predicate:
              type === 'ACTION'
                ? 'COMMITTED_TO'
                : type === 'DECISION'
                  ? 'DECIDED'
                  : 'PROPOSED',
            object: 'capture',
            statement: b.text,
            type,
            quote: b.text,
            confidence: 1,
            rationale: 'Explicitly captured by the owner.',
            memoryType: type === 'ACTION' ? 'PROSPECTIVE' : 'SEMANTIC',
          },
        ],
      },
      actor,
    );
  }
  if (b.action === 'source-exclude' || b.action === 'source-restore') {
    requireValue(
      await first('SELECT id FROM sources WHERE id=?', target),
      'Source not found',
    );
    ops.push(
      stmt(
        'UPDATE sources SET excluded=? WHERE id=?',
        b.action === 'source-exclude' ? 1 : 0,
        target,
      ),
    );
  } else if (b.action === 'pin' || b.action === 'unpin') {
    requireValue(
      await first('SELECT id FROM entities WHERE id=?', target),
      'Entity not found',
    );
    ops.push(
      stmt(
        'UPDATE entities SET pinned=?,updated_at=? WHERE id=?',
        b.action === 'pin' ? 1 : 0,
        now,
        target,
      ),
    );
  } else if (b.action === 'insight-pin' || b.action === 'insight-dismiss') {
    ops.push(
      stmt(
        'INSERT INTO feedback(id,target,action,note,created_at) VALUES(?,?,?,?,?)',
        crypto.randomUUID(),
        target,
        b.action === 'insight-pin' ? 'pin' : 'dismiss',
        String(b.note || ''),
        now,
      ),
    );
  } else if (b.action === 'status') {
    const n = await first('SELECT * FROM entities WHERE id=?', target);
    requireValue(n, 'Entity not found');
    const options =
      n.type === 'Idea'
        ? [
            'SEED',
            'REPEATED',
            'DEVELOPING',
            'CONNECTED',
            'TESTED',
            'ADOPTED',
            'IMPLEMENTED',
            'REJECTED',
            'DORMANT',
            'REVIVED',
          ]
        : [
            'PROPOSED',
            'COMMITTED',
            'IN_PROGRESS',
            'BLOCKED',
            'DONE',
            'CANCELLED',
            'SUPERSEDED',
          ];
    requireValue(options.includes(b.status), 'Invalid lifecycle status');
    closeAllowed(b.status, String(b.note || ''));
    const note = String(b.note || 'Owner changed lifecycle status');
    const source = await ingest(
      {
        provider: 'manual',
        externalId: crypto.randomUUID(),
        title: `Owner confirmation: ${n.label}`,
        body: note.length >= 12 ? note : `Owner confirms status ${b.status}.`,
        domain: n.domain,
        kind: 'owner-confirmation',
        sourceCreatedAt: now,
      },
      actor,
    );
    ops.push(
      stmt(
        'UPDATE entities SET metadata=?,updated_at=? WHERE id=?',
        JSON.stringify({
          ...JSON.parse(n.metadata),
          lifecycle: b.status,
          confirmationSource: source.sourceId,
        }),
        now,
        target,
      ),
    );
    ops.push(
      stmt(
        'INSERT INTO feedback(id,target,action,note,created_at) VALUES(?,?,?,?,?)',
        crypto.randomUUID(),
        target,
        'status',
        note,
        now,
      ),
    );
  } else if (b.action === 'correct') {
    const a = await first('SELECT * FROM assertions WHERE id=?', target);
    requireValue(a, 'Assertion not found');
    requireValue(!a.superseded_by, 'This assertion was already corrected');
    requireValue(
      typeof b.text === 'string' && b.text.trim().length >= 12,
      'Correction must include at least 12 characters',
    );
    requireValue(
      typeof b.note === 'string' && b.note.trim().length >= 12,
      'Explain the correction',
    );
    const n1 = await first('SELECT * FROM entities WHERE id=?', a.subject),
      n2 = await first('SELECT * FROM entities WHERE id=?', a.object);
    const captured = await ingest(
      {
        provider: 'manual',
        externalId: crypto.randomUUID(),
        title: `Correction: ${n1.label} → ${n2.label}`,
        domain: n1.domain,
        body: b.text + '\n\nReason: ' + b.note,
        kind: 'owner-correction',
        sourceCreatedAt: now,
        entities: [
          {
            key: 's',
            label: n1.label,
            type: n1.type,
            identity: 'correction:' + n1.id,
          },
          {
            key: 'o',
            label: n2.label,
            type: n2.type,
            identity: 'correction:' + n2.id,
          },
        ],
        claims: [
          {
            subject: 's',
            predicate: a.predicate,
            object: 'o',
            statement: b.text,
            type: a.assertion_type,
            quote: b.text,
            confidence: 1,
            rationale: 'Explicit owner correction.',
            validFrom: now,
          },
        ],
      },
      actor,
    );
    const newId = `${captured.revisionId}_a0`;
    ops.push(
      stmt(
        'UPDATE assertions SET subject=?,object=? WHERE id=?',
        a.subject,
        a.object,
        newId,
      ),
    );
    ops.push(
      stmt(
        'UPDATE assertions SET status=?,valid_to=?,superseded_by=? WHERE id=? AND superseded_by IS NULL',
        'SUPERSEDED',
        now,
        newId,
        target,
      ),
    );
  } else if (b.action === 'merge') {
    requireValue(target !== b.into, 'Choose different entities');
    const a = await first('SELECT * FROM entities WHERE id=?', target),
      c = await first('SELECT * FROM entities WHERE id=?', b.into);
    requireValue(
      a && c && a.type === c.type && !a.merged_into && !c.merged_into,
      'Merge needs two unmerged entities of the same type',
    );
    requireValue(
      typeof b.note === 'string' && b.note.trim().length >= 12,
      'Explain the identity evidence',
    );
    ops.push(
      stmt(
        'UPDATE entities SET merged_into=?,updated_at=? WHERE id=?',
        b.into,
        now,
        target,
      ),
    );
    ops.push(
      stmt(
        'INSERT INTO feedback(id,target,action,note,created_at) VALUES(?,?,?,?,?)',
        crypto.randomUUID(),
        target,
        'merge',
        b.note,
        now,
      ),
    );
  } else if (b.action === 'split') {
    requireValue(
      await first(
        'SELECT id FROM entities WHERE id=? AND merged_into IS NOT NULL',
        target,
      ),
      'Entity is not merged',
    );
    ops.push(
      stmt(
        'UPDATE entities SET merged_into=NULL,updated_at=? WHERE id=?',
        now,
        target,
      ),
    );
  } else if (b.action === 'save-view') {
    requireValue(
      typeof b.name === 'string' &&
        b.name.trim().length > 0 &&
        b.name.length <= 80,
      'Give the view a short name',
    );
    ops.push(
      stmt(
        'INSERT INTO saved_views(id,name,filters,created_at) VALUES(?,?,?,?)',
        crypto.randomUUID(),
        b.name,
        JSON.stringify(b.filters || {}),
        now,
      ),
    );
  } else if (b.action === 'connector-config') {
    requireValue(
      Array.isArray(b.connectors) && b.connectors.length <= 20,
      'Invalid connector metadata',
    );
    for (const c of b.connectors) {
      requireValue(
        typeof c.id === 'string' &&
          typeof c.name === 'string' &&
          c.id &&
          c.name,
        'Invalid connector',
      );
      const alias = c.id;
      const id =
        (
          { 'google-drive': 'drive', atlassian: 'confluence' } as Record<
            string,
            string
          >
        )[c.id] || c.id;
      const detail =
        typeof c.detail === 'string'
          ? { description: c.detail }
          : c.detail || {};
      requireValue(
        typeof detail === 'object' && !Array.isArray(detail),
        'Connector detail must be an object',
      );
      if (alias !== id)
        ops.push(stmt('DELETE FROM connectors WHERE id=?', alias));
      ops.push(
        stmt(
          'INSERT INTO connectors(id,name,status,last_sync,cursor,detail) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,last_sync=excluded.last_sync,cursor=excluded.cursor,detail=excluded.detail',
          id,
          c.name,
          String(c.status || 'UNAVAILABLE').toUpperCase(),
          c.lastSync || null,
          c.cursor || null,
          JSON.stringify(detail),
        ),
      );
    }
  } else if (b.action === 'ontology-propose') {
    const latest = await first('SELECT MAX(version) AS v FROM ontology');
    requireValue(
      b.schema &&
        Array.isArray(b.schema.entityTypes) &&
        Array.isArray(b.schema.relations) &&
        Array.isArray(b.schema.domains),
      'Invalid ontology schema',
    );
    requireValue(
      b.schema.entityTypes.every((t: any) => typeof t.name === 'string') &&
        b.schema.relations.every((t: any) => typeof t.name === 'string'),
      'Invalid ontology terms',
    );
    ops.push(
      stmt(
        'INSERT INTO ontology(version,schema,status,created_at,approved_by) VALUES(?,?,?,?,?)',
        Number(latest?.v || 0) + 1,
        JSON.stringify(b.schema),
        'PROPOSED',
        now,
        actor,
      ),
    );
  } else if (b.action === 'ontology-approve') {
    const proposed = await first(
      'SELECT * FROM ontology WHERE version=? AND status=?',
      b.version,
      'PROPOSED',
    );
    requireValue(proposed, 'Proposal not found');
    const p = JSON.parse(proposed.schema);
    const types = await rows('SELECT DISTINCT type FROM entities'),
      relations = await rows('SELECT DISTINCT predicate FROM assertions');
    requireValue(
      types.every((t) => p.entityTypes.some((n: any) => n.name === t.type)) &&
        relations.every((t) =>
          p.relations.some((n: any) => n.name === t.predicate),
        ),
      'Migration would orphan existing knowledge',
    );
    ops.push(
      stmt("UPDATE ontology SET status='ARCHIVED' WHERE status='ACTIVE'"),
    );
    ops.push(
      stmt(
        "UPDATE ontology SET status='ACTIVE',approved_by=? WHERE version=?",
        actor,
        b.version,
      ),
    );
  } else throw new BrainError(400, 'Unknown operation');
  ops.push(
    stmt(
      'INSERT INTO audit(id,actor,action,target,created_at,detail) VALUES(?,?,?,?,?,?)',
      crypto.randomUUID(),
      actor,
      b.action === 'correct'
        ? 'CORRECTED'
        : b.action === 'status'
          ? 'CONFIRMED'
          : b.action.toUpperCase(),
      target,
      now,
      JSON.stringify({
        note: b.note || null,
        status: b.status || null,
        into: b.into || null,
      }),
    ),
  );
  await db().batch(ops);
  return { ok: true, action: b.action, id: target };
}
