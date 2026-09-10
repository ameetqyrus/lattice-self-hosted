import { first, rows, runtime } from '@/db';
import { BrainError } from '@/lib/brain/core';
import { openWithSecret, sealWithSecret } from '@/lib/integrations/crypto';

const PREFIX = 'integration_secret:';
export const INTEGRATION_SECRET_KEYS = new Set([
  'SLACK_BOT_TOKEN',
  'GMAIL_ACCESS_TOKEN',
  'GOOGLE_DRIVE_ACCESS_TOKEN',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REFRESH_TOKEN',
  'MICROSOFT_GRAPH_ACCESS_TOKEN',
  'MICROSOFT_TENANT_ID',
  'MICROSOFT_CLIENT_ID',
  'MICROSOFT_CLIENT_SECRET',
  'MICROSOFT_REFRESH_TOKEN',
]);

function encryptionSecret() {
  const secret = String(runtime().APP_SESSION_SECRET || '');
  if (!secret)
    throw new BrainError(
      503,
      'APP_SESSION_SECRET is required before connector credentials can be saved.',
    );
  return secret;
}

export async function prepareIntegrationSecrets(input: unknown) {
  if (!input || typeof input !== 'object') return [];
  const prepared: Array<{ key: string; value: string }> = [];
  for (const [name, raw] of Object.entries(input)) {
    if (!INTEGRATION_SECRET_KEYS.has(name)) continue;
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value) continue;
    if (value.length > 10000)
      throw new BrainError(400, `${name} is too long to store.`);
    prepared.push({
      key: `${PREFIX}${name}`,
      value: await sealWithSecret(value, encryptionSecret()),
    });
  }
  return prepared;
}

export async function configuredIntegrationSecrets() {
  const stored = await rows(
    'SELECT key FROM settings WHERE key LIKE ?',
    `${PREFIX}%`,
  );
  return stored.map((item: any) => String(item.key).slice(PREFIX.length));
}

export async function integrationSecret(name: string) {
  const environmentValue = String(runtime()[name] || '');
  if (environmentValue) return environmentValue;
  if (!INTEGRATION_SECRET_KEYS.has(name)) return '';
  const stored = await first(
    'SELECT value FROM settings WHERE key=?',
    `${PREFIX}${name}`,
  );
  if (!stored?.value) return '';
  try {
    return await openWithSecret(String(stored.value), encryptionSecret());
  } catch {
    throw new BrainError(
      503,
      `The saved ${name} value cannot be decrypted. Enter it again in Manage integrations.`,
    );
  }
}
