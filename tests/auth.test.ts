import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../lib/schema';
import { hashPassword, verifyPassword, createSession, getSessionUser, deleteSession, sessionCookie, clearCookie, readToken, COOKIE } from '../lib/auth';

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  db.prepare(`INSERT INTO users (username, password_hash, name, role, class_id, created_at) VALUES ('w', ?, '王老师', 'teacher', 1, '')`)
    .run(hashPassword('secret'));
  return db;
}

describe('hashPassword / verifyPassword', () => {
  it('一致则通过，不一致则失败，随机盐各不相同', () => {
    const h1 = hashPassword('abc');
    const h2 = hashPassword('abc');
    expect(h1).not.toBe(h2);
    expect(verifyPassword('abc', h1)).toBe(true);
    expect(verifyPassword('bad', h1)).toBe(false);
    expect(h1).toContain(':');
  });

  it('verifyPassword 对畸形字符串返回 false', () => {
    expect(verifyPassword('x', 'no-colon')).toBe(false);
    expect(verifyPassword('x', '')).toBe(false);
  });
});

describe('sessions', () => {
  it('createSession 后 getSessionUser 可反查用户', () => {
    const db = makeDb();
    const token = createSession(db, 1);
    const u = getSessionUser(db, token);
    expect(u?.username).toBe('w');
    expect(u?.class_id).toBe(1);
  });

  it('deleteSession 后失效', () => {
    const db = makeDb();
    const token = createSession(db, 1);
    deleteSession(db, token);
    expect(getSessionUser(db, token)).toBeNull();
  });

  it('未登录 / 过期 token 返回 null', () => {
    const db = makeDb();
    expect(getSessionUser(db, undefined)).toBeNull();
    expect(getSessionUser(db, 'nope')).toBeNull();
  });
});

describe('cookie helpers', () => {
  it('sessionCookie 带 HttpOnly/Path/SameSite', () => {
    const c = sessionCookie('tok');
    expect(c.startsWith(`${COOKIE}=tok;`)).toBe(true);
    expect(c).toContain('HttpOnly');
    expect(c).toContain('Path=/');
    expect(c).toContain('SameSite=Lax');
  });

  it('clearCookie 把 Max-Age 置 0', () => {
    expect(clearCookie()).toContain(`${COOKIE}=;`);
    expect(clearCookie()).toContain('Max-Age=0');
  });

  it('readToken 从 Cookie 头解析', () => {
    const req = { headers: { get: (n: string) => n === 'cookie' ? `${COOKIE}=abc; other=1` : null } } as unknown as Request;
    expect(readToken(req)).toBe('abc');
    const req2 = { headers: { get: () => null } } as unknown as Request;
    expect(readToken(req2)).toBeUndefined();
  });
});
