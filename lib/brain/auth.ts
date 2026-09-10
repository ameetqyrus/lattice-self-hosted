import { getChatGPTUser } from '@/app/chatgpt-auth';
import { runtime, first, stmt } from '@/db';
import { BrainError, hash } from './core';
async function sessionValue() {
  const token = String(runtime().APP_ACCESS_TOKEN || '');
  const secret = String(runtime().APP_SESSION_SECRET || token);
  return token ? hash(`${token}:${secret}`) : '';
}
function cookie(req: Request, name: string) {
  return (
    req.headers
      .get('cookie')
      ?.split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith(name + '='))
      ?.slice(name.length + 1) || ''
  );
}
export async function owner() {
  const user = await getChatGPTUser();
  if (!user)
    throw new BrainError(401, 'Unlock this private Lattice workspace.');
  const allowed = runtime().OWNER_EMAIL;
  if (allowed && user.email.toLowerCase() !== String(allowed).toLowerCase())
    throw new BrainError(403, 'This workspace belongs to another owner.');
  const bound = await first(
    'SELECT value FROM settings WHERE key=?',
    'owner_subject',
  );
  if (bound && bound.value !== user.userId)
    throw new BrainError(403, 'Owner identity does not match.');
  if (!bound)
    await stmt(
      'INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)',
      'owner_subject',
      user.userId,
    ).run();
  return user.userId;
}
export async function authorized(
  req: Request,
  scope: 'read' | 'ingest' | 'write' = 'read',
) {
  const supplied = req.headers.get('authorization');
  const key =
    scope === 'ingest'
      ? runtime().INGEST_TOKEN
      : scope === 'read'
        ? runtime().READ_TOKEN
        : null;
  if (
    key &&
    supplied &&
    (await hash(supplied)) === (await hash(`Bearer ${key}`))
  )
    return `service:${scope}`;
  const appToken = String(runtime().APP_ACCESS_TOKEN || '');
  if (
    appToken &&
    supplied &&
    (await hash(supplied)) === (await hash(`Bearer ${appToken}`))
  )
    return 'owner:self-hosted';
  if (appToken && cookie(req, 'lattice_session') === (await sessionValue()))
    return 'owner:self-hosted';
  if (runtime().ALLOW_INSECURE_LOCAL === 'true')
    return 'owner:local-development';
  return owner();
}
export async function createSession(token: string) {
  const expected = String(runtime().APP_ACCESS_TOKEN || '');
  if (!expected)
    throw new BrainError(503, 'APP_ACCESS_TOKEN is not configured.');
  if ((await hash(token)) !== (await hash(expected)))
    throw new BrainError(401, 'The access key is incorrect.');
  return sessionValue();
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin)
    throw new BrainError(403, 'Cross-origin mutation denied');
  if (req.headers.get('sec-fetch-site') === 'cross-site')
    throw new BrainError(403, 'Cross-site mutation denied');
}
export function json(data: any, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
export async function body(req: Request) {
  if (!req.headers.get('content-type')?.startsWith('application/json'))
    throw new BrainError(415, 'Use application/json');
  if (Number(req.headers.get('content-length') || 0) > 1500000)
    throw new BrainError(413, 'Request too large');
  const raw = await req.text();
  if (raw.length > 1500000) throw new BrainError(413, 'Request too large');
  try {
    return JSON.parse(raw);
  } catch {
    throw new BrainError(400, 'Invalid JSON');
  }
}
export function fail(e: unknown) {
  return json(
    {
      error:
        e instanceof BrainError
          ? e.message
          : 'The operation could not complete. Your evidence has been preserved.',
    },
    e instanceof BrainError ? e.status : 500,
  );
}
