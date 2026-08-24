# 多用户（每班主任独立班级）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前"单班工作台"改造成多租户：新增账号体系，每个班主任登录后只看到自己班的数据；管理员可创建老师账号、分配班级、备份。部署形态保持**局域网自托管**（单机单进程）。

**Architecture:** 数据层直接加 `users` / `classes` / `sessions` 三张表，给所有业务表加 `class_id`；用 `node:crypto` 的 `scrypt` 做密码哈希，session 存 DB、`httpOnly` cookie 下发。作用域收口在 `lib/store.ts` + 通用路由两处：`sanitize` 强制剥掉 `class_id`（防伪造），所有增删改查带 `class_id` 过滤（防越权）。旧 `settings` 表的班级信息迁到 `classes` 表并删除 `settings`。按"未部署、不兼容旧数据"原则，启动自愈直接重置重建。

**Tech Stack:** Next.js 16 (App Router)、React 19、node:sqlite (`DatabaseSync`)、`node:crypto`(scrypt)、vitest、antd + Tailwind。测试 `npm test`，构建 `npm run build`，lint `npm run lint`。要求 **Node >= 22**。

**Spec:** `docs/superpowers/specs/2026-08-23-multiuser-wireframe.md`（前端改动线框图）；本计划的数据模型/边界决策见下。

## Global Constraints

- 未部署、不兼容旧数据：已有 `data/app.db` 由启动自愈（`lib/db.ts` 哨兵列）直接重置重建，不做逐字段迁移。
- 角色枚举只有 `admin` / `teacher`。`teacher` 只能访问自己 `class_id` 的数据；`admin` 不出现在业务数据里（`class_id` 为 NULL，业务查询返回空），仅做账号/班级/备份。
- 密码仅存 `scrypt` 哈希（`salt:hash`），任何接口不返回 `password_hash`。
- session 是 DB 内的一条记录，token 为 `randomBytes(32)` hex，`httpOnly; Path=/; SameSite=Lax` cookie 下发，有效期 30 天。
- `class_id` 由服务端注入（`sanitize` 总剥离 `class_id`），客户端永远不能传；所有 `list/get/create/update/remove` 及手写 SQL 必须带 `class_id` 过滤，否则视为越权漏洞。
- 学生身份证为**班级内**唯一：`UNIQUE(class_id, idcard)`；空串存 `NULL`。
- 页面文案使用中文；遵循现有 CrudPage 配置驱动模式（`'use client'` + `CrudPageConfig`）。
- 提交信息沿用仓库前缀（`feat:` / `fix:` / `test:` / `chore:`）。
- AGENTS.md 提示本项目 Next.js 有 breaking changes：route handler 的 `params` 是 `Promise<...>` 必须 `await`。仓库无 route 层单元测试先例，route 改动用 `npm run build` + 冒烟验证。
- 测试统一用 `new DatabaseSync(':memory:')` + `SCHEMA_SQL` 直连 `lib/`，无需服务器。

---

### Task 1: 数据模型、单班播种、启动引导 + 数据层作用域（一揽子，保持绿）

**Files:**
- Modify: `lib/schema.ts`（新增 classes/users/sessions，全业务表加 class_id，删 settings，改学生唯一索引）
- Modify: `lib/seed.ts`（seedClass / resetClass / bootstrap / resetData）
- Modify: `lib/db.ts`（哨兵列改 class_id，调用 bootstrap）
- Modify: `lib/store.ts`（函数全部带 classId，sanitize 剥 class_id，删 settings）
- Modify: `lib/types.ts`（ResourceKey 删 'settings'）
- Modify: `tests/seed.test.ts`、`tests/store.test.ts`、`tests/dashboard.test.ts`、`tests/import.test.ts`（makeDb 建班 + 新签名）

**Interfaces:**
- Consumes: 现有 `SCHEMA_SQL` / `seedIfEmpty` / `resetData` / `RESOURCES`。
- Produces:
  - `seedClass(db: DatabaseSync, classId: number): void` —— 为指定班级灌入 45 学生 + classroom_config + 课表 + 成绩 + 演示业务行。
  - `resetClass(db: DatabaseSync, classId: number): void` —— 删除该班所有业务行并重新 `seedClass`。
  - `bootstrap(db: DatabaseSync): { createdAdmin: boolean }` —— users 为空时建 admin + 一个演示班 + demo 老师。
  - `resetData(db: DatabaseSync): void` —— DROP 全部表 + `SCHEMA_SQL` + `bootstrap`。
  - `list/get/create/update/remove(db, resource, ..., classId)` —— 全部带 `class_id`；`sanitize` 剥离 `{id, class_id}`。

- [ ] **Step 1: 改 `lib/types.ts`** —— `ResourceKey` 删掉 `'settings'`：

```ts
export type Row = Record<string, string | number | null>;

export type ResourceKey =
  | 'students' | 'classroom_config' | 'leave_records'
  | 'discipline_records' | 'grades'
  | 'timetable' | 'todos' | 'conversations' | 'home_visits'
  | 'evaluation' | 'parent_comm' | 'safety_logs'
  | 'work_logs' | 'seats';

export interface DashboardStats { /* 不变 */ }
```

- [ ] **Step 2: 改 `lib/schema.ts`** —— 替换整段 `SCHEMA_SQL`：

```sql
CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  head_teacher TEXT NOT NULL DEFAULT '',
  grade_band TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'teacher',
  class_id INTEGER,
  created_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  student_no TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT '男',
  parent_name TEXT NOT NULL DEFAULT '',
  parent_phone TEXT NOT NULL DEFAULT '',
  idcard TEXT,
  address TEXT NOT NULL DEFAULT '',
  level INTEGER NOT NULL DEFAULT 4,
  group_no INTEGER NOT NULL DEFAULT 1,
  role TEXT NOT NULL DEFAULT '',
  noon_care INTEGER NOT NULL DEFAULT 0,
  breakfast INTEGER NOT NULL DEFAULT 0,
  afternoon_care INTEGER NOT NULL DEFAULT 1,
  remark TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_idcard ON students(class_id, idcard);

CREATE TABLE IF NOT EXISTS classroom_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 7,
  col_count INTEGER NOT NULL DEFAULT 8,
  desk_label TEXT NOT NULL DEFAULT '双人课桌'
);

CREATE TABLE IF NOT EXISTS leave_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  student_name TEXT NOT NULL,
  leave_type TEXT NOT NULL DEFAULT '事假',
  reason TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  hours REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS discipline_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  date TEXT NOT NULL DEFAULT '',
  student_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '常规纪律',
  content TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS grades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  exam_name TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '语文',
  student_name TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS timetable (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  weekday INTEGER NOT NULL DEFAULT 1,
  period TEXT NOT NULL DEFAULT '正课',
  subject TEXT NOT NULL DEFAULT '',
  is_chinese INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '待办',
  priority TEXT NOT NULL DEFAULT '普通'
);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  date TEXT NOT NULL DEFAULT '',
  student_name TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  effect TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS home_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  date TEXT NOT NULL DEFAULT '',
  student_name TEXT NOT NULL,
  way TEXT NOT NULL DEFAULT '电话',
  content TEXT NOT NULL DEFAULT '',
  is_meeting INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS evaluation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  student_name TEXT NOT NULL,
  moral INTEGER NOT NULL DEFAULT 3,
  study INTEGER NOT NULL DEFAULT 3,
  sports INTEGER NOT NULL DEFAULT 3,
  art INTEGER NOT NULL DEFAULT 3,
  labor INTEGER NOT NULL DEFAULT 3,
  comment TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS parent_comm (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  date TEXT NOT NULL DEFAULT '',
  student_name TEXT NOT NULL,
  way TEXT NOT NULL DEFAULT '微信',
  content TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS safety_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  date TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '课间',
  content TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS work_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  date TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '班级管理',
  place TEXT NOT NULL DEFAULT '',
  hours REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS seats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  row_index INTEGER NOT NULL,
  col_index INTEGER NOT NULL,
  student_name TEXT NOT NULL DEFAULT ''
);
```

注意：`settings` 表与本段相关引用全部移除；学生唯一索引改为 `(class_id, idcard)`。

- [ ] **Step 3: 改 `lib/store.ts`** —— 全量替换：

```ts
import type { DatabaseSync } from 'node:sqlite';
import type { ResourceKey, Row } from './types';

export const RESOURCES: Record<ResourceKey, string> = {
  students: 'students',
  classroom_config: 'classroom_config',
  leave_records: 'leave_records',
  discipline_records: 'discipline_records',
  grades: 'grades',
  timetable: 'timetable',
  todos: 'todos',
  conversations: 'conversations',
  home_visits: 'home_visits',
  evaluation: 'evaluation',
  parent_comm: 'parent_comm',
  safety_logs: 'safety_logs',
  work_logs: 'work_logs',
  seats: 'seats',
};

export function tableColumns(db: DatabaseSync, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name);
}

// class_id 由服务端注入：无论客户端传什么，永远剥离，再在写语句里由本层补上真实值
const OUT = new Set(['id', 'class_id']);

function sanitize(db: DatabaseSync, table: string, data: Partial<Row>): Record<string, string | number | null> {
  const cols = new Set(tableColumns(db, table));
  const out: Record<string, string | number | null> = {};
  for (const [k, v] of Object.entries(data)) {
    if (OUT.has(k)) continue;
    if (!cols.has(k)) continue;
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

function table(resource: ResourceKey): string {
  return RESOURCES[resource];
}

export function list(db: DatabaseSync, resource: ResourceKey, classId: number): Row[] {
  return db.prepare(`SELECT * FROM ${table(resource)} WHERE class_id = ? ORDER BY id`).all(classId) as Row[];
}

export function get(db: DatabaseSync, resource: ResourceKey, id: number, classId: number): Row | undefined {
  return db.prepare(`SELECT * FROM ${table(resource)} WHERE id = ? AND class_id = ?`).get(id, classId) as Row | undefined;
}

export function create(db: DatabaseSync, resource: ResourceKey, data: Partial<Row>, classId: number): Row {
  const t = table(resource);
  const clean = sanitize(db, t, data);
  // null 值不进 INSERT 列（落到列的 NULL 默认值，如 idcard），class_id 由本层注入
  const keys = Object.keys(clean).filter(k => clean[k] !== null);
  const cols = [...keys, 'class_id'];
  const params = cols.map(k => `@${k}`).join(', ');
  const values: Record<string, string | number> = {};
  for (const k of keys) values[k] = clean[k] as string | number;
  values['class_id'] = classId;
  const stmt = db.prepare(`INSERT INTO ${t} (${cols.join(', ')}) VALUES (${params})`);
  const result = stmt.run(values);
  return get(db, resource, Number(result.lastInsertRowid), classId)!;
}

export function update(db: DatabaseSync, resource: ResourceKey, id: number, data: Partial<Row>, classId: number): Row {
  const t = table(resource);
  const clean = sanitize(db, t, data);
  const keys = Object.keys(clean);
  if (keys.length > 0) {
    const sets = keys.map(k => `"${k}" = @${k}`).join(', ');
    db.prepare(`UPDATE ${t} SET ${sets} WHERE id = @id AND class_id = @classId`).run({ ...clean, id, classId });
  }
  const row = get(db, resource, id, classId);
  if (!row) throw new Error('记录不存在');
  return row;
}

export function remove(db: DatabaseSync, resource: ResourceKey, id: number, classId: number): void {
  db.prepare(`DELETE FROM ${table(resource)} WHERE id = ? AND class_id = ?`).run(id, classId);
}
```

- [ ] **Step 4: 改 `lib/seed.ts`** —— 全量替换（保留既有随机数据生成函数，改成 `seedClass` 接收 `classId`）：

```ts
import type { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from './schema';
import { hashPassword } from './auth';

const SURNAMES = ['李','王','张','刘','陈','杨','赵','黄','周','吴','徐','孙','胡','朱','高','林','何','郭','马','罗','梁','宋','郑','谢','韩','唐','冯','于','董','萧','程','曹','袁','邓','许','傅','沈','曾','彭','吕','苏','卢','蒋','蔡','贾','丁','魏','薛','叶','阎','余','潘','杜','戴','夏','钟','汪','田','任','姜','范','方','石','姚','谭','廖','邹','熊','金','陆','郝','孔','白','崔','康','毛','邱','秦','江','史','顾','侯','邵','孟','龙','万','段','雷','钱','汤','尹','黎','易','常','武','乔','贺','赖','龚'];
const GIVEN = ['子涵','雨欣','欣怡','梓萱','浩然','子轩','宇轩','思远','俊杰','天佑','佳琪','梦洁','诗涵','可欣','一诺','欣妍','奕辰','梓豪','若曦','语嫣','悦彤','雨泽','志强','文博','明轩','芷晴','思彤','博文','子墨','峻熙','嘉懿','煜城','懿轩','烨霖','楷瑞','建辉','致远','文昊','凯瑞','昊然','奕然','黎昕','志远','轩磊','浩宇','瑾瑜','子航','梓童','静怡','思睿'];
const PHONE_PREFIX = ['130','131','132','133','135','136','137','138','139','150','151','152','153','155','156','157','158','159','180','181','182','183','185','186','187','188','189'];
const AREAS = ['青园街道', '侯家塘街道', '金盆岭街道', '东塘街道', '赤岭路街道', '文源街道'];
const RESIDENCES = ['天心阁小区', '湘府华庭', '阳光壹佰', '白沙花园', '翡翠云天', '翰林府'];
const ROLES = ['班长','副班长','学习委员','纪律委员','劳动委员','体育委员','语文课代表','数学课代表','英语课代表', ''];

function rand(n: number) { return Math.floor(Math.random() * n); }
function pick<T>(arr: T[]): T { return arr[rand(arr.length)]; }
function phone() { return pick(PHONE_PREFIX) + String(rand(90000000) + 10000000); }
function date(daysAgo: number) { const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toISOString().slice(0, 10); }
function uniqueNames(n: number): string[] { const out = new Set<string>(); while (out.size < n) out.add(pick(SURNAMES) + pick(GIVEN)); return [...out]; }

function fakeIdcard(i: number): string {
  const area = '430102';
  const birth = `${2013 + rand(2)}${String(rand(12) + 1).padStart(2, '0')}${String(rand(28) + 1).padStart(2, '0')}`;
  const seq = String(i + 1).padStart(3, '0');
  const body = area + birth + seq;
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const map = '10X98765432';
  const sum = body.split('').reduce((s, ch, idx) => s + Number(ch) * weights[idx], 0);
  return body + map[sum % 11];
}

/** 为指定班级灌入一套完整演示数据（45 名学生 + 班级配置 + 课表 + 成绩 + 各类业务行） */
export function seedClass(db: DatabaseSync, classId: number): void {
  const ins = db.prepare(`INSERT INTO students (class_id, student_no, name, gender, parent_name, parent_phone, idcard, address, level, group_no, role, noon_care, breakfast, afternoon_care, remark)
    VALUES (@classId, @student_no, @name, @gender, @parent_name, @phone, @idcard, @address, @level, @group, @role, @noon, @breakfast, @care, '')`);
  const students = uniqueNames(45);
  students.forEach((name, i) => {
    ins.run({
      classId,
      student_no: String(i + 1).padStart(2, '0'),
      name,
      gender: rand(2) === 0 ? '女' : '男',
      parent_name: pick(SURNAMES) + pick(GIVEN),
      phone: phone(),
      idcard: fakeIdcard(i),
      address: pick(AREAS) + pick(RESIDENCES),
      level: 1 + rand(6),
      group: rand(6) + 1,
      role: rand(4) === 0 ? pick(ROLES) : '',
      noon: rand(2) === 0 ? 0 : 1,
      breakfast: rand(2) === 0 ? 0 : 1,
      care: rand(2) === 0 ? 0 : 1,
    });
  });

  db.prepare(`INSERT INTO classroom_config (class_id, row_count, col_count, desk_label) VALUES (?, 7, 8, '双人课桌')`).run(classId);

  const periods = ['早读', '正课', '正课', '正课', '中午托', '下午托'];
  const subjects = ['语文', '数学', '英语', '科学', '道德与法治', '体育', '音乐', '美术', '班会', '劳动'];
  const tt = db.prepare(`INSERT INTO timetable (class_id, weekday, period, subject, is_chinese) VALUES (?, ?, ?, ?, ?)`);
  for (let wd = 1; wd <= 5; wd++) {
    periods.forEach(p => {
      let subject = pick(subjects);
      if (p === '早读') subject = '语文';
      if (p === '中午托' || p === '下午托') subject = '自习';
      tt.run(classId, wd, p, subject, subject === '语文' ? 1 : 0);
    });
  }

  const g = db.prepare(`INSERT INTO grades (class_id, exam_name, subject, student_name, score) VALUES (?, '单元小测（一）', ?, ?, ?)`);
  for (const s of students) for (const subj of ['语文', '数学', '英语']) g.run(classId, subj, s, 60 + rand(40));

  const lv = db.prepare(`INSERT INTO leave_records (class_id, student_name, leave_type, reason, start_date, end_date, hours) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  lv.run(classId, students[0], '事假', '家里有事', date(1), date(1), 8);
  lv.run(classId, students[1], '病假', '感冒发烧', date(2), date(1), 16);

  const dc = db.prepare(`INSERT INTO discipline_records (class_id, date, student_name, category, content, action) VALUES (?, ?, ?, ?, ?, ?)`);
  dc.run(classId, date(1), students[2], '课堂表现', '上课讲话', '谈话教育');
  dc.run(classId, date(2), students[3], '迟到早退', '迟到 10 分钟', '提醒并联系家长');

  const conv = db.prepare(`INSERT INTO conversations (class_id, date, student_name, topic, content, effect) VALUES (?, ?, ?, ?, ?, ?)`);
  conv.run(classId, date(1), students[2], '课堂纪律', '约定课堂不讲话', '有改善');
  const hv = db.prepare(`INSERT INTO home_visits (class_id, date, student_name, way, content, is_meeting) VALUES (?, ?, ?, ?, ?, ?)`);
  hv.run(classId, date(5), students[0], '家访', '了解家庭学习环境', 0);
  hv.run(classId, date(6), '全班', '家长会', '期中家长会：学情反馈', 1);
  const ev = db.prepare(`INSERT INTO evaluation (class_id, student_name, moral, study, sports, art, labor, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const s of students) ev.run(classId, s, 3 + rand(3), 2 + rand(4), 2 + rand(4), 2 + rand(4), 2 + rand(4), '');
  const pc = db.prepare(`INSERT INTO parent_comm (class_id, date, student_name, way, content) VALUES (?, ?, ?, ?, ?)`);
  pc.run(classId, date(1), students[0], '微信', '反馈近期作业情况');
  const sl = db.prepare(`INSERT INTO safety_logs (class_id, date, category, content, action) VALUES (?, ?, ?, ?, ?)`);
  sl.run(classId, date(3), '消防', '消防疏散演练', '已完成');

  const wl = db.prepare(`INSERT INTO work_logs (class_id, date, title, type, place, hours) VALUES (?, ?, ?, ?, ?, ?)`);
  const workSeed: [string, string, string, number][] = [
    ['早读巡查', '班级管理', '教室', 0.5],
    ['集体备课', '教学教研', '办公室', 1.5],
    ['家长会筹备', '家校沟通', '办公室', 1],
    ['作文培优', '学生培优', '教室', 1],
    ['安全主题班会', '安全教育', '教室', 0.5],
  ];
  workSeed.forEach(([title, type, place, hours], i) => wl.run(classId, date(i * 2), title, type, place, hours));

  const td = db.prepare(`INSERT INTO todos (class_id, title, date, status, priority) VALUES (?, ?, ?, ?, ?)`);
  td.run(classId, '准备下周家长会材料', date(0), '待办', '高');
  td.run(classId, '核对期末评语', date(2), '待办', '普通');
  td.run(classId, '收集研学回执', date(4), '已完成', '普通');

  const seat = db.prepare(`INSERT INTO seats (class_id, row_index, col_index, student_name) VALUES (?, ?, ?, ?)`);
  const cc = db.prepare('SELECT row_count, col_count FROM classroom_config WHERE class_id = ?').get(classId) as { row_count: number; col_count: number };
  let si = 0;
  for (let r = 0; r < cc.row_count; r++) for (let c = 0; c < cc.col_count; c++) { seat.run(classId, r, c, si < students.length ? students[si] : ''); si++; }
}

/** users 为空时引导：建 admin、一个演示班、一个 demo 老师。返回是否新建了账号 */
export function bootstrap(db: DatabaseSync): { createdAdmin: boolean } {
  const n = (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
  if (n > 0) return { createdAdmin: false };
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO users (username, password_hash, name, role, class_id, created_at) VALUES ('admin', ?, '系统管理员', 'admin', NULL, ?)`)
    .run(hashPassword('admin'), now);
  const { lastInsertRowid: classId } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('长沙青园小学六年级（1）班', '王老师', '六年级')`).run();
  seedClass(db, Number(classId));
  db.prepare(`INSERT INTO users (username, password_hash, name, role, class_id, created_at) VALUES ('demo', ?, '王老师', 'teacher', ?, ?)`)
    .run(hashPassword('demo'), Number(classId), now);
  return { createdAdmin: true };
}

/** 重置某一班级：删除其全部业务行并重新播种 */
export function resetClass(db: DatabaseSync, classId: number): void {
  const childTables = ['todos', 'work_logs', 'safety_logs', 'parent_comm', 'evaluation', 'home_visits',
    'conversations', 'timetable', 'grades', 'discipline_records', 'leave_records', 'seats', 'students', 'classroom_config'];
  for (const t of childTables) db.prepare(`DELETE FROM ${t} WHERE class_id = ?`).run(classId);
  seedClass(db, classId);
}

/** 全库重置（启动自愈用）：DROP 全部 → 重建 → 引导 */
export function resetData(db: DatabaseSync): void {
  const tables = ['sessions', 'work_logs', 'safety_logs', 'parent_comm', 'evaluation', 'home_visits',
    'conversations', 'timetable', 'grades', 'discipline_records', 'leave_records', 'seats', 'students',
    'classroom_config', 'users', 'classes'];
  db.exec(tables.map(t => `DROP TABLE IF EXISTS ${t}`).join(';'));
  db.exec(SCHEMA_SQL);
  bootstrap(db);
}
```

- [ ] **Step 5: 改 `lib/db.ts`** —— 哨兵列改为 `class_id`，并调用 `bootstrap`：

```ts
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { SCHEMA_SQL } from './schema';
import { resetData, bootstrap } from './seed';

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!db) {
    const dir = join(process.cwd(), 'data');
    mkdirSync(dir, { recursive: true });
    db = new DatabaseSync(join(dir, 'app.db'));
    db.exec('PRAGMA journal_mode = WAL;');
    // 哨兵列：旧库 students 缺 class_id 即判定为旧结构，先整体重置再重建
    const studentCols = (db.prepare('PRAGMA table_info(students)').all() as { name: string }[]).map(c => c.name);
    if (studentCols.length > 0 && !studentCols.includes('class_id')) resetData(db);
    db.exec(SCHEMA_SQL);
    bootstrap(db);
  }
  return db;
}
```

- [ ] **Step 6: 更新 `tests/seed.test.ts`**（makeDb 建班、断言改成 classes + class_id，删 settings 断言）：

```ts
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../lib/schema';
import { bootstrap, resetData, seedClass } from '../lib/seed';

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  const { lastInsertRowid } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('长沙青园小学六年级（1）班', '王老师', '六年级')`).run();
  seedClass(db, Number(lastInsertRowid));
  return { db, classId: Number(lastInsertRowid) };
}

describe('schema', () => {
  it('创建全部 18 张表', () => {
    const { db } = makeDb();
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]).map(t => t.name);
    expect(tables).toEqual(expect.arrayContaining([
      'classes', 'users', 'sessions', 'students', 'classroom_config', 'leave_records', 'discipline_records',
      'grades', 'timetable', 'todos', 'conversations',
      'home_visits', 'evaluation', 'parent_comm', 'safety_logs',
      'work_logs', 'seats',
    ]));
    expect(tables).not.toContain('settings');
  });

  it('students 唯一索引按 (class_id, idcard)', () => {
    const { db } = makeDb();
    const idx = db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_students_idcard'").get() as { sql: string };
    expect(idx.sql).toContain('(class_id, idcard)');
  });
});

describe('seedClass', () => {
  it('灌入 45 名随机学生，且带对 class_id', () => {
    const { db, classId } = makeDb();
    const n = (db.prepare('SELECT COUNT(*) AS n FROM students WHERE class_id = ?').get(classId) as { n: number }).n;
    expect(n).toBe(45);
  });

  it('两班互相隔离', () => {
    const { db } = makeDb();
    const { lastInsertRowid: cid2 } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('六年级（2）班', '李老师', '六年级')`).run();
    seedClass(db, Number(cid2));
    const r = (db.prepare('SELECT class_id, COUNT(*) AS n FROM students GROUP BY class_id ORDER BY class_id').all() as { class_id: number; n: number }[]);
    expect(r).toEqual([{ class_id: 1, n: 45 }, { class_id: 2, n: 45 }]);
  });

  it('包含 classroom_config 与课表', () => {
    const { db, classId } = makeDb();
    const cc = (db.prepare('SELECT COUNT(*) AS n FROM classroom_config WHERE class_id = ?').get(classId) as { n: number }).n;
    const tt = (db.prepare('SELECT COUNT(*) AS n FROM timetable WHERE class_id = ?').get(classId) as { n: number }).n;
    expect(cc).toBe(1);
    expect(tt).toBe(30);
  });
});

describe('bootstrap', () => {
  it('users 为空时创建 admin 与 demo 老师 + 一个班', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(SCHEMA_SQL);
    const { createdAdmin } = bootstrap(db);
    expect(createdAdmin).toBe(true);
    const users = db.prepare('SELECT username, role, class_id FROM users ORDER BY id').all() as { username: string; role: string; class_id: number | null }[];
    expect(users.map(u => u.username)).toEqual(['admin', 'demo']);
    expect(users.find(u => u.username === 'demo')?.class_id).toBeTruthy();
    expect((db.prepare('SELECT COUNT(*) AS n FROM classes').get() as { n: number }).n).toBe(1);
  });

  it('已有 users 则不再引导', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(SCHEMA_SQL);
    bootstrap(db);
    const again = bootstrap(db);
    expect(again.createdAdmin).toBe(false);
    expect((db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n).toBe(2);
  });
});

describe('resetClass', () => {
  it('只重置本班数据，不影响他班', () => {
    const { db } = makeDb();
    const { lastInsertRowid: cid2 } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('六年级（2）班', '李老师', '六年级')`).run();
    seedClass(db, Number(cid2));
    db.prepare('DELETE FROM students WHERE class_id = 1 AND id IN (SELECT id FROM students WHERE class_id = 1 LIMIT 5)').run();
    resetClass(db, 1);
    expect((db.prepare('SELECT COUNT(*) AS n FROM students WHERE class_id = 1').get() as { n: number }).n).toBe(45);
    expect((db.prepare('SELECT COUNT(*) AS n FROM students WHERE class_id = 2').get() as { n: number }).n).toBe(45);
  });
});

describe('resetData', () => {
  it('全库重置后回到引导态', () => {
    const { db } = makeDb();
    resetData(db);
    expect((db.prepare('SELECT COUNT(*) AS n FROM classes').get() as { n: number }).n).toBe(1);
    expect((db.prepare('SELECT COUNT(*) AS n FROM students').get() as { n: number }).n).toBe(45);
  });
});
```

- [ ] **Step 7: 更新 `tests/store.test.ts`**（makeDb 返回 `{ db, classId }`，所有调用带 classId）：

```ts
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../lib/schema';
import { seedClass } from '../lib/seed';
import { list, get, create, update, remove, tableColumns } from '../lib/store';

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  const { lastInsertRowid } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('测试班', '王老师', '六年级')`).run();
  const classId = Number(lastInsertRowid);
  seedClass(db, classId);
  return { db, classId };
}

describe('store', () => {
  it('list 只返回本班学生并排序', () => {
    const { db, classId } = makeDb();
    const rows = list(db, 'students', classId);
    expect(rows.length).toBe(45);
    expect(rows[0].name).toBeTruthy();
  });

  it('list 不返回他班数据', () => {
    const { db, classId } = makeDb();
    const { lastInsertRowid: cid2 } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('六年级（2）班', '李老师', '六年级')`).run();
    seedClass(db, Number(cid2));
    expect(list(db, 'students', classId).length).toBe(45); // 只看到自己的班
  });

  it('create 新增并返回带 id 的行，class_id 由本层注入', () => {
    const { db, classId } = makeDb();
    const row = create(db, 'students', { name: '测试生', gender: '男', parent_phone: '13000000000', role: '', group_no: 1, level: 5, afternoon_care: 1, remark: '' }, classId);
    expect(row.id).toBeTruthy();
    expect(get(db, 'students', row.id as number, classId)?.name).toBe('测试生');
  });

  it('客户端伪造 class_id 会被剥离', () => {
    const { db, classId } = makeDb();
    const row = create(db, 'students', { name: '甲', class_id: 999 }, classId) as unknown as { class_id: number };
    expect(row.class_id).toBe(classId); // 忽略客户端传的 999
  });

  it('create 忽略白名单外字段', () => {
    const { db, classId } = makeDb();
    const row = create(db, 'students', { name: '甲', evil: 'injection' }, classId);
    expect((row as unknown as Record<string, unknown>).evil).toBeUndefined();
  });

  it('update 只改指定字段', () => {
    const { db, classId } = makeDb();
    const row = list(db, 'students', classId)[0];
    const updated = update(db, 'students', row.id as number, { name: '改名后', group_no: 9 }, classId);
    expect(updated.name).toBe('改名后');
    expect(updated.group_no).toBe(9);
  });

  it('update 显式 null 清空 idcard 并持久化', () => {
    const { db, classId } = makeDb();
    const row = list(db, 'students', classId)[0];
    expect(String(row.idcard).length).toBe(18);
    update(db, 'students', row.id as number, { idcard: null }, classId);
    expect(get(db, 'students', row.id as number, classId)?.idcard).toBeNull();
    const row2 = list(db, 'students', classId)[1];
    update(db, 'students', row2.id as number, { idcard: null }, classId);
    expect(get(db, 'students', row2.id as number, classId)?.idcard).toBeNull();
    expect(list(db, 'students', classId).filter(s => s.idcard === null).length).toBe(2);
  });

  it('remove 删除后 list 减少', () => {
    const { db, classId } = makeDb();
    const before = list(db, 'students', classId).length;
    remove(db, 'students', list(db, 'students', classId)[0].id as number, classId);
    expect(list(db, 'students', classId).length).toBe(before - 1);
  });

  it('update/remove 越权访问他人班级则抛错/不生效', () => {
    const { db, classId } = makeDb();
    const { lastInsertRowid: cid2 } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('六年级（2）班', '李老师', '六年级')`).run();
    seedClass(db, Number(cid2));
    const other = list(db, 'students', Number(cid2))[0];
    expect(() => update(db, 'students', other.id as number, { name: 'x' }, classId)).toThrow();
    remove(db, 'students', other.id as number, classId);
    expect(list(db, 'students', Number(cid2)).length).toBe(45); // 他班数据未被删
  });

  it('tableColumns 来自 PRAGMA', () => {
    const { db } = makeDb();
    const cols = tableColumns(db, 'students');
    expect(cols).toContain('name');
    expect(cols).toContain('parent_phone');
    expect(cols).toContain('class_id');
  });
});
```

- [ ] **Step 8: 更新 `tests/dashboard.test.ts`**（makeDb 建班 + `dashboardStats(db, classId)`）：

```ts
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../lib/schema';
import { seedClass } from '../lib/seed';
import { dashboardStats } from '../lib/dashboard';

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  const { lastInsertRowid } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('测试班', '王老师', '六年级')`).run();
  const classId = Number(lastInsertRowid);
  seedClass(db, classId);
  return { db, classId };
}

describe('dashboardStats', () => {
  it('聚合各项统计（按班）', () => {
    const { db, classId } = makeDb();
    const s = dashboardStats(db, classId);
    expect(s.studentCount).toBe(45);
    expect(s.maleCount + s.femaleCount).toBe(45);
    expect(s.todayLeaves).toBeGreaterThanOrEqual(0);
    expect(s.latestExamAvg).toBeGreaterThan(0);
    expect(s.monthWorkLogs).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 9: 更新 `tests/import.test.ts`**（makeDb 建班 + importStudents 带 classId；一次性在每处 `list(db,...)` 后加 `classId`）：

```ts
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../lib/schema';
import { seedClass } from '../lib/seed';
import { list, create } from '../lib/store';
import { importStudents, type ImportItem } from '../lib/import';

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  const { lastInsertRowid } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('测试班', '王老师', '六年级')`).run();
  const classId = Number(lastInsertRowid);
  seedClass(db, classId);
  return { db, classId };
}

const item = (p: Partial<ImportItem>): ImportItem => ({
  line: 2, student_no: '', name: '导入生', gender: '男', parent_name: '', parent_phone: '',
  idcard: '', address: '', level: 4, group_no: 1, role: '', noon_care: 0, breakfast: 0,
  afternoon_care: 1, remark: '', ...p,
});

describe('importStudents', () => {
  it('新身份证 → INSERT', () => {
    const { db, classId } = makeDb();
    const r = importStudents(db, classId, [item({ idcard: '430102199001010011', name: '新增生' })]);
    expect(r.created).toBe(1);
    expect(r.updated).toBe(0);
    expect(list(db, 'students', classId).length).toBe(46);
  });

  it('已存在身份证 → 覆盖全部字段', () => {
    const { db, classId } = makeDb();
    const first = list(db, 'students', classId)[0];
    const r = importStudents(db, classId, [item({ idcard: String(first.idcard), name: '覆盖名', level: 1, gender: '女' })]);
    expect(r.updated).toBe(1);
    const row = list(db, 'students', classId)[0];
    expect(row.name).toBe('覆盖名');
    expect(row.level).toBe(1);
    expect(row.gender).toBe('女');
    expect(list(db, 'students', classId).length).toBe(45);
  });

  it('空身份证 → 跳过并带行号', () => {
    const { db, classId } = makeDb();
    const r = importStudents(db, classId, [item({ line: 3, idcard: '' })]);
    expect(r.skipped).toBe(1);
    expect(r.errors).toEqual([{ row: 3, message: '缺少身份证' }]);
  });

  it('同批两条相同新身份证 → 一条 insert 一条 update', () => {
    const { db, classId } = makeDb();
    const r = importStudents(db, classId, [item({ idcard: '999' }), item({ idcard: '999', name: '第二次' })]);
    expect(r.created).toBe(1);
    expect(r.updated).toBe(1);
    const row = list(db, 'students', classId).find(x => x.idcard === '999');
    expect(row?.name).toBe('第二次');
  });

  it('跨班同身份证各插一条（班级内唯一）', () => {
    const { db, classId } = makeDb();
    const { lastInsertRowid: cid2 } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('六年级（2）班', '李老师', '六年级')`).run();
    seedClass(db, Number(cid2));
    const r = importStudents(db, classId, [item({ idcard: '430102199003030033', name: 'A' })]);
    const r2 = importStudents(db, Number(cid2), [item({ idcard: '430102199003030033', name: 'B' })]);
    expect(r.created).toBe(1);
    expect(r2.created).toBe(1); // 不同班不冲突
  });

  it('新身份证空学号 → INSERT 并自动取 max+1', () => {
    const { db, classId } = makeDb();
    const r = importStudents(db, classId, [item({ idcard: '430102199001020022', name: '无学号生' })]);
    expect(r.created).toBe(1);
    const row = list(db, 'students', classId).find(x => x.idcard === '430102199001020022');
    expect(row?.student_no).toBe('46');
  });
});
```

- [ ] **Step 10: 运行测试确认通过**

Run: `npm test`
Expected: PASS（`store` / `seed` / `dashboard` / `import` 全部绿；`csv` / `seats` 不受影响）。

- [ ] **Step 11: 提交**

```bash
git add lib/schema.ts lib/seed.ts lib/db.ts lib/store.ts lib/types.ts tests/seed.test.ts tests/store.test.ts tests/dashboard.test.ts tests/import.test.ts
git commit -m "feat: multi-tenant schema (users/classes/sessions, class_id) with per-class seed and scoped store"
```

> **注意：** `bootstrap` 引用了 `lib/auth.ts` 的 `hashPassword`（Task 2 创建）。为保证本任务可单独跑通测试，需在提交前先创建最小 `lib/auth.ts` 并把 `hashPassword`/`verifyPassword` 写好——见 Task 2 Step 1 的 auth 起始代码，`hashPassword` 已在其中。若先提交 Task 1，`seed.ts` 的 `import { hashPassword } from './auth'` 会因文件缺失编译失败。**建议顺序：先写 `lib/auth.ts` 的 `hashPassword`/`verifyPassword`（Task 2 前半），再执行本任务。** 下文的 Task 2 会把 auth 补全。

---

### Task 2: 鉴权核心 `lib/auth.ts`

**Files:**
- Create: `lib/auth.ts`
- Test: `tests/auth.test.ts`

**Interfaces:**
- Consumes: `DatabaseSync`；在 Task 1 被 `seed.ts` 的 `hashPassword` 引用。
- Produces:
  - `interface UserRow { id: number; username: string; name: string; role: string; class_id: number | null }`
  - `hashPassword(pw: string): string`（`salt:hash`）
  - `verifyPassword(pw: string, stored: string): boolean`
  - `createSession(db: DatabaseSync, userId: number): string`
  - `getSessionUser(db: DatabaseSync, token: string | undefined): UserRow | null`
  - `deleteSession(db: DatabaseSync, token: string): void`
  - `currentUser(db: DatabaseSync, req: Request): UserRow | null`（读 cookie → 查 session）
  - `sessionCookie(token): string` / `clearCookie(): string` / `readToken(req: Request): string | undefined`
  - `COOKIE = 'gzt_session'`

- [ ] **Step 1: 写失败测试（tests/auth.test.ts）**

```ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/auth.test.ts`
Expected: FAIL（`Cannot find module '../lib/auth'`）。

- [ ] **Step 3: 写 `lib/auth.ts`**

```ts
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`
Expected: PASS（含 auth + 此前各库测试；`seed.ts` 到 `auth.ts` 的 import 已可解析）。

- [ ] **Step 5: 提交**

```bash
git add lib/auth.ts tests/auth.test.ts
git commit -m "feat: password hashing (scrypt) and db-backed sessions"
```

> 由于 Task 1 已引用了 `hashPassword`，若你已按 Task 1 先行提交过，此处提交会包含 `tests/auth.test.ts` 与 `lib/auth.ts`。若 Task 1 尚未提交，请先补上 `lib/auth.ts` 的 `hashPassword`/`verifyPassword` 再提交 Task 1，再提交本任务。

---

### Task 3: dashboard / import / seats 作用域化

**Files:**
- Modify: `lib/dashboard.ts`（全部 SQL 带 class_id）
- Modify: `tests/dashboard.test.ts`（已更新，见 Task 1）
- Modify: `lib/import.ts`（importStudents 带 classId，class_id 注入）
- Modify: `tests/import.test.ts`（已更新，见 Task 1）

**Interfaces:**
- Consumes: Task 1 的 `seedClass` 与 `class_id` 列。
- Produces:
  - `dashboardStats(db: DatabaseSync, classId: number): DashboardStats`
  - `importStudents(db: DatabaseSync, classId: number, rows: ImportItem[]): ImportResult`

- [ ] **Step 1: 改 `lib/dashboard.ts`** —— 全量替换（`dashboard.ts`）：

```ts
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { DashboardStats } from './types';

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

export function dashboardStats(db: DatabaseSync, classId: number): DashboardStats {
  const one = (sql: string, params: SQLInputValue[] = []) => (db.prepare(sql).get(...params) as Record<string, number>);
  const students = one('SELECT COUNT(*) n FROM students WHERE class_id = ?', [classId]);
  const male = one("SELECT COUNT(*) n FROM students WHERE class_id = ? AND gender='男'", [classId]);
  const todayLeaves = one("SELECT COUNT(*) n FROM leave_records WHERE class_id = ? AND start_date <= ? AND end_date >= ?", [classId, today(), today()]).n;
  const weekDiscipline = one('SELECT COUNT(*) n FROM discipline_records WHERE class_id = ? AND date >= ?', [classId, daysAgo(6)]).n;
  const todoPending = one("SELECT COUNT(*) n FROM todos WHERE class_id = ? AND status='待办'", [classId]).n;

  const examRow = db.prepare("SELECT AVG(score) avg FROM grades WHERE class_id = ? AND exam_name=(SELECT exam_name FROM grades WHERE class_id = ? ORDER BY id DESC LIMIT 1)").get(classId, classId) as { avg: number | null };
  const latestExamAvg = examRow.avg == null ? null : Math.round(examRow.avg * 10) / 10;

  const monthWorkLogs = one('SELECT COUNT(*) n FROM work_logs WHERE class_id = ? AND date >= ?', [classId, daysAgo(30)]).n;
  const homeVisitCount = one("SELECT COUNT(*) n FROM home_visits WHERE class_id = ? AND is_meeting=0", [classId]).n;
  const parentMeetingCount = one("SELECT COUNT(*) n FROM home_visits WHERE class_id = ? AND is_meeting=1", [classId]).n;
  const engaged = (db.prepare('SELECT COUNT(DISTINCT student_name) n FROM parent_comm WHERE class_id = ?').get(classId) as { n: number }).n;
  const parentMeetingRate = students.n > 0 ? Math.min(100, Math.round((engaged / students.n) * 100)) : 0;

  return {
    studentCount: students.n,
    maleCount: male.n,
    femaleCount: students.n - male.n,
    todayLeaves,
    weekDiscipline,
    todoPending,
    latestExamAvg,
    monthWorkLogs,
    homeVisitCount,
    parentMeetingCount,
    parentMeetingRate,
  };
}
```

- [ ] **Step 2: 改 `lib/import.ts`** —— `importStudents` 带 `classId`，`find`/`nextNo`/`UPDATE`/`INSERT` 都按 `(class_id, idcard)`，`INSERT` 注入 `class_id`：

```ts
import type { DatabaseSync } from 'node:sqlite';

export interface ImportItem {
  line: number; student_no: string; name: string; gender: string; parent_name: string;
  parent_phone: string; idcard: string; address: string; level: number; group_no: number;
  role: string; noon_care: number; breakfast: number; afternoon_care: number; remark: string;
}

export interface ImportResult { created: number; updated: number; skipped: number; errors: { row: number; message: string }[] }

const UPDATE_SQL = `UPDATE students SET
  student_no = CASE WHEN @student_no = '' THEN student_no ELSE @student_no END, name = @name, gender = @gender, parent_name = @parent_name,
  parent_phone = @parent_phone, address = @address, level = @level, group_no = @group_no,
  role = @role, noon_care = @noon_care, breakfast = @breakfast, afternoon_care = @afternoon_care,
  remark = @remark WHERE class_id = @classId AND idcard = @idcard`;

const INSERT_SQL = `INSERT INTO students (class_id, student_no, name, gender, parent_name, parent_phone, idcard, address, level, group_no, role, noon_care, breakfast, afternoon_care, remark)
  VALUES (@classId, @student_no, @name, @gender, @parent_name, @parent_phone, @idcard, @address, @level, @group_no, @role, @noon_care, @breakfast, @afternoon_care, @remark)`;

export function importStudents(db: DatabaseSync, classId: number, rows: ImportItem[]): ImportResult {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const find = db.prepare('SELECT id FROM students WHERE class_id = ? AND idcard = ?');
  const nextNo = db.prepare('SELECT COALESCE(MAX(CAST(student_no AS INTEGER)), 0) + 1 AS next FROM students WHERE class_id = ?');
  const upd = db.prepare(UPDATE_SQL);
  const ins = db.prepare(INSERT_SQL);
  db.exec('BEGIN');
  try {
    for (const r of rows) {
      if (!r.idcard) { result.skipped++; result.errors.push({ row: r.line, message: '缺少身份证' }); continue; }
      const { line: _line, ...fields } = r; // 'line' 仅用于统计
      if (find.get(classId, r.idcard)) { upd.run({ ...fields, classId }); result.updated++; }
      else {
        if (!fields.student_no) fields.student_no = String((nextNo.get(classId) as { next: number }).next).padStart(2, '0');
        ins.run({ ...fields, classId }); result.created++;
      }
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return result;
}
```

- [ ] **Step 3: 运行测试确认通过**

Run: `npm test`
Expected: PASS（dashboard / import 绿）。

- [ ] **Step 4: 提交**

```bash
git add lib/dashboard.ts lib/import.ts
git commit -m "feat: scope dashboard and student import to class_id"
```

---

### Task 4: 鉴权 API 路由 + 中间件 + 用户管理路由

**Files:**
- Create: `middleware.ts`
- Create: `app/api/login/route.ts`
- Create: `app/api/logout/route.ts`
- Create: `app/api/me/route.ts`
- Create: `app/api/users/route.ts`
- Create: `app/api/users/[id]/route.ts`

**Interfaces:**
- Consumes: `getDb`、`currentUser`、`hashPassword`、`sessionCookie`/`clearCookie`、`UserRow`（Task 2）、`getSessionUser`。
- Produces:
  - `POST /api/login` → 校验密码，Set-Cookie，返回 `{ user }`（不含 password_hash）
  - `POST /api/logout` → 删 session，清除 cookie
  - `GET /api/me` → `{ user, class: classes 行 | null }`；未登录 401
  - `GET /api/users`（admin）→ `{ users }`；`POST /api/users`（admin）→ 建老师（可带 `className` 新建班）
  - `PUT /api/users/[id]`（admin）→ 改 name/角色/密码/班级；`DELETE /api/users/[id]`（admin）

- [ ] **Step 1: 创建 `middleware.ts`**（只轻量校验 cookie 是否存在，查询交给 route 层；不 import node:crypto / sqlite，保证 Edge 可跑）：

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC = ['/login', '/api/login'];
const API_PREFIX = '/api/';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some(p => pathname === p || pathname.startsWith(p))) return NextResponse.next();
  const hasSession = Boolean(req.cookies.get('gzt_session')?.value);
  if (!hasSession) {
    if (pathname.startsWith(API_PREFIX)) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
```

- [ ] **Step 2: 创建 `app/api/login/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyPassword, createSession, sessionCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const db = getDb();
  let username = '';
  let password = '';
  try {
    const body = await req.json();
    username = String(body?.username ?? '');
    password = String(body?.password ?? '');
  } catch {
    return NextResponse.json({ error: '请求错误' }, { status: 400 });
  }
  const user = db.prepare('SELECT id, username, password_hash, name, role, class_id FROM users WHERE username = ?').get(username) as
    { id: number; username: string; password_hash: string; name: string; role: string; class_id: number | null } | undefined;
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
  }
  const token = createSession(db, user.id);
  return NextResponse.json(
    { user: { id: user.id, username: user.username, name: user.name, role: user.role, class_id: user.class_id } },
    { headers: { 'Set-Cookie': sessionCookie(token) } },
  );
}
```

- [ ] **Step 3: 创建 `app/api/logout/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { deleteSession, readToken, clearCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const token = readToken(req);
  if (token) deleteSession(getDb(), token);
  return NextResponse.json({ ok: true }, { headers: { 'Set-Cookie': clearCookie() } });
}
```

- [ ] **Step 4: 创建 `app/api/me/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { currentUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const db = getDb();
  const user = currentUser(db, req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const cls = user.class_id ? db.prepare('SELECT * FROM classes WHERE id = ?').get(user.class_id) : null;
  return NextResponse.json({ user, class: cls ?? null });
}
```

- [ ] **Step 5: 创建 `app/api/users/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { currentUser, hashPassword } from '@/lib/auth';

function adminOnly(user: { role: string } | null) {
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: '无权限' }, { status: 403 });
  return null;
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const denied = adminOnly(currentUser(db, req));
  if (denied) return denied;
  const users = db.prepare('SELECT id, username, name, role, class_id, created_at FROM users ORDER BY id').all();
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const denied = adminOnly(currentUser(db, req));
  if (denied) return denied;
  try {
    const body = await req.json();
    const username = String(body?.username ?? '').trim();
    const password = String(body?.password ?? '');
    const name = String(body?.name ?? '').trim();
    const className = String(body?.className ?? '').trim();
    if (!username || !password) return NextResponse.json({ error: '用户名与密码必填' }, { status: 400 });
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (exists) return NextResponse.json({ error: '用户名已存在' }, { status: 400 });

    let classId: number | null = body?.classId && Number(body.classId) ? Number(body.classId) : null;
    if (!classId && className) {
      const { lastInsertRowid } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES (?, ?, '')`).run(className, name);
      classId = Number(lastInsertRowid);
    }
    const now = new Date().toISOString();
    const { lastInsertRowid } = db.prepare(`INSERT INTO users (username, password_hash, name, role, class_id, created_at) VALUES (?, ?, ?, 'teacher', ?, ?)`)
      .run(username, hashPassword(password), name || username, classId, now);
    return NextResponse.json({ id: Number(lastInsertRowid) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: '请求错误' }, { status: 400 });
  }
}
```

- [ ] **Step 6: 创建 `app/api/users/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { currentUser, hashPassword } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

function adminOnly(user: { role: string } | null) {
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: '无权限' }, { status: 403 });
  return null;
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const db = getDb();
  const denied = adminOnly(currentUser(db, req));
  if (denied) return denied;
  const { id } = await params;
  try {
    const body = await req.json();
    const sets: string[] = [];
    const values: Record<string, string | number | null> = { id: Number(id) };
    if (typeof body.name === 'string') { sets.push('name = @name'); values.name = body.name; }
    if (typeof body.role === 'string') { sets.push('role = @role'); values.role = body.role; }
    if (body.classId === null || typeof body.classId === 'number') { sets.push('class_id = @classId'); values.classId = body.classId; }
    if (body.password) { sets.push('password_hash = @hash'); values.hash = hashPassword(String(body.password)); }
    if (sets.length === 0) return NextResponse.json({ error: '无可更新字段' }, { status: 400 });
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = @id`).run(values);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '请求错误' }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const db = getDb();
  const denied = adminOnly(currentUser(db, req));
  if (denied) return denied;
  const { id } = await params;
  db.prepare('DELETE FROM users WHERE id = ?').run(Number(id));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: 构建验证**

Run: `npm run build`
Expected: 构建成功（route 层无单测先例，运行时由 Task 6 冒烟）。

- [ ] **Step 8: 提交**

```bash
git add middleware.ts app/api/login/route.ts app/api/logout/route.ts app/api/me/route.ts app/api/users/route.ts app/api/users/[id]/route.ts
git commit -m "feat: auth routes (login/logout/me) and admin user management"
```

---

### Task 5: 业务 API 路由作用域化 + 重置/备份/座位/导入

**Files:**
- Modify: `app/api/[resource]/route.ts`（GET/POST 带 classId + 401）
- Modify: `app/api/[resource]/[id]/route.ts`（PUT/DELETE 带 classId + 401）
- Modify: `app/api/dashboard/route.ts`（classId）
- Modify: `app/api/reset/route.ts`（resetClass 当前班，限 teacher 有班；admin 无班返回 400）
- Modify: `app/api/backup/route.ts`（限 admin）
- Modify: `app/api/students/import/route.ts`（classId）
- Modify: `app/api/seats/random/route.ts`（classId 作用域）
- Modify: `app/api/seats/clear/route.ts`（classId 作用域）

**Interfaces:**
- Consumes: `currentUser`（Task 2）、`store.*`（Task 1）、`dashboardStats`（Task 3）、`importStudents`（Task 3）、`resetClass`（Task 1）。
- Produces: 所有业务接口在未登录时 401；`teacher` 只能读写自己 `class_id` 的数据；`backup` 仅 admin。

- [ ] **Step 1: 改 `app/api/[resource]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { list, create, RESOURCES } from '@/lib/store';
import { currentUser } from '@/lib/auth';
import type { ResourceKey } from '@/lib/types';

type Ctx = { params: Promise<{ resource: string }> };

function isResource(v: string): v is ResourceKey {
  return v in RESOURCES;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const { resource } = await params;
  if (!isResource(resource)) return NextResponse.json({ error: '未知资源' }, { status: 404 });
  const db = getDb();
  const user = currentUser(db, req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  return NextResponse.json(list(db, resource, user.class_id ?? 0));
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { resource } = await params;
  if (!isResource(resource)) return NextResponse.json({ error: '未知资源' }, { status: 404 });
  const db = getDb();
  const user = currentUser(db, req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!user.class_id) return NextResponse.json({ error: '当前账号无关联班级' }, { status: 400 });
  try {
    const body = await req.json();
    const row = create(db, resource, body, user.class_id);
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 2: 改 `app/api/[resource]/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { update, remove, RESOURCES } from '@/lib/store';
import { currentUser } from '@/lib/auth';
import type { ResourceKey } from '@/lib/types';

type Ctx = { params: Promise<{ resource: string; id: string }> };

function isResource(v: string): v is ResourceKey {
  return v in RESOURCES;
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { resource, id } = await params;
  if (!isResource(resource)) return NextResponse.json({ error: '未知资源' }, { status: 404 });
  const db = getDb();
  const user = currentUser(db, req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  try {
    const body = await req.json();
    const row = update(db, resource, Number(id), body, user.class_id ?? 0);
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { resource, id } = await params;
  if (!isResource(resource)) return NextResponse.json({ error: '未知资源' }, { status: 404 });
  const db = getDb();
  const user = currentUser(db, req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  remove(db, resource, Number(id), user.class_id ?? 0);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: 改 `app/api/dashboard/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { dashboardStats } from '@/lib/dashboard';
import { currentUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const db = getDb();
  const user = currentUser(db, req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  return NextResponse.json(dashboardStats(db, user.class_id ?? 0));
}
```

- [ ] **Step 4: 改 `app/api/reset/route.ts`**（重置**当前账号的班**；admin 无班返回 400）

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { resetClass } from '@/lib/seed';
import { currentUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const db = getDb();
  const user = currentUser(db, req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!user.class_id) return NextResponse.json({ error: '当前账号无关联班级' }, { status: 400 });
  resetClass(db, user.class_id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: 改 `app/api/backup/route.ts`**（限 admin；仍整文件下载）

```ts
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDb } from '@/lib/db';
import { currentUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const db = getDb();
  const user = currentUser(db, req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: '无权限' }, { status: 403 });
  db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  const buf = readFileSync(join(process.cwd(), 'data', 'app.db'));
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="app-backup.db"',
    },
  });
}
```

- [ ] **Step 6: 改 `app/api/students/import/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { importStudents, type ImportItem } from '@/lib/import';
import { currentUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const db = getDb();
  const user = currentUser(db, req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!user.class_id) return NextResponse.json({ error: '当前账号无关联班级' }, { status: 400 });
  try {
    const body = (await req.json()) as { rows?: ImportItem[] };
    const result = importStudents(db, user.class_id, body.rows ?? []);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 7: 改 `app/api/seats/random/route.ts`**（按班读取学生/配置，清空/写座位带 class_id）

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { randomSeatPlan } from '@/lib/seats';
import { currentUser } from '@/lib/auth';
import type { Row } from '@/lib/types';

function clamp(n: number, min: number, max: number) { return Math.min(max, Math.max(min, n)); }

export async function POST(req: NextRequest) {
  const db = getDb();
  const user = currentUser(db, req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!user.class_id) return NextResponse.json({ error: '当前账号无关联班级' }, { status: 400 });
  const classId = user.class_id;
  try {
    const body = (await req.json().catch(() => ({}))) as { row_count?: number; col_count?: number };
    const cfg = db.prepare('SELECT row_count, col_count FROM classroom_config WHERE class_id = ? ORDER BY id LIMIT 1').get(classId) as
      { row_count: number; col_count: number } | undefined;
    const rowCount = clamp(Math.round(Number(body.row_count) || cfg?.row_count || 7), 1, 20);
    const colCount = clamp(Math.round(Number(body.col_count) || cfg?.col_count || 8), 1, 20);

    const students = db.prepare('SELECT name, level FROM students WHERE class_id = ?').all(classId) as Row[];
    const { groups, placed } = randomSeatPlan(students, rowCount, colCount);

    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM seats WHERE class_id = ?').run(classId);
      const ins = db.prepare('INSERT INTO seats (class_id, row_index, col_index, student_name) VALUES (?, ?, ?, ?)');
      for (let c = 0; c < groups.length; c++) for (let r = 0; r < groups[c].length; r++) ins.run(classId, r, c, groups[c][r]);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return NextResponse.json({ ok: true, placed, total: students.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
```

- [ ] **Step 8: 改 `app/api/seats/clear/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { currentUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const db = getDb();
  const user = currentUser(db, req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!user.class_id) return NextResponse.json({ error: '当前账号无关联班级' }, { status: 400 });
  db.prepare('DELETE FROM seats WHERE class_id = ?').run(user.class_id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 9: 构建验证 + 冒烟**

Run: `npm run build`
Expected: 构建成功。
然后 `npm run dev`，用 `demo/demo` 登录访问 `/api/students`，应只返回本班 45 条；未登录访问 `/api/students` 返回 401。

- [ ] **Step 10: 提交**

```bash
git add app/api/[resource]/route.ts app/api/[resource]/[id]/route.ts app/api/dashboard/route.ts app/api/reset/route.ts app/api/backup/route.ts app/api/students/import/route.ts app/api/seats/random/route.ts app/api/seats/clear/route.ts
git commit -m "feat: scope all business APIs to the logged-in class"
```

---

### Task 6: 前端（登录页、AppShell、用户管理页、系统设置页、路由守卫）

> 布局以线框图为准：`docs/superpowers/specs/2026-08-23-multiuser-wireframe.md`。改动围绕 `AppShell`（登录后按账号显示班级与用户、退出、按角色隐藏菜单）、新增 `/login` 与 `/users` 页面、重写 `/settings` 页（班级信息 + 重置本班 + 备份）、以及 `lib/api-client.ts` 在 401 时跳转登录。

**Files:**
- Modify: `lib/api-client.ts`（401 → 跳转 /login）
- Create: `app/login/page.tsx`
- Modify: `components/app-shell.tsx`（读 /api/me，头部显示用户+班级、退出；菜单按 role 隐藏）
- Create: `app/users/page.tsx`（admin 用户/班级管理）
- Modify: `app/settings/page.tsx`（班级信息 → classes；重置本班；备份限 admin）

**Interfaces:**
- Consumes: `/api/me` → `{ user, class }`；`/api/login`；`/api/logout`；`/api/users`（GET/POST/PUT/DELETE）；`/api/reset`；`/api/backup`。
- Produces: 登录页可提交并跳转；未登录访问任何页被中间件重定向到 `/login`；AppShell 显示当前用户的班级名与姓名并提供退出；`/users` 页 admin 可建老师账号（可新建班级）与改密码/角色/删除；`/settings` 展示并保存当前班级基础信息（通过 `/api/me`）。

- [ ] **Step 1: 改 `lib/api-client.ts`** —— 401 时跳转登录：

```ts
import type { Row } from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (res.status === 401) {
    if (typeof window !== 'undefined' && !location.pathname.startsWith('/login')) location.href = '/login';
    throw new Error('登录已过期');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? '请求失败');
  }
  return res.json();
}

export const get = <T = Row[]>(p: string) => request<T>(p);
export const post = <T = Row>(p: string, body: unknown) => request<T>(p, { method: 'POST', body: JSON.stringify(body) });
export const put = <T = Row>(p: string, body: unknown) => request<T>(p, { method: 'PUT', body: JSON.stringify(body) });
export const del = <T = { ok: boolean }>(p: string) => request<T>(p, { method: 'DELETE' });
```

- [ ] **Step 2: 创建 `app/login/page.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { post } from '@/lib/api-client';

export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onFinish = async (v: { username: string; password: string }) => {
    setBusy(true);
    try {
      await post('/api/login', v);
      router.replace('/');
    } catch { message.error('用户名或密码错误'); }
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Card className="w-80">
        <div className="text-center mb-4">
          <Typography.Title level={4} style={{ marginTop: 0 }}>班主任智慧工作台</Typography.Title>
          <Typography.Text type="secondary">请登录</Typography.Text>
        </div>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input autoFocus autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={busy}>登录</Button>
        </Form>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: 改 `components/app-shell.tsx`** —— 读 `/api/me`，头部显示"姓名 · 班级"，提供退出；菜单按角色隐藏"用户管理"。整体替换：

```tsx
'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button, Drawer, Grid, Layout, Menu, Typography } from 'antd';
import {
  AppstoreOutlined, BarChartOutlined, CalendarOutlined,
  CommentOutlined, DashboardOutlined, FileTextOutlined, FlagOutlined,
  HomeOutlined, LogoutOutlined, MenuOutlined, MessageOutlined, SafetyOutlined,
  SettingOutlined, StarOutlined, TeamOutlined, UserAddOutlined, UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { EditableProvider, useEditable } from './editable-context';

interface Me { user: { name: string; role: string; class_id: number | null }; class: { name: string } | null }

const BASE_MENU = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/timetable', icon: <CalendarOutlined />, label: '我的课表' },
  { key: '/students', icon: <TeamOutlined />, label: '学生管理' },
  { key: '/grades', icon: <BarChartOutlined />, label: '成绩分析' },
  { key: '/leaves', icon: <UserAddOutlined />, label: '请假管理' },
  { key: '/discipline', icon: <FlagOutlined />, label: '违纪台账' },
  { key: '/conversations', icon: <CommentOutlined />, label: '谈话记录' },
  { key: '/visits', icon: <HomeOutlined />, label: '生涯家访' },
  { key: '/evaluation', icon: <StarOutlined />, label: '综合素质评价' },
  { key: '/seats', icon: <AppstoreOutlined />, label: '排座位' },
  { key: '/parent-comm', icon: <MessageOutlined />, label: '家校沟通' },
  { key: '/safety', icon: <SafetyOutlined />, label: '安全台账' },
  { key: '/work-logs', icon: <FileTextOutlined />, label: '工作留痕' },
  { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
];

function ShellHeader({ onOpenDrawer, mobile }: { onOpenDrawer: () => void; mobile: boolean }) {
  const { editable, toggle } = useEditable();
  const router = useRouter();
  const [now, setNow] = useState('');
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.ok ? r.json() : Promise.resolve(null))
      .then((m: Me | null) => setMe(m))
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    const tick = () => setNow(dayjs().format('YYYY-MM-DD HH:mm:ss'));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.replace('/login');
  };

  const title = me?.class?.name || '班级工作台';
  return (
    <Layout.Header style={{ background: '#fff', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f0f0f0' }}>
      <Button type="text" icon={<MenuOutlined />} onClick={onOpenDrawer} style={{ display: mobile ? undefined : 'none' }} aria-label="打开菜单" />
      <Typography.Text strong>{title}</Typography.Text>
      <div style={{ flex: 1 }} />
      <Typography.Text type="secondary" style={{ fontSize: 12, display: mobile ? 'none' : undefined }}>{now}</Typography.Text>
      <Typography.Text style={{ fontSize: 12, marginLeft: 8 }}>{me?.user?.name ?? ''}</Typography.Text>
      <Button size="small" icon={<LogoutOutlined />} onClick={logout}>退出</Button>
      <Button type={editable ? 'primary' : 'default'} size="small" onClick={toggle}>
        {editable ? '完成' : '编辑'}
      </Button>
    </Layout.Header>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const screens = Grid.useBreakpoint();
  const mobile = !(screens.md ?? false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.ok ? r.json() : Promise.resolve(null))
      .then((m: Me | null) => setRole(m?.user?.role ?? null))
      .catch(() => setRole(null));
  }, []);

  const menuItems = role === 'admin'
    ? [...BASE_MENU, { key: '/users', icon: <UserOutlined />, label: '用户管理' }]
    : BASE_MENU;

  const menu = (
    <Menu mode="inline" style={{ borderInlineEnd: 0, height: '100%' }}
      selectedKeys={[pathname]} items={menuItems}
      onClick={({ key }) => { router.push(key); setDrawerOpen(false); }} />
  );

  return (
    <EditableProvider>
      <Layout style={{ minHeight: '100vh' }}>
        {mobile ? (
          <Drawer placement="left" size={220} closable={false} open={drawerOpen} onClose={() => setDrawerOpen(false)} styles={{ body: { padding: 0 } }}>
            {menu}
          </Drawer>
        ) : (
          <Layout.Sider width={210} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
            <div style={{ padding: 16, textAlign: 'center', fontWeight: 600 }}>班主任智慧工作台</div>
            {menu}
          </Layout.Sider>
        )}
        <Layout>
          <ShellHeader onOpenDrawer={() => setDrawerOpen(true)} mobile={mobile} />
          <Layout.Content style={{ padding: 16, width: '100%' }}>
            {children}
          </Layout.Content>
        </Layout>
      </Layout>
    </EditableProvider>
  );
}
```

> 说明：登录态在中间件层已拦截，`/api/me` 失败时静默降级为「班级工作台 / 空用户」。用户下拉/头像可后续按 wireframe 用 `Dropdown` 替换顶栏的姓名文本。

- [ ] **Step 4: 创建 `app/users/page.tsx`**（admin 用户/班级管理）

```tsx
'use client';
import { useEffect, useState } from 'react';
import { App, Button, Form, Input, Modal, Popconfirm, Select, Table, Typography } from 'antd';
import { get, post, put, del } from '@/lib/api-client';

interface User { id: number; username: string; name: string; role: string; class_id: number | null; created_at: string }

export default function UsersPage() {
  const { message } = App.useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();

  const load = () => {
    setLoading(true);
    get<{ users: User[] }>('/api/users')
      .then(r => setUsers(r.users))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    const v = await form.validateFields();
    setBusy(true);
    try {
      await post('/api/users', v);
      message.success('已创建');
      setOpen(false);
      form.resetFields();
      load();
    } catch { message.error('创建失败'); }
    setBusy(false);
  };

  const resetPwd = async (u: User) => {
    const pwd = window.prompt(`为「${u.name || u.username}」设置新密码`);
    if (!pwd) return;
    try { await put(`/api/users/${u.id}`, { password: pwd }); message.success('已重置密码'); }
    catch { message.error('重置失败'); }
  };

  const remove = async (u: User) => {
    try { await del(`/api/users/${u.id}`); message.success('已删除'); load(); }
    catch { message.error('删除失败'); }
  };

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>用户管理</Typography.Title>
      <Button type="primary" style={{ marginBottom: 12 }} onClick={() => setOpen(true)}>新增老师账号</Button>
      <Table<User> rowKey="id" size="small" loading={loading} dataSource={users} pagination={false}
        columns={[
          { title: '用户名', dataIndex: 'username' },
          { title: '姓名', dataIndex: 'name' },
          { title: '角色', dataIndex: 'role', render: (r: string) => r === 'admin' ? '管理员' : '班主任' },
          { title: '班级ID', dataIndex: 'class_id', render: (c: number | null) => c ?? '-' },
          { title: '操作', render: (_, u) => (
            <div className="flex gap-2">
              <Button size="small" onClick={() => resetPwd(u)}>重置密码</Button>
              {u.role !== 'admin' && (
                <Popconfirm title="确认删除该账号？" onConfirm={() => remove(u)} okText="删除" cancelText="取消">
                  <Button size="small" danger>删除</Button>
                </Popconfirm>
              )}
            </div>
          )},
        ]} />
      <Modal title="新增老师账号" open={open} onCancel={() => setOpen(false)} onOk={create} confirmLoading={busy}>
        <Form form={form} layout="vertical" initialValues={{ role: 'teacher' }}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}><Input /></Form.Item>
          <Form.Item name="name" label="姓名"><Input /></Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}><Input.Password /></Form.Item>
          <Form.Item name="className" label="班级名称（留空则不新建班级，需用已有 classId）"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 5: 改 `app/settings/page.tsx`** —— 班级信息读/写当前班级（通过 `/api/me`），重置本班数据（仅 teacher 有班），备份（仅 admin）：

```tsx
'use client';
import { useEffect, useState } from 'react';
import { App, Button, Card, Form, Input, Popconfirm, Typography } from 'antd';
import { get, post, put } from '@/lib/api-client';
import type { Row } from '@/lib/types';

interface Me { user: { name: string; role: string; class_id: number | null }; class: { id: number; name: string; head_teacher: string; grade_band: string } | null }

export default function SettingsPage() {
  const { message } = App.useApp();
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    get<Me>('/api/me').then(m => {
      setMe(m);
      if (m.class) form.setFieldsValue({ name: m.class.name, head_teacher: m.class.head_teacher, grade_band: m.class.grade_band });
    });
  }, [form]);

  const saveClass = async () => {
    const cls = me?.class;
    if (!cls) { message.warning('当前账号无关联班级'); return; }
    setBusy(true);
    try {
      const v = form.getFieldsValue();
      const row = await put<Row>(`/api/classes/${cls.id}`, v);
      void row;
      message.success('已保存');
    } catch { message.error('保存失败'); }
    setBusy(false);
  };

  const reset = async () => {
    setBusy(true);
    try { await post('/api/reset', {}); message.success('已重置本班数据'); location.reload(); }
    catch { message.error('重置失败'); setBusy(false); }
  };

  const isAdmin = me?.user?.role === 'admin';
  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>系统设置</Typography.Title>
      <div className="grid md:grid-cols-2 gap-4">
        <Card size="small"><h3 className="mb-3 text-sm font-semibold text-slate-600" style={{ marginTop: 0 }}>班级基础信息</h3>
          <Form form={form} layout="vertical">
            <div className="grid grid-cols-2 gap-3">
              <Form.Item name="name" label="班级名称"><Input /></Form.Item>
              <Form.Item name="head_teacher" label="班主任"><Input /></Form.Item>
              <Form.Item name="grade_band" label="年级班次"><Input /></Form.Item>
            </div>
            <Button type="primary" onClick={saveClass} loading={busy} disabled={!me?.class}>保存</Button>
          </Form>
        </Card>
        <div className="space-y-4">
          {(isAdmin || me?.user?.class_id) && (
            <Card size="small"><h3 className="mb-3 text-sm font-semibold text-slate-600" style={{ marginTop: 0 }}>数据维护</h3>
              <div className="flex flex-col gap-2">
                {me?.user?.class_id && (
                  <Popconfirm title="将清空本班演示数据并重新生成，确认？" onConfirm={reset} okText="重置" cancelText="取消">
                    <Button type="primary" danger loading={busy}>重置本班种子数据</Button>
                  </Popconfirm>
                )}
                {isAdmin && (
                  <Button type="primary" onClick={() => window.open('/api/backup', '_blank')}>备份数据库（下载 app.db）</Button>
                )}
              </div>
              <p className="mt-3 text-xs text-slate-400">演示数据均为随机生成的匿名姓名，用于保护学生隐私。</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
```

> **注意：** `saveClass` 需要 `app/api/classes/[id]/route.ts`（PUT 更新 class 行）。请在下面 Step 6 一并创建，否则保存班级信息会 404。班级信息的读取用 `/api/me` 已足够，只需 PUT 写回。

- [ ] **Step 6: 创建 `app/api/classes/[id]/route.ts`**（仅 admin 或该班班主任可改本班信息）

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { currentUser } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const db = getDb();
  const user = currentUser(db, req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { id } = await params;
  const classId = Number(id);
  if (user.role !== 'admin' && user.class_id !== classId) return NextResponse.json({ error: '无权限' }, { status: 403 });
  try {
    const body = await req.json();
    const sets: string[] = [];
    const values: Record<string, string | number> = { id: classId };
    for (const k of ['name', 'head_teacher', 'grade_band']) {
      if (typeof body[k] === 'string') { sets.push(`${k} = @${k}`); values[k] = body[k] as string; }
    }
    if (sets.length === 0) return NextResponse.json({ error: '无可更新字段' }, { status: 400 });
    db.prepare(`UPDATE classes SET ${sets.join(', ')} WHERE id = @id`).run(values);
    const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
    return NextResponse.json(cls);
  } catch {
    return NextResponse.json({ error: '请求错误' }, { status: 400 });
  }
}
```

- [ ] **Step 7: 构建验证 + 手工冒烟**

Run: `npm run build`
Expected: 构建成功。
然后 `npm run dev`：
- 未登录访问 `/` → 跳转 `/login`。
- `admin/admin` 登录 → 左侧菜单含"用户管理"；新增一个老师账号（可填班级名）→ 用该账号登录看到自己的班级。
- `demo/demo` 登录 → 首页只显示本班 45 人；系统设置里"重置本班种子数据"可点、"备份"不可见；保存班级信息成功。
- 未登录点开 `/api/students` → 401。

- [ ] **Step 8: 提交**

```bash
git add lib/api-client.ts app/login/page.tsx components/app-shell.tsx app/users/page.tsx app/settings/page.tsx app/api/classes/[id]/route.ts
git commit -m "feat: login page, per-user app shell, admin users page, per-class settings"
```

---

### Task 7: 全量验证与收尾

**Files:**（无新增代码）

- [ ] **Step 1: 全量测试 + 构建 + lint**

Run: `npm test`；`npm run build`；`npm run lint`
Expected: 全部通过。

- [ ] **Step 2: 启动自愈冒烟**

删除 `data/app.db*`，`npm run dev` 启动一次，确认自动重建新 schema 并 `bootstrap` 出 admin/demo；用 `demo/demo` 登录能看到 45 人班。

- [ ] **Step 3: 确认 git 干净**

Run: `git status --short`
Expected: 无未提交改动（若 `AGENTS.md` 被 `next dev` 重写，随本次一并提交以保持树干净）。

---

## Self-Review

**Spec 覆盖：** 多用户（账号+班级隔离）由 Task 1（数据模型/播种/作用域）、Task 2（鉴权核心）、Task 3（dashboard/import 作用域）、Task 4（鉴权+用户管理路由）、Task 5（业务路由作用域）、Task 6（前端）覆盖；`settings` 班级信息迁移到 `classes` 在 Task 1 + Task 6；idcard 班级内唯一在 Task 1 的索引；备份只限 admin 在 Task 5；启动自愈在 Task 1 的 `db.ts`。

**占位符扫描：** 无 TBD；每步含真实代码或真实命令。

**类型一致性：** `store.*` 统一带 `classId`；`importStudents(db, classId, rows)`；`dashboardStats(db, classId)`；`UserRow` 在 `lib/auth.ts` 定义并被登录/me 路由使用；`currentUser`/`readToken`/`sessionCookie` 命名一致；`resetClass(db, classId)` 贯穿 Task 1 与 Task 5。
