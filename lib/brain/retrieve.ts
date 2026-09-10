import { rows, first, stmt } from '@/db';
import {
  queryPlan,
  queryTerms,
  cosine,
  findPath,
  BrainError,
  requireValue,
  inTime,
} from './core';
import { modelReady, embed, modelJSON } from './model';
export const visibleAssertion = `EXISTS(SELECT 1 FROM evidence ev JOIN sources s ON s.id=ev.source_id WHERE ev.assertion_id=a.id AND s.excluded=0)`;
export async function graph(asOf?: string) {
  const clauses = ["a.status != 'DELETED'", visibleAssertion];
  const args: any[] = [];
  if (asOf) {
    clauses.push('a.valid_from<=? AND (a.valid_to IS NULL OR a.valid_to>?)');
    args.push(asOf, asOf);
  }
  const assertions = await rows(
    `SELECT a.* FROM assertions a WHERE ${clauses.join(' AND ')} ORDER BY a.valid_from DESC LIMIT 2000`,
    ...args,
  );
  const nodes = await rows(
    `SELECT n.* FROM entities n WHERE n.status != 'DELETED' AND EXISTS(SELECT 1 FROM assertions a WHERE (a.subject=n.id OR a.object=n.id) AND a.status!='DELETED' AND ${visibleAssertion}) ORDER BY n.pinned DESC,n.updated_at DESC LIMIT 1500`,
  );
  const evidence = await rows(
    `SELECT ev.*,s.title AS source_title,s.url,s.provider FROM evidence ev JOIN sources s ON s.id=ev.source_id WHERE s.excluded=0 ORDER BY ev.id LIMIT 6000`,
  );
  return {
    nodes,
    assertions,
    evidence,
    limited: assertions.length === 2000 || nodes.length === 1500,
  };
}
export async function search(q: string, asOf?: string) {
  requireValue(
    typeof q === 'string' && q.trim().length > 0 && q.length <= 2000,
    'Enter a question under 2,000 characters',
  );
  const plan = queryPlan(q),
    terms = queryTerms(q),
    started = Date.now();
  const g = await graph(asOf);
  const semantic = { enabled: modelReady(), used: false, error: false };
  let queryVector: number[] | null = null;
  if (modelReady()) {
    try {
      queryVector = (await embed([q]))?.vectors[0] || null;
      semantic.used = !!queryVector;
    } catch {
      semantic.error = true;
    }
  }
  const matchingNodes = g.nodes
    .map((n) => ({
      ...n,
      score: terms.filter((t) =>
        (n.label + ' ' + n.aliases).toLowerCase().includes(t),
      ).length,
    }))
    .filter((n) => n.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
  const ids = new Set(matchingNodes.map((n) => n.id));
  let candidates: any[] = [];
  if (terms.length) {
    const escaped = terms.map((t) => `%${t.replace(/[\\%_]/g, '\\$&')}%`);
    candidates = await rows(
      `SELECT p.id,p.source_id,p.revision_id,p.body,p.start,p.end,p.embedding,p.embedding_model,s.title,s.url,s.provider,r.source_created_at FROM passages p JOIN sources s ON s.id=p.source_id JOIN revisions r ON r.id=p.revision_id WHERE s.excluded=0 AND (${terms.map(() => "p.body LIKE ? ESCAPE '\\'").join(' OR ')}) ${asOf ? 'AND r.source_created_at<=?' : ''} ORDER BY r.source_created_at DESC LIMIT 200`,
      ...escaped,
      ...(asOf ? [asOf] : []),
    );
  }
  if (queryVector) {
    const semanticCandidates = await rows(
      `SELECT p.id,p.source_id,p.revision_id,p.body,p.start,p.end,p.embedding,p.embedding_model,s.title,s.url,s.provider,r.source_created_at FROM passages p JOIN sources s ON s.id=p.source_id JOIN revisions r ON r.id=p.revision_id WHERE s.excluded=0 AND p.embedding IS NOT NULL ${asOf ? 'AND r.source_created_at<=?' : ''} ORDER BY r.source_created_at DESC LIMIT 1500`,
      ...(asOf ? [asOf] : []),
    );
    for (const p of semanticCandidates)
      if (!candidates.some((c) => c.id === p.id)) candidates.push(p);
  }
  const passages = candidates
    .map((p) => {
      const lexical =
          terms.filter((t) => p.body.toLowerCase().includes(t)).length /
          Math.max(1, terms.length),
        vector =
          queryVector && p.embedding
            ? cosine(queryVector, JSON.parse(p.embedding))
            : 0;
      return {
        ...p,
        score: lexical * 0.6 + Math.max(0, vector) * 0.4,
        vector,
        embedding: undefined,
      };
    })
    .filter((p) => p.score > 0.1 || p.vector > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  const claims = g.assertions
    .map((a) => ({
      ...a,
      score:
        terms.filter((t) => a.statement.toLowerCase().includes(t)).length +
        (ids.has(a.subject) || ids.has(a.object) ? 2 : 0) +
        (plan.claimType === a.assertion_type ? 1 : 0),
    }))
    .filter((a) => a.score > 0 && (terms.length || plan.claimType))
    .sort(
      (a, b) => b.score - a.score || b.valid_from.localeCompare(a.valid_from),
    )
    .slice(0, 16);
  const evidence = g.evidence.filter((e) =>
    claims.some((a) => a.id === e.assertion_id),
  );
  return {
    question: q,
    plan,
    claims,
    passages,
    evidence,
    entities: matchingNodes,
    trace: {
      elapsedMs: Date.now() - started,
      semantic,
      graphAssertions: g.assertions.length,
      lexicalCandidates: candidates.length,
      coverageLimited: g.limited,
      asOf: asOf || null,
    },
    missingEvidence: [
      'Imported sources cover a subset of your history. Absence of evidence does not prove something did not happen.',
    ],
  };
}
export async function ask(q: string, asOf?: string) {
  const r = await search(q, asOf);
  if (!r.claims.length && !r.passages.length)
    return {
      ...r,
      mode: 'no-evidence',
      answer: 'I do not have enough evidence to answer this question.',
      confidence: 'UNKNOWN',
      why: 'No relevant evidence was found in the imported sources.',
      contrary: [],
      relatedQuestions: [],
    };
  if (!modelReady())
    return {
      ...r,
      mode: 'evidence-search',
      answer:
        'Relevant evidence is below. Use ChatGPT or Codex to reason over it with your existing subscription.',
      confidence: 'UNKNOWN',
      why: 'Matched source passages and graph assertions. No generated conclusion has been inferred.',
      contrary: [],
      relatedQuestions: [],
    };
  const citations = [
    ...r.evidence.map((e) => ({
      id: e.id,
      text: e.quote,
      source: e.source_title,
      date: r.claims.find((a) => a.id === e.assertion_id)?.valid_from,
    })),
    ...r.passages.map((p) => ({
      id: p.id,
      text: p.body,
      source: p.title,
      date: p.source_created_at,
    })),
  ];
  const response = await modelJSON(
    'REASONING',
    `Answer using ONLY supplied evidence. Return {answer,why,confidence,contrary,missingEvidence,relatedQuestions,claims:[{text,citationIds,type}]}. Each factual sentence belongs to a claims entry with one or more provided citationIds. No unsupported assertions. Preserve historical dates and distinguish latest observed from definitive current position. If conflicting evidence exists show both; do not assume supersession. Do not infer action closure. Confidence must be HIGH,MODERATE,LOW,UNKNOWN. Every item in contrary, missingEvidence, relatedQuestions must be a string. Return no URLs or markdown links.`,
    {
      question: q,
      asOf,
      evidence: citations,
      structuredClaims: r.claims.map((a) => ({
        statement: a.statement,
        type: a.assertion_type,
        date: a.valid_from,
        status: a.status,
      })),
      coverage: r.missingEvidence,
    },
  );
  const allowed = new Set(citations.map((e) => e.id));
  if (!Array.isArray(response.claims) || !response.claims.length)
    throw new BrainError(
      502,
      'The answer did not include traceable claims. Source evidence is still available.',
    );
  for (const claim of response.claims)
    requireValue(
      typeof claim.text === 'string' &&
        Array.isArray(claim.citationIds) &&
        claim.citationIds.length > 0 &&
        claim.citationIds.every((id: string) => allowed.has(id)),
      'AI cited evidence outside the retrieved context',
    );
  return {
    ...r,
    mode: 'ai',
    answer: response.claims.map((c: any) => c.text).join('\n\n'),
    answerClaims: response.claims,
    confidence: ['HIGH', 'MODERATE', 'LOW', 'UNKNOWN'].includes(
      response.confidence,
    )
      ? response.confidence
      : 'UNKNOWN',
    why:
      typeof response.why === 'string'
        ? response.why
        : 'Grounded in retrieved evidence.',
    contrary: response.contrary || [],
    missingEvidence: [
      ...r.missingEvidence,
      ...(Array.isArray(response.missingEvidence)
        ? response.missingEvidence
        : []),
    ],
    relatedQuestions: response.relatedQuestions || [],
  };
}
export async function insights() {
  const g = await graph();
  const feedback = await rows(
    'SELECT * FROM feedback ORDER BY created_at DESC',
  );
  const output: any[] = [];
  for (const n of g.nodes.filter((n) =>
    ['Product', 'Project', 'Technology', 'Idea', 'Topic'].includes(n.type),
  )) {
    const linked = g.assertions.filter(
      (a) => a.subject === n.id || a.object === n.id,
    );
    const ev = g.evidence.filter((e) =>
      linked.some((a) => a.id === e.assertion_id),
    );
    const unique = Array.from(new Set(ev.map((e) => e.source_id)));
    if (unique.length >= 2) {
      const id = 'convergence_' + n.id;
      const f = feedback.find((f) => f.target === id);
      output.push({
        id,
        title: `${n.label} connects ${unique.length} sources`,
        type: 'CROSS-SOURCE CONVERGENCE',
        explanation: `${unique.length} distinct source artifacts refer to this entity. This is a connection to investigate; shared mention alone does not establish agreement or independent corroboration.`,
        whyItMatters:
          'Review the linked decisions and ideas together to see whether they support the same direction.',
        confidence: 'MODERATE',
        status: f?.action || 'NEW',
        evidence: ev.slice(0, 6),
        nodeId: n.id,
        graphPath: linked.slice(0, 5),
        counterEvidence:
          'These sources may describe different scopes or repeat the same discussion.',
      });
    }
  }
  return output
    .filter((i) => i.status !== 'dismiss')
    .sort(
      (a, b) =>
        (b.status === 'pin' ? 1 : 0) - (a.status === 'pin' ? 1 : 0) ||
        b.evidence.length - a.evidence.length,
    )
    .slice(0, 12);
}
