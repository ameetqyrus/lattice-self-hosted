import { createSession, fail, json } from '@/lib/brain/auth';

export async function POST(req: Request) {
  try {
    const { token } = (await req.json()) as { token?: string };
    const session = await createSession(String(token || ''));
    const response = json({ ok: true });
    response.headers.append(
      'Set-Cookie',
      `lattice_session=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`,
    );
    return response;
  } catch (error) {
    return fail(error);
  }
}
