import { db, rows, runtime, stmt } from '@/db';
import { authorized, checkOrigin, fail, json } from '@/lib/brain/auth';
import { BrainError } from '@/lib/brain/core';
import {
  CONNECTOR_CATALOG,
  connectorCatalog,
} from '@/lib/integrations/catalog';
import {
  configuredIntegrationSecrets,
  prepareIntegrationSecrets,
} from '@/lib/integrations/secrets';

const safeWebsites = (values: unknown) =>
  Array.isArray(values)
    ? values
        .map(String)
        .map((value) => {
          try {
            const url = new URL(value.trim());
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
          } catch {
            return '';
          }
        })
        .filter(Boolean)
        .slice(0, 20)
    : [];

export async function GET(req: Request) {
  try {
    await authorized(req);
    const [settings, configuredSecrets] = await Promise.all([
      rows(
        "SELECT key,value FROM settings WHERE key NOT LIKE 'integration_secret:%'",
      ),
      configuredIntegrationSecrets(),
    ]);
    const values = Object.fromEntries(
      settings.map((item: any) => [item.key, item.value]),
    );
    return json({
      configured: values.setup_complete === 'true',
      profile: values.profile ? JSON.parse(values.profile) : null,
      selected: values.selected_connectors
        ? JSON.parse(values.selected_connectors)
        : [],
      websites: values.websites ? JSON.parse(values.websites) : [],
      connectors: connectorCatalog(configuredSecrets),
      configuredSecrets,
      aiReady: Boolean(runtime().OPENAI_API_KEY),
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const actor = await authorized(req, 'write');
    const input = (await req.json()) as any;
    const displayName = String(input.profile?.displayName || '')
      .trim()
      .slice(0, 80);
    const workspaceName = String(input.profile?.workspaceName || 'My Lattice')
      .trim()
      .slice(0, 80);
    const timezone = String(input.profile?.timezone || 'UTC')
      .trim()
      .slice(0, 80);
    if (!displayName) throw new BrainError(400, 'Display name is required');
    const allowed = new Set(CONNECTOR_CATALOG.map((item) => item.id));
    const selected = Array.isArray(input.selected)
      ? input.selected
          .map(String)
          .filter((id: any) => allowed.has(id))
          .slice(0, 20)
      : [];
    const websites = safeWebsites(input.websites);
    const encryptedSecrets = await prepareIntegrationSecrets(input.secrets);
    const configuredSecrets = new Set(await configuredIntegrationSecrets());
    for (const secret of encryptedSecrets)
      configuredSecrets.add(secret.key.replace('integration_secret:', ''));
    const now = new Date().toISOString();
    const statements = [
      stmt(
        'INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)',
        'profile',
        JSON.stringify({ displayName, workspaceName, timezone }),
      ),
      stmt(
        'INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)',
        'selected_connectors',
        JSON.stringify(selected),
      ),
      stmt(
        'INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)',
        'websites',
        JSON.stringify(websites),
      ),
      stmt(
        'INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)',
        'setup_complete',
        'true',
      ),
      stmt(
        'INSERT INTO audit(id,actor,action,target,created_at,detail) VALUES(?,?,?,?,?,?)',
        crypto.randomUUID(),
        actor,
        'CONFIGURED',
        'onboarding',
        now,
        JSON.stringify({ selected, websiteCount: websites.length }),
      ),
    ];
    for (const secret of encryptedSecrets)
      statements.push(
        stmt(
          'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
          secret.key,
          secret.value,
        ),
      );
    for (const connector of connectorCatalog(configuredSecrets).filter((item) =>
      selected.includes(item.id),
    )) {
      statements.push(
        stmt(
          'INSERT INTO connectors(id,name,status,last_sync,cursor,detail) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,status=excluded.status,detail=excluded.detail',
          connector.id,
          connector.name,
          connector.ready || connector.env.length === 0
            ? 'READY'
            : 'NEEDS_SECRET',
          null,
          null,
          JSON.stringify({
            description: connector.description,
            category: connector.category,
            requiredSecrets: connector.env,
          }),
        ),
      );
    }
    await db().batch(statements);
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
