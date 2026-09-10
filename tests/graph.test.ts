import test from 'node:test';
import assert from 'node:assert/strict';
import { graphSubset, layoutGraph } from '../lib/brain/graph-layout.ts';
const nodes = ['a', 'b', 'c', 'd'].map((id) => ({
  id,
  label: id,
  type: 'Topic',
}));
const edges = [
  { id: 'ab', subject: 'a', object: 'b', status: 'ACTIVE' },
  { id: 'bc', subject: 'b', object: 'c', status: 'ACTIVE' },
  { id: 'cd', subject: 'c', object: 'd', status: 'SUPERSEDED' },
  { id: 'ghost', subject: 'a', object: 'missing', status: 'ACTIVE' },
];
test('local graph expands exactly the requested number of hops', () => {
  assert.deepEqual(
    graphSubset(nodes, edges, 'a', 1)
      .nodes.map((n) => n.id)
      .sort(),
    ['a', 'b'],
  );
  assert.deepEqual(
    graphSubset(nodes, edges, 'a', 2)
      .nodes.map((n) => n.id)
      .sort(),
    ['a', 'b', 'c'],
  );
});
test('filtered graphs never restore endpoints outside the filters', () => {
  const result = graphSubset(nodes.slice(0, 2), edges);
  assert.deepEqual(
    result.edges.map((e) => e.id),
    ['ab'],
  );
});
test('history can include superseded relationships, current graph cannot', () => {
  assert.equal(graphSubset(nodes, edges).edges.length, 2);
  assert.equal(graphSubset(nodes, edges, undefined, 1, true).edges.length, 3);
});
test('a low-degree focus survives the rendering cap', () => {
  const result = graphSubset(nodes, edges, 'c', 2, false, 1);
  assert.equal(result.nodes[0].id, 'c');
  assert.equal(result.omitted, 2);
  assert.equal(result.edges.length, 0);
});
test('layout is deterministic, finite, and does not mutate source objects', () => {
  const input = graphSubset(nodes, edges),
    before = JSON.stringify(input),
    a = layoutGraph(input.nodes, input.edges);
  assert.deepEqual(a, layoutGraph(input.nodes, input.edges));
  assert.equal(JSON.stringify(input), before);
  assert.ok(
    a.every(
      (n) =>
        Number.isFinite(n.x) &&
        Number.isFinite(n.y) &&
        Math.abs(n.x) <= 500 &&
        Math.abs(n.y) <= 285,
    ),
  );
  assert.ok(Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) > 10);
});
test('empty and single-node graphs remain usable', () => {
  assert.deepEqual(layoutGraph([], []), []);
  assert.equal(layoutGraph([{ ...nodes[0], degree: 0 }], []).length, 1);
});
