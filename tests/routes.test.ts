import { describe, it, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { NextRequest } from 'next/server';
import { SCHEMA_SQL } from '../lib/schema';
import { bootstrap, seedClass } from '../lib/seed';
import { createSession, sessionCookie, hashPassword } from '../lib/auth';
import { GET as resourceGET, POST as resourcePOST } from '../app/api/[resource]/route';
import { PUT as resourcePUT, DELETE as resourceDELETE } from '../app/api/[resource]/[id]/route';
import { GET as templatesGET, POST as templatesPOST } from '../app/api/schedule-templates/route';
import { PUT as templatePUT, DELETE as templateDELETE } from '../app/api/schedule-templates/[id]/route';
import { POST as usersPOST } from '../app/api/users/route';

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

function classIdOf(db: DatabaseSync, username: string): number {
  return (db.prepare('SELECT class_id FROM users WHERE username = ?').get(username) as { class_id: number }).class_id;
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

  it('teacher 可新增/改名/删除本班 period_slots', async () => {
    const db = makeDb();
    const token = createSession(db, userId(db, 'demo'));
    const post = await resourcePOST(
      makeRequest('POST', '/api/period_slots', token, { seq: 99, name: '测试时段', start_time: '09:00', end_time: '09:30', kind: '自习' }),
      slotCtx,
    );
    expect(post.status).toBe(201);
    const row = await post.json();
    expect(row.class_id).toBe(classIdOf(db, 'demo'));
    const idle = { params: Promise.resolve({ resource: 'period_slots', id: String(row.id) }) };
    const put = await resourcePUT(makeRequest('PUT', `/api/period_slots/${row.id}`, token, { name: '改名' }), idle);
    expect(put.status).toBe(200);
    const del = await resourceDELETE(makeRequest('DELETE', `/api/period_slots/${row.id}`, token), idle);
    expect(del.status).toBe(200);
    expect((db.prepare('SELECT COUNT(*) AS n FROM period_slots WHERE id = ?').get(row.id) as { n: number }).n).toBe(0);
  });

  it('班级隔离：他班时段不可见、不可改、删除不级联', async () => {
    const db = makeDb();
    const { lastInsertRowid: cid2 } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('六年级（2）班', '李老师', '六年级')`).run();
    seedClass(db, Number(cid2));
    const token = createSession(db, userId(db, 'demo'));
    const listRes = await resourceGET(makeRequest('GET', '/api/period_slots', token), slotCtx);
    const rows = await listRes.json() as { id: number; class_id: number }[];
    expect(rows.every(r => r.class_id === classIdOf(db, 'demo'))).toBe(true);
    expect(rows).toHaveLength(11);
    const other = db.prepare('SELECT * FROM period_slots WHERE class_id = ? LIMIT 1').get(Number(cid2)) as { id: number };
    const idle = { params: Promise.resolve({ resource: 'period_slots', id: String(other.id) }) };
    const put = await resourcePUT(makeRequest('PUT', `/api/period_slots/${other.id}`, token, { name: '越权' }), idle);
    expect(put.status).toBe(400);
    const del = await resourceDELETE(makeRequest('DELETE', `/api/period_slots/${other.id}`, token), idle);
    expect(del.status).toBe(200); // 本班作用域下无匹配行，静默成功
    expect((db.prepare('SELECT COUNT(*) AS n FROM period_slots WHERE id = ?').get(other.id) as { n: number }).n).toBe(1); // 他班未被删
  });

  it('admin（无关联班级）新增 period_slots 返回 400', async () => {
    const db = makeDb();
    const token = createSession(db, userId(db, 'admin'));
    const post = await resourcePOST(
      makeRequest('POST', '/api/period_slots', token, { seq: 99, name: '测试时段', start_time: '09:00', end_time: '09:30', kind: '自习' }),
      slotCtx,
    );
    expect(post.status).toBe(400);
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

describe('作息模板路由', () => {
  it('未登录/非管理员访问模板返回 401/403', async () => {
    const db = makeDb();
    const noAuth = await templatesGET(makeRequest('GET', '/api/schedule-templates', undefined));
    expect(noAuth.status).toBe(401);
    const teacherToken = createSession(db, userId(db, 'demo'));
    const teacher = await templatesGET(makeRequest('GET', '/api/schedule-templates', teacherToken));
    expect(teacher.status).toBe(403);
  });

  it('admin 可创建/查看/改名/删除模板', async () => {
    const db = makeDb();
    const token = createSession(db, userId(db, 'admin'));
    const slots = [
      { name: '早自习', start_time: '07:50', end_time: '08:20', kind: '自习' },
      { name: '第1节', start_time: '08:30', end_time: '09:10', kind: '正课' },
    ];
    const post = await templatesPOST(makeRequest('POST', '/api/schedule-templates', token, { name: '夏季作息', remark: '备注', slots }));
    expect(post.status).toBe(201);
    const { template } = await post.json();
    expect(template.id).toBeTruthy();
    expect(template.slots).toHaveLength(2);
    const listRes = await templatesGET(makeRequest('GET', '/api/schedule-templates', token));
    const { templates } = await listRes.json();
    expect(templates).toHaveLength(2); // 默认「标准作息」 + 新建
    expect(templates.map((t: { name: string }) => t.name)).toContain('夏季作息');
    const ctx = { params: Promise.resolve({ id: String(template.id) }) };
    const put = await templatePUT(makeRequest('PUT', `/api/schedule-templates/${template.id}`, token, { name: '冬季作息' }), ctx);
    expect(put.status).toBe(200);
    const del = await templateDELETE(makeRequest('DELETE', `/api/schedule-templates/${template.id}`, token), ctx);
    expect(del.status).toBe(200);
    const after = await templatesGET(makeRequest('GET', '/api/schedule-templates', token));
    expect((await after.json()).templates).toHaveLength(1);
  });

  it('POST 模板校验：无名称/无时段返回 400', async () => {
    const db = makeDb();
    const token = createSession(db, userId(db, 'admin'));
    const noName = await templatesPOST(makeRequest('POST', '/api/schedule-templates', token, { name: '', slots: [{ name: '早自习', start_time: '', end_time: '', kind: '自习' }] }));
    expect(noName.status).toBe(400);
    const noSlots = await templatesPOST(makeRequest('POST', '/api/schedule-templates', token, { name: '夏季作息', slots: [] }));
    expect(noSlots.status).toBe(400);
  });

  it('建班时应用模板：新班级带对模板时段；模板不存在返回 400', async () => {
    const db = makeDb();
    const token = createSession(db, userId(db, 'admin'));
    const ts = await templatesPOST(makeRequest('POST', '/api/schedule-templates', token, {
      name: '小班作息',
      slots: [{ name: '早自习', start_time: '07:50', end_time: '08:20', kind: '自习' }],
    }));
    const { template } = await ts.json();

    const created = await usersPOST(makeRequest('POST', '/api/users', token, {
      username: 't2', password: 'x', name: '李老师', className: '六年级（3）班', templateId: template.id,
    }));
    expect(created.status).toBe(201);
    const uid = (await created.json()).id;
    const classId = (db.prepare('SELECT class_id FROM users WHERE id = ?').get(uid) as { class_id: number }).class_id;
    const n = (db.prepare('SELECT COUNT(*) AS n FROM period_slots WHERE class_id = ?').get(classId) as { n: number }).n;
    expect(n).toBe(1);

    const bad = await usersPOST(makeRequest('POST', '/api/users', token, {
      username: 't3', password: 'x', name: '王老师', className: '六年级（4）班', templateId: 999,
    }));
    expect(bad.status).toBe(400);
  });
});
