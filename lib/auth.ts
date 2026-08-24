import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export interface UserRow {
  id: number;
  username: string;
  name: string;
  role: string;
  class_id: number | null;
}

export const COOKIE = 'gzt_session';

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 64).toString('hex')}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  if (!/^[0-9a-f]{128}$/i.test(hash)) return false;
  return timingSafeEqual(scryptSync(pw, salt, 64), Buffer.from(hash, 'hex'));
}

export function createSession(db: DatabaseSync, userId: number): string {
  const token = randomBytes(32).toString('hex');
  const expires = Date.now() + 30 * 24 * 60 * 60 * 1000;
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires);
  return token;
}

export function getSessionUser(db: DatabaseSync, token: string | undefined): UserRow | null {
  if (!token) return null;
  const row = db.prepare(`SELECT u.id, u.username, u.name, u.role, u.class_id
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ?`).get(token, Date.now()) as UserRow | undefined;
  return row ?? null;
}

export function deleteSession(db: DatabaseSync, token: string): void {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function readToken(req: Request): string | undefined {
  const h = req.headers.get('cookie') ?? '';
  const entry = h.split(/;\s*/).find(c => c.startsWith(`${COOKIE}=`));
  return entry ? entry.slice(COOKIE.length + 1) : undefined;
}

export function sessionCookie(token: string): string {
  return `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`;
}

export function clearCookie(): string {
  return `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}

export function currentUser(db: DatabaseSync, req: Request): UserRow | null {
  return getSessionUser(db, readToken(req));
}
