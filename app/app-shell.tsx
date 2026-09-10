'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Check, Network, ShieldCheck } from 'lucide-react';
import BrainApp from './brain-app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Setup = {
  configured: boolean;
  profile: {
    displayName: string;
    workspaceName: string;
    timezone: string;
  } | null;
  selected: string[];
  websites: string[];
  connectors: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
    ready: boolean;
    env: string[];
  }>;
  aiReady: boolean;
};

export default function AppShell() {
  const [state, setState] = useState<
    'loading' | 'locked' | 'onboarding' | 'ready'
  >('loading');
  const [setup, setSetup] = useState<Setup | null>(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState({
    displayName: '',
    workspaceName: 'My Lattice',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  });
  const [selected, setSelected] = useState<string[]>(['uploads', 'websites']);
  const [websites, setWebsites] = useState('');

  const load = async () => {
    const response = await fetch('/api/setup');
    if (response.status === 401) return setState('locked');
    const data = (await response.json()) as Setup;
    setSetup(data);
    if (data.profile) setProfile(data.profile);
    if (data.selected.length) setSelected(data.selected);
    if (data.websites.length) setWebsites(data.websites.join('\n'));
    setState(data.configured ? 'ready' : 'onboarding');
  };
  useEffect(() => {
    load().catch(() => setState('locked'));
  }, []);

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const response = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      return setError(result.error || 'Could not unlock');
    }
    await load();
  };
  const finish = async () => {
    setError('');
    const response = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile,
        selected,
        websites: websites.split('\n').filter(Boolean),
      }),
    });
    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      return setError(result.error || 'Could not save setup');
    }
    setState('ready');
  };

  if (state === 'ready')
    return (
      <BrainApp
        onManageSetup={() => {
          setStep(0);
          setState('onboarding');
        }}
      />
    );
  if (state === 'loading')
    return (
      <div className="setup-screen">
        <Network className="setup-logo" />
        <p>Opening Lattice…</p>
      </div>
    );
  if (state === 'locked')
    return (
      <div className="setup-screen">
        <form className="setup-card unlock-card" onSubmit={unlock}>
          <div className="setup-mark">
            <Network />
          </div>
          <p className="eyebrow">PRIVATE BY DEFAULT</p>
          <h1>Unlock Lattice</h1>
          <p>
            Your access key is checked on the server and stored only in a secure
            session cookie.
          </p>
          <label>
            Access key
            <Input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              autoFocus
            />
          </label>
          {error && <p className="setup-error">{error}</p>}
          <Button type="submit">
            Continue <ArrowRight />
          </Button>
        </form>
      </div>
    );
  return (
    <div className="setup-screen">
      <section className="setup-card">
        <div className="setup-progress">
          <span style={{ width: `${((step + 1) / 3) * 100}%` }} />
        </div>
        <div className="setup-brand">
          <Network /> Lattice <small>STEP {step + 1} OF 3</small>
        </div>
        {step === 0 && (
          <>
            <p className="eyebrow">YOUR PRIVATE INTELLIGENCE LAYER</p>
            <h1>Make your scattered context useful.</h1>
            <p>
              Lattice turns messages, meetings, documents, and trusted sites
              into an evidence-backed knowledge graph.
            </p>
            <div className="setup-grid two">
              <label>
                Your name
                <Input
                  value={profile.displayName}
                  onChange={(event) =>
                    setProfile({ ...profile, displayName: event.target.value })
                  }
                  placeholder="Alex Morgan"
                />
              </label>
              <label>
                Workspace name
                <Input
                  value={profile.workspaceName}
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      workspaceName: event.target.value,
                    })
                  }
                />
              </label>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <p className="eyebrow">CHOOSE YOUR SOURCES</p>
            <h1>Connect what matters.</h1>
            <p>
              Select sources now. You can add deployment secrets and change the
              selection later.
            </p>
            <div className="connector-picker">
              {setup?.connectors.map((connector) => {
                const active = selected.includes(connector.id);
                return (
                  <button
                    key={connector.id}
                    className={active ? 'selected' : ''}
                    onClick={() =>
                      setSelected(
                        active
                          ? selected.filter((id) => id !== connector.id)
                          : [...selected, connector.id],
                      )
                    }
                  >
                    <span>{active ? <Check /> : <Network />}</span>
                    <div>
                      <strong>{connector.name}</strong>
                      <small>{connector.description}</small>
                    </div>
                    <em>
                      {connector.ready || connector.env.length === 0
                        ? 'Ready'
                        : 'Needs secret'}
                    </em>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <p className="eyebrow">ADD YOUR FIRST SIGNALS</p>
            <h1>Follow sites you trust.</h1>
            <p>
              Add one public page or RSS feed per line. Document uploads are
              available in Sources after setup.
            </p>
            <label>
              Sites and feeds
              <textarea
                value={websites}
                onChange={(event) => setWebsites(event.target.value)}
                placeholder={
                  'https://example.com/blog/rss.xml\nhttps://example.com/notes'
                }
                rows={7}
              />
            </label>
            <div className="privacy-note">
              <ShieldCheck />
              <span>
                <strong>Your source data stays in your deployment.</strong>
                <small>
                  Connector credentials are read from server secrets and never
                  stored in the browser or knowledge database.
                </small>
              </span>
            </div>
          </>
        )}
        {error && <p className="setup-error">{error}</p>}
        <div className="setup-actions">
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <Button
            onClick={() => (step < 2 ? setStep(step + 1) : finish())}
            disabled={step === 0 && !profile.displayName.trim()}
          >
            {step === 2 ? 'Open my Lattice' : 'Continue'} <ArrowRight />
          </Button>
        </div>
      </section>
    </div>
  );
}
