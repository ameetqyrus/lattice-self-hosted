'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Network,
  Sun,
  Clock3,
  Lightbulb,
  ListChecks,
  BookOpen,
  Radio,
  Database,
  ShieldCheck,
  Search,
  Plus,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  FileText,
  Pin,
  ExternalLink,
  RefreshCw,
  SlidersHorizontal,
  Activity,
  Settings2,
  Download,
  GitBranch,
  AlertCircle,
  Check,
  Focus,
  ArrowLeft,
  Command as CommandIcon,
  X,
  Link as LinkIcon,
  CircleHelp,
  UploadCloud,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import GraphView, { COLORS } from './graph-view';
import { evidencePacket } from '@/lib/brain/context';
import { findPath, inTime, safeUrl } from '@/lib/brain/core';
const nav = [
  ['Today', Sun],
  ['Your world', Network],
  ['Timeline', Clock3],
  ['Decisions', BookOpen],
  ['Ideas', Lightbulb],
  ['Commitments', ListChecks],
  ['Intelligence', Radio],
  ['Sources', Database],
] as const;
const titles: Record<string, [string, string]> = {
  Today: ['YOUR DAILY PERSPECTIVE', 'Welcome back.'],
  'Your world': ['YOUR KNOWLEDGE, CONNECTED', 'Knowledge graph'],
  Timeline: ['KNOWLEDGE THROUGH TIME', 'The story so far.'],
  Decisions: ['CONTEXT THAT ENDURES', 'Your decision ledger.'],
  Ideas: ['FROM SEED TO SOMETHING MORE', 'Ideas worth keeping.'],
  Commitments: ['CLOSE THE LOOP', 'What is still open.'],
  Intelligence: ['A DIFFERENT PERSPECTIVE', 'Connections worth exploring.'],
  Sources: ['THE EVIDENCE LAYER', 'Connected to your world.'],
  Ontology: ['THE SEMANTIC RULEBOOK', 'Your evolving ontology.'],
  System: ['TRUST THROUGH VISIBILITY', 'System health.'],
  Ask: ['SEARCH LATTICE', 'Think with your evidence.'],
};
function CloseMobileNav({ view }: { view: string }) {
  const { setOpenMobile } = useSidebar();
  useEffect(() => setOpenMobile(false), [view, setOpenMobile]);
  return null;
}
const format = (d?: string | null) =>
  d
    ? new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(d))
    : 'Date unknown';
const formatSync = (d?: string | null) =>
  d
    ? new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      }).format(new Date(d))
    : 'Not synced yet';
const meta = (n: any) => {
  try {
    return JSON.parse(n?.metadata || '{}');
  } catch {
    return {};
  }
};
async function api(path: string, body?: any) {
  const r = await fetch('/api/brain/' + path, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const d: any = await r.json();
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}
function Picker({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(String(v))}>
      <SelectTrigger aria-label={label}>
        <SelectValue>{value}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function Nothing({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
export default function BrainApp({
  onManageSetup,
}: {
  onManageSetup?: () => void;
}) {
  const [data, setData] = useState<any>(null),
    [view, setView] = useState('Your world'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const [query, setQuery] = useState(''),
    [answer, setAnswer] = useState<any>(null),
    [asking, setAsking] = useState(false);
  const [domain, setDomain] = useState('All domains'),
    [type, setType] = useState('All types'),
    [source, setSource] = useState('All sources'),
    [relation, setRelation] = useState('All relations'),
    [confidence, setConfidence] = useState(0),
    [asOf, setAsOf] = useState(''),
    [fromDate, setFromDate] = useState(''),
    [focus, setFocus] = useState<string>(),
    [hops, setHops] = useState('1 hop'),
    [selected, setSelected] = useState<string>(),
    [edge, setEdge] = useState<string>(),
    [sourceDetail, setSourceDetail] = useState<any>(),
    [sourceLoading, setSourceLoading] = useState(false),
    [palette, setPalette] = useState(false),
    [capture, setCapture] = useState(false),
    [captureText, setCaptureText] = useState(''),
    [captureType, setCaptureType] = useState('IDEA'),
    [captureDomain, setCaptureDomain] = useState('IDEAS'),
    [edit, setEdit] = useState<any>(),
    [editText, setEditText] = useState(''),
    [note, setNote] = useState(''),
    [status, setStatus] = useState(''),
    [pathFrom, setPathFrom] = useState(''),
    [pathTo, setPathTo] = useState(''),
    [pathResult, setPathResult] = useState<any>(),
    [health, setHealth] = useState<any>(),
    [saveView, setSaveView] = useState(false),
    [viewName, setViewName] = useState(''),
    [graphSettings, setGraphSettings] = useState(false),
    [guide, setGuide] = useState(false);
  const copyForChat = async () => {
    try {
      await navigator.clipboard.writeText(evidencePacket(answer));
      setNotice(
        'Evidence copied. Paste it into ChatGPT or Codex with your question.',
      );
    } catch {
      setError('Clipboard is unavailable. Download the evidence instead.');
    }
  };
  const downloadEvidence = () => {
    const url = URL.createObjectURL(
      new Blob([evidencePacket(answer)], { type: 'text/markdown' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lattice-evidence.md';
    a.click();
    URL.revokeObjectURL(url);
  };
  const load = useCallback(async () => {
    try {
      const d = await api('data');
      setData(d);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);
  const go = useCallback((next: string) => {
    setView(next);
    setPalette(false);
    if (next === 'System')
      api('health')
        .then(setHealth)
        .catch((e) => setError(e.message));
  }, []);
  const mutate = async (b: any) => {
    setBusy(true);
    try {
      const r = await api('mutate', b);
      await load();
      setNotice('Saved to your brain.');
      return r;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const syncSources = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/integrations/sync', {
        method: 'POST',
      });
      const result = (await response.json()) as any;
      if (!response.ok) throw new Error(result.error || 'Sync failed');
      await load();
      setNotice(`Sync complete. ${result.processed} artifacts checked.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError('');
    try {
      let imported = 0;
      for (const file of Array.from(files).slice(0, 10)) {
        const form = new FormData();
        form.append('file', file);
        form.append('domain', 'PERSONAL');
        const response = await fetch('/api/uploads', {
          method: 'POST',
          body: form,
        });
        const result = (await response.json()) as any;
        if (!response.ok)
          throw new Error(result.error || `Could not import ${file.name}`);
        if (result.change !== 'UNCHANGED') imported += 1;
      }
      await load();
      setNotice(`${imported} document${imported === 1 ? '' : 's'} imported.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const openSource = useCallback(async (id: string, revision?: string) => {
    setSourceLoading(true);
    try {
      setSourceDetail(
        await api(
          `source?id=${encodeURIComponent(id)}${revision ? '&revision=' + encodeURIComponent(revision) : ''}`,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSourceLoading(false);
    }
  }, []);
  const ask = useCallback(
    async (q: string) => {
      if (!q.trim()) return;
      setQuery(q);
      setView('Ask');
      setAsking(true);
      setAnswer(null);
      try {
        setAnswer(
          await api('query', {
            question: q,
            asOf: asOf
              ? new Date(asOf + 'T23:59:59.999').toISOString()
              : undefined,
          }),
        );
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setAsking(false);
      }
    },
    [asOf],
  );
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    for (const tool of [
      {
        name: 'search_memory',
        description: 'Search private source evidence and show the results.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', minLength: 1, maxLength: 2000 },
          },
          required: ['query'],
          additionalProperties: false,
        },
        execute: async (input: any) => {
          if (
            typeof input.query !== 'string' ||
            !input.query.trim() ||
            input.query.length > 2000
          )
            throw Error('Invalid query');
          const result = await api('tool', {
            name: 'search_memory',
            arguments: { query: input.query },
          });
          setView('Ask');
          setQuery(input.query);
          setAnswer({
            ...result,
            mode: 'evidence-search',
            answer: 'Search results',
            confidence: 'UNKNOWN',
          });
          return result;
        },
      },
      {
        name: 'inspect_entity',
        description: 'Open an existing graph entity in the inspector.',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
          additionalProperties: false,
        },
        execute: async (input: any) => {
          const n = data?.nodes?.find((n: any) => n.id === input.id);
          if (!n) throw Error('Entity not found');
          setSelected(n.id);
          setEdge(undefined);
          return { id: n.id, label: n.label, type: n.type };
        },
      },
    ]) {
      Promise.resolve(
        context.registerTool(
          {
            ...tool,
            annotations: { readOnlyHint: true, untrustedContentHint: true },
          },
          { signal: controller.signal },
        ),
      ).catch(() => {});
    }
    return () => controller.abort();
  }, [data]);
  const nodes: any[] = data?.nodes || [],
    allEdges: any[] = data?.assertions || [],
    evidence: any[] = data?.evidence || [],
    sources: any[] = data?.sources || [];
  const ownerName = data?.profile?.displayName || 'Owner';
  const initials = ownerName
    .split(/\s+/)
    .map((part: string) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const ns = useMemo(
    () =>
      nodes.filter(
        (n) =>
          (domain === 'All domains' || n.domain === domain) &&
          (type === 'All types' || n.type === type) &&
          n.status !== 'DELETED',
      ),
    [nodes, domain, type],
  );
  const es = useMemo(
    () =>
      allEdges.filter(
        (a) =>
          (relation === 'All relations' || a.predicate === relation) &&
          a.confidence >= confidence &&
          inTime(
            a,
            asOf
              ? new Date(asOf + 'T23:59:59.999+05:30').toISOString()
              : undefined,
          ) &&
          (!fromDate ||
            a.valid_from >=
              new Date(fromDate + 'T00:00:00+05:30').toISOString()) &&
          (source === 'All sources' ||
            evidence.some(
              (e) => e.assertion_id === a.id && e.provider === source,
            )),
      ),
    [allEdges, relation, confidence, asOf, source, evidence, fromDate],
  );
  const constrained =
    source !== 'All sources' ||
    relation !== 'All relations' ||
    confidence > 0 ||
    !!fromDate ||
    !!asOf;
  const graphNodes = constrained
    ? ns.filter((n) =>
        es.some(
          (a) =>
            (asOf || a.status === 'ACTIVE') &&
            (a.subject === n.id || a.object === n.id),
        ),
      )
    : ns;
  const filteredClaims = es.filter((a) =>
    ns.some((n) => n.id === a.subject || n.id === a.object),
  );
  const visibleDecisions = filteredClaims.filter(
    (a) => a.assertion_type === 'DECISION',
  );
  const visibleIdeas = nodes.filter(
    (n) =>
      n.type === 'Idea' &&
      ns.some((x) => x.id === n.id) &&
      es.some((a) => a.object === n.id || a.subject === n.id),
  );
  const visibleCommitments = nodes.filter(
    (n) =>
      ['Commitment', 'Action'].includes(n.type) &&
      ns.some((x) => x.id === n.id) &&
      es.some((a) => a.object === n.id || a.subject === n.id),
  );
  const activeEdges = es.filter((a) => a.status === 'ACTIVE');
  const selectedNode = nodes.find((n) => n.id === selected),
    selectedEdge = allEdges.find((a) => a.id === edge),
    nodeEdges = allEdges.filter(
      (a) => a.subject === selected || a.object === selected,
    );
  const decisions = allEdges.filter(
      (a) => a.assertion_type === 'DECISION' && a.status === 'ACTIVE',
    ),
    ideas = nodes.filter((n) => n.type === 'Idea'),
    commitments = nodes.filter((n) =>
      ['Commitment', 'Action'].includes(n.type),
    ),
    openCommitments = commitments.filter(
      (n) => !['DONE', 'CANCELLED', 'SUPERSEDED'].includes(meta(n).lifecycle),
    );
  const name = (id: string) => nodes.find((n) => n.id === id)?.label || id;
  const evFor = (id: string) => evidence.filter((e) => e.assertion_id === id);
  const inspect = (id: string) => {
    setSelected(id);
    setEdge(undefined);
  };
  const EvidenceButtons = ({ items }: { items: any[] }) => (
    <div className="evidence-links">
      {Array.from(new Map(items.map((e) => [e.source_id, e])).values())
        .slice(0, 4)
        .map((e) => (
          <button
            key={e.source_id}
            onClick={() => openSource(e.source_id, e.revision_id)}
          >
            <FileText size={13} />
            {e.source_title ||
              sources.find((s) => s.id === e.source_id)?.title ||
              'View evidence'}
            <ArrowUpRight size={12} />
          </button>
        ))}
    </div>
  );
  const Claim = ({ a }: { a: any }) => (
    <article className="claim-row">
      <div
        className="claim-marker"
        style={{
          background:
            COLORS[
              a.assertion_type === 'DECISION'
                ? 'Decision'
                : a.assertion_type === 'IDEA'
                  ? 'Idea'
                  : 'Technology'
            ],
        }}
      />
      <div>
        <div className="meta-line">
          <span className={'tag ' + a.assertion_type.toLowerCase()}>
            {a.assertion_type}
          </span>
          <span>{format(a.valid_from)}</span>
          {a.status !== 'ACTIVE' && <span>{a.status}</span>}
        </div>
        <button
          className="statement"
          onClick={() => {
            setEdge(a.id);
            setSelected(undefined);
          }}
        >
          {a.statement}
        </button>
        <EvidenceButtons items={evFor(a.id)} />
      </div>
      <button
        className="icon-button"
        aria-label="Inspect assertion"
        onClick={() => {
          setEdge(a.id);
          setSelected(undefined);
        }}
      >
        <ChevronRight size={18} />
      </button>
    </article>
  );
  return (
    <SidebarProvider>
      <CloseMobileNav view={view} />
      <Sidebar>
        <SidebarHeader className="brand">
          <Network size={28} />
          <div>
            Lattice<small>PERSONAL KNOWLEDGE</small>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu className="nav-list">
            {nav.map(([label, Icon]) => (
              <SidebarMenuItem key={label}>
                <SidebarMenuButton
                  className="nav-item"
                  isActive={view === label}
                  onClick={() => go(label)}
                >
                  <Icon />
                  <span>
                    {label === 'Your world' ? 'Knowledge graph' : label}
                  </span>
                  {label === 'Commitments' && openCommitments.length > 0 && (
                    <span className="nav-count">{openCommitments.length}</span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            <div className="nav-rule" />
            <SidebarMenuItem>
              <SidebarMenuButton
                className="nav-item"
                isActive={view === 'Ontology'}
                onClick={() => go('Ontology')}
              >
                <GitBranch />
                <span>Ontology</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="nav-item"
                isActive={view === 'System'}
                onClick={() => go('System')}
              >
                <Activity />
                <span>System health</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <button className="nightly-card" onClick={() => go('Sources')}>
            <div>
              <Clock3 size={16} />
              {data?.scheduler?.status === 'SCHEDULED'
                ? 'Nightly analysis'
                : 'Source coverage'}
            </div>
            <p>Last synced: {formatSync(data?.scheduler?.last_sync)}</p>
          </button>
        </SidebarContent>
        <SidebarFooter className="owner">
          <div className="avatar-owner">{initials || 'O'}</div>
          <div>
            {ownerName}
            <small>
              <ShieldCheck size={11} /> Owner-only workspace
            </small>
          </div>
        </SidebarFooter>
      </Sidebar>
      <main className="workspace">
        <header className="topbar">
          <SidebarTrigger />
          <span>{view === 'Your world' ? 'Knowledge graph' : view}</span>
          <button
            className="icon-button"
            aria-label="Refresh knowledge"
            onClick={load}
          >
            <RefreshCw size={15} />
          </button>
          <button
            aria-label="Search Lattice"
            className="command-button"
            onClick={() => setPalette(true)}
          >
            <Search size={15} />
            <span>Search Lattice</span>
            <kbd>⌘ K</kbd>
          </button>
          <span className="private">
            <ShieldCheck size={14} /> Private
          </span>
          <Button variant="ghost" onClick={() => setGuide(true)}>
            <CircleHelp /> Guide
          </Button>
          <Button variant="outline" onClick={() => setCapture(true)}>
            <Plus /> Remember this
          </Button>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">{titles[view]?.[0]}</div>
              <h1>{titles[view]?.[1]}</h1>
            </div>
            <div className="date-block">
              {format(new Date().toISOString())}
              <small>
                {data
                  ? `${sources.filter((s) => !s.excluded).length} sources · ${nodes.length} entities · Synced ${formatSync(data?.scheduler?.last_sync)}`
                  : 'Opening your private brain…'}
              </small>
            </div>
          </div>
          {error && (
            <div className="banner error" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
              {error.includes('Sign in') ? (
                <a href="/signin-with-chatgpt?return_to=/" target="_top">
                  Sign in
                </a>
              ) : (
                <Button variant="ghost" onClick={load}>
                  Retry
                </Button>
              )}
              <button aria-label="Dismiss error" onClick={() => setError('')}>
                <X size={15} />
              </button>
            </div>
          )}
          {notice && (
            <div className="banner success" role="status">
              <Check size={17} />
              {notice}
              <button aria-label="Dismiss notice" onClick={() => setNotice('')}>
                <X size={15} />
              </button>
            </div>
          )}
          <form
            className={
              view === 'Your world' ? 'ask-box graph-search-bar' : 'ask-box'
            }
            onSubmit={(e) => {
              e.preventDefault();
              ask(query);
            }}
          >
            <Search size={21} />
            <input
              aria-label="Search your knowledge"
              placeholder="Search your knowledge…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className="ask-hint">
              {data?.aiReady ? 'Answers with evidence' : 'Search your evidence'}
            </span>
            <Button
              size="icon"
              type="submit"
              disabled={asking}
              aria-label="Search your knowledge"
            >
              <ArrowUpRight />
            </Button>
          </form>
          {!data && !error && (
            <Nothing
              title="Opening your evidence…"
              description="Reading your private knowledge store."
            />
          )}
          {view === 'Ask' && data?.aiIssue && (
            <p className="bottom-note" style={{ marginBottom: 20 }}>
              {data.aiIssue}{' '}
            </p>
          )}
          {data && view === 'Today' && (
            <>
              <div className="today-grid">
                <section className="world-panel">
                  <div className="section-title">
                    <div>
                      <h2>Your world</h2>
                      <p className="muted">
                        Follow an idea down to its evidence.
                      </p>
                    </div>
                    <Button variant="ghost" onClick={() => go('Your world')}>
                      Explore <ArrowUpRight />
                    </Button>
                  </div>
                  <GraphView
                    nodes={nodes}
                    edges={activeEdges}
                    onNode={inspect}
                    onEdge={(id) => {
                      setEdge(id);
                      setSelected(undefined);
                    }}
                    selected={selected}
                    compact
                    onFocus={(id) => {
                      setFocus(id);
                      go('Your world');
                    }}
                  />
                </section>
                <aside className="attention-panel">
                  <div className="eyebrow">KEEP IN VIEW</div>
                  <h2>Open loops</h2>
                  {openCommitments.length === 0 ? (
                    <p className="muted">
                      No open commitments found in the imported sources.
                    </p>
                  ) : (
                    openCommitments.slice(0, 4).map((n, i) => (
                      <button
                        className="attention-item"
                        key={n.id}
                        onClick={() => inspect(n.id)}
                      >
                        <span className="attention-number">0{i + 1}</span>
                        <div>
                          <h3>{n.label}</h3>
                          <small>
                            {meta(n).ownerScope || 'Owner unconfirmed'} ·{' '}
                            {meta(n).lifecycle || 'PROPOSED'}
                          </small>
                        </div>
                        <ArrowUpRight size={15} />
                      </button>
                    ))
                  )}
                  {openCommitments.length > 0 && (
                    <button
                      className="text-button"
                      onClick={() => go('Commitments')}
                    >
                      All {openCommitments.length} commitments{' '}
                      <ArrowRight size={14} />
                    </button>
                  )}
                  <div className="coverage-note">
                    <ShieldCheck size={17} />
                    <p>
                      Every connection leads to a source. Uncertain identities
                      and tentative ideas stay labelled.
                    </p>
                  </div>
                </aside>
              </div>
              <div className="below-grid">
                <section>
                  <div className="section-title plain">
                    <h2>Recent decisions</h2>
                    <button
                      className="text-button"
                      onClick={() => go('Decisions')}
                    >
                      View ledger <ArrowRight size={14} />
                    </button>
                  </div>
                  {decisions.slice(0, 3).map((a) => (
                    <Claim key={a.id} a={a} />
                  ))}
                  {!decisions.length && (
                    <Nothing
                      title="Decisions need evidence."
                      description="Decisions will appear here after structured extraction."
                    />
                  )}
                </section>
                <section>
                  <div className="section-title plain">
                    <h2>Worth connecting</h2>
                    <button
                      className="text-button"
                      onClick={() => go('Intelligence')}
                    >
                      Explore <ArrowRight size={14} />
                    </button>
                  </div>
                  {data.insights?.slice(0, 2).map((i: any) => (
                    <article className="signal-mini" key={i.id}>
                      <span className="tag hypothesis">INFERENCE</span>
                      <button
                        className="statement"
                        onClick={() => {
                          setFocus(i.nodeId);
                          go('Your world');
                        }}
                      >
                        {i.title}
                      </button>
                      <p>{i.explanation}</p>
                      <EvidenceButtons items={i.evidence} />
                    </article>
                  ))}
                  {!data.insights?.length && (
                    <Nothing
                      title="Let connections accumulate."
                      description="Cross-source signals appear when evidence shares meaningful entities."
                    />
                  )}
                </section>
              </div>
              <p className="bottom-note">
                Coverage reflects imported sources.{' '}
                {data.scheduler?.status === 'SCHEDULED'
                  ? 'Cloud analysis is scheduled nightly; inspect Sources for the latest verified run.'
                  : 'Continuous sync and cloud scheduling are not connected.'}
              </p>
            </>
          )}
          {data && view === 'Your world' && (
            <div className="graph-page-toolbar">
              <div className="graph-summary">
                <span>
                  <Network size={16} />
                  <strong>{nodes.length}</strong> entities
                </span>
                <span>
                  <LinkIcon size={16} />
                  <strong>{allEdges.length}</strong> connections
                </span>
                <span>
                  <FileText size={16} />
                  <strong>
                    {sources.filter((s) => !s.excluded).length}
                  </strong>{' '}
                  sources
                </span>
              </div>
              <div className="actions">
                <Button
                  variant="outline"
                  aria-expanded={graphSettings}
                  onClick={() => setGraphSettings((v) => !v)}
                >
                  <SlidersHorizontal />
                  Filters
                </Button>
                <Button variant="outline" onClick={() => setSaveView(true)}>
                  <Pin />
                  Save view
                </Button>
              </div>
            </div>
          )}
          {data &&
            [
              'Your world',
              'Timeline',
              'Decisions',
              'Ideas',
              'Commitments',
            ].includes(view) && (
              <div
                className="filters graph-view-filters"
                hidden={view === 'Your world' && !graphSettings}
              >
                <SlidersHorizontal size={16} />
                <Picker
                  label="Life domain"
                  value={domain}
                  onChange={setDomain}
                  options={['All domains', ...data.ontology.domains]}
                />
                <Picker
                  label="Entity type"
                  value={type}
                  onChange={setType}
                  options={[
                    'All types',
                    ...data.ontology.entityTypes.map((t: any) => t.name),
                  ]}
                />
                <Picker
                  label="Source provider"
                  value={source}
                  onChange={setSource}
                  options={[
                    'All sources',
                    ...(Array.from(
                      new Set(sources.map((s) => s.provider)),
                    ) as string[]),
                  ]}
                />
                <label className="date-filter">
                  From{' '}
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </label>
                <label className="date-filter">
                  As of{' '}
                  <input
                    type="date"
                    value={asOf}
                    onChange={(e) => setAsOf(e.target.value)}
                  />
                </label>
                <button
                  className="text-button"
                  onClick={() => {
                    setDomain('All domains');
                    setType('All types');
                    setSource('All sources');
                    setRelation('All relations');
                    setAsOf('');
                    setFromDate('');
                    setConfidence(0);
                  }}
                >
                  Reset
                </button>
              </div>
            )}
          {data && view === 'Your world' && (
            <>
              {graphSettings && (
                <div className="graph-options">
                  <Picker
                    label="Relationship type"
                    value={relation}
                    onChange={setRelation}
                    options={[
                      'All relations',
                      ...data.ontology.relations.map((r: any) => r.name),
                    ]}
                  />
                  <label className="confidence-control">
                    Minimum confidence {Math.round(confidence * 100)}%
                    <Slider
                      value={[confidence]}
                      min={0}
                      max={1}
                      step={0.1}
                      onValueChange={(v) =>
                        setConfidence(Array.isArray(v) ? v[0] : v)
                      }
                    />
                  </label>
                  <Picker
                    label="Neighborhood depth"
                    value={hops}
                    onChange={setHops}
                    options={['1 hop', '2 hops', '3 hops']}
                  />
                  {data.views?.length > 0 && (
                    <Picker
                      label="Saved views"
                      value="Saved views"
                      onChange={(v) => {
                        const f = JSON.parse(
                          data.views.find((x: any) => x.name === v)?.filters ||
                            '{}',
                        );
                        setDomain(f.domain || 'All domains');
                        setType(f.type || 'All types');
                        setFocus(f.focus);
                        setAsOf(f.asOf || '');
                        setSource(f.source || 'All sources');
                        setRelation(f.relation || 'All relations');
                        setConfidence(f.confidence || 0);
                        setHops(f.hops || '1 hop');
                        setFromDate(f.fromDate || '');
                      }}
                      options={[
                        'Saved views',
                        ...data.views.map((v: any) => v.name),
                      ]}
                    />
                  )}
                </div>
              )}
              <section className="world-panel">
                <GraphView
                  nodes={graphNodes}
                  edges={es}
                  onNode={inspect}
                  onEdge={(id) => {
                    setEdge(id);
                    setSelected(undefined);
                  }}
                  selected={selected}
                  focus={focus}
                  onFocus={setFocus}
                  hops={parseInt(hops)}
                  asOf={asOf}
                />
              </section>
              <div className="path-box">
                <GitBranch size={20} />
                <div>
                  <h3>Why are these connected?</h3>
                  <p className="muted">
                    A path through actual evidenced relationships.
                  </p>
                </div>
                <Picker
                  label="Path starting entity"
                  value={pathFrom || 'Choose start'}
                  onChange={setPathFrom}
                  options={[
                    'Choose start',
                    ...nodes.map((n) => n.label + ' [' + n.id.slice(-6) + ']'),
                  ]}
                />
                <ArrowRight size={16} />
                <Picker
                  label="Path destination entity"
                  value={pathTo || 'Choose destination'}
                  onChange={setPathTo}
                  options={[
                    'Choose destination',
                    ...nodes.map((n) => n.label + ' [' + n.id.slice(-6) + ']'),
                  ]}
                />
                <Button
                  variant="outline"
                  disabled={
                    !nodes.some(
                      (n) => n.label + ' [' + n.id.slice(-6) + ']' === pathFrom,
                    ) ||
                    !nodes.some(
                      (n) => n.label + ' [' + n.id.slice(-6) + ']' === pathTo,
                    )
                  }
                  onClick={() =>
                    setPathResult(
                      findPath(
                        es.filter((a) => a.status === 'ACTIVE'),
                        nodes.find(
                          (n) =>
                            n.label + ' [' + n.id.slice(-6) + ']' === pathFrom,
                        )?.id || '',
                        nodes.find(
                          (n) =>
                            n.label + ' [' + n.id.slice(-6) + ']' === pathTo,
                        )?.id || '',
                        5,
                      ),
                    )
                  }
                >
                  Find path
                </Button>
              </div>
              {pathResult !== undefined && (
                <div className="path-result">
                  {pathResult === null
                    ? 'No evidenced path within five hops.'
                    : pathResult.length === 0
                      ? 'Choose two different entities.'
                      : pathResult.map((a: any) => (
                          <div key={a.id}>
                            <button
                              onClick={() => {
                                setEdge(a.id);
                                setSelected(undefined);
                              }}
                            >
                              {name(a.traversedFrom)}{' '}
                              {a.traversedFrom === a.subject ? (
                                <ArrowRight size={14} />
                              ) : (
                                <ArrowLeft size={14} />
                              )}{' '}
                              {a.predicate.toLowerCase().replaceAll('_', ' ')}{' '}
                              {a.traversedFrom === a.subject ? (
                                <ArrowRight size={14} />
                              ) : (
                                <ArrowLeft size={14} />
                              )}{' '}
                              {name(a.traversedTo)}
                            </button>
                            <EvidenceButtons items={evFor(a.id)} />
                          </div>
                        ))}
                </div>
              )}
            </>
          )}
          {data && view === 'Timeline' && (
            <section className="timeline-list">
              {filteredClaims.map((a) => (
                <Claim key={a.id} a={a} />
              ))}
              {!filteredClaims.length && (
                <Nothing
                  title="No events in this period."
                  description="Broaden the date range to explore earlier knowledge."
                />
              )}
            </section>
          )}
          {data && view === 'Decisions' && (
            <section>
              {visibleDecisions.map((a) => (
                <Claim key={a.id} a={a} />
              ))}
              {!visibleDecisions.length && (
                <Nothing
                  title="No decisions in this view."
                  description="Try broader filters to find decisions and their evidence."
                />
              )}
            </section>
          )}
          {data && ['Ideas', 'Commitments'].includes(view) && (
            <div className="entity-list">
              {(view === 'Ideas' ? visibleIdeas : visibleCommitments).map(
                (n) => (
                  <article className="entity-card" key={n.id}>
                    <div className="meta-line">
                      <span
                        className={
                          'tag ' + (view === 'Ideas' ? 'idea' : 'action')
                        }
                      >
                        {meta(n).lifecycle ||
                          (view === 'Ideas' ? 'SEED' : 'PROPOSED')}
                      </span>
                      <span>{n.domain}</span>
                      {n.pinned === 1 && <Pin size={14} />}
                    </div>
                    <button className="statement" onClick={() => inspect(n.id)}>
                      {n.label}
                    </button>
                    <p>{allEdges.find((a) => a.object === n.id)?.statement}</p>
                    <div className="entity-card-bottom">
                      <small>{meta(n).ownerScope || 'Owner unconfirmed'}</small>
                      <button
                        className="text-button"
                        onClick={() => inspect(n.id)}
                      >
                        Explore history <ArrowRight size={14} />
                      </button>
                    </div>
                    <EvidenceButtons
                      items={evidence.filter((e) =>
                        allEdges.some(
                          (a) =>
                            a.id === e.assertion_id &&
                            (a.subject === n.id || a.object === n.id),
                        ),
                      )}
                    />
                  </article>
                ),
              )}
              {!(view === 'Ideas' ? visibleIdeas : visibleCommitments)
                .length && (
                <Nothing
                  title={
                    view === 'Ideas'
                      ? 'Your next idea can start here.'
                      : 'No commitments extracted yet.'
                  }
                  description="Capture something or import a source with evidence."
                />
              )}
            </div>
          )}
          {data && ['Today', 'Intelligence'].includes(view) && data.report && (
            <section className="intelligence-card">
              <div className="meta-line">
                <span className="tag decision">LATEST ANALYSIS</span>
                <span>{data.report.date}</span>
              </div>
              <h2>{data.report.title}</h2>
              {data.report.items
                .slice(0, view === 'Today' ? 3 : 30)
                .map((item: any, i: number) => (
                  <div className="passage-result" key={i}>
                    <span className="tag neutral">
                      {item.type.replaceAll('_', ' ')}
                    </span>
                    <p>{item.text}</p>
                    {item.caveat && <p className="muted">{item.caveat}</p>}
                    <EvidenceButtons
                      items={evidence.filter((e) =>
                        item.evidenceIds.includes(e.id),
                      )}
                    />
                  </div>
                ))}
              <details>
                <summary>Coverage and method</summary>
                {data.report.coverage.map((c: string, i: number) => (
                  <p key={i}>{c}</p>
                ))}
                <p>{data.report.method}</p>
              </details>
            </section>
          )}
          {data && view === 'Intelligence' && (
            <>
              <p className="intro-note">
                These are evidence-backed connections to investigate.
                Co-occurrence is not proof of agreement or causality.
              </p>
              <div className="intelligence-list">
                {data.insights?.map((i: any) => (
                  <article className="intelligence-card" key={i.id}>
                    <div className="meta-line">
                      <span className="tag hypothesis">INFERENCE</span>
                      <span>{i.confidence} confidence</span>
                    </div>
                    <h2>{i.title}</h2>
                    <p>{i.explanation}</p>
                    <h3>Why it may matter</h3>
                    <p>{i.whyItMatters}</p>
                    <h3>What could weaken it</h3>
                    <p>{i.counterEvidence}</p>
                    <EvidenceButtons items={i.evidence} />
                    <div className="actions">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setFocus(i.nodeId);
                          go('Your world');
                        }}
                      >
                        <Network /> Explore path
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          mutate({ action: 'insight-pin', id: i.id })
                        }
                      >
                        <Pin /> Pin
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          mutate({ action: 'insight-dismiss', id: i.id })
                        }
                      >
                        Dismiss
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
              <div className="external-status">
                <Radio size={20} />
                <div>
                  <h3>External intelligence</h3>
                  <p>
                    Add RSS feeds or trusted public pages during onboarding.
                    Every imported revision remains traceable to its source.
                  </p>
                </div>
              </div>
            </>
          )}
          {data && view === 'Sources' && (
            <>
              <div className="source-toolbar">
                <p className="intro-note">
                  Your sources, preserved with original text, links, and
                  revision history. Nightly analysis reads connected apps and
                  updates this workspace.
                </p>
                <div className="source-actions">
                  <Button variant="outline" onClick={onManageSetup}>
                    <Settings2 /> Manage integrations
                  </Button>
                  <label className="upload-control">
                    <UploadCloud size={16} /> Upload documents
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.docx,.txt,.md,.csv,.json,.html,.htm"
                      onChange={(event) => uploadFiles(event.target.files)}
                    />
                  </label>
                  <Button
                    variant="outline"
                    onClick={syncSources}
                    disabled={busy}
                  >
                    <Play /> Sync now
                  </Button>
                  <a className="export-link" href="/api/brain/export">
                    <Download size={16} /> Export
                  </a>
                </div>
              </div>
              <div className="coverage-note">
                <p>
                  Connectors use secrets from your deployment environment.
                  Uploads and website feeds work without third-party
                  credentials. Add an OpenAI API key only if you want automatic
                  extraction and grounded answers.
                </p>
              </div>
              <div className="connector-list">
                {data.connectors?.map((c: any) => (
                  <article className="connector-row" key={c.id}>
                    <div className="connector-icon">
                      <Database size={21} />
                    </div>
                    <div>
                      <h3>{c.name}</h3>
                      <p>{JSON.parse(c.detail).description}</p>
                      <small>
                        {c.last_sync
                          ? 'Last complete scan ' + format(c.last_sync)
                          : JSON.parse(c.detail).lastCheckedAt
                            ? 'Access checked ' +
                              format(JSON.parse(c.detail).lastCheckedAt) +
                              ' · Full scan pending'
                            : 'Awaiting setup'}
                      </small>
                    </div>
                    <span
                      className={
                        'tag ' +
                        (c.status === 'IMPORTED' ? 'decision' : 'neutral')
                      }
                    >
                      {c.status.replaceAll('_', ' ')}
                    </span>
                  </article>
                ))}
              </div>
              <div className="section-title plain">
                <h2>Source library</h2>
                <span>{sources.length} artifacts</span>
              </div>
              {sources.map((s) => (
                <article
                  className={'source-row ' + (s.excluded ? 'excluded' : '')}
                  key={s.id}
                >
                  <FileText size={19} />
                  <div>
                    <button
                      className="statement"
                      onClick={() => openSource(s.id)}
                    >
                      {s.title}
                    </button>
                    <small>
                      {s.provider} · {s.revision_count} revision
                      {s.revision_count !== 1 ? 's' : ''} · {s.domain}
                    </small>
                  </div>
                  <span>{s.excluded ? 'EXCLUDED' : ''}</span>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      mutate({
                        action: s.excluded
                          ? 'source-restore'
                          : 'source-exclude',
                        id: s.id,
                      })
                    }
                  >
                    {s.excluded ? 'Restore' : 'Exclude'}
                  </Button>
                </article>
              ))}
            </>
          )}
          {data && view === 'Ontology' && (
            <>
              <div className="ontology-info">
                <GitBranch />
                <div>
                  <h2>Version {data.ontology.version} · Owner-controlled</h2>
                  <p>
                    New terms require explicit approval. Existing claims retain
                    their ontology version.
                  </p>
                </div>
              </div>
              <div className="ontology-columns">
                <section>
                  <h2>Entity classes</h2>
                  {data.ontology.entityTypes.map((t: any) => (
                    <div className="schema-row" key={t.name}>
                      <span>
                        {t.name}
                        <small>
                          {t.parent ? 'inherits ' + t.parent : 'Root class'}
                        </small>
                      </span>
                      <strong>
                        {nodes.filter((n) => n.type === t.name).length}
                      </strong>
                    </div>
                  ))}
                </section>
                <section>
                  <h2>Relationships</h2>
                  {data.ontology.relations.map((r: any) => (
                    <div className="schema-row" key={r.name}>
                      <span>
                        {r.name}
                        <small>{r.cardinality}</small>
                      </span>
                      <strong>
                        {allEdges.filter((a) => a.predicate === r.name).length}
                      </strong>
                    </div>
                  ))}
                </section>
              </div>
            </>
          )}
          {view === 'System' && health && (
            <>
              <div className="service-grid">
                {Object.entries(health.services).map(([key, val]) => (
                  <div key={key}>
                    <span className={'status-dot ' + (val ? 'on' : 'off')} />
                    <span>
                      {(
                        {
                          database: 'Knowledge database',
                          sourceStorage: 'Original sources',
                          liveAI: 'Live AI answers',
                          cloudScheduler: 'Nightly cloud task',
                          hostedConnectors: 'Source synchronization',
                          backupVerified: 'Backup restore',
                        } as Record<string, string>
                      )[key] || key}
                    </span>
                    <strong>
                      {val
                        ? key === 'cloudScheduler'
                          ? 'Scheduled'
                          : 'Available'
                        : key === 'liveAI'
                          ? 'Use ChatGPT'
                          : key === 'hostedConnectors'
                            ? 'Via cloud task'
                            : key === 'backupVerified'
                              ? 'Not yet verified'
                              : 'Not configured'}
                    </strong>
                  </div>
                ))}
              </div>
              <div className="quality-grid">
                <div>
                  <strong>{health.quality.unsupported}</strong>
                  <span>Assertions without evidence</span>
                </div>
                <div>
                  <strong>{health.quality.unresolvedPeople}</strong>
                  <span>People retained as unresolved identities</span>
                </div>
              </div>
              <h2>Ingestion jobs</h2>
              <div className="admin-table">
                {health.jobs.map((j: any) => (
                  <div key={j.id}>
                    <span>{j.kind}</span>
                    <span className="tag neutral">{j.status}</span>
                    <span>{j.error || format(j.updated_at)}</span>
                  </div>
                ))}
              </div>
              <h2>Recent audit trail</h2>
              <div className="admin-table">
                {health.audit.map((a: any) => (
                  <div key={a.id}>
                    <span>{a.action}</span>
                    <span>{format(a.created_at)}</span>
                    <code>{a.target.slice(0, 40)}</code>
                  </div>
                ))}
              </div>
            </>
          )}
          {view === 'Ask' && (
            <section className="answer-panel">
              {asking ? (
                <Nothing
                  title="Following the evidence…"
                  description="Searching passages, entities, and their relationships."
                />
              ) : answer ? (
                <>
                  <div className="meta-line">
                    <span className="tag decision">
                      {answer.mode === 'ai'
                        ? 'GROUNDED ANSWER'
                        : answer.mode === 'no-evidence'
                          ? 'INSUFFICIENT EVIDENCE'
                          : 'EVIDENCE SEARCH'}
                    </span>
                    {answer.mode === 'ai' && (
                      <span>{answer.confidence} confidence</span>
                    )}
                  </div>
                  <div className="answer-text">
                    {answer.answerClaims ? (
                      answer.answerClaims.map((c: any, i: number) => (
                        <div key={i}>
                          <p>{c.text}</p>
                          <div className="evidence-links">
                            {c.citationIds.map((id: string) => {
                              const e = [
                                ...(answer.evidence || []),
                                ...(answer.passages || []),
                              ].find((e: any) => e.id === id);
                              return e ? (
                                <button
                                  key={id}
                                  onClick={() =>
                                    openSource(e.source_id, e.revision_id)
                                  }
                                >
                                  <FileText size={12} />
                                  {e.source_title || e.title}
                                </button>
                              ) : null;
                            })}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p>{answer.answer}</p>
                    )}
                  </div>
                  {answer.mode === 'evidence-search' && (
                    <div className="actions">
                      <Button variant="outline" onClick={copyForChat}>
                        Copy evidence for ChatGPT
                      </Button>
                      <Button variant="ghost" onClick={downloadEvidence}>
                        <Download /> Download evidence
                      </Button>
                    </div>
                  )}
                  <h3>
                    {answer.mode === 'ai'
                      ? 'Why this answer'
                      : 'How this was found'}
                  </h3>
                  <p className="muted">{answer.why}</p>
                  {answer.contrary?.length > 0 && (
                    <>
                      <h3>Contrary evidence</h3>
                      {answer.contrary.map((s: string, i: number) => (
                        <p key={i}>{s}</p>
                      ))}
                    </>
                  )}
                  <h3>Evidence</h3>
                  {answer.claims?.slice(0, 8).map((a: any) => (
                    <Claim key={a.id} a={a} />
                  ))}
                  {answer.passages?.slice(0, 5).map((p: any) => (
                    <div className="passage-result" key={p.id}>
                      <button
                        className="text-button"
                        onClick={() => openSource(p.source_id, p.revision_id)}
                      >
                        {p.title}
                        <ArrowUpRight size={14} />
                      </button>
                      <p>
                        {p.body.slice(0, 600)}
                        {p.body.length > 600 ? '…' : ''}
                      </p>
                      <small>
                        {format(p.source_created_at)} · Characters {p.start}–
                        {p.end}
                      </small>
                    </div>
                  ))}
                  <h3>Missing context</h3>
                  {answer.missingEvidence?.map((m: string, i: number) => (
                    <p className="muted" key={i}>
                      {m}
                    </p>
                  ))}
                  {answer.relatedQuestions?.length > 0 && (
                    <div className="related-questions">
                      {answer.relatedQuestions.map((q: string, i: number) => (
                        <Button
                          key={i}
                          variant="outline"
                          onClick={() => ask(q)}
                        >
                          {q}
                        </Button>
                      ))}
                    </div>
                  )}
                  <details className="trace">
                    <summary>Inspect retrieval trace</summary>
                    <pre>{JSON.stringify(answer.trace, null, 2)}</pre>
                  </details>
                </>
              ) : (
                <Nothing
                  title="Start with a question."
                  description="Ask about a decision, a person, an unresolved commitment, or how an idea changed."
                />
              )}
            </section>
          )}
        </div>
      </main>
      <Sheet
        open={!!selectedNode || !!selectedEdge}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(undefined);
            setEdge(undefined);
          }
        }}
      >
        <SheetContent className="inspector">
          <SheetHeader>
            <div className="eyebrow">
              {selectedNode ? 'ENTITY' : 'ASSERTION'} INSPECTOR
            </div>
            <SheetTitle>
              {selectedNode?.label || selectedEdge?.statement}
            </SheetTitle>
            <SheetDescription>
              {selectedNode
                ? selectedNode.type + ' · ' + selectedNode.domain
                : 'Every assertion retains its evidence and valid time.'}
            </SheetDescription>
          </SheetHeader>
          <div className="inspector-body">
            {selectedNode && (
              <>
                <div className="actions">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFocus(selectedNode.id);
                      setSelected(undefined);
                      go('Your world');
                    }}
                  >
                    <Focus /> Focus graph
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      mutate({
                        action: selectedNode.pinned ? 'unpin' : 'pin',
                        id: selectedNode.id,
                      })
                    }
                  >
                    <Pin />
                    {selectedNode.pinned ? 'Unpin' : 'Pin'}
                  </Button>
                </div>
                {selectedNode.type === 'Person' && (
                  <div className="coverage-note">
                    <p>
                      {selectedNode.identity.startsWith('unresolved:')
                        ? 'This name is local to its source. Identity has not been verified across meetings.'
                        : 'A stable identity was supplied for this person.'}
                    </p>
                  </div>
                )}
                {selectedNode.merged_into && (
                  <div className="banner">
                    Merged with {name(selectedNode.merged_into)}
                    <Button
                      variant="outline"
                      onClick={() =>
                        mutate({ action: 'split', id: selectedNode.id })
                      }
                    >
                      Split / undo merge
                    </Button>
                  </div>
                )}
                <div className="entity-properties">
                  <div>
                    <span>First observed</span>
                    <strong>{format(selectedNode.created_at)}</strong>
                  </div>
                  <div>
                    <span>Last updated</span>
                    <strong>{format(selectedNode.updated_at)}</strong>
                  </div>
                  <div>
                    <span>Relationships</span>
                    <strong>{nodeEdges.length}</strong>
                  </div>
                  {meta(selectedNode).lifecycle && (
                    <div>
                      <span>Lifecycle</span>
                      <strong>{meta(selectedNode).lifecycle}</strong>
                    </div>
                  )}
                </div>
                {['Idea', 'Commitment', 'Action'].includes(
                  selectedNode.type,
                ) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEdit({
                        action: 'status',
                        id: selectedNode.id,
                        nodeType: selectedNode.type,
                      });
                      setStatus(meta(selectedNode).lifecycle || 'PROPOSED');
                      setNote('');
                    }}
                  >
                    Update lifecycle
                  </Button>
                )}
                <h3>Evidence and evolution</h3>
                {nodeEdges
                  .sort((a, b) => b.valid_from.localeCompare(a.valid_from))
                  .map((a) => (
                    <Claim key={a.id} a={a} />
                  ))}
                <details className="trace">
                  <summary>Aliases and source metadata</summary>
                  <pre>
                    {JSON.stringify(
                      {
                        aliases: JSON.parse(selectedNode.aliases),
                        metadata: meta(selectedNode),
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEdit({
                      action: 'merge',
                      id: selectedNode.id,
                      type: selectedNode.type,
                    });
                    setEditText('');
                    setNote('');
                  }}
                >
                  Resolve duplicate identity
                </Button>
              </>
            )}
            {selectedEdge && (
              <>
                <div className="meta-line">
                  <span
                    className={
                      'tag ' + selectedEdge.assertion_type.toLowerCase()
                    }
                  >
                    {selectedEdge.assertion_type}
                  </span>
                  <span>
                    {Math.round(selectedEdge.confidence * 100)}% confidence
                  </span>
                </div>
                <p className="muted">{selectedEdge.rationale}</p>
                <div className="relationship">
                  <button onClick={() => inspect(selectedEdge.subject)}>
                    {name(selectedEdge.subject)}
                  </button>
                  <span>
                    {selectedEdge.predicate.toLowerCase().replaceAll('_', ' ')}
                  </span>
                  <button onClick={() => inspect(selectedEdge.object)}>
                    {name(selectedEdge.object)}
                  </button>
                </div>
                <div className="entity-properties">
                  {[
                    ['Valid from', selectedEdge.valid_from],
                    ['Valid to', selectedEdge.valid_to],
                    ['Observed', selectedEdge.observed_at],
                    ['Source created', selectedEdge.source_created_at],
                    ['Ingested', selectedEdge.ingested_at],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <span>{l}</span>
                      <strong>{v ? format(v) : 'Open / unknown'}</strong>
                    </div>
                  ))}
                  <div>
                    <span>Status</span>
                    <strong>{selectedEdge.status}</strong>
                  </div>
                  <div>
                    <span>Memory</span>
                    <strong>{selectedEdge.memory_type}</strong>
                  </div>
                </div>
                <h3>Where this came from</h3>
                {evFor(selectedEdge.id).map((e) => (
                  <div className="evidence-quote" key={e.id}>
                    <blockquote>{e.quote}</blockquote>
                    <small>
                      {e.kind} · {e.locator}
                    </small>
                    <EvidenceButtons items={[e]} />
                  </div>
                ))}
                {selectedEdge.superseded_by && (
                  <Button
                    variant="outline"
                    onClick={() => setEdge(selectedEdge.superseded_by)}
                  >
                    View superseding assertion
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={!!selectedEdge.superseded_by}
                  onClick={() => {
                    setEdit({ action: 'correct', id: selectedEdge.id });
                    setEditText(selectedEdge.statement);
                    setNote('');
                  }}
                >
                  Correct with new evidence
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <Sheet
        open={!!sourceDetail || sourceLoading}
        onOpenChange={(open) => {
          if (!open) setSourceDetail(undefined);
        }}
      >
        <SheetContent className="source-inspector">
          <SheetHeader>
            <div className="eyebrow">ORIGINAL EVIDENCE</div>
            <SheetTitle>
              {sourceDetail?.source?.title || 'Opening source…'}
            </SheetTitle>
            <SheetDescription>
              {sourceDetail
                ? `${sourceDetail.source.provider} · ${sourceDetail.revisions.length} preserved revision(s)`
                : 'Fetching private source content.'}
            </SheetDescription>
          </SheetHeader>
          {sourceDetail && (
            <div className="inspector-body">
              <div className="actions">
                {safeUrl(sourceDetail.source.url) && (
                  <a
                    className="external-source"
                    href={sourceDetail.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open original <ExternalLink size={15} />
                  </a>
                )}
                <span className="tag neutral">
                  {sourceDetail.selectedRevision.status}
                </span>
              </div>
              <p className="muted">
                Source created{' '}
                {format(sourceDetail.selectedRevision.source_created_at)} ·
                Imported {format(sourceDetail.selectedRevision.ingested_at)}
              </p>
              {sourceDetail.revisions.length > 1 && (
                <Picker
                  label="Source revision"
                  value={sourceDetail.selectedRevision.id}
                  onChange={(id) => openSource(sourceDetail.source.id, id)}
                  options={sourceDetail.revisions.map((r: any) => r.id)}
                />
              )}
              <pre className="source-text">
                {sourceDetail.body || 'Original source bytes are unavailable.'}
              </pre>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <Dialog open={capture} onOpenChange={setCapture}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remember this</DialogTitle>
            <DialogDescription>
              A thought, a decision, or a commitment. Saved with your own words
              as evidence.
            </DialogDescription>
          </DialogHeader>
          <div className="capture-form">
            <Textarea
              aria-label="Memory text"
              value={captureText}
              onChange={(e) => setCaptureText(e.target.value)}
              placeholder="What would you like to remember?"
              rows={7}
            />
            <div className="actions">
              <Picker
                label="Memory kind"
                value={captureType}
                onChange={setCaptureType}
                options={[
                  'IDEA',
                  'ACTION',
                  'DECISION',
                  'QUESTION',
                  'OPINION',
                  'PREDICTION',
                ]}
              />
              <Picker
                label="Memory domain"
                value={captureDomain}
                onChange={setCaptureDomain}
                options={data?.ontology.domains || ['IDEAS']}
              />
            </div>
            <Button
              disabled={busy || captureText.trim().length < 12}
              onClick={async () => {
                try {
                  await mutate({
                    action: 'capture',
                    text: captureText,
                    type: captureType,
                    domain: captureDomain,
                  });
                  setCapture(false);
                  setCaptureText('');
                } catch {}
              }}
            >
              Save to my brain <ArrowRight />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!edit}
        onOpenChange={(open) => {
          if (!open) setEdit(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {edit?.action === 'correct'
                ? 'Correct this knowledge'
                : edit?.action === 'merge'
                  ? 'Resolve an identity'
                  : 'Update lifecycle'}
            </DialogTitle>
            <DialogDescription>
              {edit?.action === 'correct'
                ? 'The previous assertion remains in history. Your correction becomes new evidence.'
                : edit?.action === 'merge'
                  ? 'Explicitly link two identities. Their original evidence is preserved and this can be undone.'
                  : 'Closure requires your explicit confirmation. A passed deadline never closes a commitment.'}
            </DialogDescription>
          </DialogHeader>
          {edit?.action === 'correct' && (
            <Textarea
              aria-label="Corrected assertion"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={4}
            />
          )}
          {edit?.action === 'merge' && (
            <Picker
              label="Merge into entity"
              value={editText || 'Choose entity'}
              onChange={setEditText}
              options={[
                'Choose entity',
                ...nodes
                  .filter(
                    (n) =>
                      n.type === edit.type &&
                      n.id !== edit.id &&
                      !n.merged_into,
                  )
                  .map((n) => n.label + ' [' + n.id.slice(-6) + ']'),
              ]}
            />
          )}
          {edit?.action === 'status' && (
            <Picker
              label="Lifecycle status"
              value={status}
              onChange={setStatus}
              options={
                edit.nodeType === 'Idea'
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
                    ]
              }
            />
          )}
          <Textarea
            aria-label="Supporting evidence or confirmation"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What evidence or confirmation supports this change?"
            rows={3}
          />
          <Button
            disabled={busy || note.trim().length < 12}
            onClick={async () => {
              try {
                await mutate({
                  ...edit,
                  text: editText,
                  note,
                  status,
                  into: nodes.find(
                    (n) => n.label + ' [' + n.id.slice(-6) + ']' === editText,
                  )?.id,
                });
                setEdit(undefined);
              } catch {}
            }}
          >
            Save change
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={saveView} onOpenChange={setSaveView}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save this perspective</DialogTitle>
            <DialogDescription>
              Return to these filters and this graph neighborhood.
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="View name"
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            placeholder="Name this view"
          />
          <Button
            disabled={busy || !viewName.trim()}
            onClick={async () => {
              try {
                await mutate({
                  action: 'save-view',
                  name: viewName,
                  filters: {
                    domain,
                    type,
                    focus,
                    asOf,
                    source,
                    relation,
                    confidence,
                    hops,
                    fromDate,
                  },
                });
                setSaveView(false);
              } catch {}
            }}
          >
            Save view
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={guide} onOpenChange={setGuide}>
        <DialogContent className="lattice-guide">
          <DialogHeader>
            <DialogTitle>How to use Lattice</DialogTitle>
            <DialogDescription>
              Start with one question or one task. You do not need to explore
              everything.
            </DialogDescription>
          </DialogHeader>
          <div className="guide-steps">
            <button
              onClick={() => {
                setGuide(false);
                go('Today');
              }}
            >
              <b>1</b>
              <span>
                <strong>Start your day</strong>
                <small>
                  Open Today for priorities, new intelligence, and commitments.
                </small>
              </span>
            </button>
            <button
              onClick={() => {
                setGuide(false);
                setPalette(true);
              }}
            >
              <b>2</b>
              <span>
                <strong>Prepare for a meeting</strong>
                <small>
                  Search for a person, customer, product, or project and inspect
                  its evidence.
                </small>
              </span>
            </button>
            <button
              onClick={() => {
                setGuide(false);
                go('Commitments');
              }}
            >
              <b>3</b>
              <span>
                <strong>Close your loops</strong>
                <small>
                  Review promises, check their original source, and mark
                  completed work.
                </small>
              </span>
            </button>
            <button
              onClick={() => {
                setGuide(false);
                go('Decisions');
              }}
            >
              <b>4</b>
              <span>
                <strong>Recall why</strong>
                <small>
                  Use Decisions before reopening something the team already
                  settled.
                </small>
              </span>
            </button>
            <button
              onClick={() => {
                setGuide(false);
                setCapture(true);
              }}
            >
              <b>5</b>
              <span>
                <strong>Remember something</strong>
                <small>
                  Capture a decision, idea, promise, or useful meeting takeaway.
                </small>
              </span>
            </button>
          </div>
          <p className="guide-tip">
            Tip: every conclusion should lead back to its original evidence. Use
            the graph when you want connections; use Search when you already
            know what you need.
          </p>
        </DialogContent>
      </Dialog>
      <CommandDialog
        open={palette}
        onOpenChange={setPalette}
        title="Search Lattice"
        description="Find an entity or jump to a view."
      >
        <Command>
          <CommandInput placeholder="People, projects, ideas, commands…" />
          <CommandList>
            <CommandEmpty>No matching knowledge.</CommandEmpty>
            <CommandGroup heading="Go to">
              {nav.map(([label, Icon]) => (
                <CommandItem key={label} onSelect={() => go(label)}>
                  <Icon size={16} />
                  {label}
                </CommandItem>
              ))}
              <CommandItem
                onSelect={() => {
                  setPalette(false);
                  setCapture(true);
                }}
              >
                <Plus size={16} />
                Remember this
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Your knowledge">
              {nodes.map((n) => (
                <CommandItem
                  key={n.id}
                  value={n.id + ' ' + n.label + ' ' + n.type}
                  onSelect={() => {
                    inspect(n.id);
                    setPalette(false);
                  }}
                >
                  <span
                    className="entity-dot"
                    style={{ background: COLORS[n.type] || '#7188a8' }}
                  />
                  {n.label}
                  <small>{n.type}</small>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </SidebarProvider>
  );
}
