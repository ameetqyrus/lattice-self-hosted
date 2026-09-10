# Lattice

Lattice is a private, self-hosted intelligence workspace for information scattered across email, meetings, chat, documents, and trusted websites. It preserves original source text, extracts evidence-backed claims, maps relationships in an interactive graph, tracks decisions and commitments through time, and keeps every conclusion connected to its evidence.

## What is included

- A guided three-step first launch for workspace identity, source selection, and websites or feeds
- Owner access through a server-side access key and secure session cookie
- An Obsidian-style knowledge graph with filters, focus mode, paths, zoom, and fullscreen
- Decisions, ideas, commitments, timelines, source revisions, evidence quotes, and an audit trail
- PDF, DOCX, Markdown, text, HTML, CSV, and JSON uploads
- Sync adapters for Outlook, Gmail, Slack, Microsoft Teams, Google Drive, websites, RSS, and Atom
- A generic meeting/transcript webhook and authenticated MCP server
- Optional OpenAI extraction, embeddings, and grounded answers
- A GitHub Actions workflow for always-on nightly synchronization

## Architecture

Lattice runs in your own Cloudflare account.

| Component         | Purpose                                                   |
| ----------------- | --------------------------------------------------------- |
| Cloudflare Worker | UI, APIs, connectors, and MCP server                      |
| D1                | Knowledge graph, evidence, revisions, settings, and audit |
| R2                | Original private source bodies                            |
| GitHub Actions    | Optional scheduled call to the sync endpoint              |
| OpenAI API        | Optional extraction, embeddings, and grounded answers     |

Connector credentials are deployment secrets. Lattice does not save them in D1, R2, the browser, or the repository.

## Run locally

Requirements: Node.js 22 or newer, npm, and Wrangler.

    git clone https://github.com/ameetqyrus/lattice-self-hosted.git
    cd lattice-self-hosted
    npm install
    cp config.example.env .dev.vars

Generate three different random values:

    openssl rand -hex 32

Use them for APP_ACCESS_TOKEN, APP_SESSION_SECRET, and INGEST_TOKEN in .dev.vars. Then initialize and run:

    npm run build
    npm run db:local:init
    npm run dev

Open the printed local URL, enter APP_ACCESS_TOKEN, and follow onboarding.

ALLOW_INSECURE_LOCAL=true is available for local UI work only. Never enable it on an internet-facing deployment.

## Deploy to Cloudflare

1. Authenticate and create storage:

       npx wrangler login
       npx wrangler d1 create lattice-db
       npx wrangler r2 bucket create lattice-sources

2. Copy wrangler.example.jsonc to wrangler.jsonc and paste the returned D1 database ID.

3. Apply the schema:

       npx wrangler d1 migrations apply lattice-db --remote --config wrangler.jsonc

4. Add secrets:

       npx wrangler secret put APP_ACCESS_TOKEN --config wrangler.jsonc
       npx wrangler secret put APP_SESSION_SECRET --config wrangler.jsonc
       npx wrangler secret put INGEST_TOKEN --config wrangler.jsonc

5. Build and deploy:

       npm run build
       npx wrangler deploy --config wrangler.jsonc

Open the deployed URL and complete onboarding. Put the deployment behind Cloudflare Access if you want identity-provider login or multiple approved users.

## Configure integrations

Select sources during onboarding. Lattice reports NEEDS SECRET until the corresponding deployment secret is available.

### Slack

Create a Slack bot, grant only the channel scopes you intend to import, and add the bot to those channels. Store its token:

    npx wrangler secret put SLACK_BOT_TOKEN --config wrangler.jsonc

Typical scopes are channels:read, channels:history, groups:read, and groups:history.

### Google Drive and Gmail

For a short test, set GOOGLE_DRIVE_ACCESS_TOKEN and/or GMAIL_ACCESS_TOKEN. For unattended sync, configure an OAuth client with narrow read scopes, obtain an offline refresh token, and add:

    npx wrangler secret put GOOGLE_CLIENT_ID --config wrangler.jsonc
    npx wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.jsonc
    npx wrangler secret put GOOGLE_REFRESH_TOKEN --config wrangler.jsonc

The same refresh token serves both connectors only when it contains both requested scopes.

### Outlook and Microsoft Teams

Create a Microsoft Entra OAuth application with delegated read permissions for the selected sources and obtain an offline refresh token:

    npx wrangler secret put MICROSOFT_CLIENT_ID --config wrangler.jsonc
    npx wrangler secret put MICROSOFT_CLIENT_SECRET --config wrangler.jsonc
    npx wrangler secret put MICROSOFT_REFRESH_TOKEN --config wrangler.jsonc
    npx wrangler secret put MICROSOFT_TENANT_ID --config wrangler.jsonc

Teams import also requires access to the selected teams and channels. Use the minimum Graph permissions that satisfy your sources.

### Websites and personal blogs

Enter one HTTPS page, RSS feed, or Atom feed per line during onboarding. Each run fetches a bounded snapshot and creates a revision only when content changes.

### Documents and meeting minutes

Open Sources, then choose Upload documents. PDF, DOCX, Markdown, text, HTML, CSV, and JSON are parsed inside the Worker.

Meeting tools such as Fathom, Fireflies, Otter, Zoom, or Teams can POST complete minutes or transcripts to the ingestion endpoint:

    curl --request POST https://YOUR-LATTICE.example/api/brain/ingest \
      --header "Authorization: Bearer YOUR_INGEST_TOKEN" \
      --header "Content-Type: application/json" \
      --data '{"provider":"meeting-webhook","externalId":"meeting-123","title":"Weekly product review","domain":"PROFESSIONAL","kind":"meeting-transcript","sourceCreatedAt":"2026-09-10T09:00:00Z","body":"Paste the complete transcript or minutes here."}'

Without AI extraction, imported content is preserved and searchable but remains AWAITING_EXTRACTION.

## Optional AI

An AI provider is not required for storage, search, export, or evidence inspection. To enable structured extraction, embeddings, and grounded answers:

    npx wrangler secret put OPENAI_API_KEY --config wrangler.jsonc

Models can be changed with EXTRACTION_MODEL, REASONING_MODEL, and EMBEDDING_MODEL. Requests use store:false. Source content is always treated as untrusted data and cannot invoke tools.

## Nightly synchronization

The included .github/workflows/nightly-sync.yml calls the bounded sync endpoint at 02:00 UTC every day and can also be run manually.

Add two GitHub repository secrets:

- LATTICE_URL: the deployed origin
- LATTICE_INGEST_TOKEN: the same value as the Worker INGEST_TOKEN

Edit the cron expression for another UTC time. Each run processes at most 20 artifacts, uses provider IDs for idempotency, and updates a connector last_sync only after that provider run succeeds.

## Daily use

1. Start on Today for recent changes, active commitments, and the latest analysis.
2. Search for a person, project, customer, or topic before a meeting.
3. Open Decisions to recover what was agreed and inspect the original evidence.
4. Use Commitments to track open loops. Closure requires explicit confirmation.
5. Explore Knowledge graph to discover relationships or trace a path.
6. Open Sources to upload documents, run a sync, inspect revisions, or export data.
7. Use System health to review connector failures, ingestion jobs, and evidence quality.

The Guide button offers the five most common workflows without requiring you to understand the whole system.

## MCP and automation

Streamable HTTP MCP is available at /mcp and /api/mcp. It includes read tools for search, entities, relationships, decisions, commitments, and briefs, plus idempotent sync tools. Automated reads use READ_TOKEN and writes use INGEST_TOKEN.

## Security model

- The app fails closed unless ChatGPT sign-in headers, APP_ACCESS_TOKEN, or explicit local-development mode is present.
- Mutation routes reject cross-origin browser requests.
- Unsafe source URLs and embedded URL credentials are rejected.
- Source text is treated as untrusted data.
- Every extracted assertion must quote an exact substring of its source.
- Uncertain people remain source-scoped and are never merged by name alone.
- Credentials belong in Worker or GitHub secrets. Never commit .dev.vars, .env, or wrangler.jsonc.

Before exposing a fork to other users, add an identity-aware access layer and review provider permissions.

## Validate changes

    npm run typecheck
    npm test
    npm run build

The tests cover evidence validation, temporal assertions, identity rules, prompt-injection resistance, graph filtering, path finding, and deterministic layout.

## License

MIT
