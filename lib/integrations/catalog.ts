import { runtime } from '@/db';

export const CONNECTOR_CATALOG = [
  {
    id: 'outlook',
    name: 'Outlook email',
    category: 'Email',
    description: 'Import selected messages through Microsoft Graph.',
    env: ['MICROSOFT_GRAPH_ACCESS_TOKEN'],
  },
  {
    id: 'gmail',
    name: 'Gmail',
    category: 'Email',
    description: 'Import message bodies and threads through the Gmail API.',
    env: ['GMAIL_ACCESS_TOKEN'],
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'Conversations',
    description: 'Import channels the configured Slack bot can read.',
    env: ['SLACK_BOT_TOKEN'],
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    category: 'Meetings',
    description:
      'Import Teams messages and meeting notes through Microsoft Graph.',
    env: ['MICROSOFT_GRAPH_ACCESS_TOKEN'],
  },
  {
    id: 'drive',
    name: 'Google Drive',
    category: 'Documents',
    description: 'Import Google Docs and text documents from Drive.',
    env: ['GOOGLE_DRIVE_ACCESS_TOKEN'],
  },
  {
    id: 'uploads',
    name: 'Document uploads',
    category: 'Documents',
    description: 'Upload PDF, DOCX, Markdown, text, HTML, CSV, and JSON files.',
    env: [],
  },
  {
    id: 'websites',
    name: 'Websites and blogs',
    category: 'Web',
    description: 'Watch public pages and RSS/Atom feeds for changes.',
    env: [],
  },
  {
    id: 'webhook',
    name: 'Meeting webhook',
    category: 'Meetings',
    description:
      'Send transcripts or meeting minutes from any automation tool.',
    env: ['INGEST_TOKEN'],
  },
] as const;

export function connectorCatalog() {
  return CONNECTOR_CATALOG.map((connector) => ({
    ...connector,
    ready:
      connector.env.length === 0 ||
      connector.env.every((key) => Boolean(runtime()[key])) ||
      (['gmail', 'drive'].includes(connector.id) &&
        [
          'GOOGLE_CLIENT_ID',
          'GOOGLE_CLIENT_SECRET',
          'GOOGLE_REFRESH_TOKEN',
        ].every((key) => Boolean(runtime()[key]))) ||
      (['outlook', 'teams'].includes(connector.id) &&
        [
          'MICROSOFT_CLIENT_ID',
          'MICROSOFT_CLIENT_SECRET',
          'MICROSOFT_REFRESH_TOKEN',
        ].every((key) => Boolean(runtime()[key]))),
  }));
}
