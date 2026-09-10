import { unzipSync, strFromU8 } from 'fflate';
import { extractText } from 'unpdf';
import { authorized, checkOrigin, fail, json } from '@/lib/brain/auth';
import { BrainError } from '@/lib/brain/core';
import { ingest } from '@/lib/brain/ingest';

const cleanHtml = (value: string) =>
  value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
async function extract(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  if (file.size > 12_000_000)
    throw new BrainError(413, 'Files must be 12 MB or smaller.');
  if (name.endsWith('.pdf')) {
    const result = await extractText(bytes, { mergePages: true });
    return String(result.text);
  }
  if (name.endsWith('.docx')) {
    const archive = unzipSync(bytes);
    const xml = archive['word/document.xml'];
    if (!xml)
      throw new BrainError(400, 'This DOCX has no readable document body.');
    return cleanHtml(
      strFromU8(xml)
        .replace(/<w:tab\/?\s*>/g, '\t')
        .replace(/<\/w:p>/g, '\n'),
    );
  }
  const raw = new TextDecoder().decode(bytes);
  return /\.html?$/.test(name) ? cleanHtml(raw) : raw;
}

export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const actor = await authorized(req, 'ingest');
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File))
      throw new BrainError(400, 'Choose a document to upload.');
    const body = (await extract(file)).trim().slice(0, 250000);
    if (body.length < 12)
      throw new BrainError(
        400,
        'The document did not contain enough readable text.',
      );
    const domainValue = form.get('domain');
    const domain = typeof domainValue === 'string' ? domainValue : 'PERSONAL';
    return json(
      await ingest(
        {
          provider: 'uploads',
          externalId: `${file.name}:${file.lastModified}:${file.size}`,
          title: file.name,
          domain,
          body,
          kind: 'uploaded-document',
          observedAt: new Date().toISOString(),
          metadata: {
            filename: file.name,
            mimeType: file.type,
            size: file.size,
            extractionMethod: 'local-parser',
          },
        },
        actor,
      ),
    );
  } catch (error) {
    return fail(error);
  }
}
