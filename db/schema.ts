import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
export const sources = sqliteTable(
  'sources',
  {
    id: text().primaryKey(),
    provider: text().notNull(),
    externalId: text('external_id').notNull(),
    title: text().notNull(),
    url: text(),
    domain: text().notNull(),
    visibility: text().notNull().default('PRIVATE'),
    excluded: integer().notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    metadata: text().notNull().default('{}'),
  },
  (t) => [
    uniqueIndex('source_identity').on(t.provider, t.externalId),
    index('source_provider').on(t.provider),
  ],
);
export const revisions = sqliteTable(
  'revisions',
  {
    id: text().primaryKey(),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id),
    contentHash: text('content_hash').notNull(),
    objectKey: text('object_key').notNull(),
    sourceCreatedAt: text('source_created_at'),
    observedAt: text('observed_at').notNull(),
    ingestedAt: text('ingested_at').notNull(),
    status: text().notNull(),
    metadata: text().notNull().default('{}'),
  },
  (t) => [
    uniqueIndex('source_revision').on(t.sourceId, t.contentHash),
    index('revision_source').on(t.sourceId, t.ingestedAt),
  ],
);
export const passages = sqliteTable(
  'passages',
  {
    id: text().primaryKey(),
    revisionId: text('revision_id')
      .notNull()
      .references(() => revisions.id),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id),
    body: text().notNull(),
    start: integer().notNull(),
    end: integer().notNull(),
    locator: text(),
    embedding: text(),
    embeddingModel: text('embedding_model'),
  },
  (t) => [index('passage_source').on(t.sourceId)],
);
export const entities = sqliteTable(
  'entities',
  {
    id: text().primaryKey(),
    label: text().notNull(),
    type: text().notNull(),
    domain: text().notNull(),
    identity: text().notNull(),
    aliases: text().notNull().default('[]'),
    status: text().notNull().default('ACTIVE'),
    pinned: integer().notNull().default(0),
    mergedInto: text('merged_into'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    metadata: text().notNull().default('{}'),
  },
  (t) => [
    uniqueIndex('entity_identity').on(t.type, t.identity),
    index('entity_type').on(t.type, t.domain),
  ],
);
export const assertions = sqliteTable(
  'assertions',
  {
    id: text().primaryKey(),
    subject: text()
      .notNull()
      .references(() => entities.id),
    predicate: text().notNull(),
    object: text()
      .notNull()
      .references(() => entities.id),
    statement: text().notNull(),
    assertionType: text('assertion_type').notNull(),
    memoryType: text('memory_type').notNull(),
    confidence: real().notNull(),
    rationale: text().notNull(),
    validFrom: text('valid_from').notNull(),
    validTo: text('valid_to'),
    observedAt: text('observed_at').notNull(),
    sourceCreatedAt: text('source_created_at'),
    ingestedAt: text('ingested_at').notNull(),
    supersededBy: text('superseded_by'),
    status: text().notNull().default('ACTIVE'),
    ontologyVersion: integer('ontology_version').notNull(),
    metadata: text().notNull().default('{}'),
  },
  (t) => [
    index('assertion_subject').on(t.subject, t.validFrom),
    index('assertion_object').on(t.object, t.validFrom),
    index('assertion_type').on(t.assertionType, t.status),
  ],
);
export const evidence = sqliteTable(
  'evidence',
  {
    id: text().primaryKey(),
    assertionId: text('assertion_id')
      .notNull()
      .references(() => assertions.id),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id),
    revisionId: text('revision_id')
      .notNull()
      .references(() => revisions.id),
    quote: text().notNull(),
    start: integer().notNull(),
    end: integer().notNull(),
    locator: text(),
    kind: text().notNull(),
  },
  (t) => [
    index('evidence_assertion').on(t.assertionId),
    index('evidence_source').on(t.sourceId),
  ],
);
export const ontology = sqliteTable('ontology', {
  version: integer().primaryKey(),
  schema: text().notNull(),
  status: text().notNull(),
  createdAt: text('created_at').notNull(),
  approvedBy: text('approved_by').notNull(),
});
export const jobs = sqliteTable(
  'jobs',
  {
    id: text().primaryKey(),
    kind: text().notNull(),
    sourceId: text('source_id'),
    status: text().notNull(),
    attempts: integer().notNull().default(0),
    error: text(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    payload: text().notNull().default('{}'),
  },
  (t) => [index('job_status').on(t.status, t.updatedAt)],
);
export const audit = sqliteTable('audit', {
  id: text().primaryKey(),
  actor: text().notNull(),
  action: text().notNull(),
  target: text().notNull(),
  createdAt: text('created_at').notNull(),
  detail: text().notNull().default('{}'),
});
export const feedback = sqliteTable('feedback', {
  id: text().primaryKey(),
  target: text().notNull(),
  action: text().notNull(),
  note: text().notNull(),
  createdAt: text('created_at').notNull(),
});
export const connectors = sqliteTable('connectors', {
  id: text().primaryKey(),
  name: text().notNull(),
  status: text().notNull(),
  enabled: integer().notNull().default(1),
  lastSync: text('last_sync'),
  cursor: text(),
  detail: text().notNull().default('{}'),
});
export const settings = sqliteTable('settings', {
  key: text().primaryKey(),
  value: text().notNull(),
});
export const savedViews = sqliteTable('saved_views', {
  id: text().primaryKey(),
  name: text().notNull(),
  filters: text().notNull(),
  createdAt: text('created_at').notNull(),
});
export const metrics = sqliteTable(
  'metrics',
  {
    id: text().primaryKey(),
    entityId: text('entity_id').notNull(),
    metric: text().notNull(),
    value: real().notNull(),
    unit: text().notNull(),
    observedAt: text('observed_at').notNull(),
    sourceId: text('source_id').notNull(),
  },
  (t) => [index('metric_series').on(t.entityId, t.metric, t.observedAt)],
);
