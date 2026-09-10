'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Network,
  Plus,
  Minus,
  Maximize,
  Minimize,
  RotateCcw,
  ArrowLeft,
  Search,
  X,
  ScanEye,
  Type,
  Move,
} from 'lucide-react';
import { graphSubset, layoutGraph } from '@/lib/brain/graph-layout';
export const COLORS: Record<string, string> = {
  Person: '#e4b988',
  Project: '#8eabff',
  Product: '#8eabff',
  Idea: '#c3a3fa',
  Decision: '#76d2b5',
  Commitment: '#edc46c',
  Action: '#edc46c',
  Technology: '#82c9de',
  Meeting: '#96a8bd',
  Topic: '#8ac6be',
  Document: '#96a8bd',
  Risk: '#ed8da2',
  Question: '#e1aaed',
};
const color = (type: string) => COLORS[type] || '#9aaaca';
export default function GraphView({
  nodes,
  edges,
  onNode,
  onEdge,
  selected,
  compact = false,
  focus,
  hops = 1,
  onFocus,
  asOf,
}: {
  nodes: any[];
  edges: any[];
  onNode: (id: string) => void;
  onEdge: (id: string) => void;
  selected?: string;
  compact?: boolean;
  focus?: string;
  hops?: number;
  onFocus?: (id?: string) => void;
  asOf?: string;
}) {
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [hover, setHover] = useState<string>(),
    [search, setSearch] = useState(''),
    [labels, setLabels] = useState(false),
    [fullscreen, setFullscreen] = useState(false),
    [positions, setPositions] = useState<
      Record<string, { x: number; y: number }>
    >({}),
    [size, setSize] = useState({ w: 1000, h: 580 }),
    [gpu, setGpu] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null),
    fullscreenButton = useRef<HTMLButtonElement>(null),
    stage = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    renderer = useRef<any>(null),
    drag = useRef<any>(null),
    pointers = useRef(new Map<number, { x: number; y: number }>()),
    suppressClick = useRef(false),
    clickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const key =
    nodes.map((n) => n.id).join(',') +
    '|' +
    edges.map((e) => e.id + e.status).join(',');
  const graph = useMemo(
    () => graphSubset(nodes, edges, focus, hops, !!asOf, compact ? 100 : 500),
    [key, focus, hops, asOf, compact],
  );
  const layout = useMemo(() => layoutGraph(graph.nodes, graph.edges), [graph]);
  const points = layout.map((n) => ({ ...n, ...positions[n.id] }));
  const byId = new Map(points.map((n) => [n.id, n]));
  const fit = Math.min(size.w / 1150, size.h / 690),
    active = hover || selected;
  const connected = new Set(active ? [active] : []);
  if (active)
    for (const e of graph.edges) {
      if (e.subject === active) connected.add(e.object);
      if (e.object === active) connected.add(e.subject);
    }
  const matches = search.trim()
    ? points.filter((n) => n.label.toLowerCase().includes(search.toLowerCase()))
    : [];
  const matchIds = new Set(matches.map((n) => n.id));
  const isLit = (id: string) =>
    search.trim() ? matchIds.has(id) : !active || connected.has(id);
  const showLabel = (n: any) =>
    labels ||
    n.id === active ||
    (active && connected.has(n.id)) ||
    matchIds.has(n.id) ||
    (!active && !search && (n.degree >= 5 || zoom > 1.6));
  const radius = (n: any) => 4.5 + Math.min(5, Math.sqrt(n.degree) * 1.05);
  const zoomAt = (next: number, x = 0, y = 0) => {
    next = Math.min(3.5, Math.max(0.4, next));
    setPan((p) => ({
      x: x - ((x - p.x) * next) / zoom,
      y: y - ((y - p.y) * next) / zoom,
    }));
    setZoom(next);
  };
  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setPositions({});
    setSearch('');
  };
  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      // Evidence inspectors have their own Escape and focus handling.
      if (event.defaultPrevented || document.querySelector('[role="dialog"]'))
        return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setFullscreen(false);
        fullscreenButton.current?.focus({ preventScroll: true });
      }
      if (event.key === 'Tab') {
        const controls = Array.from(
          wrapper.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
          ) || [],
        );
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [fullscreen]);
  useEffect(
    () => () => {
      clearTimeout(clickTimer.current);
    },
    [],
  );
  useEffect(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setPositions({});
  }, [focus, hops]);
  useEffect(() => {
    if (!stage.current) return;
    const r = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    r.observe(stage.current);
    return () => r.disconnect();
  }, []);
  useEffect(() => {
    let stopped = false,
      clean = () => {};
    import('three')
      .then((T) => {
        if (stopped || !canvas.current) return;
        let webgl: any;
        try {
          webgl = new T.WebGLRenderer({
            canvas: canvas.current,
            alpha: true,
            antialias: true,
            powerPreference: 'low-power',
          });
        } catch {
          return;
        }
        webgl.setClearColor(0x000000, 0);
        webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        const scene = new T.Scene(),
          camera = new T.OrthographicCamera(-500, 500, 300, -300, 0.1, 100),
          group = new T.Group();
        camera.position.z = 10;
        scene.add(group);
        const lost = (e: Event) => {
          e.preventDefault();
          setGpu(false);
        };
        canvas.current.addEventListener('webglcontextlost', lost);
        renderer.current = { T, webgl, scene, camera, group };
        setGpu(true);
        clean = () => {
          canvas.current?.removeEventListener('webglcontextlost', lost);
          for (const c of [...group.children] as any[]) {
            c.geometry?.dispose();
            c.material?.dispose();
          }
          webgl.dispose();
          renderer.current = null;
        };
      })
      .catch(() => setGpu(false));
    return () => {
      stopped = true;
      clean();
    };
  }, []);
  useEffect(() => {
    const r = renderer.current;
    if (!r || !gpu) return;
    const { T, webgl, scene, camera, group } = r;
    webgl.setSize(size.w, size.h, false);
    camera.left = -size.w / 2;
    camera.right = size.w / 2;
    camera.top = size.h / 2;
    camera.bottom = -size.h / 2;
    camera.updateProjectionMatrix();
    for (const c of [...group.children]) {
      group.remove(c);
      c.geometry?.dispose();
      c.material?.dispose();
    }
    const vertices: number[] = [],
      colors: number[] = [];
    for (const e of graph.edges) {
      if (['INFERENCE', 'HYPOTHESIS'].includes(e.assertion_type)) continue;
      const a = byId.get(e.subject),
        b = byId.get(e.object);
      if (!a || !b) continue;
      const lit = active && (e.subject === active || e.object === active),
        dim = (active && !lit) || search.trim();
      const c = new T.Color(lit ? '#7994c1' : dim ? '#1c2634' : '#384759');
      vertices.push(a.x, -a.y, 0, b.x, -b.y, 0);
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    const lineGeo = new T.BufferGeometry();
    lineGeo.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    lineGeo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    group.add(
      new T.LineSegments(
        lineGeo,
        new T.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.85,
        }),
      ),
    );
    const dotGeo = new T.BufferGeometry(),
      dotPos: number[] = [],
      dotCol: number[] = [],
      dotSize: number[] = [],
      dotAlpha: number[] = [];
    for (const n of points) {
      const c = new T.Color(color(n.type));
      dotPos.push(n.x, -n.y, 0.1);
      dotCol.push(c.r, c.g, c.b);
      dotSize.push(
        radius(n) * 4 * fit * zoom * Math.min(window.devicePixelRatio || 1, 2),
      );
      dotAlpha.push(isLit(n.id) ? 1 : 0.13);
    }
    dotGeo.setAttribute('position', new T.Float32BufferAttribute(dotPos, 3));
    dotGeo.setAttribute('color', new T.Float32BufferAttribute(dotCol, 3));
    dotGeo.setAttribute('pointSize', new T.Float32BufferAttribute(dotSize, 1));
    dotGeo.setAttribute(
      'pointAlpha',
      new T.Float32BufferAttribute(dotAlpha, 1),
    );
    const mat = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      vertexShader:
        'attribute float pointSize; attribute float pointAlpha; varying vec3 vColor; varying float vAlpha; void main(){vColor=color;vAlpha=pointAlpha;gl_PointSize=pointSize;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:
        'varying vec3 vColor; varying float vAlpha; void main(){float d=length(gl_PointCoord-vec2(0.5))*2.0;float core=1.0-smoothstep(0.40,0.52,d);float halo=(1.0-smoothstep(0.25,1.0,d))*0.12;gl_FragColor=vec4(vColor,max(core,halo)*vAlpha);\n#include <colorspace_fragment>\n}',
    });
    group.add(new T.Points(dotGeo, mat));
    group.scale.set(fit * zoom, fit * zoom, 1);
    group.position.set(pan.x, -pan.y, 0);
    webgl.render(scene, camera);
  }, [graph, positions, zoom, pan, size, hover, selected, search, gpu]);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const b = el.getBoundingClientRect();
      zoomAt(
        zoom * Math.exp(-e.deltaY * 0.0015),
        e.clientX - b.left - size.w / 2,
        e.clientY - b.top - size.h / 2,
      );
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [zoom, size]);
  const down = (e: React.PointerEvent, id?: string) => {
    if (e.button !== 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      drag.current = { pinch: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      suppressClick.current = true;
    } else {
      const n = id ? byId.get(id) : undefined;
      drag.current = {
        id,
        x: e.clientX,
        y: e.clientY,
        px: pan.x,
        py: pan.y,
        nx: n?.x,
        ny: n?.y,
      };
      suppressClick.current = false;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
  };
  const move = (e: React.PointerEvent) => {
    if (!drag.current) return;
    if (pointers.current.has(e.pointerId))
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && drag.current.pinch) {
      const [a, b] = [...pointers.current.values()];
      setZoom(
        Math.min(
          3.5,
          Math.max(
            0.4,
            (drag.current.zoom * Math.hypot(a.x - b.x, a.y - b.y)) /
              drag.current.pinch,
          ),
        ),
      );
      return;
    }
    const d = drag.current,
      dx = e.clientX - d.x,
      dy = e.clientY - d.y;
    if (!Number.isFinite(dx)) return;
    if (Math.hypot(dx, dy) > 4) suppressClick.current = true;
    if (d.id)
      setPositions((p) => ({
        ...p,
        [d.id]: { x: d.nx + dx / (fit * zoom), y: d.ny + dy / (fit * zoom) },
      }));
    else setPan({ x: d.px + dx, y: d.py + dy });
  };
  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };
  return (
    <div
      ref={wrapper}
      className={
        'graph-wrap lattice-graph ' +
        (compact ? 'compact ' : '') +
        (fullscreen ? 'graph-fullscreen' : '')
      }
    >
      <div className="graph-hint">
        <div className="graph-status">
          <span className="status-dot on" />
          {focus ? (
            <button onClick={() => onFocus?.(undefined)}>
              <ArrowLeft size={14} />
              All connections
            </button>
          ) : (
            <span>
              {graph.nodes.length} entities <b>·</b> {graph.edges.length}{' '}
              connections
            </span>
          )}
        </div>
        {fullscreen ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setFullscreen(false);
              fullscreenButton.current?.focus({ preventScroll: true });
            }}
          >
            <Minimize size={15} /> Exit fullscreen
          </Button>
        ) : (
          <span>
            {focus ? 'Focused neighborhood' : 'All knowledge'}
            {asOf ? ' · Historical view' : ''}
          </span>
        )}
      </div>
      <div className="graph-stage" ref={stage}>
        <canvas
          ref={canvas}
          className="graph-webgl"
          aria-hidden="true"
          style={{ opacity: gpu ? 1 : 0 }}
        />
        <svg
          className="knowledge-graph"
          viewBox={`${-size.w / 2} ${-size.h / 2} ${size.w} ${size.h}`}
          role="group"
          aria-label="Interactive knowledge graph"
          onPointerDown={(e) => down(e)}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <g transform={`translate(${pan.x} ${pan.y}) scale(${fit * zoom})`}>
            {graph.edges.map((e) => {
              const a = byId.get(e.subject)!,
                b = byId.get(e.object)!,
                lit = active && (e.subject === active || e.object === active);
              return (
                <g key={e.id}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={lit ? '#7994c1' : '#384759'}
                    strokeWidth={lit ? 1.6 : 1}
                    opacity={
                      gpu &&
                      !['INFERENCE', 'HYPOTHESIS'].includes(e.assertion_type)
                        ? 0
                        : active && !lit
                          ? 0.15
                          : 0.65
                    }
                    strokeDasharray={
                      ['INFERENCE', 'HYPOTHESIS'].includes(e.assertion_type)
                        ? '4 5'
                        : undefined
                    }
                  />
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="transparent"
                    strokeWidth={9 / (fit * zoom)}
                    className="graph-link-target"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => onEdge(e.id)}
                  >
                    <title>{e.statement}</title>
                  </line>
                </g>
              );
            })}
            {points.map((n) => {
              const lit = isLit(n.id),
                r = radius(n),
                label = showLabel(n);
              return (
                <g
                  key={n.id}
                  className="graph-node"
                  transform={`translate(${n.x} ${n.y})`}
                  tabIndex={0}
                  role="button"
                  aria-label={`${n.label}, ${n.type}, ${n.degree} relationships`}
                  onPointerDown={(e) => down(e, n.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!suppressClick.current) {
                      clearTimeout(clickTimer.current);
                      clickTimer.current = setTimeout(() => onNode(n.id), 240);
                    }
                  }}
                  onDoubleClick={() => {
                    clearTimeout(clickTimer.current);
                    onFocus?.(n.id);
                  }}
                  onPointerEnter={() => {
                    if (!drag.current) setHover(n.id);
                  }}
                  onPointerLeave={() => setHover(undefined)}
                  onFocus={() => setHover(n.id)}
                  onBlur={() => setHover(undefined)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onNode(n.id);
                    }
                    if (e.key === 'f') onFocus?.(n.id);
                  }}
                >
                  <title>
                    {n.label} · {n.type}
                  </title>
                  <circle
                    r={Math.max(14 / (fit * zoom), r + 4)}
                    fill="transparent"
                  />
                  {n.id === active && (
                    <circle
                      r={r + 7}
                      fill="none"
                      stroke={color(n.type)}
                      strokeWidth={1.2 / (fit * zoom)}
                      opacity=".6"
                    />
                  )}
                  <circle
                    className="node-core"
                    r={r}
                    fill={color(n.type)}
                    opacity={gpu ? 0 : lit ? 1 : 0.15}
                  />
                  <text
                    className="node-label"
                    y={r + 18 / (fit * zoom)}
                    textAnchor="middle"
                    fill={n.id === active ? '#f0f4ff' : '#b6c1d5'}
                    fontSize={
                      n.id === active ? 14 / (fit * zoom) : 12 / (fit * zoom)
                    }
                    paintOrder="stroke"
                    stroke="#12151b"
                    strokeWidth={4 / (fit * zoom)}
                    style={{
                      opacity: label && lit ? 1 : 0,
                      pointerEvents: 'none',
                    }}
                  >
                    {n.label.length > 34 ? n.label.slice(0, 32) + '…' : n.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
        {!graph.nodes.length && (
          <div className="graph-empty graph-empty-overlay">
            <Network size={32} />
            <h3>No connections in this view</h3>
            <p>Try a broader filter or return to all knowledge.</p>
            {focus && (
              <Button variant="outline" onClick={() => onFocus?.(undefined)}>
                Show all connections
              </Button>
            )}
          </div>
        )}
        {!compact && (
          <div className="graph-search">
            <Search size={15} />
            <input
              aria-label="Find in graph"
              placeholder="Find an entity…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                aria-label="Clear graph search"
                onClick={() => setSearch('')}
              >
                <X size={14} />
              </button>
            )}
            {search && (
              <div className="graph-search-results">
                {matches.length ? (
                  matches.slice(0, 7).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        onNode(n.id);
                        setSearch('');
                      }}
                    >
                      <i style={{ background: color(n.type) }} />
                      {n.label}
                      <small>{n.type}</small>
                    </button>
                  ))
                ) : (
                  <p>No matching entities</p>
                )}
              </div>
            )}
          </div>
        )}
        {hover && byId.has(hover) && (
          <div className="graph-hover-card" aria-live="polite">
            <i style={{ background: color(byId.get(hover)!.type) }} />
            <div>
              <strong>{byId.get(hover)!.label}</strong>
              <span>
                {byId.get(hover)!.type} · {byId.get(hover)!.degree} connections
              </span>
            </div>
            <ScanEye size={16} />
          </div>
        )}
        <div className="graph-corner-label">
          <Network size={14} />
          {focus ? 'LOCAL GRAPH' : 'KNOWLEDGE MAP'}
        </div>
      </div>
      <div className="graph-bottom">
        <div className="legend">
          {['Project', 'Person', 'Idea', 'Decision', 'Technology', 'Action']
            .filter((t) => points.some((n) => n.type === t))
            .map((t) => (
              <span key={t}>
                <i style={{ background: color(t) }} />
                {t === 'Action' ? 'Commitment' : t}
              </span>
            ))}
        </div>
        <div className="graph-controls">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Toggle all graph labels"
            aria-pressed={labels}
            onClick={() => setLabels((v) => !v)}
          >
            <Type />
          </Button>
          <span className="graph-control-rule" />
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Zoom out"
            onClick={() => zoomAt(zoom - 0.2)}
          >
            <Minus />
          </Button>
          <span className="graph-zoom" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Zoom in"
            onClick={() => zoomAt(zoom + 0.2)}
          >
            <Plus />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Reset graph view"
            title="Reset graph view"
            onClick={reset}
          >
            <RotateCcw />
          </Button>
          <Button
            ref={fullscreenButton}
            size="icon-sm"
            variant="ghost"
            aria-label={
              fullscreen ? 'Exit fullscreen graph' : 'Enter fullscreen graph'
            }
            aria-pressed={fullscreen}
            title={
              fullscreen
                ? 'Exit fullscreen (Esc)'
                : 'Expand graph to fill window'
            }
            onClick={() => setFullscreen((value) => !value)}
          >
            {fullscreen ? <Minimize /> : <Maximize />}
          </Button>
        </div>
      </div>
      {!compact && (
        <div className="graph-footnote">
          <span>
            <Move size={13} /> Drag to explore · Scroll to zoom · Double-click
            to focus
          </span>
          <span>
            {graph.omitted
              ? `${graph.omitted} more entities. Narrow filters to explore them.`
              : 'Every connection has a source.'}
          </span>
        </div>
      )}
    </div>
  );
}
