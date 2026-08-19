# 学生管理页增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增强学生管理页：层次改 1–6 六档、新增学号/身份证(唯一)/住址/家长姓名/中午托/早餐字段、列显示隐藏(全局)、CSV 导入(按身份证覆盖)。

**Architecture:** 数据层直接改 schema（未部署、不兼容旧数据），启动时缺列即重置演示数据；导入核心为 `lib/import.ts` 纯函数 `importStudents`，由新静态路由 `/api/students/import` 调用；列显隐与导入弹窗做进共享 CrudPage/DataTable/PageHeader，所有 CRUD 页自动生效。

**Tech Stack:** Next.js 16 (App Router)、React 19、node:sqlite (`DatabaseSync`)、vitest、Tailwind。测试运行 `npm test`，构建验证 `npm run build`。要求 Node >= 22。

## Global Constraints

- 未部署，不兼容旧数据：已有 `data/app.db` 由启动自愈直接重置演示数据，不做逐字段迁移。
- 学生层次为 1–6 六档，1 最低 / 6 最高；「重点关注」= `level === 1`。
- 身份证是唯一索引：空串存 `NULL`（多个空值不冲突），重复身份证抛 400 → toast「身份证已存在」。
- 页面文案使用中文；遵循现有 CrudPage 配置驱动模式（`'use client'` + `CrudPageConfig`）。
- 提交信息沿用仓库风格前缀（`feat:` / `fix:` / `test:` / `chore:`）。
- AGENTS.md 提示本项目 Next.js 有 breaking changes：如对 Next 约定不确定，先读 `node_modules/next/dist/docs/` 对应指南；本计划仅复用现有 `page.tsx`/`route.ts` 模式，不引入新 Next API。

---

### Task 1: 数据模型、播种与启动自愈

**Files:**
- Modify: `lib/schema.ts`（students 表新列 + 唯一索引）
- Modify: `lib/seed.ts`（新字段播种 + resetData 改 DROP→重建）
- Modify: `lib/db.ts:9-19`（缺列自愈）
- Modify: `tests/store.test.ts:24`（level 数值化）
- Test: `tests/seed.test.ts`（新增新字段断言）

**Interfaces:**
- Consumes: 现有 `SCHEMA_SQL`、`seedIfEmpty`、`resetData`。
- Produces: `students` 表含 `student_no/idcard/parent_name/address/noon_care/breakfast` 且 `level` 为整数；`resetData(db)` 先 DROP 全部表再重建再播种；`getDb()` 对缺 `idcard` 列的旧库自动重置。

- [ ] **Step 1: 写失败测试（tests/seed.test.ts 末尾追加）**

```ts
describe('seed 新学籍字段', () => {
  it('学号连续唯一、身份证 18 位唯一、其余新字段完整', () => {
    const db = makeDb();
    seedIfEmpty(db);
    const rows = db.prepare('SELECT * FROM students ORDER BY student_no').all() as { student_no: string; idcard: string; parent_name: string; address: string; level: number; noon_care: number; breakfast: number; afternoon_care: number }[];
    expect(rows.length).toBe(45);
    expect(rows.map(r => r.student_no)).toEqual(Array.from({ length: 45 }, (_, i) => String(i + 1).padStart(2, '0')));
    const ids = rows.map(r => r.idcard);
    expect(new Set(ids).size).toBe(45);
    ids.forEach(id => expect(id.length).toBe(18));
    rows.forEach(r => {
      expect(r.parent_name).toBeTruthy();
      expect(r.address).toBeTruthy();
      expect([0, 1]).toContain(r.noon_care);
      expect([0, 1]).toContain(r.breakfast);
      expect([0, 1]).toContain(r.afternoon_care);
      expect(r.level).toBeGreaterThanOrEqual(1);
      expect(r.level).toBeLessThanOrEqual(6);
    });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL（`rows.map(r => r.student_no)` —— `student_no` 列不存在，SQL 报错）。

- [ ] **Step 3: 改 `lib/schema.ts`**

把 `students` 建表语句替换为（并在此表之后追加唯一索引）：

```sql
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_idcard ON students(idcard);
```

- [ ] **Step 4: 改 `lib/seed.ts`**

在文件顶部 import `SCHEMA_SQL`，删除 `const LEVELS = [...]`，新增：

```ts
const AREAS = ['青园街道', '侯家塘街道', '金盆岭街道', '东塘街道', '赤岭路街道', '文源街道'];
const RESIDENCES = ['天心阁小区', '湘府华庭', '阳光壹佰', '白沙花园', '翡翠云天', '翰林府'];

function fakeIdcard(i: number): string {
  const area = '430102';
  const birth = `${2013 + rand(2)}${String(rand(12) + 1).padStart(2, '0')}${String(rand(28) + 1).padStart(2, '0')}`;
  const seq = String(i + 1).padStart(3, '0'); // i 0..44 → 唯一
  const body = area + birth + seq; // 17 位
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const map = '10X98765432';
  const sum = body.split('').reduce((s, ch, idx) => s + Number(ch) * weights[idx], 0);
  return body + map[sum % 11];
}
```

把 `seedIfEmpty` 里学生插入改为（含索引下标）：

```ts
const ins = db.prepare(`INSERT INTO students (student_no, name, gender, parent_name, parent_phone, idcard, address, level, group_no, role, noon_care, breakfast, afternoon_care, remark)
  VALUES (@student_no, @name, @gender, @parent_name, @phone, @idcard, @address, @level, @group, @role, @noon, @breakfast, @care, '')`);
const students = uniqueNames(45);
students.forEach((name, i) => {
  ins.run({
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
```

把 `resetData` 改为 DROP → 重建 → 播种：

```ts
export function resetData(db: DatabaseSync): void {
  const tables = ['todos', 'work_logs', 'peiyou_records', 'safety_logs', 'parent_comm',
    'evaluation', 'home_visits', 'conversations', 'timetable', 'schedules', 'homework',
    'grades', 'discipline_records', 'leave_records', 'seats', 'students', 'settings', 'classroom_config'];
  db.exec(tables.map(t => `DROP TABLE IF EXISTS ${t}`).join(';'));
  db.exec(SCHEMA_SQL);
  seedIfEmpty(db);
}
```

- [ ] **Step 5: 改 `lib/db.ts`**

```ts
db.exec(SCHEMA_SQL);
const studentCols = (db.prepare('PRAGMA table_info(students)').all() as { name: string }[]).map(c => c.name);
if (!studentCols.includes('idcard')) resetData(db);
seedIfEmpty(db);
```

import 改为 `import { resetData, seedIfEmpty } from './seed';`。

- [ ] **Step 6: 改 `tests/store.test.ts:24`**

`level: '良好'` → `level: 5`（其余不动）。

- [ ] **Step 7: 运行全部测试确认通过**

Run: `npm test`
Expected: PASS（含 seed.test.ts / store.test.ts / dashboard.test.ts）。

- [ ] **Step 8: 提交**

```bash
git add lib/schema.ts lib/seed.ts lib/db.ts tests/store.test.ts tests/seed.test.ts
git commit -m "feat: students schema with idcard/no/care fields and reseed self-heal"
```

---

### Task 2: 导入核心纯函数 importStudents

**Files:**
- Create: `lib/import.ts`
- Test: `tests/import.test.ts`

**Interfaces:**
- Consumes: 任务 1 的 `students` 表结构。
- Produces:
  - `export interface ImportItem { line: number; student_no: string; name: string; gender: string; parent_name: string; parent_phone: string; idcard: string; address: string; level: number; group_no: number; role: string; noon_care: number; breakfast: number; afternoon_care: number; remark: string }`
  - `export interface ImportResult { created: number; updated: number; skipped: number; errors: { row: number; message: string }[] }`
  - `export function importStudents(db: DatabaseSync, rows: ImportItem[]): ImportResult`

- [ ] **Step 1: 写失败测试（tests/import.test.ts）**

```ts
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../lib/schema';
import { seedIfEmpty } from '../lib/seed';
import { list, create } from '../lib/store';
import { importStudents, type ImportItem } from '../lib/import';

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  seedIfEmpty(db);
  return db;
}

const item = (p: Partial<ImportItem>): ImportItem => ({
  line: 2, student_no: '', name: '导入生', gender: '男', parent_name: '', parent_phone: '',
  idcard: '', address: '', level: 4, group_no: 1, role: '', noon_care: 0, breakfast: 0,
  afternoon_care: 1, remark: '', ...p,
});

describe('importStudents', () => {
  it('新身份证 → INSERT', () => {
    const db = makeDb();
    const r = importStudents(db, [item({ idcard: '430102201303010011', name: '新增生' })]);
    expect(r.created).toBe(1);
    expect(r.updated).toBe(0);
    expect(list(db, 'students').length).toBe(46);
  });

  it('已存在身份证 → 覆盖全部字段', () => {
    const db = makeDb();
    const first = list(db, 'students')[0];
    const r = importStudents(db, [item({ idcard: String(first.idcard), name: '覆盖名', level: 1, gender: '女' })]);
    expect(r.updated).toBe(1);
    const row = list(db, 'students')[0];
    expect(row.name).toBe('覆盖名');
    expect(row.level).toBe(1);
    expect(row.gender).toBe('女');
    expect(list(db, 'students').length).toBe(45);
  });

  it('空身份证 → 跳过并带行号', () => {
    const db = makeDb();
    const r = importStudents(db, [item({ line: 3, idcard: '' })]);
    expect(r.skipped).toBe(1);
    expect(r.errors).toEqual([{ row: 3, message: '缺少身份证' }]);
  });

  it('同批两条相同新身份证 → 一条 insert 一条 update', () => {
    const db = makeDb();
    const r = importStudents(db, [item({ idcard: '999' }), item({ idcard: '999', name: '第二次' })]);
    expect(r.created).toBe(1);
    expect(r.updated).toBe(1);
    const row = list(db, 'students').find(x => x.idcard === '999');
    expect(row?.name).toBe('第二次');
  });

  it('直接插入重复身份证抛错（唯一索引）', () => {
    const db = makeDb();
    const idc = String(list(db, 'students')[0].idcard);
    expect(() => { create(db, 'students', { name: 'A', idcard: idc }); }).toThrow();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL（`Cannot find module '../lib/import'`）。

- [ ] **Step 3: 写 `lib/import.ts`**

```ts
import type { DatabaseSync } from 'node:sqlite';

export interface ImportItem {
  line: number;
  student_no: string;
  name: string;
  gender: string;
  parent_name: string;
  parent_phone: string;
  idcard: string;
  address: string;
  level: number;
  group_no: number;
  role: string;
  noon_care: number;
  breakfast: number;
  afternoon_care: number;
  remark: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

const UPDATE_SQL = `UPDATE students SET
  student_no = @student_no, name = @name, gender = @gender, parent_name = @parent_name,
  parent_phone = @parent_phone, address = @address, level = @level, group_no = @group_no,
  role = @role, noon_care = @noon_care, breakfast = @breakfast, afternoon_care = @afternoon_care,
  remark = @remark WHERE idcard = @idcard`;

const INSERT_SQL = `INSERT INTO students (student_no, name, gender, parent_name, parent_phone, idcard, address, level, group_no, role, noon_care, breakfast, afternoon_care, remark)
  VALUES (@student_no, @name, @gender, @parent_name, @parent_phone, @idcard, @address, @level, @group_no, @role, @noon_care, @breakfast, @afternoon_care, @remark)`;

export function importStudents(db: DatabaseSync, rows: ImportItem[]): ImportResult {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const find = db.prepare('SELECT id FROM students WHERE idcard = ?');
  const upd = db.prepare(UPDATE_SQL);
  const ins = db.prepare(INSERT_SQL);
  db.exec('BEGIN');
  try {
    for (const r of rows) {
      if (!r.idcard) { result.skipped++; result.errors.push({ row: r.line, message: '缺少身份证' }); continue; }
      if (find.get(r.idcard)) { upd.run(r); result.updated++; }
      else { ins.run(r); result.created++; }
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return result;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add lib/import.ts tests/import.test.ts
git commit -m "feat: importStudents upsert-by-idcard pure function"
```

---

### Task 3: CSV 解析与生成

**Files:**
- Modify: `lib/csv.ts`
- Test: `tests/csv.test.ts`

**Interfaces:**
- Consumes: 无。
- Produces:
  - `export function parseCsv(text: string): string[][]`（去 BOM，支持引号转义 `""`、引号内逗号/换行、`\r\n` 与 `\n`）
  - `export function toCsv(headers: string[], rows: (string | number)[][]): string`（带 BOM，字段引号包裹）

- [ ] **Step 1: 写失败测试（tests/csv.test.ts）**

```ts
import { describe, it, expect } from 'vitest';
import { parseCsv, toCsv } from '../lib/csv';

describe('parseCsv', () => {
  it('解析引号内逗号、引号转义、多行', () => {
    const out = parseCsv('a,b\n"x,y",z\n"say ""hi""",w');
    expect(out).toEqual([['a', 'b'], ['x,y', 'z'], ['say "hi"', 'w']]);
  });

  it('去掉 BOM', () => {
    expect(parseCsv(String.fromCharCode(0xFEFF) + 'h1,h2\n1,2')[0][0]).toBe('h1');
  });

  it('兼容 \\r\\n 换行', () => {
    expect(parseCsv('a,b\r\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('toCsv', () => {
  it('生成带 BOM、带引号的 CSV', () => {
    const csv = toCsv(['学号', '姓名'], [['01', '张,三']]);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(csv).toContain('学号,姓名');
    expect(csv).toContain('"01","张,三"');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test`
Expected: FAIL（`parseCsv is not a function`）。

- [ ] **Step 3: 改 `lib/csv.ts`**

保留现有 `exportCsv` 不变，文件末尾新增：

```ts
export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell); cell = '';
    } else if (ch === '\n') {
      row.push(cell); cell = ''; rows.push(row); row = [];
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const head = headers.map(esc).join(',');
  const body = rows.map(r => r.map(c => esc(String(c))).join(','));
  return String.fromCharCode(0xFEFF) + [head, ...body].join('\n');
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add lib/csv.ts tests/csv.test.ts
git commit -m "feat: csv parse and build helpers"
```

---

### Task 4: 导入 API 路由

**Files:**
- Create: `app/api/students/import/route.ts`

**Interfaces:**
- Consumes: `getDb()`（Task 1）、`importStudents`/`ImportItem`（Task 2）。
- Produces: `POST /api/students/import`，body `{ rows: ImportItem[] }`，返回 `ImportResult`。

- [ ] **Step 1: 创建路由文件**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { importStudents, type ImportItem } from '@/lib/import';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { rows?: ImportItem[] };
    const result = importStudents(getDb(), body.rows ?? []);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
```

静态段 `students/import` 优先于动态 `[resource]`，不会冲突。

- [ ] **Step 2: 构建验证**

Run: `npm run build`
Expected: 构建成功（仓库对 route 无单元测试先例，运行时由 Task 6 手工验证）。

- [ ] **Step 3: 提交**

```bash
git add app/api/students/import/route.ts
git commit -m "feat: students import API route"
```

---

### Task 5: 列显隐 + 导入弹窗（共享组件）

**Files:**
- Modify: `components/crud/types.ts`
- Modify: `components/ui/page-header.tsx`
- Modify: `components/crud/data-table.tsx:31-40`
- Create: `components/crud/import-modal.tsx`
- Modify: `components/crud/crud-page.tsx`

**Interfaces:**
- Consumes: `ImportItem`（Task 2）、`parseCsv`/`toCsv`（Task 3）。
- Produces:
  - `ColumnDef` 新增可选 `nullOnEmpty?: boolean`
  - `CrudPageConfig` 新增可选 `sortRows?: (a: Row, b: Row) => number`、`defaultHidden?: string[]`、`importTemplate?: ImportTemplate`；`defaultNewRow` 改为 `(rows: Row[]) => Record<string, string | number | null>`
  - `export interface ImportTemplate { filename: string; columns: { key: string; label: string }[]; exampleRow: Record<string, string | number>; parseRow: (fields: Record<string, string>, line: number) => { ok: true; row: ImportItem } | { ok: false; message: string } }`
  - `PageHeader` 新增可选 `onImport`/`onColumns`
  - `DataTable` 的 InlineEdit 保存时对 `nullOnEmpty` 列把 `''` 转 `null`

- [ ] **Step 1: 改 `components/crud/types.ts`**

`ColumnDef` 增加 `nullOnEmpty?: boolean;`；`CrudPageConfig` 更新为：

```ts
export interface CrudPageConfig {
  resource: ResourceKey;
  title: string;
  columns: ColumnDef[];
  filters?: { key: string; label: string; options: string[] }[];
  stats?: (rows: Row[]) => { label: string; value: number | string; tone?: string }[];
  defaultNewRow?: (rows: Row[]) => Record<string, string | number | null>;
  canDelete?: boolean;
  sortRows?: (a: Row, b: Row) => number;
  defaultHidden?: string[];
  importTemplate?: ImportTemplate;
}
```

文件顶部（在 `ResourceKey` import 后）追加（`ImportItem` 从 `@/lib/import` 引入类型）：

```ts
import type { ImportItem } from '@/lib/import';

export interface ImportTemplate {
  filename: string;
  columns: { key: string; label: string }[];
  exampleRow: Record<string, string | number>;
  parseRow: (fields: Record<string, string>, line: number) =>
    { ok: true; row: ImportItem } | { ok: false; message: string };
}
```

- [ ] **Step 2: 改 `components/ui/page-header.tsx`**

```ts
interface Props {
  title: string;
  onAdd?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onColumns?: () => void;
}
```

按钮区改为（顺序：☰ 列 / 导入 / 导出 / ＋新增）：

```tsx
<div className="flex gap-2">
  {onColumns && <button className="bg-white border border-slate-300 text-slate-600 rounded-md hover:bg-slate-50 transition-colors px-3 py-1.5 text-xs" onClick={onColumns}>☰ 列</button>}
  {onImport && <button className="bg-white border border-slate-300 text-slate-600 rounded-md hover:bg-slate-50 transition-colors px-3 py-1.5 text-xs" onClick={onImport}>导入</button>}
  {onExport && <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => { onExport(); toast('已导出'); }}>导出</button>}
  {onAdd && <button className="btn-primary px-3 py-1.5 text-xs" onClick={onAdd}>＋新增</button>}
</div>
```

- [ ] **Step 3: 改 `components/crud/data-table.tsx`**

把 `onSave` 改为：

```tsx
<InlineEdit
  value={r[c.key]}
  type={c.type}
  options={c.options}
  onSave={v => onUpdate(r.id as number, { [c.key]: c.nullOnEmpty && v === '' ? null : v })}
/>
```

- [ ] **Step 4: 创建 `components/crud/import-modal.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { parseCsv, toCsv } from '@/lib/csv';
import { post } from '@/lib/api-client';
import type { ImportItem } from '@/lib/import';
import type { ImportTemplate } from './types';
import Modal from '../ui/modal';

interface Result { created: number; updated: number; skipped: number; errors: { row: number; message: string }[] }

interface Props {
  resource: string;
  template: ImportTemplate;
  onClose: () => void;
  onDone: () => void;
}

export default function ImportModal({ resource, template, onClose, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  const downloadTemplate = () => {
    const headers = template.columns.map(c => c.label);
    const example = template.columns.map(c => template.exampleRow[c.key] ?? '');
    const csv = toCsv(headers, [example]);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = template.filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const text = await file.text();
      const table = parseCsv(text);
      if (table.length < 2) { setError('文件为空或只有表头'); return; }
      const headerIdx = new Map(table[0].map((h, i) => [h.trim(), i]));
      const items: ImportItem[] = [];
      const skipped: { row: number; message: string }[] = [];
      for (let i = 1; i < table.length; i++) {
        const fields: Record<string, string> = {};
        template.columns.forEach(c => {
          const idx = headerIdx.get(c.label);
          fields[c.key] = idx === undefined ? '' : (table[i][idx] ?? '').trim();
        });
        const parsed = template.parseRow(fields, i + 1);
        if (parsed.ok) items.push(parsed.row);
        else skipped.push({ row: i + 1, message: parsed.message });
      }
      const server = await post<Result>(`/api/${resource}/import`, { rows: items });
      setResult({
        created: server.created,
        updated: server.updated,
        skipped: server.skipped + skipped.length,
        errors: [...server.errors, ...skipped],
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="导入" open onClose={onClose}>
      <p className="text-xs text-slate-500 mb-3">按身份证匹配：已存在的身份证覆盖，新的新增；无身份证的行跳过。</p>
      <button className="btn-primary px-3 py-1.5 text-xs mb-3" onClick={downloadTemplate}>下载示例模板</button>
      {!result ? (
        <div>
          <input type="file" accept=".csv" onChange={handleFile} disabled={busy} className="text-xs" />
          {busy && <p className="text-xs text-slate-400 mt-2">导入中…</p>}
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>
      ) : (
        <div className="text-sm">
          <p className="mb-2">新增 {result.created} · 更新 {result.updated} · 跳过 {result.skipped}</p>
          {result.errors.length > 0 && (
            <ul className="text-xs text-amber-600 space-y-1 max-h-32 overflow-y-auto">
              {result.errors.map((er, idx) => (
                <li key={idx}>第 {er.row} 行：{er.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2 mt-4">
        <button className="bg-white border border-slate-300 text-slate-600 rounded-md hover:bg-slate-50 transition-colors px-4 py-1.5 text-sm" onClick={onClose}>完成</button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 5: 改 `components/crud/crud-page.tsx`**

把文件整体替换为（`relative` 根节点 + 列面板 + 导入弹窗 + 排序 + 可见列导出 + `defaultNewRow(rows)`）：

```tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import { Row } from '@/lib/types';
import { get, post, put, del } from '@/lib/api-client';
import { exportCsv } from '@/lib/csv';
import PageHeader from '../ui/page-header';
import { StatRow } from '../ui/stat-card';
import Modal from '../ui/modal';
import DataTable from './data-table';
import ImportModal from './import-modal';
import { useToast } from '../ui/toast';
import type { CrudPageConfig } from './types';

export default function CrudPage({ config }: { config: CrudPageConfig }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Record<string, string>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [importOpen, setImportOpen] = useState(false);
  const [colsOpen, setColsOpen] = useState(false);

  const storageKey = `gzt:cols:${config.resource}`;
  const [hidden, setHidden] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved) as string[];
    } catch { /* localStorage 不可用 */ }
    return config.defaultHidden ?? [];
  });
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(hidden)); } catch { /* ignore */ }
  }, [hidden, storageKey]);

  const load = () => {
    get<Row[]>(`/api/${config.resource}`)
      .then(r => { setRows(r); setLoading(false); })
      .catch(() => { setLoading(false); toast('加载失败', 'err'); });
  };
  useEffect(() => { load(); }, [config.resource]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const f = rows.filter(r =>
      Object.entries(filter).every(([k, v]) => !v || String(r[k]) === v)
    );
    return config.sortRows ? [...f].sort(config.sortRows) : f;
  }, [rows, filter, config.sortRows]);

  const visibleColumns = useMemo(
    () => config.columns.filter(c => !hidden.includes(c.key)),
    [config.columns, hidden]
  );

  const toggleCol = (key: string) => {
    setHidden(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const handleUpdate = async (id: number, patch: Partial<Row>) => {
    const prev = rows;
    setRows(rows.map(r => r.id === id ? ({ ...r, ...patch } as Row) : r));
    try {
      const updated = await put<Row>(`/api/${config.resource}/${id}`, patch);
      setRows(rows.map(r => r.id === id ? updated : r));
    } catch (e) {
      setRows(prev);
      throw e;
    }
  };

  const handleCreate = async () => {
    const defaults = config.defaultNewRow?.(rows) ?? {};
    const data: Partial<Row> = { ...defaults };
    for (const c of config.columns) {
      if (!c.readOnly && draft[c.key] !== undefined) {
        data[c.key] = c.nullOnEmpty && draft[c.key] === '' ? null : draft[c.key];
      }
    }
    try {
      const row = await post<Row>(`/api/${config.resource}`, data);
      setRows([...rows, row]);
      setAddOpen(false);
      setDraft({});
      toast('已新增');
    } catch { toast('新增失败', 'err'); }
  };

  const handleDelete = async (id: number) => {
    try { await del(`/api/${config.resource}/${id}`); setRows(rows.filter(r => r.id !== id)); toast('已删除'); }
    catch { toast('删除失败', 'err'); }
  };

  const onExport = () => exportCsv(filtered, visibleColumns, `${config.title}.csv`);

  return (
    <div className="relative">
      <PageHeader
        title={config.title}
        onAdd={() => setAddOpen(true)}
        onExport={onExport}
        onImport={config.importTemplate ? () => setImportOpen(true) : undefined}
        onColumns={() => setColsOpen(o => !o)}
      />
      {colsOpen && (
        <div className="absolute right-0 top-12 z-20 bg-white border border-slate-200 rounded-lg shadow-lg p-2 w-44">
          {config.columns.map(c => (
            <label key={c.key} className="flex items-center gap-2 px-2 py-1 text-xs text-slate-700 cursor-pointer">
              <input type="checkbox" checked={!hidden.includes(c.key)} onChange={() => toggleCol(c.key)} />
              {c.label}
            </label>
          ))}
        </div>
      )}
      {config.stats && <StatRow stats={config.stats(filtered)} />}
      {config.filters && (
        <div className="flex flex-wrap gap-2 mb-3">
          {config.filters.map(f => (
            <select key={f.key} value={filter[f.key] ?? ''} onChange={e => setFilter({ ...filter, [f.key]: e.target.value })}
              className="border border-slate-300 rounded-md px-2 py-1 text-xs bg-white">
              <option value="">全部{f.label}</option>
              {f.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}
        </div>
      )}
      {loading ? <div className="text-sm text-slate-400 py-8 text-center">加载中…</div> : (
        <DataTable rows={filtered} columns={visibleColumns} onUpdate={handleUpdate} onDelete={handleDelete} canDelete={config.canDelete ?? true} />
      )}

      <Modal title={`新增${config.title.replace(/管理$/, '')}`} open={addOpen} onClose={() => setAddOpen(false)}>
        <div className="grid grid-cols-2 gap-3">
          {config.columns.filter(c => !c.readOnly).map(c => (
            <label key={c.key} className="flex flex-col gap-1 text-xs text-slate-500">
              {c.label}
              {c.type === 'select' ? (
                <select className="border border-slate-300 rounded px-2 py-1.5 text-sm" value={draft[c.key] ?? ''}
                  onChange={e => setDraft({ ...draft, [c.key]: e.target.value })}>
                  <option value="">请选择</option>
                  {c.options?.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : c.type === 'textarea' ? (
                <textarea className="border border-slate-300 rounded px-2 py-1.5 text-sm" rows={2}
                  value={draft[c.key] ?? ''} onChange={e => setDraft({ ...draft, [c.key]: e.target.value })} />
              ) : (
                <input className="border border-slate-300 rounded px-2 py-1.5 text-sm"
                  type={c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'}
                  value={draft[c.key] ?? ''} onChange={e => setDraft({ ...draft, [c.key]: e.target.value })} />
              )}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-primary px-4 py-1.5 text-sm" onClick={handleCreate}>保存</button>
        </div>
      </Modal>

      {config.importTemplate && importOpen && (
        <ImportModal resource={config.resource} template={config.importTemplate} onClose={() => setImportOpen(false)} onDone={load} />
      )}
    </div>
  );
}
```

注意：`useEffect(() => { load(); }, [config.resource])` 中 `load` 引用了 `toast`，保持现有依赖方式即可。

- [ ] **Step 6: 构建 + 回归测试**

Run: `npm run build` 然后 `npm test`
Expected: 构建成功、全部测试通过。

- [ ] **Step 7: 提交**

```bash
git add components/crud/types.ts components/ui/page-header.tsx components/crud/data-table.tsx components/crud/import-modal.tsx components/crud/crud-page.tsx
git commit -m "feat: global column visibility and CSV import modal in CRUD pages"
```

---

### Task 6: 学生页接线

**Files:**
- Modify: `app/students/page.tsx`

**Interfaces:**
- Consumes: Task 5 的 `CrudPageConfig` 扩展（`sortRows`/`defaultHidden`/`importTemplate`/`defaultNewRow(rows)`/`nullOnEmpty`）、Task 2 的 `ImportItem`。
- Produces: 学生页完整配置（14 列、按学号排序、1–6 层次、导入模板）。

- [ ] **Step 1: 整体替换 `app/students/page.tsx`**

```tsx
'use client';
import CrudPage from '@/components/crud/crud-page';
import type { CrudPageConfig } from '@/components/crud/types';
import type { ImportItem } from '@/lib/import';

const nextNo = (rows: { student_no?: string | number | null }[]) =>
  String((rows.reduce((m, r) => Math.max(m, Number(r.student_no) || 0), 0) + 1)).padStart(2, '0');

const to01 = (s: string) => (s === '是' || s === '有' || s === '1' ? 1 : 0);

const config: CrudPageConfig = {
  resource: 'students',
  title: '学生管理',
  columns: [
    { key: 'student_no', label: '学号', width: '60px' },
    { key: 'name', label: '姓名', width: '90px' },
    { key: 'gender', label: '性别', type: 'select', options: ['男', '女'], width: '70px' },
    { key: 'parent_name', label: '家长姓名', width: '100px' },
    { key: 'parent_phone', label: '家长电话', type: 'tel', width: '130px' },
    { key: 'idcard', label: '身份证', nullOnEmpty: true, width: '160px' },
    { key: 'address', label: '住址', width: '160px' },
    { key: 'level', label: '学生层次', type: 'select', options: ['1', '2', '3', '4', '5', '6'], width: '90px' },
    { key: 'group_no', label: '小组', type: 'number', width: '70px' },
    { key: 'role', label: '班干部职务' },
    { key: 'noon_care', label: '中午托', type: 'select', options: ['1', '0'], width: '90px' },
    { key: 'breakfast', label: '早餐', type: 'select', options: ['1', '0'], width: '90px' },
    { key: 'afternoon_care', label: '下午托', type: 'select', options: ['1', '0'], width: '90px' },
    { key: 'remark', label: '备注', type: 'text' },
  ],
  defaultHidden: ['address', 'remark'],
  sortRows: (a, b) => (Number(a.student_no) || 0) - (Number(b.student_no) || 0),
  filters: [
    { key: 'gender', label: '性别', options: ['男', '女'] },
    { key: 'afternoon_care', label: '下午托', options: ['1', '0'] },
    { key: 'level', label: '层次', options: ['1', '2', '3', '4', '5', '6'] },
  ],
  stats: rows => [
    { label: '总人数', value: rows.length, tone: 'blue' },
    { label: '男生', value: rows.filter(r => r.gender === '男').length, tone: 'teal' },
    { label: '女生', value: rows.filter(r => r.gender === '女').length, tone: 'purple' },
    { label: '班干部', value: rows.filter(r => r.role).length, tone: 'amber' },
    { label: '重点关注(1档)', value: rows.filter(r => Number(r.level) === 1).length, tone: 'red' },
  ],
  defaultNewRow: rows => ({
    student_no: nextNo(rows),
    name: '新学生', gender: '男', parent_name: '', parent_phone: '', idcard: null,
    address: '', level: 4, group_no: 1, role: '', noon_care: 0, breakfast: 0,
    afternoon_care: 1, remark: '',
  }),
  importTemplate: {
    filename: '学生导入模板.csv',
    columns: [
      { key: 'student_no', label: '学号' },
      { key: 'name', label: '姓名' },
      { key: 'gender', label: '性别' },
      { key: 'parent_name', label: '家长姓名' },
      { key: 'parent_phone', label: '家长电话' },
      { key: 'idcard', label: '身份证' },
      { key: 'address', label: '住址' },
      { key: 'level', label: '学生层次' },
      { key: 'group_no', label: '小组' },
      { key: 'role', label: '班干部职务' },
      { key: 'noon_care', label: '中午托' },
      { key: 'breakfast', label: '早餐' },
      { key: 'afternoon_care', label: '下午托' },
      { key: 'remark', label: '备注' },
    ],
    exampleRow: { student_no: '46', name: '示例学生', gender: '男', parent_name: '示例家长', parent_phone: '13800000000', idcard: '430102201301010011', address: '青园街道示例小区', level: 4, group_no: 2, role: '语文课代表', noon_care: 1, breakfast: 0, afternoon_care: 1, remark: '' },
    parseRow: (f, line): { ok: true; row: ImportItem } | { ok: false; message: string } => {
      const lv = f['level'] === '' ? 4 : Number(f['level']);
      if (!Number.isInteger(lv) || lv < 1 || lv > 6) return { ok: false, message: '学生层次需为 1-6' };
      return {
        ok: true,
        row: {
          line,
          idcard: f['idcard'] ?? '',
          student_no: f['student_no'] ?? '',
          name: f['name'] ?? '',
          gender: f['gender'] || '男',
          parent_name: f['parent_name'] ?? '',
          parent_phone: f['parent_phone'] ?? '',
          address: f['address'] ?? '',
          level: lv,
          group_no: Number(f['group_no']) || 1,
          role: f['role'] ?? '',
          noon_care: to01(f['noon_care'] ?? ''),
          breakfast: to01(f['breakfast'] ?? ''),
          afternoon_care: f['afternoon_care'] === '0' ? 0 : 1,
          remark: f['remark'] ?? '',
        },
      };
    },
  },
};

export default function StudentsPage() {
  return <CrudPage config={config} />;
}
```

注意 `idcard` 列 `nullOnEmpty: true`：表格内联编辑与新增弹窗都会把空串转 `null`，多个空值不冲突。

- [ ] **Step 2: 构建 + 测试 + 手工验证**

Run: `npm run build`；`npm test`
Expected: 构建成功、全部测试通过。

然后手工验证（`npm run dev` 打开 http://localhost:3000/students）：
- 学生按学号升序；地址/备注列默认隐藏，「☰ 列」可勾选显示并跨刷新记忆。
- 新增学生学号自动 +1。
- 身份证填重复值保存 → toast「身份证已存在」。
- 导入：下载模板 → 填一条新身份证（新增）、一条已存在身份证改姓名（覆盖）、一条空身份证（跳过）→ 结果面板显示 新增1·更新1·跳过1，表格刷新。

- [ ] **Step 3: 提交**

```bash
git add app/students/page.tsx
git commit -m "feat: students page with new fields, sort, and import"
```

---

### Task 7: 全量验证与收尾

**Files:**（无新增代码）

- [ ] **Step 1: 全量测试 + 构建 + lint**

Run: `npm test`；`npm run build`；`npm run lint`
Expected: 全部通过。

- [ ] **Step 2: 跑一次重置自愈路径（可选冒烟）**

Run: `node -e "const {getDb}=require('./lib/db');getDb();console.log('ok')"`（若 node:sqlite 可用）
或：删除 `data/app.db*` 后 `npm run dev` 启动一次，确认自动重建新 schema 并播种。
Expected: 无报错，`data/app.db` 重建。

- [ ] **Step 3: 确认 git 干净并收尾**

Run: `git status --short`
Expected: 无未提交改动（若 `AGENTS.md` 被 `next dev` 重写，随本次一并提交以保持树干净）。
