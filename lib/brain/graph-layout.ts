export type GraphNode = {
  id: string;
  label: string;
  type: string;
  [key: string]: any;
};
export type GraphEdge = {
  id: string;
  subject: string;
  object: string;
  status?: string;
  [key: string]: any;
};
export function graphSubset(
  nodes: GraphNode[],
  edges: GraphEdge[],
  focus?: string,
  hops = 1,
  historical = false,
  limit = 500,
) {
  const validIds = new Set(nodes.map((n) => n.id));
  let links = edges.filter(
    (e) =>
      (historical || e.status === 'ACTIVE') &&
      validIds.has(e.subject) &&
      validIds.has(e.object),
  );
  let eligible = nodes;
  if (focus) {
    const seen = new Set([focus]);
    for (let i = 0; i < hops; i++) {
      const next = new Set(seen);
      for (const e of links) {
        if (seen.has(e.subject)) next.add(e.object);
        if (seen.has(e.object)) next.add(e.subject);
      }
      for (const id of next) seen.add(id);
    }
    eligible = nodes.filter((n) => seen.has(n.id));
  }
  const degree = new Map<string, number>();
  for (const e of links) {
    degree.set(e.subject, (degree.get(e.subject) || 0) + 1);
    degree.set(e.object, (degree.get(e.object) || 0) + 1);
  }
  const ordered = [...eligible].sort(
    (a, b) =>
      Number(b.id === focus) - Number(a.id === focus) ||
      (degree.get(b.id) || 0) - (degree.get(a.id) || 0) ||
      a.id.localeCompare(b.id),
  );
  const chosen = ordered.slice(0, limit),
    ids = new Set(chosen.map((n) => n.id));
  links = links.filter((e) => ids.has(e.subject) && ids.has(e.object));
  return {
    nodes: chosen.map((n) => ({ ...n, degree: degree.get(n.id) || 0 })),
    edges: links,
    omitted: Math.max(0, eligible.length - chosen.length),
  };
}
export function layoutGraph(
  nodes: (GraphNode & { degree: number })[],
  edges: GraphEdge[],
) {
  const unique = new Map<string, GraphEdge>();
  for (const e of edges) unique.set([e.subject, e.object].sort().join('|'), e);
  const points = nodes.map((n, i) => ({
    ...n,
    x: Math.cos(i * 2.399963) * Math.sqrt(i + 1) * 38,
    y: Math.sin(i * 2.399963) * Math.sqrt(i + 1) * 32,
  }));
  const byId = new Map(points.map((n) => [n.id, n]));
  for (let it = 0; it < 220; it++) {
    const forces = points.map((p) => ({ x: -p.x * 0.003, y: -p.y * 0.004 }));
    for (let i = 0; i < points.length; i++)
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i],
          b = points[j],
          dx = a.x - b.x,
          dy = a.y - b.y,
          d = Math.max(1, Math.hypot(dx, dy));
        const push =
          Math.min(16, 1700 / (d * d)) + (d < 46 ? (46 - d) * 0.06 : 0);
        forces[i].x += (dx / d) * push;
        forces[i].y += (dy / d) * push;
        forces[j].x -= (dx / d) * push;
        forces[j].y -= (dy / d) * push;
      }
    const idx = new Map(points.map((n, i) => [n.id, i]));
    for (const e of unique.values()) {
      const a = byId.get(e.subject),
        b = byId.get(e.object);
      if (!a || !b || a === b) continue;
      const dx = b.x - a.x,
        dy = b.y - a.y,
        d = Math.max(1, Math.hypot(dx, dy)),
        pull = (d - 90) * 0.017;
      forces[idx.get(a.id)!].x += (dx / d) * pull;
      forces[idx.get(a.id)!].y += (dy / d) * pull;
      forces[idx.get(b.id)!].x -= (dx / d) * pull;
      forces[idx.get(b.id)!].y -= (dy / d) * pull;
    }
    const cooling = 2 * (1 - it / 260);
    points.forEach((n, i) => {
      n.x += Math.max(-10, Math.min(10, forces[i].x)) * cooling;
      n.y += Math.max(-10, Math.min(10, forces[i].y)) * cooling;
    });
  }
  const extent = Math.max(
    1,
    ...points.map((p) => Math.abs(p.x) / 500),
    ...points.map((p) => Math.abs(p.y) / 285),
  );
  return points.map((p) => ({ ...p, x: p.x / extent, y: p.y / extent }));
}
