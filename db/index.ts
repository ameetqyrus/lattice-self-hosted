import { env } from 'cloudflare:workers';
export const runtime = () => env as unknown as Record<string, any>;
export function db(): D1Database {
  const d = runtime().DB;
  if (!d) throw new Error('Database unavailable');
  return d;
}
export const stmt = (sql: string, ...args: any[]) =>
  db()
    .prepare(sql)
    .bind(...args);
export async function rows<T = any>(sql: string, ...args: any[]): Promise<T[]> {
  return (await stmt(sql, ...args).all<T>()).results;
}
export async function first<T = any>(
  sql: string,
  ...args: any[]
): Promise<T | null> {
  return stmt(sql, ...args).first<T>();
}
