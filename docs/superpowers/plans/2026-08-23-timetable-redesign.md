# 课程表重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把课程表拆成「班级课表」（可配置时段 + 学科网格）和「我的授课」（班主任独立授课安排）两个视图。

**Architecture:** 新增 `period_slots` 表定义学校一天的时段（名称/时间/顺序/类型），`timetable` 表改为按 `period_id` 关联时段，新增 `teacher_schedule` 表记录班主任自己的授课。纯函数（网格构建、统计、分布、级联删除）放 `lib/timetable.ts` 便于测试；`app/timetable/page.tsx` 用 antd `Tabs` 切换两个子视图，各自是 `components/timetable/` 下的组件。

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind 4 + antd v6 + Recharts + node:sqlite + Vitest。

**Spec:** `docs/superpowers/specs/2026-08-23-timetable-redesign-design.md`

## Global Constraints

- Node >= 22；测试用 `npx vitest run tests/<file>.test.ts`，in-memory SQLite，直接 import `lib/`，无需起服务。
- 每个 `'use client'` 组件/页面文件首行必须有 `'use client';`。
- 所有 UI 文案与种子数据用中文。
- antd v6：用 `size` 而非 `width`（Drawer），用 `destroyOnHidden` 而非 `destroyOnClose`。
- 通用 `app/api/[resource]` 与新表自动生效；走 `RESOURCES` 白名单，非白名单字段会被丢弃。
- **不写迁移**：改 schema 后靠 `lib/db.ts` 哨兵列检测旧库 → `resetData`。
- `timetable` 每行 `weekday`(1–5), `period_id`(关联 period_slots), `subject`, `is_chinese`；非正课时段不落表。
- 提交信息用 `feat:` / `fix:` / `test:` / `chore:` 前缀。

---

### Task 1: 数据层（schema + 播种 + 注册 + 哨兵自愈 + seed 测试）

**Files:**
- Modify: `lib/schema.ts`（新增 `period_slots`、`teacher_schedule`；`timetable` 改 `period_id`）
- Modify: `lib/seed.ts`（播种时段/35 行正课/演示授课；`resetData` DROP 清单加新表）
- Modify: `lib/db.ts`（加 `timetable.period_id` 哨兵判断）
- Modify: `lib/types.ts` / `lib/store.ts`（ResourceKey / RESOURCES 加 `period_slots`、`teacher_schedule`）
- Test: `tests/seed.test.ts`

**Interfaces:**
- Produces: `period_slots`、`teacher_schedule` 表；`timetable.period_id` 列；`store.list/create/update/remove` 对 `'period_slots'`、`'teacher_schedule'` 可用；`resetData` 含新表。

- [ ] **Step 1: 改 `lib/schema.ts`** — 在 `timetable` 定义处替换，并在其后追加两张新表

```ts
CREATE TABLE IF NOT EXISTS timetable (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weekday INTEGER NOT NULL DEFAULT 1,
  period_id INTEGER NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  is_chinese INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS period_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seq INTEGER NOT NULL,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL DEFAULT '',
  end_time TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT '正课'
);

CREATE TABLE IF NOT EXISTS teacher_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weekday INTEGER NOT NULL DEFAULT 1,
  period_id INTEGER NOT NULL,
  class_name TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  remark TEXT NOT NULL DEFAULT ''
);
```

（替换掉原来含 `period TEXT` 的 `timetable` 建表语句；`CREATE TABLE IF NOT EXISTS` 幂等。）

- [ ] **Step 2: 注册 resource** — `lib/types.ts`

```ts
export type ResourceKey =
  | 'settings' | 'students' | 'classroom_config' | 'leave_records'
  | 'discipline_records' | 'grades'
  | 'timetable' | 'period_slots' | 'teacher_schedule'
  | 'todos' | 'conversations' | 'home_visits'
  | 'evaluation' | 'parent_comm' | 'safety_logs'
  | 'work_logs' | 'seats';
```

`lib/store.ts` → `RESOURCES` 增加两行：
```ts
  timetable: 'timetable',
  period_slots: 'period_slots',
  teacher_schedule: 'teacher_schedule',
```

- [ ] **Step 3: `lib/db.ts` 哨兵自愈** — 在 `students.idcard` 检查后追加

```ts
const ttCols = (db.prepare('PRAGMA table_info(timetable)').all() as { name: string }[]).map(c => c.name);
if (ttCols.length > 0 && !ttCols.includes('period_id')) resetData(db);
```

- [ ] **Step 4: `lib/seed.ts` 播种** — **替换**从 `// 课表：周一~周五，早读/正课/中午托/下午托；语文标 is_chinese=1` 注释起到 `periods.forEach(...)` 那段 for 循环结束的整个旧块（即旧 `const periods = [...]` / `const subjects = [...]` / `const tt = db.prepare(...)` 及其循环）。用下面的新代码替换：

```ts
  // 时段定义：早自习 + 上午正课4 + 中午托 + 陪餐 + 下午正课3 + 下午托（共 11 个）
  const slots: [string, string, string, string][] = [
    ['早自习', '08:00', '08:20', '自习'],
    ['上午第1节', '08:25', '09:05', '正课'],
    ['上午第2节', '09:15', '09:55', '正课'],
    ['上午第3节', '10:05', '10:45', '正课'],
    ['上午第4节', '10:55', '11:35', '正课'],
    ['中午托', '11:40', '12:10', '托管'],
    ['陪餐', '12:10', '12:40', '陪餐'],
    ['下午第1节', '14:00', '14:40', '正课'],
    ['下午第2节', '14:50', '15:30', '正课'],
    ['下午第3节', '15:40', '16:20', '正课'],
    ['下午托', '16:20', '17:00', '托管'],
  ];
  const insSlot = db.prepare(`INSERT INTO period_slots (seq, name, start_time, end_time, kind) VALUES (?, ?, ?, ?, ?)`);
  slots.forEach(([name, s, e, kind], i) => insSlot.run(i + 1, name, s, e, kind));

  // 正课科目：语数英科学道法体音美班会劳动；仍用 lib/seed.ts 顶部已有的 subjects 字典改个名避免冲突
  const ttSubjects = ['语文', '数学', '英语', '科学', '道德与法治', '体育', '音乐', '美术', '班会', '劳动'];
  const insTt = db.prepare(`INSERT INTO timetable (weekday, period_id, subject, is_chinese) VALUES (?, ?, ?, ?)`);
  for (let wd = 1; wd <= 5; wd++) {
    slots.forEach(([, , , kind], i) => {
      if (kind !== '正课') return;
      const subject = pick(ttSubjects);
      insTt.run(wd, i + 1, subject, subject === '语文' ? 1 : 0);
    });
  }

  // 班主任授课安排（演示）：本班 + 跨班各若干
  const insTs = db.prepare(`INSERT INTO teacher_schedule (weekday, period_id, class_name, subject, remark) VALUES (?, ?, ?, ?, ?)`);
  insTs.run(1, 2, '长沙青园小学六年级（1）班', '语文', '本班');
  insTs.run(2, 9, '六年级（2）班', '数学', '跨班');
  insTs.run(4, 4, '长沙青园小学六年级（1）班', '语文', '');
```

- [ ] **Step 5: `lib/seed.ts` resetData** — DROP 清单加入新表

```ts
  const tables = ['todos', 'work_logs', 'safety_logs', 'parent_comm',
    'evaluation', 'home_visits', 'conversations', 'timetable', 'period_slots', 'teacher_schedule',
    'grades', 'discipline_records', 'leave_records', 'seats', 'students', 'settings', 'classroom_config'];
```

- [ ] **Step 6: 更新 `tests/seed.test.ts`** — 表清单加两表；`resetData` 的 timetable 计数 30 → 35

```ts
    expect(tables).toEqual(expect.arrayContaining([
      'settings', 'students', 'classroom_config', 'leave_records', 'discipline_records',
      'grades', 'timetable', 'period_slots', 'teacher_schedule', 'todos', 'conversations',
      'home_visits', 'evaluation', 'parent_comm', 'safety_logs',
      'work_logs', 'seats',
    ]));
```
```ts
    expect(timetable).toBe(35);
```

- [ ] **Step 7: 跑测试**

Run: `npx vitest run tests/seed.test.ts`
Expected: PASS（3 处断言全绿）

- [ ] **Step 8: 提交**

```bash
git add lib/schema.ts lib/seed.ts lib/db.ts lib/types.ts lib/store.ts tests/seed.test.ts
git commit -m "feat: add configurable period_slots + teacher_schedule schema"
```

---

### Task 2: `lib/timetable.ts` 纯函数 + `tests/timetable.test.ts`

**Files:**
- Create: `lib/timetable.ts`
- Test: `tests/timetable.test.ts`

**Interfaces:**
- Consumes: `Row` from `@/lib/types`；`DatabaseSync` from `node:sqlite`（仅类型）；`seedIfEmpty` from `@/lib/seed`。
- Produces（后续 Task 5/6 与测试依赖）：
  - `type PeriodKind = '正课' | '自习' | '托管' | '陪餐'`
  - `const SUBJECTS: string[]`（含空串，选「空」表示清空）
  - `const KIND_LABELS: Record<string, string>`
  - `buildClassGrid(slots: Row[], rows: Row[]): Map<string, Row>`（key `${weekday}-${period_id}`）
  - `classStats(slots: Row[], rows: Row[]): { total: number; chinese: number }`
  - `subjectDist(rows: Row[]): { name: string; 课时: number }[]`
  - `removePeriodSlot(db: DatabaseSync, id: number): void`（级联，Task 3 的 route 用）

- [ ] **Step 1: 写失败的测试** `tests/timetable.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../lib/schema';
import { seedIfEmpty } from '../lib/seed';
import { buildClassGrid, classStats, subjectDist, KIND_LABELS, SUBJECTS } from '../lib/timetable';
import type { Row } from '../lib/types';

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  seedIfEmpty(db);
  return db;
}
function query<T>(db: DatabaseSync, sql: string): T[] {
  return db.prepare(sql).all() as unknown as T[];
}

describe('播种：时段与正课', () => {
  it('11 个时段，seq 连续，kind 分布 正课7/自习1/托管2/陪餐1', () => {
    const db = makeDb();
    const slots = query<Row>(db, 'SELECT * FROM period_slots ORDER BY seq');
    expect(slots).toHaveLength(11);
    expect(slots.map(s => s.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const count = (k: string) => slots.filter(s => s.kind === k).length;
    expect(count('正课')).toBe(7);
    expect(count('自习')).toBe(1);
    expect(count('托管')).toBe(2);
    expect(count('陪餐')).toBe(1);
  });

  it('35 行正课：每个正课时段×星期一行，无正课 type 的时段无行', () => {
    const db = makeDb();
    const slots = query<Row>(db, 'SELECT * FROM period_slots');
    const zheng = slots.filter(s => s.kind === '正课');
    const nonZheng = slots.filter(s => s.kind !== '正课');
    const tt = query<Row>(db, 'SELECT * FROM timetable');
    expect(tt).toHaveLength(zheng.length * 5);
    const byPeriod = new Map<number, number>();
    for (const r of tt) byPeriod.set(Number(r.period_id), (byPeriod.get(Number(r.period_id)) ?? 0) + 1);
    for (const s of zheng) expect(byPeriod.get(Number(s.id))).toBe(5); // 每周5天各一行
    const used = new Set(tt.map(r => Number(r.period_id)));
    for (const s of nonZheng) expect(used.has(Number(s.id))).toBe(false);
  });
});

describe('纯函数', () => {
  it('KIND_LABELS 覆盖四类', () => {
    expect(KIND_LABELS['正课']).toBe('正课');
    expect(KIND_LABELS['自习']).toBe('自习');
    expect(KIND_LABELS['托管']).toBe('托管');
    expect(KIND_LABELS['陪餐']).toBe('陪餐');
  });

  it('SUBJECTS 含空串（用于清空）', () => {
    expect(SUBJECTS).toContain('');
  });

  it('classStats 只统计正课且有学科的课时；is_chinese 计入 chinese', () => {
    const db = makeDb();
    const slots = query<Row>(db, 'SELECT * FROM period_slots');
    const tt = query<Row>(db, 'SELECT * FROM timetable');
    const stats = classStats(slots, tt);
    expect(stats.total).toBe(35);
    const chinese = tt.filter(r => r.subject === '语文').length;
    expect(stats.chinese).toBe(chinese);
  });

  it('classStats 忽略无学科行', () => {
    const db = makeDb();
    const slots = query<Row>(db, 'SELECT * FROM period_slots');
    const tt = query<Row>(db, 'SELECT * FROM timetable');
    const one = { ...tt[0], subject: '' };
    const stats = classStats(slots, [one]);
    expect(stats.total).toBe(0);
    expect(stats.chinese).toBe(0);
  });

  it('subjectDist 只含非空学科且按课时统计', () => {
    const db = makeDb();
    const tt = query<Row>(db, 'SELECT * FROM timetable');
    const dist = subjectDist(tt);
    expect(dist.every(d => d.name)).toBe(true);
    const sum = dist.reduce((a, d) => a + d.课时, 0);
    expect(sum).toBe(35);
    expect(dist.find(d => d.name === '语文')?.课时).toBeGreaterThanOrEqual(1);
  });

  it('buildClassGrid 以 `${weekday}-${period_id}` 为键', () => {
    const db = makeDb();
    const slots = query<Row>(db, 'SELECT * FROM period_slots');
    const tt = query<Row>(db, 'SELECT * FROM timetable');
    const grid = buildClassGrid(slots, tt);
    const r = tt[0];
    expect(grid.get(`${Number(r.weekday)}-${Number(r.period_id)}`)).toEqual(r);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/timetable.test.ts`
Expected: FAIL（`lib/timetable.ts` 不存在 → import 报错）

- [ ] **Step 3: 写实现** `lib/timetable.ts`

```ts
import type { DatabaseSync } from 'node:sqlite';
import type { Row } from './types';

export type PeriodKind = '正课' | '自习' | '托管' | '陪餐';

export const SUBJECTS = ['语文', '数学', '英语', '科学', '道德与法治', '体育', '音乐', '美术', '班会', '劳动', ''];

export const KIND_LABELS: Record<string, string> = { 正课: '正课', 自习: '自习', 托管: '托管', 陪餐: '陪餐' };

/** 以 `${weekday}-${period_id}` 为键把 timetable 行映射到网格 */
export function buildClassGrid(slots: Row[], rows: Row[]): Map<string, Row> {
  const m = new Map<string, Row>();
  for (const r of rows) m.set(`${Number(r.weekday)}-${Number(r.period_id)}`, r);
  return m;
}

/** 只统计正课时段且 subject 非空的行 */
export function classStats(slots: Row[], rows: Row[]): { total: number; chinese: number } {
  const zheng = new Set(slots.filter(s => s.kind === '正课').map(s => Number(s.id)));
  const subjectRows = rows.filter(r => zheng.has(Number(r.period_id)) && String(r.subject ?? '') !== '');
  return {
    total: subjectRows.length,
    chinese: subjectRows.filter(r => r.is_chinese == 1).length,
  };
}

/** 按学科统计课时，只含非空学科 */
export function subjectDist(rows: Row[]): { name: string; 课时: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const s = String(r.subject ?? '');
    if (!s) continue;
    m.set(s, (m.get(s) ?? 0) + 1);
  }
  return [...m.entries()].map(([name, 课时]) => ({ name, 课时 })).filter(d => d.name);
}

/** 删除时段并级联删除其下 timetable 与 teacher_schedule 行 */
export function removePeriodSlot(db: DatabaseSync, id: number): void {
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM timetable WHERE period_id = ?').run(id);
    db.prepare('DELETE FROM teacher_schedule WHERE period_id = ?').run(id);
    db.prepare('DELETE FROM period_slots WHERE id = ?').run(id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run tests/timetable.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/timetable.ts tests/timetable.test.ts
git commit -m "feat: add timetable pure helpers (grid/stats/distribution/cascade)"
```

---

### Task 3: 时段删除级联接入 API

**Files:**
- Modify: `app/api/[resource]/[id]/route.ts`

**Interfaces:**
- Consumes: `removePeriodSlot(db, id)` from Task 2.
- Produces: DELETE `/api/period_slots/:id` 级联删除其下 timetable/teacher_schedule。

- [ ] **Step 1: 改 DELETE 分支** `app/api/[resource]/[id]/route.ts`

```ts
import { removePeriodSlot } from '@/lib/timetable';
```
在 `DELETE` 内：
```ts
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { resource, id } = await params;
  if (!isResource(resource)) return NextResponse.json({ error: '未知资源' }, { status: 404 });
  const db = getDb();
  if (resource === 'period_slots') removePeriodSlot(db, Number(id));
  else remove(db, resource, Number(id));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: 跑既有测试 + lint**

Run: `npx vitest run tests/timetable.test.ts tests/seed.test.ts`
Expected: PASS

Run: `npm run lint`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add app/api/[resource]/[id]/route.ts
git commit -m "fix: cascade delete period_slots children in DELETE route"
```

---

### Task 4: 时段管理弹窗 `components/timetable/period-slots-modal.tsx`

**Files:**
- Create: `components/timetable/period-slots-modal.tsx`

**Interfaces:**
- Consumes: `useResourceRows('period_slots')`；`@ant-design/icons`；`antd`。
- Produces: `PeriodSlotsModal({ open, onClose })` `{ open: boolean; onClose: () => void }` 组件；用于 Task 5。

- [ ] **Step 1: 写组件**

```tsx
'use client';
import { useMemo } from 'react';
import { Modal, Button, Input, Select, Space, Popconfirm } from 'antd';
import { UpOutlined, DownOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useResourceRows } from '@/components/use-resource';

const KINDS = ['正课', '自习', '托管', '陪餐'];

export default function PeriodSlotsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { rows, update, create, remove } = useResourceRows('period_slots');
  const ordered = useMemo(() => [...rows].sort((a, b) => Number(a.seq) - Number(b.seq)), [rows]);

  const move = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= ordered.length) return;
    const a = ordered[index], b = ordered[j];
    await Promise.all([
      update(a.id as number, { seq: Number(b.seq) }),
      update(b.id as number, { seq: Number(a.seq) }),
    ]);
  };

  const add = async () => {
    const maxSeq = ordered.reduce((m, s) => Math.max(m, Number(s.seq)), 0);
    await create({ seq: maxSeq + 1, name: '新时段', start_time: '', end_time: '', kind: '正课' });
  };

  return (
    <Modal title="时段管理" open={open} onCancel={onClose} footer={null} width={720}>
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        {ordered.map((slot, i) => (
          <Space key={slot.id} style={{ width: '100%' }} align="baseline">
            <Button size="small" icon={<UpOutlined />} disabled={i === 0} onClick={() => void move(i, -1)} />
            <Button size="small" icon={<DownOutlined />} disabled={i === ordered.length - 1} onClick={() => void move(i, 1)} />
            <Input size="small" style={{ width: 120 }} defaultValue={String(slot.name)} onBlur={e => void update(slot.id as number, { name: e.target.value })} />
            <Input size="small" style={{ width: 80 }} defaultValue={String(slot.start_time)} onBlur={e => void update(slot.id as number, { start_time: e.target.value })} placeholder="HH:mm" />
            <Input size="small" style={{ width: 80 }} defaultValue={String(slot.end_time)} onBlur={e => void update(slot.id as number, { end_time: e.target.value })} placeholder="HH:mm" />
            <Select size="small" style={{ width: 92 }} value={String(slot.kind)} options={KINDS.map(k => ({ value: k, label: k }))} onChange={v => void update(slot.id as number, { kind: v })} />
            <Popconfirm title="删除该时段将同时删除其课表与授课行，确定？" onConfirm={() => void remove(slot.id as number)}>
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ))}
        <Button type="dashed" block icon={<PlusOutlined />} onClick={() => void add()}>新增时段</Button>
      </Space>
    </Modal>
  );
}
```

- [ ] **Step 2: 验证**

Run: `npm run lint`
Expected: 无错误

Run: `npm run build`
Expected: 编译通过（类型检查含 `.tsx`）。此组件尚未被引用，未打包产物但类型不报错即可。

- [ ] **Step 3: 提交**

```bash
git add components/timetable/period-slots-modal.tsx
git commit -m "feat: add period slots management modal"
```

---

### Task 5: 班级课表网格 `components/timetable/class-timetable.tsx`

**Files:**
- Create: `components/timetable/class-timetable.tsx`
- Modify: 无（复用 Task 2 纯函数 + Task 4 弹窗）

**Interfaces:**
- Consumes: `buildClassGrid`、`classStats`、`subjectDist`、`SUBJECTS`、`KIND_LABELS`(Task 2)；`PeriodSlotsModal`(Task 4)；`useResourceRows('period_slots'|'timetable')`；`EditableCell`；`useEditable`（AppShell 已全局提供）。
- Produces: `ClassTimetable()` 组件，供 Task 7 的 `page.tsx` 使用。

- [ ] **Step 1: 写组件**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { Button, Card, Typography } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import PeriodSlotsModal from './period-slots-modal';
import { buildClassGrid, classStats, subjectDist, SUBJECTS, KIND_LABELS } from '@/lib/timetable';

const DAYS = ['周一', '周二', '周三', '周四', '周五'];

export default function ClassTimetable() {
  const { rows: slots, loading: slotLoading } = useResourceRows('period_slots');
  const { rows: tt, loading: ttLoading, update, create } = useResourceRows('timetable');
  const [slotModalOpen, setSlotModalOpen] = useState(false);

  const ordered = useMemo(() => [...slots].sort((a, b) => Number(a.seq) - Number(b.seq)), [slots]);
  const grid = useMemo(() => buildClassGrid(ordered, tt), [ordered, tt]);
  const stats = useMemo(() => classStats(ordered, tt), [ordered, tt]);
  const bySubject = useMemo(() => subjectDist(tt), [tt]);

  const saveSubject = async (weekday: number, periodId: number, subject: string | number | null) => {
    const v = String(subject ?? '');
    const isChinese = v === '语文' ? 1 : 0;
    const existing = grid.get(`${weekday}-${periodId}`);
    if (existing) await update(existing.id as number, { subject: v, is_chinese: isChinese });
    else await create({ weekday, period_id: periodId, subject: v, is_chinese: isChinese });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Typography.Title level={5} style={{ margin: 0 }}>班级课表</Typography.Title>
        <Button size="small" onClick={() => setSlotModalOpen(true)}>时段管理</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card size="small"><div className="text-xs text-slate-500">每周正课总课时</div><div className="text-xl font-semibold mt-0.5">{stats.total}</div></Card>
        <Card size="small"><div className="text-xs text-slate-500">语文任教课时</div><div className="text-xl font-semibold mt-0.5 text-blue-600">{stats.chinese}</div></Card>
      </div>
      <Card size="small" className="overflow-x-auto mb-4" loading={slotLoading || ttLoading}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-xs text-slate-500">
              <th className="px-2 py-2 text-left border-b border-gray-200">时段</th>
              {DAYS.map(d => <th key={d} className="px-2 py-2 border-b border-gray-200">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {ordered.map(slot => {
              const isSubject = slot.kind === '正课';
              return (
                <tr key={slot.id}>
                  <td className="px-2 py-2 border-b border-gray-100 whitespace-nowrap">
                    <div className="text-xs text-slate-700">{String(slot.name)}</div>
                    <div className="text-xs text-slate-400">{String(slot.start_time)}-{String(slot.end_time)}</div>
                  </td>
                  {DAYS.map(d => {
                    const wd = DAYS.indexOf(d) + 1;
                    const key = `${wd}-${slot.id}`;
                    const r = grid.get(key);
                    if (!isSubject) {
                      return <td key={key} className="px-2 py-2 border-b border-gray-100 text-center"><span className="text-xs text-slate-400">{KIND_LABELS[String(slot.kind)]}</span></td>;
                    }
                    const chinese = r && r.is_chinese == 1;
                    return (
                      <td key={key} className={`px-2 py-2 border-b border-gray-100 text-center ${chinese ? 'bg-blue-50' : ''}`}>
                        <EditableCell
                          value={r ? r.subject : null}
                          type="select"
                          options={SUBJECTS}
                          onSave={v => saveSubject(wd, Number(slot.id), v)}
                          className={chinese ? 'text-blue-700 font-medium' : 'text-slate-700'}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Card size="small"><h3 className="mb-3 text-sm font-semibold text-slate-600" style={{ marginTop: 0 }}>课时分布（按学科）</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bySubject}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="课时" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <PeriodSlotsModal open={slotModalOpen} onClose={() => setSlotModalOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 2: 验证**

Run: `npm run lint`
Expected: 无错误

Run: `npm run build`
Expected: 编译通过（组件尚未被 `page.tsx` 引用，但类型检查不报错即可）。

- [ ] **Step 3: 提交**

```bash
git add components/timetable/class-timetable.tsx
git commit -m "feat: rebuild class timetable grid from period_slots"
```

---

### Task 6: 我的授课（表格 + 周总览 + 弹窗）

**Files:**
- Create: `components/timetable/teacher-schedule.tsx`
- Create: `components/timetable/teacher-schedule-modal.tsx`

**Interfaces:**
- Consumes: `useResourceRows('teacher_schedule'|'period_slots')`；`antd Table/Modal/Form/Select/Input/Tag`；`Row` 类型。
- Produces: `TeacherSchedule()` 组件（含内部 TeacherScheduleModal），供 Task 7 使用。

- [ ] **Step 1: 写弹窗** `components/timetable/teacher-schedule-modal.tsx`

```tsx
'use client';
import { useEffect } from 'react';
import { Modal, Form, Select, Input } from 'antd';
import type { Row } from '@/lib/types';

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五'];
const SUBJECT_OPTIONS = ['语文', '数学', '英语', '科学', '道德与法治', '体育', '音乐', '美术', '班会', '劳动'];

type Values = { weekday: number; period_id: number; class_name: string; subject: string; remark: string };

export default function TeacherScheduleModal({ open, onClose, editing, slots, onSave }: {
  open: boolean;
  onClose: () => void;
  editing: Row | null;
  slots: Row[];
  onSave: (v: Values) => Promise<void>;
}) {
  const [form] = Form.useForm();
  const slotOptions = [...slots].sort((a, b) => Number(a.seq) - Number(b.seq))
    .map(s => ({ value: Number(s.id), label: `${s.name} ${s.start_time}-${s.end_time}` }));

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(editing ? {
      weekday: Number(editing.weekday),
      period_id: Number(editing.period_id),
      class_name: String(editing.class_name ?? ''),
      subject: String(editing.subject ?? ''),
      remark: String(editing.remark ?? ''),
    } : { weekday: 1, period_id: undefined, class_name: '', subject: '', remark: '' });
  }, [open, editing, form]);

  const submit = async () => {
    const v = await form.validateFields();
    await onSave({ weekday: Number(v.weekday), period_id: Number(v.period_id), class_name: v.class_name, subject: v.subject, remark: v.remark ?? '' });
    onClose();
  };

  return (
    <Modal title={editing ? '编辑授课' : '新增授课'} open={open} onCancel={onClose} onOk={() => void submit()} destroyOnHidden>
      <Form form={form} layout="vertical">
        <Form.Item name="weekday" label="星期" rules={[{ required: true, message: '请选择星期' }]}>
          <Select options={WEEKDAYS.map((w, i) => ({ value: i + 1, label: w }))} />
        </Form.Item>
        <Form.Item name="period_id" label="时段" rules={[{ required: true, message: '请选择时段' }]}>
          <Select options={slotOptions} />
        </Form.Item>
        <Form.Item name="class_name" label="目标班级" rules={[{ required: true, message: '请输入班级' }]}>
          <Input placeholder="如 六年级（2）班" />
        </Form.Item>
        <Form.Item name="subject" label="科目" rules={[{ required: true, message: '请选择科目' }]}>
          <Select options={SUBJECT_OPTIONS.map(s => ({ value: s, label: s }))} />
        </Form.Item>
        <Form.Item name="remark" label="备注"><Input.TextArea rows={2} /></Form.Item>
      </Form>
    </Modal>
  );
}
```

- [ ] **Step 2: 写主视图** `components/timetable/teacher-schedule.tsx`

```tsx
'use client';
import { useMemo, useState } from 'react';
import { Button, Card, Table, Tag, Typography } from 'antd';
import type { TableProps } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useResourceRows } from '@/components/use-resource';
import TeacherScheduleModal from './teacher-schedule-modal';
import type { Row } from '@/lib/types';

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五'];

export default function TeacherSchedule() {
  const { rows: ts, loading, update, create, remove } = useResourceRows('teacher_schedule');
  const { rows: slots } = useResourceRows('period_slots');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const slotById = useMemo(() => new Map(slots.map(s => [Number(s.id), s])), [slots]);
  const orderedSlots = useMemo(() => [...slots].sort((a, b) => Number(a.seq) - Number(b.seq)), [slots]);
  const slotLabel = (id: string | number) => { const s = slotById.get(Number(id)); return s ? `${s.name} ${s.start_time}-${s.end_time}` : `#${id}`; };
  const weekLabel = (wd: string | number) => WEEKDAYS[Number(wd) - 1] ?? String(wd);

  // 周总览：weekday × period_id 映射
  const overview = useMemo(() => {
    const m = new Map<string, Row>();
    for (const r of ts) m.set(`${Number(r.weekday)}-${Number(r.period_id)}`, r);
    return m;
  }, [ts]);

  const sorted = useMemo(() => [...ts].sort((a, b) =>
    Number(a.weekday) - Number(b.weekday)
    || Number(slotById.get(Number(a.period_id))?.seq ?? 0) - Number(slotById.get(Number(b.period_id))?.seq ?? 0)
  ), [ts, slotById]);

  const onSave = async (values: { weekday: number; period_id: number; class_name: string; subject: string; remark: string }) => {
    if (editing) await update(editing.id as number, values);
    else await create(values);
  };

  const columns: TableProps<Row>['columns'] = [
    { title: '星期', dataIndex: 'weekday', render: (v: string | number) => weekLabel(v) },
    { title: '时段', dataIndex: 'period_id', render: (v: string | number) => slotLabel(v) },
    { title: '目标班级', dataIndex: 'class_name', render: (v: string) => v || '—' },
    { title: '科目', dataIndex: 'subject', render: (v: string) => v ? <Tag color="blue">{v}</Tag> : '—' },
    { title: '备注', dataIndex: 'remark', render: (v: string) => v || '—' },
    {
      title: '操作', key: 'actions',
      render: (_: unknown, r: Row) => (
        <div className="space-x-2">
          <Button size="small" onClick={() => { setEditing(r); setModalOpen(true); }}>编辑</Button>
          <Button size="small" danger onClick={() => void remove(r.id as number)}>删除</Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Typography.Title level={5} style={{ margin: 0 }}>我的授课</Typography.Title>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => { setEditing(null); setModalOpen(true); }}>新增授课</Button>
      </div>
      <Card size="small" className="overflow-x-auto mb-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-xs text-slate-500">
              <th className="px-2 py-2 text-left border-b border-gray-200">时段</th>
              {WEEKDAYS.map(d => <th key={d} className="px-2 py-2 border-b border-gray-200">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {orderedSlots.map(slot => (
              <tr key={slot.id}>
                <td className="px-2 py-2 border-b border-gray-100 whitespace-nowrap">
                  <div className="text-xs text-slate-700">{String(slot.name)}</div>
                  <div className="text-xs text-slate-400">{String(slot.start_time)}-{String(slot.end_time)}</div>
                </td>
                {WEEKDAYS.map((d, idx) => {
                  const key = `${idx + 1}-${slot.id}`;
                  const r = overview.get(key);
                  return (
                    <td key={key} className="px-2 py-2 border-b border-gray-100 text-center">
                      {r ? (
                        <div>
                          <div className="text-xs text-slate-700">{String(r.class_name)}</div>
                          <div className="text-xs text-blue-600">{String(r.subject)}</div>
                        </div>
                      ) : <span className="text-xs text-slate-300">空闲</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Table rowKey="id" size="small" loading={loading} dataSource={sorted} columns={columns} pagination={false} />
      <TeacherScheduleModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} slots={slots} onSave={onSave} />
    </div>
  );
}
```

- [ ] **Step 3: 验证**

Run: `npm run lint`
Expected: 无错误

Run: `npm run build`
Expected: 编译通过。

- [ ] **Step 4: 提交**

```bash
git add components/timetable/teacher-schedule.tsx components/timetable/teacher-schedule-modal.tsx
git commit -m "feat: add teacher teaching schedule view"
```

---

### Task 7: 页面接线 + 全量验证

**Files:**
- Modify: `app/timetable/page.tsx`（改为 Tabs 包装）

**Interfaces:**
- Consumes: `ClassTimetable`(Task 5)、`TeacherSchedule`(Task 6)。

- [ ] **Step 1: 重写 `app/timetable/page.tsx`**

```tsx
'use client';
import { Tabs } from 'antd';
import ClassTimetable from '@/components/timetable/class-timetable';
import TeacherSchedule from '@/components/timetable/teacher-schedule';

export default function TimetablePage() {
  return (
    <Tabs
      items={[
        { key: 'class', label: '班级课表', children: <ClassTimetable /> },
        { key: 'teacher', label: '我的授课', children: <TeacherSchedule /> },
      ]}
    />
  );
}
```

- [ ] **Step 2: 全量测试 + 构建 + lint**

Run: `npm test`
Expected: 全部 PASS（含 `tests/timetable.test.ts`、更新后的 `tests/seed.test.ts`）

Run: `npm run build`
Expected: 构建成功

Run: `npm run lint`
Expected: 无错误

- [ ] **Step 3: 手动验证清单（起 `npm run dev` 后逐项核对）**

- [ ] `/timetable` 显示两个标签「班级课表 / 我的授课」，默认班级课表。
- [ ] 班级课表共 11 行；首列显示时段名 + 时间；正课列可点选学科（进入「编辑」模式更明显）；早自习/托管/陪餐显示固定淡色标签。
- [ ] 点击数显「每周正课总课时 = 35」，语文课时与表格一致；学科分布图表正常。
- [ ] 「时段管理」弹窗：可上移/下移、改名称/时间、切换正课/自习/托管/陪餐、新增、删除；删除一个正课时段后其课表列清空。
- [ ] 「我的授课」显示周总览（有课的格子显示班级+科目，其余「空闲」）+ 下方列表；「新增授课」可保存，出现于列表与总览。
- [ ] 桌面 / 手机宽度下两视图均正常（内容铺满或横向滚动均可）。

- [ ] **Step 4: 提交**

```bash
git add app/timetable/page.tsx
git commit -m "feat: wire timetable tabs (class timetable + teacher schedule)"
```

---

## 自审

**Spec 覆盖核对：**
- 时段可配置（名称/时间/顺序/类型）→ Task 1 schema + Task 4 弹窗 ✅
- 班级课表 11×5 网格、正课可填学科、非正课固定标签 → Task 5 ✅
- 统计（每周正课总课时+语文）与学科分布 → Task 2 纯函数 + Task 5 ✅
- 我的授课（独立、手动）→ Task 6 ✅
- 删除时段级联 → Task 2 `removePeriodSlot` + Task 3 路由 ✅
- 启动自愈哨兵 → Task 1 Step 3 ✅
- 现有 seed.test 计数/表清单更新 → Task 1 Step 6 ✅

**Placeholder 检查：** 无 TBD/TODO；每个代码步骤给出完整代码；类型均在 Task 2 定义并在后续一致使用（`buildClassGrid`/`classStats`/`subjectDist`/`removePeriodSlot`/`SUBJECTS`/`KIND_LABELS`/`PeriodSlotsModal`/`TeacherSchedule`/`ClassTimetable`）。

**类型一致性：** `useResourceRows` 返回 `{ rows, loading, update, create, remove, reload }`，Task 5/6 只取所用字段；`EditableCell` 的 `onSave(value)` 返回 `Promise<void>` 与 Task 5 的 `saveSubject` 签名一致；antd v6 用 `destroyOnHidden` 而非 `destroyOnClose`（Task 6 弹窗）。
