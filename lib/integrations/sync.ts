import { first, runtime, stmt } from '@/db';
import { ingest } from '@/lib/brain/ingest';

type Artifact = {
  provider: string;
  externalId: string;
  title: string;
  body: string;
  kind: string;
  url?: string;
  sourceCreatedAt?: string;
  metadata?: Record<string, unknown>;
};

const text = (value: string) =>
  value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
const json = async (url: string, token: string) => {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok)
    throw new Error(`Provider request failed (${response.status})`);
  return response.json() as Promise<any>;
};
async function oauthToken(provider: 'google' | 'microsoft', fallback: string) {
  const direct = String(runtime()[fallback] || '');
  if (direct) return direct;
  const prefix = provider === 'google' ? 'GOOGLE' : 'MICROSOFT';
  const clientId = String(runtime()[`${prefix}_CLIENT_ID`] || '');
  const clientSecret = String(runtime()[`${prefix}_CLIENT_SECRET`] || '');
  const refreshToken = String(runtime()[`${prefix}_REFRESH_TOKEN`] || '');
  if (!clientId || !clientSecret || !refreshToken)
    throw new Error(
      `${fallback} or ${prefix} OAuth refresh credentials are missing`,
    );
  const tenant = String(runtime().MICROSOFT_TENANT_ID || 'common');
  const url =
    provider === 'google'
      ? 'https://oauth2.googleapis.com/token'
      : `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const form = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  if (provider === 'microsoft')
    form.set('scope', 'https://graph.microsoft.com/.default offline_access');
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  if (!response.ok)
    throw new Error(`${provider} token refresh failed (${response.status})`);
  const result = (await response.json()) as any;
  if (!result.access_token)
    throw new Error(`${provider} token refresh returned no access token`);
  return String(result.access_token);
}
const setting = async (key: string) => {
  const value = await first('SELECT value FROM settings WHERE key=?', key);
  return value?.value ? JSON.parse(value.value) : null;
};

async function websites(limit: number): Promise<Artifact[]> {
  const urls = ((await setting('websites')) || []).slice(0, limit);
  const artifacts: Artifact[] = [];
  for (const url of urls) {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Lattice self-hosted knowledge sync' },
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok)
      throw new Error(`Website ${url} returned ${response.status}`);
    const raw = (await response.text()).slice(0, 500000);
    const body = text(raw).slice(0, 250000);
    if (body.length < 20) continue;
    artifacts.push({
      provider: 'websites',
      externalId: url,
      title: new URL(url).hostname,
      body,
      kind: /rss|atom|xml/i.test(response.headers.get('content-type') || '')
        ? 'feed'
        : 'web-page',
      url,
      metadata: { contentType: response.headers.get('content-type') },
    });
  }
  return artifacts;
}

async function slack(limit: number): Promise<Artifact[]> {
  const token = String(runtime().SLACK_BOT_TOKEN || '');
  if (!token) throw new Error('SLACK_BOT_TOKEN is missing');
  const list = await json(
    'https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=20',
    token,
  );
  if (!list.ok) throw new Error(list.error || 'Slack request failed');
  const artifacts: Artifact[] = [];
  for (const channel of (list.channels || []).slice(0, limit)) {
    const history = await json(
      `https://slack.com/api/conversations.history?channel=${encodeURIComponent(channel.id)}&limit=100`,
      token,
    );
    if (!history.ok) throw new Error(history.error || 'Slack history failed');
    const messages = (history.messages || [])
      .filter((item: any) => item.text)
      .reverse();
    if (!messages.length) continue;
    artifacts.push({
      provider: 'slack',
      externalId: channel.id,
      title: `#${channel.name}`,
      body: messages
        .map(
          (item: any) =>
            `[${new Date(Number(item.ts) * 1000).toISOString()}] ${item.user || 'member'}: ${item.text}`,
        )
        .join('\n'),
      kind: 'channel',
      url: `https://app.slack.com/client/${channel.context_team_id || ''}/${channel.id}`,
      sourceCreatedAt: new Date(Number(messages[0].ts) * 1000).toISOString(),
      metadata: { channelId: channel.id },
    });
  }
  return artifacts;
}

async function outlook(limit: number): Promise<Artifact[]> {
  const token = await oauthToken('microsoft', 'MICROSOFT_GRAPH_ACCESS_TOKEN');
  const result = await json(
    `https://graph.microsoft.com/v1.0/me/messages?$top=${Math.min(limit, 20)}&$select=id,subject,body,bodyPreview,from,toRecipients,receivedDateTime,webLink&$orderby=receivedDateTime%20desc`,
    token,
  );
  return (result.value || [])
    .map((message: any) => ({
      provider: 'outlook',
      externalId: message.id,
      title: message.subject || 'Untitled email',
      body: text(message.body?.content || message.bodyPreview || ''),
      kind: 'email',
      url: message.webLink,
      sourceCreatedAt: message.receivedDateTime,
      metadata: {
        from: message.from?.emailAddress?.address,
        to: message.toRecipients?.map(
          (item: any) => item.emailAddress?.address,
        ),
      },
    }))
    .filter((item: Artifact) => item.body.length >= 20);
}

async function teams(limit: number): Promise<Artifact[]> {
  const token = await oauthToken('microsoft', 'MICROSOFT_GRAPH_ACCESS_TOKEN');
  const teamList = await json(
    'https://graph.microsoft.com/v1.0/me/joinedTeams?$select=id,displayName',
    token,
  );
  const artifacts: Artifact[] = [];
  for (const team of (teamList.value || []).slice(0, 5)) {
    const channelList = await json(
      `https://graph.microsoft.com/v1.0/teams/${team.id}/channels?$select=id,displayName`,
      token,
    );
    for (const channel of (channelList.value || []).slice(0, 4)) {
      if (artifacts.length >= limit) return artifacts;
      const result = await json(
        `https://graph.microsoft.com/v1.0/teams/${team.id}/channels/${channel.id}/messages?$top=50`,
        token,
      );
      const messages = (result.value || [])
        .filter((item: any) => item.body?.content)
        .reverse();
      if (!messages.length) continue;
      artifacts.push({
        provider: 'teams',
        externalId: `${team.id}:${channel.id}`,
        title: `${team.displayName} · ${channel.displayName}`,
        body: messages
          .map(
            (item: any) =>
              `[${item.createdDateTime}] ${item.from?.user?.displayName || 'member'}: ${text(item.body.content)}`,
          )
          .join('\n'),
        kind: 'teams-channel',
        sourceCreatedAt: messages[0].createdDateTime,
        metadata: { teamId: team.id, channelId: channel.id },
      });
    }
  }
  return artifacts;
}

async function drive(limit: number): Promise<Artifact[]> {
  const token = await oauthToken('google', 'GOOGLE_DRIVE_ACCESS_TOKEN');
  const result = await json(
    `https://www.googleapis.com/drive/v3/files?pageSize=${Math.min(limit, 20)}&orderBy=modifiedTime%20desc&fields=files(id,name,mimeType,modifiedTime,webViewLink)&q=trashed%3Dfalse`,
    token,
  );
  const artifacts: Artifact[] = [];
  for (const file of result.files || []) {
    let response: Response;
    if (file.mimeType === 'application/vnd.google-apps.document')
      response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text%2Fplain`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
    else if (/^text\//.test(file.mimeType))
      response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
    else continue;
    if (!response.ok) continue;
    const body = (await response.text()).slice(0, 250000);
    if (body.length < 20) continue;
    artifacts.push({
      provider: 'drive',
      externalId: file.id,
      title: file.name,
      body,
      kind: 'document',
      url: file.webViewLink,
      sourceCreatedAt: file.modifiedTime,
      metadata: { mimeType: file.mimeType },
    });
  }
  return artifacts;
}

function decodeBase64Url(value: string) {
  const normalized = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  return new TextDecoder().decode(
    Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0)),
  );
}
function gmailBody(payload: any): string {
  if (payload?.body?.data) return decodeBase64Url(payload.body.data);
  return (payload?.parts || []).map(gmailBody).join('\n');
}
async function gmail(limit: number): Promise<Artifact[]> {
  const token = await oauthToken('google', 'GMAIL_ACCESS_TOKEN');
  const list = await json(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${Math.min(limit, 20)}`,
    token,
  );
  const artifacts: Artifact[] = [];
  for (const item of list.messages || []) {
    const message = await json(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`,
      token,
    );
    const headers = Object.fromEntries(
      (message.payload?.headers || []).map((header: any) => [
        header.name.toLowerCase(),
        header.value,
      ]),
    );
    const body = text(gmailBody(message.payload) || message.snippet || '');
    if (body.length < 20) continue;
    artifacts.push({
      provider: 'gmail',
      externalId: message.id,
      title: headers.subject || 'Untitled email',
      body,
      kind: 'email',
      sourceCreatedAt: new Date(Number(message.internalDate)).toISOString(),
      metadata: {
        from: headers.from,
        to: headers.to,
        threadId: message.threadId,
      },
    });
  }
  return artifacts;
}

const adapters: Record<string, (limit: number) => Promise<Artifact[]>> = {
  websites,
  slack,
  outlook,
  teams,
  drive,
  gmail,
};

export async function syncSelected(actor: string) {
  const selected = ((await setting('selected_connectors')) || []) as string[];
  const report: Array<{
    id: string;
    status: string;
    imported: number;
    error?: string;
  }> = [];
  let remaining = 20;
  for (const id of selected) {
    if (!adapters[id] || remaining <= 0) continue;
    const started = new Date().toISOString();
    try {
      const artifacts = await adapters[id](remaining);
      let imported = 0;
      for (const artifact of artifacts) {
        const result = await ingest(
          { ...artifact, domain: 'PROFESSIONAL', observedAt: started },
          actor,
        );
        if (result.change !== 'UNCHANGED') imported += 1;
        remaining -= 1;
        if (remaining <= 0) break;
      }
      await stmt(
        'INSERT INTO connectors(id,name,status,last_sync,cursor,detail) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,last_sync=excluded.last_sync,detail=excluded.detail',
        id,
        id,
        'SYNCED',
        started,
        started,
        JSON.stringify({
          description: `Last run completed; ${imported} changed artifacts.`,
          lastCheckedAt: started,
        }),
      ).run();
      report.push({ id, status: 'SYNCED', imported });
    } catch (error) {
      await stmt(
        'UPDATE connectors SET status=?,detail=? WHERE id=?',
        'ERROR',
        JSON.stringify({
          description: error instanceof Error ? error.message : 'Sync failed',
          lastCheckedAt: started,
        }),
        id,
      ).run();
      report.push({
        id,
        status: 'ERROR',
        imported: 0,
        error: error instanceof Error ? error.message : 'Sync failed',
      });
    }
  }
  const completedAt = new Date().toISOString();
  const allSucceeded = report.every((item) => item.status === 'SYNCED');
  const detail = JSON.stringify({
    description: allSucceeded
      ? 'The most recent bounded connector run completed.'
      : 'One or more connectors failed. The last successful sync is unchanged.',
    artifactLimit: 20,
    failed: report
      .filter((item) => item.status === 'ERROR')
      .map((item) => item.id),
    lastCheckedAt: completedAt,
  });
  if (allSucceeded) {
    await stmt(
      'INSERT INTO connectors(id,name,status,last_sync,cursor,detail) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,last_sync=excluded.last_sync,detail=excluded.detail',
      'nightly-analysis',
      'Scheduled synchronization',
      'SYNCED',
      completedAt,
      null,
      detail,
    ).run();
  } else {
    await stmt(
      'INSERT INTO connectors(id,name,status,last_sync,cursor,detail) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,detail=excluded.detail',
      'nightly-analysis',
      'Scheduled synchronization',
      'PARTIAL',
      null,
      null,
      detail,
    ).run();
  }
  return {
    processed: 20 - remaining,
    connectors: report,
    completedAt,
  };
}
