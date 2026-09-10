import { authorized, checkOrigin, body, json, fail } from '@/lib/brain/auth';
import { search, ask, graph, insights } from '@/lib/brain/retrieve';
import { first, rows } from '@/db';
import { BrainError, findPath } from '@/lib/brain/core';
export async function invoke(name: string, args: any) {
  const g = async () => graph(args.asOf);
  switch (name) {
    case 'search_memory':
      return search(args.query, args.asOf);
    case 'ask_brain':
      return ask(args.question, args.asOf);
    case 'get_entity': {
      const world = await g();
      return world.nodes.find((n) => n.id === args.id) || null;
    }
    case 'get_relationships':
    case 'get_entity_timeline': {
      const world = await g();
      const assertions = world.assertions.filter(
        (a) => a.subject === args.id || a.object === args.id,
      );
      return {
        assertions,
        evidence: world.evidence.filter((e) =>
          assertions.some((a) => a.id === e.assertion_id),
        ),
      };
    }
    case 'find_path': {
      const world = await g();
      const path = findPath(
        world.assertions.filter((a) => a.status === 'ACTIVE'),
        args.from,
        args.to,
        Math.min(6, args.maxHops || 4),
      );
      return {
        path,
        evidence: world.evidence.filter((e) =>
          path?.some((a) => a.id === e.assertion_id),
        ),
      };
    }
    case 'query_graph': {
      const world = await g();
      return {
        ...world,
        nodes: world.nodes
          .filter(
            (n) =>
              (!args.type || n.type === args.type) &&
              (!args.domain || n.domain === args.domain),
          )
          .slice(0, 100),
      };
    }
    case 'get_recent_changes':
      return rows(
        'SELECT * FROM audit WHERE action IN (?,?,?,?) ORDER BY created_at DESC LIMIT 50',
        'NEW',
        'UPDATED',
        'CORRECTED',
        'CONFIRMED',
      );
    case 'get_decisions':
    case 'get_ideas':
    case 'get_open_commitments': {
      const world = await g();
      const type =
        name === 'get_decisions'
          ? 'DECISION'
          : name === 'get_ideas'
            ? 'IDEA'
            : 'ACTION';
      const assertions = world.assertions.filter(
        (a) => a.assertion_type === type && a.status === 'ACTIVE',
      );
      const nodes = world.nodes
        .filter((n) => assertions.some((a) => a.object === n.id))
        .filter(
          (n) =>
            name !== 'get_open_commitments' ||
            !['DONE', 'CANCELLED'].includes(JSON.parse(n.metadata).lifecycle),
        );
      return {
        nodes,
        assertions: assertions.filter((a) =>
          nodes.some((n) => n.id === a.object),
        ),
        evidence: world.evidence.filter((e) =>
          assertions.some((a) => a.id === e.assertion_id),
        ),
      };
    }
    case 'get_insights':
      return insights();
    case 'get_daily_brief':
    case 'get_weekly_brief': {
      const world = await g();
      const since = new Date(
        Date.now() - (name === 'get_daily_brief' ? 1 : 7) * 86400000,
      ).toISOString();
      const assertions = world.assertions.filter((a) => a.valid_from >= since);
      return {
        period: { since, until: new Date().toISOString() },
        assertions,
        evidence: world.evidence.filter((e) =>
          assertions.some((a) => a.id === e.assertion_id),
        ),
        coverage: 'Imported subset only; cloud consolidation is not scheduled.',
      };
    }
    default:
      throw new BrainError(400, 'Unknown retrieval operation');
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    await authorized(req);
    const b = await body(req);
    return json(await invoke(b.name, b.arguments || {}));
  } catch (e) {
    return fail(e);
  }
}
