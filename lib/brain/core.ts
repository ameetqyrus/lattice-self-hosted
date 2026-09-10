export const DOMAINS = [
  'PROFESSIONAL',
  'PERSONAL',
  'LEARNING',
  'IDEAS',
  'TECHNOLOGY',
  'FINANCE',
  'TRAVEL',
  'HEALTH & FITNESS',
  'FAMILY',
  'RELATIONSHIPS',
  'BOOKS & MEDIA',
  'PHOTOGRAPHY / HOBBIES',
  'HOME / PROPERTY',
  'PERSONAL ADMIN',
  'GOALS',
];
export const TYPES = [
  'Entity',
  'Person',
  'Organization',
  'Company',
  'Customer',
  'Vendor',
  'Institution',
  'Project',
  'Product',
  'ProductFeature',
  'Technology',
  'Tool',
  'AIModel',
  'Agent',
  'ArchitectureComponent',
  'Repository',
  'Document',
  'Email',
  'Conversation',
  'Meeting',
  'Podcast',
  'PodcastEpisode',
  'Event',
  'Place',
  'Topic',
  'Concept',
  'Idea',
  'Hypothesis',
  'Belief',
  'Prediction',
  'Decision',
  'Question',
  'Answer',
  'Action',
  'Commitment',
  'Goal',
  'Milestone',
  'Risk',
  'Opportunity',
  'Problem',
  'Requirement',
  'Insight',
  'Trend',
  'Metric',
  'FinancialItem',
  'TravelPlan',
  'HealthMetric',
  'Property',
  'SourceArtifact',
];
export const RELATIONS = [
  'WORKS_WITH',
  'REPORTS_TO',
  'MANAGES',
  'OWNS',
  'PARTICIPATED_IN',
  'MENTIONED_IN',
  'DISCUSSED_IN',
  'DISCUSSES',
  'RELATES_TO',
  'DEPENDS_ON',
  'BLOCKS',
  'SUPPORTS',
  'CONTRADICTS',
  'REINFORCES',
  'SUPERSEDES',
  'RESULTED_IN',
  'CAUSED',
  'MAY_CAUSE',
  'INFLUENCED',
  'CHANGED',
  'PROPOSED',
  'DECIDED',
  'OWNS_ACTION',
  'ASSIGNED_TO',
  'COMMITTED_TO',
  'DUE_ON',
  'IMPLEMENTED_BY',
  'EVIDENCED_BY',
  'DERIVED_FROM',
  'SOURCE_FOR',
  'PART_OF',
  'BELONGS_TO',
  'USES',
  'COMPETES_WITH',
  'CUSTOMER_OF',
  'WORKS_ON',
  'IMPACTS',
  'PRECEDES',
  'FOLLOWED_BY',
  'SIMILAR_TO',
];
export const CLAIM_TYPES = [
  'FACT',
  'INFERENCE',
  'HYPOTHESIS',
  'OPINION',
  'PREDICTION',
  'DECISION',
  'QUESTION',
  'ACTION',
  'IDEA',
];
export const INITIAL_ONTOLOGY = {
  version: 1,
  entityTypes: TYPES.map((name) => ({
    name,
    parent: ['Company', 'Customer', 'Vendor', 'Institution'].includes(name)
      ? 'Organization'
      : name === 'Entity'
        ? null
        : 'Entity',
    aliases: [],
    deprecated: false,
  })),
  relations: RELATIONS.map((name) => ({
    name,
    subjectTypes: ['Entity'],
    objectTypes: ['Entity'],
    cardinality: 'many-to-many',
    deprecated: false,
  })),
  domains: DOMAINS,
  assertionTypes: CLAIM_TYPES,
};
export type NodeInput = {
  key: string;
  label: string;
  type: string;
  domain?: string;
  identity?: string;
  aliases?: string[];
  metadata?: Record<string, unknown>;
};
export type ClaimInput = {
  subject: string;
  predicate: string;
  object: string;
  statement: string;
  type: string;
  quote: string;
  confidence: number;
  rationale: string;
  validFrom?: string;
  validTo?: string;
  memoryType?: string;
  metadata?: Record<string, unknown>;
};
export type SourceInput = {
  provider: string;
  externalId: string;
  title: string;
  url?: string;
  domain: string;
  sourceCreatedAt?: string;
  observedAt?: string;
  body: string;
  kind: string;
  metadata?: Record<string, unknown>;
  entities?: NodeInput[];
  claims?: ClaimInput[];
};
export class BrainError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireValue(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new BrainError(400, message);
}
export function safeUrl(value?: string | null) {
  if (!value) return null;
  try {
    const u = new URL(value);
    return ['https:', 'http:'].includes(u.protocol) &&
      !u.username &&
      !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function validDate(d: string) {
  return !isNaN(Date.parse(d)) && /^\d{4}-\d{2}-\d{2}T/.test(d);
}
export function normalize(s: string) {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
export async function hash(s: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)),
    ),
  )
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
}
export function segment(body: string, size = 1800) {
  const result: { body: string; start: number; end: number }[] = [];
  for (let start = 0; start < body.length;) {
    let end = Math.min(start + size, body.length);
    if (end < body.length) {
      const nl = body.lastIndexOf('\n', end);
      if (nl > start + size / 2) end = nl;
    }
    result.push({ body: body.slice(start, end), start, end });
    start = end;
  }
  return result;
}
export function validateInput(x: SourceInput, ontology = INITIAL_ONTOLOGY) {
  requireValue(x && typeof x === 'object', 'Expected a source');
  for (const k of [
    'provider',
    'externalId',
    'title',
    'domain',
    'body',
    'kind',
  ] as const)
    requireValue(
      typeof x[k] === 'string' && x[k].trim().length > 0,
      `Missing ${k}`,
    );
  requireValue(x.body.length <= 250000, 'Source exceeds 250,000 characters');
  requireValue(
    x.title.length <= 500 && x.externalId.length <= 500,
    'Identifier or title too long',
  );
  requireValue(ontology.domains.includes(x.domain), 'Unknown domain');
  if (x.sourceCreatedAt)
    requireValue(validDate(x.sourceCreatedAt), 'Invalid source date');
  if (x.observedAt)
    requireValue(validDate(x.observedAt), 'Invalid observation date');
  requireValue(
    (x.entities?.length || 0) <= 120 && (x.claims?.length || 0) <= 180,
    'Extraction exceeds size limit',
  );
  requireValue(
    !x.entities || Array.isArray(x.entities),
    'Entities must be an array',
  );
  requireValue(!x.claims || Array.isArray(x.claims), 'Claims must be an array');
  const keys = new Set<string>();
  for (const n of x.entities || []) {
    requireValue(
      n.key && n.label?.trim() && n.label.length <= 300,
      'Invalid entity',
    );
    requireValue(!keys.has(n.key), 'Duplicate entity key');
    keys.add(n.key);
    requireValue(
      ontology.entityTypes.some((t) => t.name === n.type && !t.deprecated),
      'Unknown entity type',
    );
    requireValue(
      ontology.domains.includes(n.domain || x.domain),
      'Unknown entity domain',
    );
  }
  for (const c of x.claims || []) {
    requireValue(
      keys.has(c.subject) && keys.has(c.object),
      'Unknown assertion endpoint',
    );
    requireValue(
      ontology.relations.some((t) => t.name === c.predicate && !t.deprecated),
      'Unknown relation',
    );
    requireValue(CLAIM_TYPES.includes(c.type), 'Unknown assertion type');
    requireValue(
      typeof c.statement === 'string' &&
        c.statement.length > 0 &&
        c.statement.length <= 2000,
      'Invalid statement',
    );
    requireValue(
      typeof c.quote === 'string' &&
        c.quote.trim().length >= 12 &&
        x.body.includes(c.quote),
      'Evidence quote must exist exactly in this source',
    );
    requireValue(
      Number.isFinite(c.confidence) && c.confidence >= 0 && c.confidence <= 1,
      'Invalid confidence',
    );
    requireValue(
      typeof c.rationale === 'string' && c.rationale.length > 0,
      'Confidence needs a rationale',
    );
    if (c.validFrom) requireValue(validDate(c.validFrom), 'Invalid validFrom');
    if (c.validTo)
      requireValue(
        validDate(c.validTo) &&
          c.validTo > (c.validFrom || x.sourceCreatedAt || ''),
        'Invalid validity interval',
      );
    if (c.predicate === 'CAUSED')
      requireValue(
        c.type === 'FACT' && c.confidence >= 0.9,
        'Use MAY_CAUSE for uncertain causality',
      );
  }
  return x;
}
export function entityIdentity(n: NodeInput, sourceId: string) {
  return n.identity
    ? `verified:${normalize(n.identity)}`
    : [
          'Person',
          'Idea',
          'Decision',
          'Commitment',
          'Action',
          'Risk',
          'Question',
          'Hypothesis',
          'Insight',
        ].includes(n.type)
      ? `unresolved:${sourceId}:${normalize(n.label)}`
      : `label:${n.domain || ''}:${normalize(n.label)}`;
}
export function inTime(a: any, asOf?: string) {
  return !asOf || (a.valid_from <= asOf && (!a.valid_to || a.valid_to > asOf));
}
export function findPath(edges: any[], from: string, to: string, maxHops = 5) {
  if (from === to) return [];
  const queue: { id: string; path: any[] }[] = [{ id: from, path: [] }];
  const seen = new Set([from]);
  while (queue.length) {
    const { id, path } = queue.shift()!;
    if (path.length >= maxHops) continue;
    for (const e of edges) {
      const next =
        e.subject === id ? e.object : e.object === id ? e.subject : null;
      if (!next || seen.has(next)) continue;
      const nextPath = [
        ...path,
        { ...e, traversedFrom: id, traversedTo: next },
      ];
      if (next === to) return nextPath;
      seen.add(next);
      queue.push({ id: next, path: nextPath });
    }
  }
  return null;
}
export function cosine(a: number[], b: number[]) {
  if (a.length !== b.length || !a.length) return 0;
  let d = 0,
    x = 0,
    y = 0;
  for (let i = 0; i < a.length; i++) {
    d += a[i] * b[i];
    x += a[i] ** 2;
    y += b[i] ** 2;
  }
  return x && y ? d / Math.sqrt(x * y) : 0;
}
export function queryPlan(q: string) {
  return {
    lexical: true,
    semantic: true,
    graph: true,
    temporal: /latest|when|before|after|changed|evol|week|month|year/i.test(q),
    claimType: /decid|decision/i.test(q)
      ? 'DECISION'
      : /commit|owe|follow.up/i.test(q)
        ? 'ACTION'
        : /idea/i.test(q)
          ? 'IDEA'
          : null,
  };
}
export function queryTerms(q: string) {
  const stop = new Set(
    'what when where who how why did does do i my me the a an on in to for of and about have has is are was were with latest please tell show everything we our this that it'.split(
      ' ',
    ),
  );
  return normalize(q)
    .split(' ')
    .filter((t) => t.length > 2 && !stop.has(t))
    .slice(0, 12);
}
export function closeAllowed(status: string, note: string) {
  requireValue(
    !['DONE', 'CANCELLED'].includes(status) || note.trim().length >= 12,
    'Closure requires an explicit confirmation or evidence of at least 12 characters',
  );
}
