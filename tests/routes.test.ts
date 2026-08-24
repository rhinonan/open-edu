import { describe, it, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { NextRequest } from 'next/server';
import { SCHEMA_SQL } from '../lib/schema';
import { bootstrap, seedClass } from '../lib/seed';
import { createSession, sessionCookie, hashPassword } from '../lib/auth';
import { GET as resourceGET, POST as resourcePOST } from '../app/api/[resource]/route';
import { PUT as resourcePUT, DELETE as resourceDELETE } from '../app/api/[resource]/[id]/route';

// 用 vi.hoisted 先定义 DB 容器，再 mock getDb，保证路由模块在 import 时就拿到 mock
const holder = vi.hoisted(() => ({ db: null as unknown as DatabaseSync }));
vi.mock('../lib/db', () => ({ getDb: () => holder.db }));

function makeDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  bootstrap(db); // 建 admin + 演示班 + demo 老师
  holder.db = db;
  return db;
}

function userId(db: DatabaseSync, username: string): number {
  return (db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number }).id;
}

function makeRequest(method: string, path: string, token: string | undefined, body?: unknown): NextRequest {
  const headers = new Headers();
  if (token) headers.set('cookie', sessionCookie(token));
  if (body !== undefined) headers.set('content-type', 'application/json');
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const studentsCtx = { params: Promise.resolve({ resource: 'students' }) };
const slotCtx = { params: Promise.resolve({ resource: 'period_slots' }) };
const slotIdCtx = { params: Promise.resolve({ resource: 'period_slots', id: '1' }) };

describe('通用路由鉴权', () => {
  it('未登录访问资源返回 401', async () => {
    makeDb();
    const res = await resourceGET(makeRequest('GET', '/api/students', undefined), studentsCtx);
    expect(res.status).toBe(401);
  });

  it('teacher 登录后 GET /api/students 返回本班 45 人', async () => {
    const db = makeDb();
    const token = createSession(db, userId(db, 'demo'));
    const res = await resourceGET(makeRequest('GET', '/api/students', token), studentsCtx);
    expect(res.status).toBe(200);
    const rows = await res.json();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBe(45);
  });

  it('teacher 写全局 period_slots 一律 403，且不触发级联删除', async () => {
    const db = makeDb();
    const token = createSession(db, userId(db, 'demo'));
    const post = await resourcePOST(
      makeRequest('POST', '/api/period_slots', token, { seq: 99, name: '测试时段', start_time: '09:00', end_time: '09:30', kind: '自习' }),
      slotCtx,
    );
    expect(post.status).toBe(403);
    const put = await resourcePUT(makeRequest('PUT', '/api/period_slots/1', token, { name: '改名' }), slotIdCtx);
    expect(put.status).toBe(403);
    const del = await resourceDELETE(makeRequest('DELETE', '/api/period_slots/1', token), slotIdCtx);
    expect(del.status).toBe(403);
    const n = (db.prepare('SELECT COUNT(*) AS n FROM period_slots WHERE id = 1').get() as { n: number }).n;
    expect(n).toBe(1); // teacher 被 403 拦下，未发生跨班级联删除
  });

  it('admin 可新增全局 period_slots', async () => {
    const db = makeDb();
    const token = createSession(db, userId(db, 'admin'));
    const res = await resourcePOST(
      makeRequest('POST', '/api/period_slots', token, { seq: 99, name: '测试时段', start_time: '09:00', end_time: '09:30', kind: '自习' }),
      slotCtx,
    );
    expect(res.status).toBe(201);
    const row = await res.json();
    expect(row.id).toBeTruthy();
    const n = (db.prepare("SELECT COUNT(*) AS n FROM period_slots WHERE name = '测试时段'").get() as { n: number }).n;
    expect(n).toBe(1);
  });

  it('HTTP 层跨班隔离：第一个 teacher 仍只见自己班 45 人', async () => {
    const db = makeDb();
    const { lastInsertRowid: cid2 } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('六年级（2）班', '李老师', '六年级')`).run();
    seedClass(db, Number(cid2));
    db.prepare(`INSERT INTO users (username, password_hash, name, role, class_id, created_at) VALUES ('demo2', ?, '李老师', 'teacher', ?, '')`)
      .run(hashPassword('demo2'), Number(cid2));
    const token = createSession(db, userId(db, 'demo'));
    const res = await resourceGET(makeRequest('GET', '/api/students', token), studentsCtx);
    expect(res.status).toBe(200);
    const rows = await res.json();
    expect(rows.length).toBe(45); // 而非 90
  });
});
