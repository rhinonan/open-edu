# antd 组件库迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将前端组件层全量重写为 antd v6 原生写法（原生视觉），保留内联编辑交互与「编辑/完成」开关，数据层与通用 API 不动。

**Architecture:** 页面按 antd 原生 API 直写（每页自己的 `columns` + `<Table>` + Form 模态框），仅保留 3 个薄共享件：`EditableCell`（单元格内联编辑）、`TableToolbar`（新增/导出/导入/列显隐，含 `useColumnVisibility`）、`useResourceRows`（数据获取 + 乐观更新）。壳层改 antd `Layout`/`Menu`/`Drawer`。Tailwind 仅留做布局；antd 原生默认视觉。逐步替换、`npm run build` 全程保持绿，旧 `components/crud`、`components/ui` 在最后一轮统一删除。

**Tech Stack:** Next.js 16 App Router、React 19、antd v6、@ant-design/icons、@ant-design/nextjs-registry、dayjs、recharts、Tailwind v4、Vitest、TypeScript 严格模式。Node >= 22（本机 24）。

## Global Constraints

- 数据层 `lib/schema.ts`/`lib/store.ts`/`lib/seed.ts`/`lib/db.ts`/`lib/dashboard.ts`/`lib/import.ts`/`lib/api-client.ts` 与 `app/api/**` **一律不动**（`lib/csv.ts` 仅加 `downloadCsv`、最后一轮清理 `exportCsv`）。
- `tests/` vitest 测试不依赖 UI，保持通过：`npm test`。
- 每任务末尾验证 `npm run build` 通过（Next build 含 typecheck 与 lint）。旧 `components/crud`、`components/ui` 保留到最后一轮再删，任一任务不得让旧文件被提前删除而断链。
- 文案保持中文；全局中文经 `ConfigProvider locale={zhCN}` + `dayjs.locale('zh-cn')`。
- 内联编辑保存走 `PUT /api/{resource}/{id}`；`nullOnEmpty` 时空串转 `null`（如学生身份证）。
- 列显隐 localStorage 键沿用 `gzt:cols:{resource}`，不丢用户已保存设置。
- 提交信息沿用仓库前缀（`feat:`/`fix:`/`chore:`/`docs:`）。
- AGENTS.md 提示本项目 Next.js 有 breaking changes：不确定处先读 `node_modules/next/dist/docs/`；antd v6 若某组件 API 报错，以 `node_modules/antd/es/**/index.d.ts` 类型为准。
- 编辑行为受 `EditableContext`（`components/editable-context.tsx`）控制：`editable === false` 时单元格不可编辑。

## File Structure

**Create:**
- `lib/color-utils.ts` — 品类色映射（从 `components/ui/color-utils.ts` 复制）
- `lib/csv.ts:downloadCsv` — 导出下载助手（`toCsv` 已存在）
- `components/editable-cell.tsx` — 单元格内联编辑（antd 控件，点编辑/失焦回车保存）
- `components/table-toolbar.tsx` — 工具栏（新增/导出/导入/列显隐）+ `useColumnVisibility`
- `components/use-resource.ts` — `useResourceRows` 数据钩子（获取/乐观更新/新增/删除）

**Modify (rewrite):**
- `app/layout.tsx` — AntdRegistry + ConfigProvider(zhCN) + antd App
- `app/globals.css` — 保留 tailwind + body；删 `.card`/`.btn-primary`（最后一轮）
- `components/app-shell.tsx` — antd Layout 壳（重写）
- 17 个路由页 `app/*/page.tsx`（`/`、schedule、timetable、students、grades、homework、leaves、discipline、conversations、visits、evaluation、seats、parent-comm、safety、peiyou、work-logs、settings）

**Delete (last cleanup task):**
- `components/crud/*`、`components/ui/*`、`components/sidebar.tsx`、`components/topbar.tsx`、`components/dashboard/*`
- `lib/csv.ts` 中 `exportCsv` 及 `ColumnDef` 导入；`globals.css` 中 `.card`/`.btn-primary`
- package.json 中 `lucide-react`（在 Task 5）

**Dependencies:** 新增 `antd@^6`、`@ant-design/icons`、`@ant-design/nextjs-registry`、`dayjs`；移除 `lucide-react`（Task 5）。

---

### Task 1: 依赖安装与全局基建（layout / 主题 / dayjs）

**Files:**
- Modify: `package.json`
- Modify: `app/layout.tsx`

**Produces:** antd 环境就绪：`AntdRegistry` → `ConfigProvider`(zhCN) → antd `App`；`dayjs` 中文。后续所有组件依赖此布局。

- [ ] **Step 1: 安装依赖**

Run: `npm install antd@^6 @ant-design/icons @ant-design/nextjs-registry dayjs`（暂不删 lucide-react，旧侧边栏还在用）
Expected: install 成功；`package.json` 新增 4 个依赖。

- [ ] **Step 2: 重写 `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { App, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import './globals.css';
import AppShell from '@/components/app-shell';

dayjs.locale('zh-cn');

export const metadata: Metadata = {
  title: '班主任智慧工作台',
  description: '长沙小学六年级班主任智慧班级管理工作台',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdRegistry>
          <ConfigProvider locale={zhCN}>
            <App>
              <AppShell>{children}</AppShell>
            </App>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: 验证构建**

Run: `npm run build`
Expected: PASS（此时旧组件还在，build 应全绿）。

- [ ] **Step 4: 冒烟运行**

Run: `npm run dev`，打开 `http://localhost:3000`
Expected: 页面正常渲染（视觉仍旧 Tailwind 风，但 antd message/Modal 上下文已就绪）。Ctrl+C 结束。

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app/layout.tsx
git commit -m "feat: add antd v6, registry, and zh-CN layout shell"
```

---

### Task 2: `lib/color-utils.ts` 迁移 + `lib/csv.ts:downloadCsv` 助手

**Files:**
- Create: `lib/color-utils.ts`
- Modify: `lib/csv.ts`

**Interfaces:**
- Produces: `CategoryColor(kind: string): string`（逻辑同现）；`downloadCsv(filename, headers, rows)`。后续页面与 `TableToolbar` 使用。

- [ ] **Step 1: 新建 `lib/color-utils.ts`（复制 `components/ui/color-utils.ts`）**

```ts
const MAP: Record<string, string> = {
  '语文': '#3b82f6', '数学': '#8b5cf6', '英语': '#14b8a6', '科学': '#f59e0b',
  '体育': '#ef4444', '音乐': '#eab308', '美术': '#ec4899',
  '班级管理': '#3b82f6', '教学教研': '#8b5cf6', '家校沟通': '#f59e0b',
  '学生培优': '#ef4444', '生涯活动': '#14b8a6', '安全教育': '#eab308',
  '会议培训': '#6366f1', '心理辅导': '#ec4899',
  '备课': '#3b82f6', '教研': '#8b5cf6', '培优': '#ef4444',
  '监考': '#f59e0b', '会议': '#14b8a6',
};

export function CategoryColor(kind: string): string {
  return MAP[kind] ?? '#64748b';
}
```

- [ ] **Step 2: 在 `lib/csv.ts` 末尾追加 `downloadCsv`（保留现有 `exportCsv`/`parseCsv`/`toCsv` 不动）**

```ts
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const blob = new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 3: 验证构建**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add lib/color-utils.ts lib/csv.ts
git commit -m "feat: move category colors to lib and add downloadCsv helper"
```

---

### Task 3: `EditableCell` 内联编辑组件

**Files:**
- Create: `components/editable-cell.tsx`

**Interfaces:**
- Consumes: `useEditable()`（`./editable-context`）——`editable: boolean`；`App.useApp()` 取 `message`。
- Produces:
  - `type EditableType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'tel'`
  - `interface EditableCellProps { value: string | number | null; type?: EditableType; options?: string[]; nullOnEmpty?: boolean; onSave: (value: string | number | null) => Promise<void>; className?: string }`
  - `export default function EditableCell(props: EditableCellProps)`。父组件 `onSave` 需 `PUT` 后 resolve、失败 reject（`useResourceRows.update` 满足）。

契约：非编辑态显示值，空值显示 `—`；点按进入编辑；text/textarea/number 失焦或文本回车保存，select/date 变更即保存；`editable=false` 时禁用；保存失败 `message.error('保存失败')`。

- [ ] **Step 1: 编写组件**

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { App, DatePicker, Input, InputNumber, Select } from 'antd';
import dayjs from 'dayjs';
import { useEditable } from './editable-context';

export type EditableType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'tel';

interface Props {
  value: string | number | null;
  type?: EditableType;
  options?: string[];
  nullOnEmpty?: boolean;
  onSave: (value: string | number | null) => Promise<void>;
  className?: string;
}

export default function EditableCell({ value, type = 'text', options, nullOnEmpty, onSave, className }: Props) {
  const { editable } = useEditable();
  const { message } = App.useApp();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(String(value ?? ''));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  if (!editable || !editing) {
    const display = value === null || value === '' ? '—' : String(value);
    return (
      <span
        className={`block w-full px-1 py-0.5 rounded cursor-text ${editable ? 'hover:bg-gray-100' : 'cursor-default hover:bg-transparent'} ${className ?? ''}`}
        title={editable ? '点击编辑' : undefined}
        onClick={() => { if (editable) { setDraft(String(value ?? '')); setEditing(true); } }}
      >
        {display}
      </span>
    );
  }

  const cancel = () => setEditing(false);
  const save = async (v: string | number | null) => {
    setEditing(false);
    if (String(v) === String(value ?? '')) return;
    try { await onSave(v); }
    catch { message.error('保存失败'); }
  };
  const onBlurSave = () => {
    const final = type === 'number' ? (draft === '' ? 0 : Number(draft)) : (nullOnEmpty && draft === '' ? null : draft);
    void save(final);
  };
  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' && type !== 'textarea') { e.preventDefault(); void save(type === 'number' ? (draft === '' ? 0 : Number(draft)) : draft); }
    if (e.key === 'Escape') cancel();
  };

  if (type === 'select' && options) {
    return (
      <Select
        size="small" autoFocus open style={{ width: '100%' }}
        defaultValue={value ?? ''}
        options={options.map(o => ({ value: o, label: o }))}
        onChange={(v) => void save(v)}
      />
    );
  }
  if (type === 'date') {
    return (
      <DatePicker
        size="small" autoFocus style={{ width: '100%' }}
        value={value ? dayjs(String(value)) : null}
        onChange={(d) => void save(d ? d.format('YYYY-MM-DD') : '')}
      />
    );
  }
  if (type === 'textarea') {
    return (
      <Input.TextArea
        autoFocus rows={2} size="small" value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => void save(nullOnEmpty && draft === '' ? null : draft)}
        onKeyDown={onKey}
      />
    );
  }
  if (type === 'number') {
    return (
      <InputNumber
        autoFocus size="small" style={{ width: '100%' }}
        value={draft === '' ? null : Number(draft)}
        onChange={(v) => setDraft(v === null ? '' : String(v))}
        onBlur={onBlurSave}
        onPressEnter={() => void save(draft === '' ? 0 : Number(draft))}
      />
    );
  }
  return (
    <Input
      ref={inputRef} size="small" variant="borderless" value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={onBlurSave}
      onKeyDown={onKey}
    />
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add components/editable-cell.tsx
git commit -m "feat: editable inline-cell with antd controls"
```

---

### Task 4: `useResourceRows` 数据钩子 + `TableToolbar` 工具栏

**Files:**
- Create: `components/use-resource.ts`
- Create: `components/table-toolbar.tsx`

**Interfaces:**
- Consumes: `get/post/put/del` from `@/lib/api-client`；`ResourceKey`/`Row` from `@/lib/types`；`downloadCsv` from `@/lib/csv`。
- Produces:
  - `useResourceRows(resource: ResourceKey)` → `{ rows: Row[]; loading: boolean; reload: () => Promise<void>; update: (id, patch) => Promise<void>; create: (data) => Promise<Row>; remove: (id) => Promise<void> }`
  - `useColumnVisibility(storageKey, defaultHidden?)` → `{ hidden: Set<string>; toggle(key): void }`
  - `TableToolbar` props：`{ title; columns: ToolbarColumn[]; hidden; onToggleColumn; rows; onAdd?; onImport? }`，`ToolbarColumn = { key; label; exportable? }`

`update` 契约：乐观更新 → `PUT` → 服务端回包覆盖 → 失败回滚并 `throw`（供 `EditableCell` 显示错误）。

- [ ] **Step 1: 编写 `components/use-resource.ts`**

```ts
'use client';
import { useCallback, useEffect, useState } from 'react';
import { get, post, put, del } from '@/lib/api-client';
import type { ResourceKey, Row } from '@/lib/types';

export function useResourceRows(resource: ResourceKey) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    return get<Row[]>(`/api/${resource}`)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [resource]);

  useEffect(() => { void reload(); }, [reload]);

  const update = useCallback(async (id: number, patch: Partial<Row>) => {
    const snapshot = rows.filter(r => r.id === id)[0];
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    try {
      const u = await put<Row>(`/api/${resource}/${id}`, patch);
      setRows(prev => prev.map(r => r.id === id ? u : r));
    } catch (e) {
      if (snapshot) setRows(prev => prev.map(r => r.id === id ? snapshot : r));
      throw e;
    }
  }, [resource, rows]);

  const create = useCallback(async (data: Partial<Row>) => {
    const row = await post<Row>(`/api/${resource}`, data);
    setRows(prev => [...prev, row]);
    return row;
  }, [resource]);

  const remove = useCallback(async (id: number) => {
    await del(`/api/${resource}/${id}`);
    setRows(prev => prev.filter(r => r.id !== id));
  }, [resource]);

  return { rows, loading, reload, update, create, remove };
}
```

- [ ] **Step 2: 编写 `components/table-toolbar.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { Button, Checkbox, Dropdown, Space, Typography, Upload } from 'antd';
import { DownloadOutlined, PlusOutlined, SettingOutlined, UploadOutlined } from '@ant-design/icons';
import type { Row } from '@/lib/types';
import { downloadCsv } from '@/lib/csv';

export function useColumnVisibility(storageKey: string, defaultHidden: string[] = []) {
  const [hidden, setHidden] = useState<Set<string>>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
      if (Array.isArray(v)) return new Set(v);
    } catch { /* localStorage 不可用 */ }
    return new Set(defaultHidden);
  });
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify([...hidden])); } catch { /* ignore */ }
  }, [hidden, storageKey]);
  return {
    hidden,
    toggle: (key: string) => setHidden(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    }),
  };
}

export interface ToolbarColumn { key: string; label: string; exportable?: boolean; }

interface Props {
  title: string;
  columns: ToolbarColumn[];
  hidden: Set<string>;
  onToggleColumn: (key: string) => void;
  rows: Row[];
  onAdd?: () => void;
  onImport?: (text: string) => Promise<void>;
}

export default function TableToolbar({ title, columns, hidden, onToggleColumn, rows, onAdd, onImport }: Props) {
  const exportable = columns.filter(c => (c.exportable ?? true) && !hidden.has(c.key));
  const exportCsv = () => {
    downloadCsv(`${title}.csv`, exportable.map(c => c.label), rows.map(r => exportable.map(c => r[c.key] ?? '')));
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <Typography.Title level={4} style={{ margin: 0 }}>{title}</Typography.Title>
      <Space wrap>
        {onImport && (
          <Upload accept=".csv" showUploadList={false} beforeUpload={(file) => {
            const reader = new FileReader();
            reader.onload = () => { void onImport!(String(reader.result ?? '')); };
            reader.readAsText(file);
            return false;
          }}>
            <Button icon={<UploadOutlined />}>导入</Button>
          </Upload>
        )}
        <Button icon={<DownloadOutlined />} onClick={exportCsv}>导出</Button>
        <Dropdown trigger={['click']} menu={{ items: columns.map(c => ({
          key: c.key,
          label: (
            <Checkbox checked={!hidden.has(c.key)} onChange={() => onToggleColumn(c.key)} style={{ width: '100%' }}>
              {c.label}
            </Checkbox>
          ),
        })) }}>
          <Button icon={<SettingOutlined />}>列</Button>
        </Dropdown>
        {onAdd && <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>新增</Button>}
      </Space>
    </div>
  );
}
```

- [ ] **Step 3: 验证构建**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add components/use-resource.ts components/table-toolbar.tsx
git commit -m "feat: resource data hook and shared table toolbar"
```

---

### Task 5: antd 壳层（Layout / Menu / Drawer / Header）+ 编辑开关 + 移除 lucide-react

**Files:**
- Modify: `components/app-shell.tsx`（重写）
- Delete: `components/sidebar.tsx`、`components/topbar.tsx`
- Modify: `package.json`（卸载 lucide-react）

**Interfaces:**
- Consumes: `EditableProvider`/`useEditable`（`components/editable-context.tsx`，保留原样）；`App.useApp` 的 `message` 由各页面自理。
- Produces: 新 `AppShell`（antd `Layout`：桌面 `Sider` + 移动 `Drawer` + `Menu` + `Header`），菜单沿用 17 项路由，`selectedKeys` 高亮。
- `lucide-react` 此任务删净，后续页面不得再 import 它。

- [ ] **Step 1: 卸载 lucide-react**

Run: `npm uninstall lucide-react`
Expected: package.json 移除；旧 `sidebar.tsx`/`topbar.tsx` 下一步即删，build 不破。

- [ ] **Step 2: 删除旧壳**

Run: `rm components/sidebar.tsx components/topbar.tsx`

- [ ] **Step 3: 重写 `components/app-shell.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button, Drawer, Grid, Layout, Menu, Typography } from 'antd';
import {
  ArmchairOutlined, BarChartOutlined, CalendarOutlined, CommentOutlined,
  FileTextOutlined, FlagOutlined, HomeOutlined, LayoutDashboard,
  MessagesOutlined, MenuOutlined, NotebookOutlined, SafetyOutlined,
  SettingOutlined, StarOutlined, TeamOutlined, UserAddOutlined, UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { EditableProvider, useEditable } from './editable-context';

const MENU_ITEMS = [
  { key: '/', icon: <LayoutDashboard />, label: '仪表盘' },
  { key: '/schedule', icon: <CalendarOutlined />, label: '日程安排' },
  { key: '/timetable', icon: <CalendarOutlined />, label: '我的课表' },
  { key: '/students', icon: <TeamOutlined />, label: '学生管理' },
  { key: '/grades', icon: <BarChartOutlined />, label: '成绩分析' },
  { key: '/homework', icon: <NotebookOutlined />, label: '作业管理' },
  { key: '/leaves', icon: <UserAddOutlined />, label: '请假管理' },
  { key: '/discipline', icon: <FlagOutlined />, label: '违纪台账' },
  { key: '/conversations', icon: <CommentOutlined />, label: '谈话记录' },
  { key: '/visits', icon: <HomeOutlined />, label: '生涯家访' },
  { key: '/evaluation', icon: <StarOutlined />, label: '综合素质评价' },
  { key: '/seats', icon: <ArmchairOutlined />, label: '排座位' },
  { key: '/parent-comm', icon: <MessagesOutlined />, label: '家校沟通' },
  { key: '/safety', icon: <SafetyOutlined />, label: '安全台账' },
  { key: '/peiyou', icon: <UserOutlined />, label: '培优临界生' },
  { key: '/work-logs', icon: <FileTextOutlined />, label: '工作留痕' },
  { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
];

function ShellHeader({ onOpenDrawer, mobile }: { onOpenDrawer: () => void; mobile: boolean }) {
  const { editable, toggle } = useEditable();
  const [now, setNow] = useState('');
  const [className, setClassName] = useState('');
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then((rows: { key: string; value: string }[]) => {
      const c = rows.find(r => r.key === 'class_name');
      if (c) setClassName(c.value);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    const tick = () => setNow(dayjs().format('YYYY-MM-DD HH:mm:ss'));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <Layout.Header style={{ background: '#fff', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f0f0f0' }}>
      <Button type="text" icon={<MenuOutlined />} onClick={onOpenDrawer} style={{ display: mobile ? undefined : 'none' }} aria-label="打开菜单" />
      <Typography.Text strong>{className || '班级工作台'}</Typography.Text>
      <div style={{ flex: 1 }} />
      <Typography.Text type="secondary" style={{ fontSize: 12, display: mobile ? 'none' : undefined }}>{now}</Typography.Text>
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

  const menu = (
    <Menu
      mode="inline"
      style={{ borderInlineEnd: 0, height: '100%' }}
      selectedKeys={[pathname]}
      items={MENU_ITEMS}
      onClick={({ key }) => { router.push(key); setDrawerOpen(false); }}
    />
  );

  return (
    <EditableProvider>
      <Layout style={{ minHeight: '100vh' }}>
        {mobile ? (
          <Drawer placement="left" width={220} closable={false} open={drawerOpen} onClose={() => setDrawerOpen(false)} styles={{ body: { padding: 0 } }}>
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
          <Layout.Content style={{ padding: 16, width: '100%', maxWidth: 1152, margin: '0 auto' }}>
            {children}
          </Layout.Content>
        </Layout>
      </Layout>
    </EditableProvider>
  );
}
```

注：若 antd v6 对个别图标导出名报错，以 `@ant-design/icons` 实际导出为准替换。`Layout` 需从 `antd` 默认导入（含 Sider/Header/Content 子组件）。

- [ ] **Step 4: 验证构建**

Run: `npm run build`
Expected: PASS；`grep -r "lucide-react" app components` 无命中。

- [ ] **Step 5: 冒烟运行**

Run: `npm run dev`，检查桌面侧边栏菜单可跳转、顶栏时钟与「编辑/完成」按钮工作、缩窄窗口时 Sider 变 Drawer。
Expected: 无误；Ctrl+C 结束。

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json components/app-shell.tsx
git rm components/sidebar.tsx components/topbar.tsx
git commit -m "feat: antd layout shell with sider/drawer menu and edit toggle"
```

---

### Task 6: 仪表盘 `/`（Statistic 卡 + 快捷操作 + QuickAdd 弹窗）

**Files:**
- Modify: `app/page.tsx`（重写）
- Delete: `components/dashboard/stats-grid.tsx`、`components/dashboard/quick-actions.tsx`

**Interfaces:**
- Consumes: `get/post` from `@/lib/api-client`；`DashboardStats`/`ResourceKey` from `@/lib/types`。
- Produces: 首页 8 张统计卡 + 快捷操作九宫格 + QuickAdd 弹窗（记违纪/布置作业/请假登记/谈心谈话/添加待办/发布家校通知/家访记录，`POST /api/{resource}`）。

- [ ] **Step 1: 重写 `app/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { App, Button, Card, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select, Statistic } from 'antd';
import { PlusCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { get, post } from '@/lib/api-client';
import type { DashboardStats, ResourceKey } from '@/lib/types';

const fmt = (n: number) => n.toLocaleString('zh-CN');

interface FieldDef { key: string; label: string; type?: 'text' | 'number' | 'date'; }
interface QuickDef { label: string; href?: string; quick?: { resource: ResourceKey; title: string; fields: FieldDef[] } }

const QUICK: QuickDef[] = [
  { label: '记违纪', quick: { resource: 'discipline_records', title: '记违纪', fields: [{ key: 'student_name', label: '学生' }, { key: 'category', label: '类别' }, { key: 'content', label: '违纪内容' }, { key: 'action', label: '处理方式' }] } },
  { label: '布置作业', quick: { resource: 'homework', title: '布置作业', fields: [{ key: 'subject', label: '学科' }, { key: 'assign_date', label: '布置日期', type: 'date' }, { key: 'requirement', label: '作业要求' }, { key: 'deadline', label: '截止时间', type: 'date' }] } },
  { label: '请假登记', quick: { resource: 'leave_records', title: '请假登记', fields: [{ key: 'student_name', label: '学生' }, { key: 'leave_type', label: '假别' }, { key: 'reason', label: '事由' }, { key: 'start_date', label: '开始日期', type: 'date' }, { key: 'end_date', label: '结束日期', type: 'date' }] } },
  { label: '工作留痕', href: '/work-logs' },
  { label: '谈心谈话', quick: { resource: 'conversations', title: '谈心谈话', fields: [{ key: 'student_name', label: '学生' }, { key: 'topic', label: '主题' }, { key: 'content', label: '内容' }, { key: 'effect', label: '效果' }] } },
  { label: '录入成绩', href: '/grades' },
  { label: '添加待办', quick: { resource: 'todos', title: '添加待办', fields: [{ key: 'title', label: '事项' }, { key: 'date', label: '日期', type: 'date' }, { key: 'priority', label: '优先级' }] } },
  { label: '发布家校通知', quick: { resource: 'parent_comm', title: '家校沟通', fields: [{ key: 'student_name', label: '学生/对象' }, { key: 'way', label: '方式' }, { key: 'content', label: '内容' }] } },
  { label: '日程安排', href: '/schedule' },
  { label: '班级排位', href: '/seats' },
  { label: '学生档案', href: '/students' },
  { label: '家访记录', quick: { resource: 'home_visits', title: '家访记录', fields: [{ key: 'student_name', label: '学生' }, { key: 'way', label: '方式' }, { key: 'content', label: '内容' }] } },
];

export default function HomePage() {
  const { message } = App.useApp();
  const [s, setS] = useState<DashboardStats | null>(null);
  const [active, setActive] = useState<QuickDef | null>(null);
  const [form] = Form.useForm();

  useEffect(() => { get<DashboardStats>('/api/dashboard').then(setS).catch(() => {}); }, []);

  const submit = async () => {
    if (!active?.quick) return;
    try {
      const v = await form.validateFields();
      const body: Record<string, string | number | null> = {};
      for (const f of active.quick.fields) {
        const val = v[f.key];
        body[f.key] = f.type === 'date' ? (val ? (val as dayjs.Dayjs).format('YYYY-MM-DD') : '') : (val ?? '');
      }
      await post(`/api/${active.quick.resource}`, body);
      message.success('已记录');
      setActive(null); form.resetFields();
    } catch { /* 表单校验或请求失败 */ }
  };

  const cards = [
    { title: '班级人数', value: s ? `${s.studentCount} 人` : '—', suffix: s ? `男${s.maleCount}/女${s.femaleCount}` : '' },
    { title: '当日请假', value: s ? `${s.todayLeaves} 人` : '—', suffix: '' },
    { title: '本周常规违纪', value: s ? `${s.weekDiscipline} 条` : '—', suffix: '' },
    { title: '待办事项', value: s ? `${s.todoPending} 项` : '—', suffix: '' },
    { title: '作业收缴率', value: s ? `${s.homeworkSubmitRate}%` : '—', suffix: '' },
    { title: '最近单元测平均分', value: s && s.latestExamAvg != null ? `${s.latestExamAvg} 分` : '—', suffix: '' },
    { title: '本月工作留痕', value: s ? `${fmt(s.monthWorkLogs)} 条` : '—', suffix: '' },
    { title: '家校沟通', value: s ? `家访${s.homeVisitCount} 次` : '—', suffix: s ? `家长会${s.parentMeetingCount} 场 / 沟通率${s.parentMeetingRate}%` : '' },
  ];

  return (
    <div>
      <Row gutter={[12, 12]} className="mb-5">
        {cards.map(c => (
          <Col xs={12} md={6} key={c.title}>
            <Card size="small" style={{ height: '100%' }}>
              <Statistic title={c.title} value={c.value} suffix={c.suffix} />
            </Card>
          </Col>
        ))}
      </Row>
      <Card size="small">
        <h3 className="mb-3 font-semibold text-slate-600" style={{ marginTop: 0 }}>快捷操作</h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {QUICK.map(t => t.href ? (
            <Link key={t.label} href={t.href}>
              <Button block style={{ height: 56 }}>{t.label}</Button>
            </Link>
          ) : (
            <Button key={t.label} block style={{ height: 56 }} icon={<PlusCircleOutlined />}
              onClick={() => { setActive(t); form.resetFields(); }}>
              {t.label}
            </Button>
          ))}
        </div>
      </Card>

      <Modal title={active?.quick?.title ?? '快速新增'} open={!!active} onCancel={() => setActive(null)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          {active?.quick?.fields.map(f => (
            <Form.Item key={f.key} name={f.key} label={f.label} rules={f.key === 'student_name' || f.key === 'title' ? [{ required: true, message: `请填写${f.label}` }] : undefined}
              initialValue={f.type === 'date' ? dayjs() : undefined}>
              {f.type === 'date' ? <DatePicker style={{ width: '100%' }} />
                : f.type === 'number' ? <InputNumber style={{ width: '100%' }} />
                : <Input />}
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 删除旧仪表盘组件**

Run: `rm components/dashboard/stats-grid.tsx components/dashboard/quick-actions.tsx`

- [ ] **Step 3: 验证构建**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 4: 冒烟运行**

Run: `npm run dev`，`/`：8 张统计卡渲染；点一个 quick（如「记违纪」）填学生名保存，去 `/discipline` 能看到新纪录。
Expected: 正常；Ctrl+C 结束。

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git rm components/dashboard/stats-grid.tsx components/dashboard/quick-actions.tsx
git commit -m "feat: rewrite dashboard with antd statistic cards and quick actions"
```

---

### Task 7: 学生管理 `/students`（内联编辑 + 导入 + 排序 + 列显隐）

**Files:**
- Modify: `app/students/page.tsx`（重写）

**Interfaces:**
- Consumes: `useResourceRows('students')`、`EditableCell`、`TableToolbar`/`useColumnVisibility`、`parseCsv`（`@/lib/csv`）、`post`（`@/lib/api-client`）、`ImportItem`（`@/lib/import`）。
- 导入 `parseRow` 逻辑照抄现 `config.importTemplate.parseRow`；`idcard` 列 `nullOnEmpty`。

- [ ] **Step 1: 重写 `app/students/page.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { App, Button, Form, Input, InputNumber, Modal, Select, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import type { Row } from '@/lib/types';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import TableToolbar, { useColumnVisibility } from '@/components/table-toolbar';
import { parseCsv } from '@/lib/csv';
import { post } from '@/lib/api-client';
import type { ImportItem } from '@/lib/import';

const LEVELS = ['1', '2', '3', '4', '5', '6'];
const TOOLBAR_COLS = [
  { key: 'student_no', label: '学号' }, { key: 'name', label: '姓名' },
  { key: 'gender', label: '性别' }, { key: 'parent_name', label: '家长姓名' },
  { key: 'parent_phone', label: '家长电话' }, { key: 'idcard', label: '身份证' },
  { key: 'address', label: '住址' }, { key: 'level', label: '学生层次' },
  { key: 'group_no', label: '小组' }, { key: 'role', label: '班干部职务' },
  { key: 'noon_care', label: '中午托' }, { key: 'breakfast', label: '早餐' },
  { key: 'afternoon_care', label: '下午托' }, { key: 'remark', label: '备注' },
];

const to01 = (s: string) => (s === '是' || s === '有' || s === '1' ? 1 : 0);

function parseRow(f: Record<string, string>, line: number): { ok: true; row: ImportItem } | { ok: false; message: string } {
  const lv = f['level'] === '' ? 4 : Number(f['level']);
  if (!Number.isInteger(lv) || lv < 1 || lv > 6) return { ok: false, message: '学生层次需为 1-6' };
  return {
    ok: true,
    row: {
      line, idcard: f['idcard'] ?? '', student_no: f['student_no'] ?? '', name: f['name'] ?? '',
      gender: f['gender'] || '男', parent_name: f['parent_name'] ?? '', parent_phone: f['parent_phone'] ?? '',
      address: f['address'] ?? '', level: lv, group_no: Number(f['group_no']) || 1,
      role: f['role'] ?? '', noon_care: to01(f['noon_care'] ?? ''), breakfast: to01(f['breakfast'] ?? ''),
      afternoon_care: to01(f['afternoon_care'] ?? ''), remark: f['remark'] ?? '',
    },
  };
}

export default function StudentsPage() {
  const { message } = App.useApp();
  const { rows, loading, update, create, remove } = useResourceRows('students');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:students', ['address', 'remark']);
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();

  const columns: TableColumnsType<Row> = useMemo(() => {
    const cols = TOOLBAR_COLS.filter(col => !hidden.has(col.key)).map(col => {
      const selectCol = col.key === 'gender' || col.key === 'level' || col.key === 'noon_care' || col.key === 'breakfast' || col.key === 'afternoon_care';
      const options = col.key === 'gender' ? ['男', '女']
        : col.key === 'level' ? LEVELS
        : (col.key === 'noon_care' || col.key === 'breakfast' || col.key === 'afternoon_care') ? ['1', '0'] : undefined;
      return {
        title: col.label,
        dataIndex: col.key,
        width: col.key === 'address' ? 180 : undefined,
        sorter: col.key === 'student_no' ? (a: Row, b: Row) => (Number(a.student_no) || 0) - (Number(b.student_no) || 0) : undefined,
        filters: col.key === 'gender' ? [{ text: '男', value: '男' }, { text: '女', value: '女' }]
          : col.key === 'level' ? LEVELS.map(v => ({ text: v, value: v }))
          : col.key === 'afternoon_care' ? [{ text: '1', value: '1' }, { text: '0', value: '0' }]
          : undefined,
        onFilter: selectCol && options ? (v: unknown, r: Row) => String(r[col.key]) === String(v) : undefined,
        render: (_: unknown, r: Row) => (
          <EditableCell
            value={r[col.key]}
            type={selectCol ? 'select' : col.key === 'parent_phone' ? 'tel' : col.key === 'remark' ? 'textarea' : 'text'}
            options={options}
            nullOnEmpty={col.key === 'idcard'}
            onSave={v => update(r.id as number, { [col.key]: v })}
          />
        ),
      };
    });
    return [
      ...cols,
      {
        title: '操作', key: 'op', width: 64, fixed: 'right', exportable: false,
        render: (_: unknown, r: Row) => (
          <Button type="link" danger size="small" onClick={async () => {
            try { await remove(r.id as number); message.success('已删除'); } catch { message.error('删除失败'); }
          }}>删除</Button>
        ),
      },
    ];
  }, [hidden, update, remove, message]);

  const onImport = async (text: string) => {
    const table = parseCsv(text);
    if (table.length < 2) { message.warning('文件为空或只有表头'); return; }
    const headerIdx = new Map(table[0].map((h, i) => [h.trim(), i]));
    const items: ImportItem[] = [];
    const skipped: { row: number; message: string }[] = [];
    table.slice(1).forEach((row, idx) => {
      const fields: Record<string, string> = {};
      TOOLBAR_COLS.forEach(col => {
        const i = headerIdx.get(col.label);
        fields[col.key] = i === undefined ? '' : (row[i] ?? '').trim();
      });
      const parsed = parseRow(fields, idx + 2);
      if (parsed.ok) items.push(parsed.row);
      else skipped.push({ row: idx + 2, message: parsed.message });
    });
    try {
      const res = await post<{ created: number; updated: number; skipped: number; errors: { row: number; message: string }[] }>('/api/students/import', { rows: items });
      const errs = [...res.errors, ...skipped];
      if (errs.length) message.warning(`新增 ${res.created} · 更新 ${res.updated} · 跳过 ${res.skipped + skipped.length}（${errs[0].row}行: ${errs[0].message} 等）`);
      else message.success(`新增 ${res.created} · 更新 ${res.updated}`);
    } catch { message.error('导入失败'); }
  };

  const submit = async () => {
    try {
      const v = await form.validateFields();
      await create(v);
      message.success('已新增');
      setAddOpen(false); form.resetFields();
    } catch { /* 校验/请求失败 */ }
  };

  return (
    <div>
      <TableToolbar title="学生管理" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} onImport={onImport} />
      <Table<Row> rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle" pagination={{ pageSize: 10, showSizeChanger: false }} scroll={{ x: 'max-content' }} />
      <Modal title="新增学生" open={addOpen} onCancel={() => setAddOpen(false)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="student_no" label="学号"><Input /></Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}><Input /></Form.Item>
          <Form.Item name="gender" label="性别" initialValue="男"><Select options={['男', '女'].map(v => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item name="parent_name" label="家长姓名"><Input /></Form.Item>
          <Form.Item name="parent_phone" label="家长电话"><Input /></Form.Item>
          <Form.Item name="idcard" label="身份证"><Input /></Form.Item>
          <Form.Item name="address" label="住址"><Input /></Form.Item>
          <Form.Item name="level" label="学生层次" initialValue={4}><InputNumber min={1} max={6} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="group_no" label="小组" initialValue={1}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="role" label="班干部职务"><Input /></Form.Item>
          <Form.Item name="noon_care" label="中午托" initialValue={0}><Select options={[{ value: 1, label: '是' }, { value: 0, label: '否' }]} /></Form.Item>
          <Form.Item name="breakfast" label="早餐" initialValue={0}><Select options={[{ value: 1, label: '是' }, { value: 0, label: '否' }]} /></Form.Item>
          <Form.Item name="afternoon_care" label="下午托" initialValue={1}><Select options={[{ value: 1, label: '是' }, { value: 0, label: '否' }]} /></Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 3: 冒烟运行**

Run: `npm run dev`，`/students`：① 清空身份证后失焦存为 null 再输入不冲突；② 学号列可排序；③ 性别/层次列筛选；④ 下载模板、改一行上传应提示新增/更新；⑤ 删除某行。
Expected: 全通过；Ctrl+C 结束。

- [ ] **Step 4: Commit**

```bash
git add app/students/page.tsx
git commit -m "feat: rewrite students page with antd table, import, and sort"
```

---

### Task 8: 日程安排 `/schedule`（卡片列表 + 完成勾选 + 内联编辑 + 新增）

**Files:**
- Modify: `app/schedule/page.tsx`（重写）

**Interfaces:**
- Consumes: `useResourceRows('schedules')`、`EditableCell`、`CategoryColor`（`@/lib/color-utils`）。
- 保留：按类型 `Segmented` 筛选、完成勾选、标题/日期/时长内联编辑、新增弹窗。

- [ ] **Step 1: 重写 `app/schedule/page.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { App, Button, Card, Checkbox, DatePicker, Form, Input, InputNumber, Modal, Segmented, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { Row } from '@/lib/types';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import { CategoryColor } from '@/lib/color-utils';
import dayjs from 'dayjs';

const TYPE_OPTS = ['全部', '备课', '教研', '培优', '监考', '会议', '其他'];
const COUNT_TYPES = ['备课', '教研', '培优', '监考', '会议'];

export default function SchedulePage() {
  const { message } = App.useApp();
  const { rows, loading, update, create } = useResourceRows('schedules');
  const [filter, setFilter] = useState('全部');
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();

  const filtered = useMemo(() => rows.filter(r => filter === '全部' || r.type === filter), [rows, filter]);

  const toggleDone = async (r: Row) => {
    const next = r.done == 1 ? 0 : 1;
    try { await update(r.id as number, { done: next }); }
    catch { message.error('保存失败'); }
  };

  const submit = async () => {
    try {
      const v = await form.validateFields();
      await create({
        date: v.date ? v.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        title: v.title ?? '', type: v.type ?? '备课', duration_min: Number(v.duration_min) || 60, done: 0,
      });
      message.success('已新增');
      setAddOpen(false); form.resetFields();
    } catch { /* 校验/请求失败 */ }
  };

  const stats = useMemo(() => [
    { label: '全部任务', value: rows.length },
    ...COUNT_TYPES.map(t => ({ label: t, value: rows.filter(r => r.type === t).length })),
  ], [rows]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <Typography.Title level={4} style={{ margin: 0 }}>日程安排</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>新增</Button>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
        {stats.map(s => (
          <Card key={s.label} size="small"><div className="text-xs text-slate-500">{s.label}</div><div className="text-xl font-semibold mt-0.5">{s.value}</div></Card>
        ))}
      </div>
      <Segmented options={TYPE_OPTS} value={filter} onChange={(v) => setFilter(String(v))} className="mb-4" />
      {loading ? <Card loading /> : (
        <div className="space-y-2">
          {filtered.map(r => (
            <Card key={r.id} size="small" className={r.done == 1 ? 'opacity-60' : ''}>
              <div className="flex items-center gap-3">
                <Checkbox checked={r.done == 1} onChange={() => void toggleDone(r)} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">
                    <EditableCell value={r.title} onSave={v => update(r.id as number, { title: v })} />
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                    <span style={{ color: CategoryColor(String(r.type)) }}>{String(r.type)}</span>
                    <EditableCell value={r.date} type="date" onSave={v => update(r.id as number, { date: v })} />
                  </div>
                </div>
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  <EditableCell value={r.duration_min} type="number" onSave={v => update(r.id as number, { duration_min: v })} />
                  <span className="ml-0.5">分钟</span>
                </span>
              </div>
            </Card>
          ))}
          {filtered.length === 0 && <Card size="small"><div className="py-6 text-center text-slate-400">暂无日程</div></Card>}
        </div>
      )}
      <Modal title="新增日程" open={addOpen} onCancel={() => setAddOpen(false)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}><Input /></Form.Item>
          <Form.Item name="date" label="日期" initialValue={dayjs()}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="duration_min" label="时长(分钟)" initialValue={60}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="type" label="类型" initialValue="备课"><Segmented options={COUNT_TYPES.concat('其他')} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add app/schedule/page.tsx
git commit -m "feat: rewrite schedule page with antd cards and segmented filter"
```

---

### Task 9: 我的课表 `/timetable`（网格 + 内联选课 + 统计 + 图表）

**Files:**
- Modify: `app/timetable/page.tsx`（重写）

**Interfaces:**
- Consumes: `useResourceRows('timetable')`、`EditableCell`。
- 保序逻辑：`weekday` 内按行序排 `period` 槽位，`grid.get(\`${wd}-${pos}\`)`。

- [ ] **Step 1: 重写 `app/timetable/page.tsx`**

```tsx
'use client';
import { useMemo } from 'react';
import { Card, Typography } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useResourceRows } from '@/components/use-resource';
import type { Row } from '@/lib/types';
import EditableCell from '@/components/editable-cell';

const DAYS = ['周一', '周二', '周三', '周四', '周五'];
const PERIODS = ['早读', '正课', '正课', '正课', '中午托', '下午托'];
const SUBJECTS = ['语文', '数学', '英语', '科学', '道德与法治', '体育', '音乐', '美术', '班会', '劳动', '自习', ''];

export default function TimetablePage() {
  const { rows, loading, update } = useResourceRows('timetable');

  const grid = useMemo(() => {
    const m = new Map<string, Row>();
    const pos = new Map<number, number>();
    for (const r of rows) {
      const wd = Number(r.weekday);
      const p = pos.get(wd) ?? 0;
      pos.set(wd, p + 1);
      m.set(`${wd}-${p}`, r);
    }
    return m;
  }, [rows]);

  const stats = useMemo(() => ({
    total: rows.length,
    chinese: rows.filter(r => r.is_chinese == 1).length,
  }), [rows]);

  const bySubject = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(String(r.subject), (m.get(String(r.subject)) ?? 0) + 1);
    return [...m.entries()].map(([name, 课时]) => ({ name, 课时 })).filter(d => d.name);
  }, [rows]);

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>我的课表</Typography.Title>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card size="small"><div className="text-xs text-slate-500">每周总课时</div><div className="text-xl font-semibold mt-0.5">{stats.total}</div></Card>
        <Card size="small"><div className="text-xs text-slate-500">语文任教课时</div><div className="text-xl font-semibold mt-0.5 text-blue-600">{stats.chinese}</div></Card>
      </div>
      <Card size="small" className="overflow-x-auto mb-4" loading={loading}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-xs text-slate-500">
              <th className="px-2 py-2 text-left border-b border-gray-200">时段</th>
              {DAYS.map(d => <th key={d} className="px-2 py-2 border-b border-gray-200">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((period, i) => (
              <tr key={i}>
                <td className="px-2 py-2 border-b border-gray-100 text-xs text-slate-500 whitespace-nowrap">{period}{i > 0 && i < 4 ? i : ''}</td>
                {DAYS.map(d => {
                  const key = `${DAYS.indexOf(d) + 1}-${i}`;
                  const r = grid.get(key);
                  if (!r) return <td key={key} className="px-2 py-2 border-b border-gray-100" />;
                  const chinese = r.is_chinese == 1;
                  return (
                    <td key={key} className={`px-2 py-2 border-b border-gray-100 text-center ${chinese ? 'bg-blue-50' : ''}`}>
                      <EditableCell
                        value={r.subject}
                        type="select"
                        options={SUBJECTS}
                        onSave={v => update(r.id as number, { subject: v, is_chinese: v === '语文' ? 1 : 0 })}
                        className={chinese ? 'text-blue-700 font-medium' : 'text-slate-700'}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
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
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add app/timetable/page.tsx
git commit -m "feat: rewrite timetable with antd and keep grid editing"
```

---

### Task 10: 成绩分析 `/grades`（统计卡 + 直方图 + 内联分数编辑）

**Files:**
- Modify: `app/grades/page.tsx`（重写）

**Interfaces:**
- Consumes: `useResourceRows('grades')`、`EditableCell`、`CategoryColor`。
- 行为：考试下拉（无选择时取最近一次）+ 学科 Segmented；统计 `{ 平均分, 及格率, 优秀率, 最高/最低 }`；直方图分档；右表内联可改分数。

- [ ] **Step 1: 重写 `app/grades/page.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { Card, Segmented, Select, Statistic, Typography } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Row } from '@/lib/types';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import { CategoryColor } from '@/lib/color-utils';

const SUBJECTS = ['语文', '数学', '英语'];

export default function GradesPage() {
  const { rows, loading, update } = useResourceRows('grades');
  const [exam, setExam] = useState<string | undefined>(undefined);
  const [subject, setSubject] = useState('语文');

  const exams = useMemo(() => [...new Set(rows.map(r => String(r.exam_name)))], [rows]);
  const latestExam = useMemo(() => exams[exams.length - 1] ?? '', [exams]);
  const currentExam = exam ?? latestExam;

  const current = useMemo(() =>
    rows.filter(r => r.exam_name === currentExam && r.subject === subject),
    [rows, currentExam, subject]);

  const stats = useMemo(() => {
    const scores = current.map(r => Number(r.score));
    if (scores.length === 0) return [];
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const pass = Math.round((scores.filter(s => s >= 60).length / scores.length) * 1000) / 10;
    const good = Math.round((scores.filter(s => s >= 85).length / scores.length) * 1000) / 10;
    return [
      { title: '平均分', value: avg.toFixed(1) },
      { title: '及格率', value: `${pass}%` },
      { title: '优秀率(≥85)', value: `${good}%` },
      { title: '最高/最低', value: `${Math.max(...scores)} / ${Math.min(...scores)}` },
    ];
  }, [current]);

  const histogram = useMemo(() => {
    const bins = [
      { label: '<60', min: 0, max: 59 }, { label: '60-69', min: 60, max: 69 },
      { label: '70-79', min: 70, max: 79 }, { label: '80-89', min: 80, max: 89 },
      { label: '90-100', min: 90, max: 100 },
    ];
    return bins.map(b => ({ name: b.label, 人数: current.filter(r => { const s = Number(r.score); return s >= b.min && s <= b.max; }).length }));
  }, [current]);

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>成绩分析</Typography.Title>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select style={{ width: 200 }} value={currentExam} onChange={setExam} options={exams.map(e => ({ value: e, label: e || '未命名考试' }))} />
        <Segmented options={SUBJECTS} value={subject} onChange={(v) => setSubject(String(v))} />
      </div>
      {loading ? <Card loading /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {stats.map(s => <Card key={s.title} size="small"><Statistic title={s.title} value={s.value} /></Card>)}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Card size="small"><h3 className="mb-3 text-sm font-semibold text-slate-600" style={{ marginTop: 0 }}>分数段分布（直方图）</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histogram}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="人数" fill={CategoryColor(subject)} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card size="small"><h3 className="mb-3 text-sm font-semibold text-slate-600" style={{ marginTop: 0 }}>成绩明细（点击可改）</h3>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-slate-500">
                    <tr><th className="px-3 py-2 text-left font-medium border-b border-gray-200">姓名</th><th className="px-3 py-2 text-left font-medium border-b border-gray-200">分数</th></tr>
                  </thead>
                  <tbody>
                    {current.map(r => (
                      <tr key={r.id} className="border-b border-gray-100">
                        <td className="px-3 py-1.5">{r.student_name}</td>
                        <td className="px-3 py-1.5"><EditableCell value={r.score} type="number" onSave={v => update(r.id as number, { score: v })} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add app/grades/page.tsx
git commit -m "feat: rewrite grades page with statistic cards and inline scores"
```

---

### Task 11: 作业管理 `/homework`（进度条 + 录收缴弹窗 + 统计）

**Files:**
- Modify: `app/homework/page.tsx`（重写）

**Interfaces:**
- Consumes: `useResourceRows('homework')`、`EditableCell`。
- 保留：`Progress` 进度条列；「录入收缴」Modal（submitted/late/missing 三个 InputNumber，`update` 保存）。

- [ ] **Step 1: 重写 `app/homework/page.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { App, Button, Card, DatePicker, Form, Input, InputNumber, Modal, Progress, Select, Statistic, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import type { Row } from '@/lib/types';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import TableToolbar, { useColumnVisibility } from '@/components/table-toolbar';
import dayjs from 'dayjs';

const SUBJECTS = ['语文', '数学', '英语', '科学', '道德与法治'];
const TOOLBAR_COLS = [
  { key: 'subject', label: '学科' }, { key: 'assign_date', label: '布置日期' },
  { key: 'requirement', label: '作业要求' }, { key: 'deadline', label: '截止时间' },
  { key: 'submitted', label: '已交' }, { key: 'late', label: '迟交' },
  { key: 'missing', label: '未交' }, { key: 'missing_names', label: '未交学生' },
];

const totalOf = (r: Row) => Number(r.submitted) + Number(r.late) + Number(r.missing);

export default function HomeworkPage() {
  const { message } = App.useApp();
  const { rows, loading, update, create, remove } = useResourceRows('homework');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:homework');
  const [addOpen, setAddOpen] = useState(false);
  const [collecting, setCollecting] = useState<Row | null>(null);
  const [form] = Form.useForm();

  const columns: TableColumnsType<Row> = useMemo(() => {
    const base = TOOLBAR_COLS.filter(c => !hidden.has(c.key)).map(c => ({
      title: c.label,
      dataIndex: c.key,
      width: c.key === 'requirement' ? 220 : c.key === 'missing_names' ? 160 : undefined,
      render: (_: unknown, r: Row) => (
        <EditableCell
          value={r[c.key]}
          type={c.key === 'subject' ? 'select' : (c.key === 'assign_date' || c.key === 'deadline') ? 'date' : c.key === 'requirement' ? 'textarea'
            : (c.key === 'submitted' || c.key === 'late' || c.key === 'missing') ? 'number' : 'text'}
          options={c.key === 'subject' ? SUBJECTS : undefined}
          onSave={v => update(r.id as number, { [c.key]: v })}
        />
      ),
    }));
    return [
      ...base,
      {
        title: '收缴进度', key: 'progress', width: 260,
        render: (_: unknown, r: Row) => {
          const total = totalOf(r);
          const pct = total > 0 ? Math.round((Number(r.submitted) / total) * 100) : 0;
          return <Progress percent={pct} size="small" format={() => `${pct}%（已交 ${r.submitted}·迟交 ${r.late}·未交 ${r.missing}）`} />;
        },
      },
      {
        title: '操作', key: 'op', width: 120, fixed: 'right', exportable: false,
        render: (_: unknown, r: Row) => (
          <div className="flex">
            <Button type="link" size="small" onClick={() => {
              setCollecting(r);
              form.setFieldsValue({ submitted: r.submitted, late: r.late, missing: r.missing });
            }}>录入收缴</Button>
            <Button type="link" danger size="small" onClick={async () => {
              try { await remove(r.id as number); message.success('已删除'); } catch { message.error('删除失败'); }
            }}>删除</Button>
          </div>
        ),
      },
    ];
  }, [hidden, update, remove, form, message]);

  const stats = useMemo(() => {
    const avg = rows.length ? Math.round(rows.reduce((s, r) => s + (totalOf(r) > 0 ? Number(r.submitted) / totalOf(r) : 0), 0) / rows.length * 100) : 0;
    const missingAll = rows.reduce((s, r) => s + Number(r.missing), 0);
    return [
      { title: '累计布置作业', value: rows.length },
      { title: '平均提交率', value: `${avg}%` },
      { title: '累计未交人次', value: missingAll },
    ];
  }, [rows]);

  const submit = async () => {
    try {
      const v = await form.validateFields();
      await create({
        subject: v.subject ?? '语文',
        assign_date: v.assign_date ? v.assign_date.format('YYYY-MM-DD') : '',
        requirement: v.requirement ?? '',
        deadline: v.deadline ? v.deadline.format('YYYY-MM-DD') : '',
        submitted: v.submitted ?? 0, late: v.late ?? 0, missing: v.missing ?? 0, missing_names: v.missing_names ?? '',
      });
      message.success('已新增');
      setAddOpen(false); form.resetFields();
    } catch { /* 校验/请求失败 */ }
  };

  const saveCollect = async () => {
    if (!collecting) return;
    try {
      const v = await form.validateFields();
      await update(collecting.id as number, { submitted: v.submitted ?? 0, late: v.late ?? 0, missing: v.missing ?? 0 });
      message.success('已更新收缴情况');
      setCollecting(null);
    } catch { message.error('保存失败'); }
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {stats.map(s => <Card key={s.title} size="small"><Statistic title={s.title} value={s.value} /></Card>)}
      </div>
      <TableToolbar title="作业管理" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <Table<Row> rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle" pagination={false} scroll={{ x: 'max-content' }} />

      <Modal title="新增作业" open={addOpen} onCancel={() => setAddOpen(false)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="subject" label="学科" initialValue="语文"><Select options={SUBJECTS.map(s => ({ value: s, label: s }))} /></Form.Item>
          <Form.Item name="assign_date" label="布置日期"><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="requirement" label="作业要求"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="deadline" label="截止时间"><DatePicker style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="录入收缴情况" open={!!collecting} onCancel={() => setCollecting(null)} onOk={saveCollect} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="submitted" label="已交"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="late" label="迟交"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="missing" label="未交"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 3: 冒烟运行**

Run: `npm run dev`，`/homework`：点「录入收缴」改数字保存，进度条更新。
Expected: 正常；Ctrl+C 结束。

- [ ] **Step 4: Commit**

```bash
git add app/homework/page.tsx
git commit -m "feat: rewrite homework page with progress bar and collect modal"
```

---

### Task 12: 请假管理 `/leaves`（标准 CRUD + 统计）

**Files:**
- Modify: `app/leaves/page.tsx`（重写）

**Interfaces:** 资源 `leave_records`；统计：累计/当日/本月人次/本月病假占比。

- [ ] **Step 1: 重写 `app/leaves/page.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { App, Button, Card, DatePicker, Form, Input, InputNumber, Modal, Select, Statistic, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import type { Row } from '@/lib/types';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import TableToolbar, { useColumnVisibility } from '@/components/table-toolbar';
import dayjs from 'dayjs';

const today = () => dayjs().format('YYYY-MM-DD');
const LEAVE_TYPES = ['事假', '病假', '公假'];
const TOOLBAR_COLS = [
  { key: 'student_name', label: '学生' }, { key: 'leave_type', label: '假别' },
  { key: 'reason', label: '事由' }, { key: 'start_date', label: '开始日期' },
  { key: 'end_date', label: '结束日期' }, { key: 'hours', label: '时长(小时)' },
];

export default function LeavesPage() {
  const { message } = App.useApp();
  const { rows, loading, update, create, remove } = useResourceRows('leave_records');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:leave_records');
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();

  const columns: TableColumnsType<Row> = useMemo(() => [
    ...TOOLBAR_COLS.filter(c => !hidden.has(c.key)).map(c => ({
      title: c.label, dataIndex: c.key,
      render: (_: unknown, r: Row) => (
        <EditableCell
          value={r[c.key]}
          type={c.key === 'leave_type' ? 'select' : (c.key === 'start_date' || c.key === 'end_date') ? 'date' : c.key === 'reason' ? 'textarea' : c.key === 'hours' ? 'number' : 'text'}
          options={c.key === 'leave_type' ? LEAVE_TYPES : undefined}
          onSave={v => update(r.id as number, { [c.key]: v })}
        />
      ),
    })),
    {
      title: '操作', key: 'op', width: 64, fixed: 'right', exportable: false,
      render: (_: unknown, r: Row) => (
        <Button type="link" danger size="small" onClick={async () => {
          try { await remove(r.id as number); message.success('已删除'); } catch { message.error('删除失败'); }
        }}>删除</Button>
      ),
    },
  ], [hidden, update, remove, message]);

  const stats = useMemo(() => {
    const month = today().slice(0, 7);
    const monthRows = rows.filter(r => String(r.start_date).startsWith(month));
    const sick = monthRows.filter(r => r.leave_type === '病假').length;
    return [
      { title: '累计请假记录', value: rows.length },
      { title: '当日请假', value: rows.filter(r => r.start_date === today()).length },
      { title: '本月人次', value: monthRows.length },
      { title: '本月病假占比', value: monthRows.length ? `${Math.round((sick / monthRows.length) * 100)}%` : '0%' },
    ];
  }, [rows]);

  const submit = async () => {
    try {
      const v = await form.validateFields();
      await create({
        student_name: v.student_name ?? '', leave_type: v.leave_type ?? '事假', reason: v.reason ?? '',
        start_date: v.start_date ? v.start_date.format('YYYY-MM-DD') : today(),
        end_date: v.end_date ? v.end_date.format('YYYY-MM-DD') : today(), hours: v.hours ?? 8,
      });
      message.success('已新增');
      setAddOpen(false); form.resetFields();
    } catch { /* 校验/请求失败 */ }
  };

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {stats.map(s => <Card key={s.title} size="small"><Statistic title={s.title} value={s.value} /></Card>)}
      </div>
      <TableToolbar title="请假管理" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <Table<Row> rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle" pagination={false} scroll={{ x: 'max-content' }} />
      <Modal title="新增请假" open={addOpen} onCancel={() => setAddOpen(false)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="student_name" label="学生" rules={[{ required: true, message: '请输入学生' }]}><Input /></Form.Item>
          <Form.Item name="leave_type" label="假别" initialValue="事假"><Select options={LEAVE_TYPES.map(v => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item name="reason" label="事由"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="start_date" label="开始日期" initialValue={dayjs()}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="end_date" label="结束日期" initialValue={dayjs()}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="hours" label="时长(小时)" initialValue={8}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add app/leaves/page.tsx
git commit -m "feat: rewrite leaves page with antd"
```

---

### Task 13: 违纪台账 `/discipline`（标准 CRUD + 列筛选）

**Files:**
- Modify: `app/discipline/page.tsx`（重写）

**Interfaces:** 资源 `discipline_records`；列：日期/学生/类别(select 5 项)/内容(textarea)/处理方式(text)；统计：累计/本周条数；类别列级筛选。

- [ ] **Step 1: 重写 `app/discipline/page.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { App, Button, Card, DatePicker, Form, Input, Modal, Select, Statistic, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import type { Row } from '@/lib/types';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import TableToolbar, { useColumnVisibility } from '@/components/table-toolbar';
import dayjs from 'dayjs';

const today = () => dayjs().format('YYYY-MM-DD');
const CATEGORIES = ['常规纪律', '迟到早退', '课堂表现', '课间行为', '卫生值日'];
const TOOLBAR_COLS = [
  { key: 'date', label: '日期' }, { key: 'student_name', label: '学生' },
  { key: 'category', label: '类别' }, { key: 'content', label: '违纪内容' },
  { key: 'action', label: '处理方式' },
];

export default function DisciplinePage() {
  const { message } = App.useApp();
  const { rows, loading, update, create, remove } = useResourceRows('discipline_records');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:discipline_records');
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();

  const columns: TableColumnsType<Row> = useMemo(() => [
    ...TOOLBAR_COLS.filter(c => !hidden.has(c.key)).map(c => ({
      title: c.label, dataIndex: c.key,
      filters: c.key === 'category' ? CATEGORIES.map(v => ({ text: v, value: v })) : undefined,
      onFilter: c.key === 'category' ? (v: unknown, r: Row) => String(r.category) === String(v) : undefined,
      render: (_: unknown, r: Row) => (
        <EditableCell
          value={r[c.key]}
          type={c.key === 'date' ? 'date' : c.key === 'category' ? 'select' : c.key === 'content' ? 'textarea' : 'text'}
          options={c.key === 'category' ? CATEGORIES : undefined}
          onSave={v => update(r.id as number, { [c.key]: v })}
        />
      ),
    })),
    {
      title: '操作', key: 'op', width: 64, fixed: 'right', exportable: false,
      render: (_: unknown, r: Row) => (
        <Button type="link" danger size="small" onClick={async () => {
          try { await remove(r.id as number); message.success('已删除'); } catch { message.error('删除失败'); }
        }}>删除</Button>
      ),
    },
  ], [hidden, update, remove, message]);

  const stats = useMemo(() => [
    { title: '累计条数', value: rows.length },
    { title: '本周条数', value: rows.filter(r => String(r.date) >= dayjs().subtract(6, 'day').format('YYYY-MM-DD')).length },
  ], [rows]);

  const submit = async () => {
    try {
      const v = await form.validateFields();
      await create({ date: v.date ? v.date.format('YYYY-MM-DD') : today(), student_name: v.student_name ?? '', category: v.category ?? '常规纪律', content: v.content ?? '', action: v.action ?? '' });
      message.success('已新增');
      setAddOpen(false); form.resetFields();
    } catch { /* 校验/请求失败 */ }
  };

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {stats.map(s => <Card key={s.title} size="small"><Statistic title={s.title} value={s.value} /></Card>)}
      </div>
      <TableToolbar title="违纪台账" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <Table<Row> rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle" pagination={false} scroll={{ x: 'max-content' }} />
      <Modal title="新增违纪" open={addOpen} onCancel={() => setAddOpen(false)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="student_name" label="学生" rules={[{ required: true, message: '请输入学生' }]}><Input /></Form.Item>
          <Form.Item name="category" label="类别" initialValue="常规纪律"><Select options={CATEGORIES.map(v => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item name="content" label="违纪内容"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="action" label="处理方式"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add app/discipline/page.tsx
git commit -m "feat: rewrite discipline page with antd"
```

---

### Task 14: 谈话记录 `/conversations`（标准 CRUD）

**Files:**
- Modify: `app/conversations/page.tsx`（重写）

**Interfaces:** 资源 `conversations`；列：日期/学生/主题/内容(textarea)/谈话效果(select：有改善/需持续跟进/已解决)。

- [ ] **Step 1: 重写 `app/conversations/page.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { App, Button, Form, Input, Modal, Select, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import type { Row } from '@/lib/types';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import TableToolbar, { useColumnVisibility } from '@/components/table-toolbar';
import dayjs from 'dayjs';

const EFFECTS = ['有改善', '需持续跟进', '已解决'];
const TOOLBAR_COLS = [
  { key: 'date', label: '日期' }, { key: 'student_name', label: '学生' },
  { key: 'topic', label: '主题' }, { key: 'content', label: '内容' },
  { key: 'effect', label: '谈话效果' },
];

export default function ConversationsPage() {
  const { message } = App.useApp();
  const { rows, loading, update, create, remove } = useResourceRows('conversations');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:conversations');
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();

  const columns: TableColumnsType<Row> = useMemo(() => [
    ...TOOLBAR_COLS.filter(c => !hidden.has(c.key)).map(c => ({
      title: c.label, dataIndex: c.key,
      render: (_: unknown, r: Row) => (
        <EditableCell
          value={r[c.key]}
          type={c.key === 'date' ? 'date' : c.key === 'effect' ? 'select' : c.key === 'content' ? 'textarea' : 'text'}
          options={c.key === 'effect' ? EFFECTS : undefined}
          onSave={v => update(r.id as number, { [c.key]: v })}
        />
      ),
    })),
    {
      title: '操作', key: 'op', width: 64, fixed: 'right', exportable: false,
      render: (_: unknown, r: Row) => (
        <Button type="link" danger size="small" onClick={async () => {
          try { await remove(r.id as number); message.success('已删除'); } catch { message.error('删除失败'); }
        }}>删除</Button>
      ),
    },
  ], [hidden, update, remove, message]);

  const submit = async () => {
    try {
      const v = await form.validateFields();
      await create({ date: v.date ? v.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'), student_name: v.student_name ?? '', topic: v.topic ?? '', content: v.content ?? '', effect: v.effect ?? '需持续跟进' });
      message.success('已新增');
      setAddOpen(false); form.resetFields();
    } catch { /* 校验/请求失败 */ }
  };

  return (
    <div>
      <TableToolbar title="谈话记录" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <Table<Row> rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle" pagination={false} scroll={{ x: 'max-content' }} />
      <Modal title="新增谈话记录" open={addOpen} onCancel={() => setAddOpen(false)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="student_name" label="学生" rules={[{ required: true, message: '请输入学生' }]}><Input /></Form.Item>
          <Form.Item name="topic" label="主题"><Input /></Form.Item>
          <Form.Item name="content" label="内容"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="effect" label="谈话效果" initialValue="需持续跟进"><Select options={EFFECTS.map(v => ({ value: v, label: v }))} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add app/conversations/page.tsx
git commit -m "feat: rewrite conversations page with antd"
```

---

### Task 15: 生涯家访 `/visits`（类型 Tag 切换 + 统计）

**Files:**
- Modify: `app/visits/page.tsx`（重写）

**Interfaces:** 资源 `home_visits`；`is_meeting` 列只读，渲染 Tag 按钮（家长会/家访），点击切换；`exportable: false` 不导出；统计沿用原公式。

- [ ] **Step 1: 重写 `app/visits/page.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { App, Button, Card, Form, Input, Modal, Select, Statistic, Table, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import type { Row } from '@/lib/types';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import TableToolbar, { useColumnVisibility } from '@/components/table-toolbar';
import dayjs from 'dayjs';

const WAYS = ['电话', '家访', '家长会', '微信'];
const TOOLBAR_COLS = [
  { key: 'date', label: '日期' }, { key: 'student_name', label: '学生' },
  { key: 'way', label: '方式' }, { key: 'content', label: '内容' },
  { key: 'is_meeting', label: '类型', exportable: false },
];

export default function VisitsPage() {
  const { message } = App.useApp();
  const { rows, loading, update, create, remove } = useResourceRows('home_visits');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:home_visits');
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();

  const columns: TableColumnsType<Row> = useMemo(() => [
    ...TOOLBAR_COLS.filter(c => !hidden.has(c.key)).map(c => c.key === 'is_meeting' ? ({
      title: c.label, dataIndex: 'is_meeting', width: 90,
      render: (_: unknown, r: Row) => {
        const meeting = r.is_meeting == 1;
        return (
          <Button size="small" onClick={async () => {
            try { await update(r.id as number, { is_meeting: meeting ? 0 : 1 }); }
            catch { message.error('保存失败'); }
          }}>
            <Tag color={meeting ? 'purple' : 'gold'} style={{ margin: 0 }}>{meeting ? '家长会' : '家访'}</Tag>
          </Button>
        );
      },
    }) : ({
      title: c.label, dataIndex: c.key,
      render: (_: unknown, r: Row) => (
        <EditableCell
          value={r[c.key]}
          type={c.key === 'date' ? 'date' : c.key === 'way' ? 'select' : c.key === 'content' ? 'textarea' : 'text'}
          options={c.key === 'way' ? WAYS : undefined}
          onSave={v => update(r.id as number, { [c.key]: v })}
        />
      ),
    })),
    {
      title: '操作', key: 'op', width: 64, fixed: 'right', exportable: false,
      render: (_: unknown, r: Row) => (
        <Button type="link" danger size="small" onClick={async () => {
          try { await remove(r.id as number); message.success('已删除'); } catch { message.error('删除失败'); }
        }}>删除</Button>
      ),
    },
  ], [hidden, update, remove, message]);

  const stats = useMemo(() => {
    const visits = rows.filter(r => r.is_meeting != 1).length;
    const meetings = rows.filter(r => r.is_meeting == 1).length;
    const meetingStudents = new Set(rows.filter(r => r.is_meeting == 1).map(r => String(r.student_name))).size;
    const allStudents = new Set(rows.map(r => String(r.student_name))).size;
    const rate = allStudents > 0 ? Math.round((meetingStudents / allStudents) * 100) : 0;
    return [
      { title: '家访次数', value: visits },
      { title: '家长会场次', value: meetings },
      { title: '家长会参会率', value: `${rate}%` },
    ];
  }, [rows]);

  const submit = async () => {
    try {
      const v = await form.validateFields();
      await create({ date: v.date ? v.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'), student_name: v.student_name ?? '', way: v.way ?? '电话', content: v.content ?? '', is_meeting: 0 });
      message.success('已新增');
      setAddOpen(false); form.resetFields();
    } catch { /* 校验/请求失败 */ }
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {stats.map(s => <Card key={s.title} size="small"><Statistic title={s.title} value={s.value} /></Card>)}
      </div>
      <TableToolbar title="生涯家访" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <Table<Row> rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle" pagination={false} scroll={{ x: 'max-content' }} />
      <Modal title="新增家访记录" open={addOpen} onCancel={() => setAddOpen(false)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="student_name" label="学生" rules={[{ required: true, message: '请输入学生' }]}><Input /></Form.Item>
          <Form.Item name="way" label="方式" initialValue="电话"><Select options={WAYS.map(v => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item name="content" label="内容"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 3: 冒烟运行**

Run: `npm run dev`，`/visits`：点「家访/家长会」Tag 应切换。
Expected: 正常；Ctrl+C 结束。

- [ ] **Step 4: Commit**

```bash
git add app/visits/page.tsx
git commit -m "feat: rewrite visits page with antd tag toggle"
```

---

### Task 16: 综合素质评价 `/evaluation`（维分内联 + 维度平均图）

**Files:**
- Modify: `app/evaluation/page.tsx`（重写）

**Interfaces:** 资源 `evaluation`；5 维（moral/study/sports/art/labor）1-5 内联数字 + 评语 textarea；维度平均 BarChart。

- [ ] **Step 1: 重写 `app/evaluation/page.tsx`**

```tsx
'use client';
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Table } from 'antd';
import type { TableColumnsType } from 'antd';
import type { Row } from '@/lib/types';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import TableToolbar, { useColumnVisibility } from '@/components/table-toolbar';
import { CategoryColor } from '@/lib/color-utils';

const DIMS = [
  { key: 'moral', label: '品德' }, { key: 'study', label: '学习' }, { key: 'sports', label: '体育' },
  { key: 'art', label: '美育' }, { key: 'labor', label: '劳动' },
];
const TOOLBAR_COLS = [
  { key: 'student_name', label: '姓名' },
  ...DIMS.map(d => ({ key: d.key, label: d.label })),
  { key: 'comment', label: '评语' },
];

export default function EvaluationPage() {
  const { rows, loading, update } = useResourceRows('evaluation');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:evaluation');

  const columns: TableColumnsType<Row> = useMemo(() => [
    ...TOOLBAR_COLS.filter(c => !hidden.has(c.key)).map(c => ({
      title: c.label,
      dataIndex: c.key,
      align: (c.key === 'comment' ? 'left' : 'center') as const,
      render: (_: unknown, r: Row) => (
        <EditableCell
          value={r[c.key]}
          type={c.key === 'comment' ? 'textarea' : 'number'}
          onSave={v => update(r.id as number, { [c.key]: v })}
        />
      ),
    })),
  ], [hidden, update]);

  const dimStats = useMemo(() => DIMS.map(d => ({
    name: d.label,
    avg: rows.length ? (rows.reduce((s, r) => s + Number(r[d.key] ?? 3), 0) / rows.length).toFixed(1) : '0',
  })), [rows]);

  return (
    <div>
      <TableToolbar title="综合素质评价" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} />
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-600" style={{ marginTop: 0 }}>各维度平均分（满分 5）</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dimStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Bar dataKey="avg" fill={CategoryColor('班级管理')} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-600" style={{ marginTop: 0 }}>评价说明</h3>
          <p className="text-xs text-slate-500 leading-relaxed">每项按 1-5 打分（1 很差 / 5 优秀）。点击分数直接修改，实时保存。评语在表格底部。</p>
        </div>
      </div>
      <Table<Row> rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle" pagination={false} scroll={{ x: 'max-content' }} />
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add app/evaluation/page.tsx
git commit -m "feat: rewrite evaluation page with antd"
```

---

### Task 17: 家校沟通 `/parent-comm`（标准 CRUD）

**Files:**
- Modify: `app/parent-comm/page.tsx`（重写）

**Interfaces:** 资源 `parent_comm`；列：日期/学生对象/方式(select：电话/微信/面谈/通知)/沟通内容(textarea)。

- [ ] **Step 1: 重写 `app/parent-comm/page.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { App, Button, Form, Input, Modal, Select, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import type { Row } from '@/lib/types';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import TableToolbar, { useColumnVisibility } from '@/components/table-toolbar';
import dayjs from 'dayjs';

const WAYS = ['电话', '微信', '面谈', '通知'];
const TOOLBAR_COLS = [
  { key: 'date', label: '日期' }, { key: 'student_name', label: '学生/对象' },
  { key: 'way', label: '方式' }, { key: 'content', label: '沟通内容' },
];

export default function ParentCommPage() {
  const { message } = App.useApp();
  const { rows, loading, update, create, remove } = useResourceRows('parent_comm');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:parent_comm');
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();

  const columns: TableColumnsType<Row> = useMemo(() => [
    ...TOOLBAR_COLS.filter(c => !hidden.has(c.key)).map(c => ({
      title: c.label, dataIndex: c.key,
      render: (_: unknown, r: Row) => (
        <EditableCell
          value={r[c.key]}
          type={c.key === 'date' ? 'date' : c.key === 'way' ? 'select' : c.key === 'content' ? 'textarea' : 'text'}
          options={c.key === 'way' ? WAYS : undefined}
          onSave={v => update(r.id as number, { [c.key]: v })}
        />
      ),
    })),
    {
      title: '操作', key: 'op', width: 64, fixed: 'right', exportable: false,
      render: (_: unknown, r: Row) => (
        <Button type="link" danger size="small" onClick={async () => {
          try { await remove(r.id as number); message.success('已删除'); } catch { message.error('删除失败'); }
        }}>删除</Button>
      ),
    },
  ], [hidden, update, remove, message]);

  const submit = async () => {
    try {
      const v = await form.validateFields();
      await create({ date: v.date ? v.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'), student_name: v.student_name ?? '', way: v.way ?? '微信', content: v.content ?? '' });
      message.success('已新增');
      setAddOpen(false); form.resetFields();
    } catch { /* 校验/请求失败 */ }
  };

  return (
    <div>
      <TableToolbar title="家校沟通" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <Table<Row> rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle" pagination={false} scroll={{ x: 'max-content' }} />
      <Modal title="新增沟通记录" open={addOpen} onCancel={() => setAddOpen(false)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="student_name" label="学生/对象" rules={[{ required: true, message: '请输入对象' }]}><Input /></Form.Item>
          <Form.Item name="way" label="方式" initialValue="微信"><Select options={WAYS.map(v => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item name="content" label="沟通内容"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add app/parent-comm/page.tsx
git commit -m "feat: rewrite parent-comm page with antd"
```

---

### Task 18: 安全台账 `/safety`（标准 CRUD + 列筛选）

**Files:**
- Modify: `app/safety/page.tsx`（重写）

**Interfaces:** 资源 `safety_logs`；列：日期/类别(select：课间/交通/食品/消防/防溺水/其他)/内容(textarea)/处理情况(text)；类别列级筛选。

- [ ] **Step 1: 重写 `app/safety/page.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { App, Button, Form, Input, Modal, Select, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import type { Row } from '@/lib/types';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import TableToolbar, { useColumnVisibility } from '@/components/table-toolbar';
import dayjs from 'dayjs';

const CATEGORIES = ['课间', '交通', '食品', '消防', '防溺水', '其他'];
const TOOLBAR_COLS = [
  { key: 'date', label: '日期' }, { key: 'category', label: '类别' },
  { key: 'content', label: '内容' }, { key: 'action', label: '处理情况' },
];

export default function SafetyPage() {
  const { message } = App.useApp();
  const { rows, loading, update, create, remove } = useResourceRows('safety_logs');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:safety_logs');
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();

  const columns: TableColumnsType<Row> = useMemo(() => [
    ...TOOLBAR_COLS.filter(c => !hidden.has(c.key)).map(c => ({
      title: c.label, dataIndex: c.key,
      filters: c.key === 'category' ? CATEGORIES.map(v => ({ text: v, value: v })) : undefined,
      onFilter: c.key === 'category' ? (v: unknown, r: Row) => String(r.category) === String(v) : undefined,
      render: (_: unknown, r: Row) => (
        <EditableCell
          value={r[c.key]}
          type={c.key === 'date' ? 'date' : c.key === 'category' ? 'select' : c.key === 'content' ? 'textarea' : 'text'}
          options={c.key === 'category' ? CATEGORIES : undefined}
          onSave={v => update(r.id as number, { [c.key]: v })}
        />
      ),
    })),
    {
      title: '操作', key: 'op', width: 64, fixed: 'right', exportable: false,
      render: (_: unknown, r: Row) => (
        <Button type="link" danger size="small" onClick={async () => {
          try { await remove(r.id as number); message.success('已删除'); } catch { message.error('删除失败'); }
        }}>删除</Button>
      ),
    },
  ], [hidden, update, remove, message]);

  const submit = async () => {
    try {
      const v = await form.validateFields();
      await create({ date: v.date ? v.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'), category: v.category ?? '课间', content: v.content ?? '', action: v.action ?? '' });
      message.success('已新增');
      setAddOpen(false); form.resetFields();
    } catch { /* 校验/请求失败 */ }
  };

  return (
    <div>
      <TableToolbar title="安全台账" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <Table<Row> rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle" pagination={false} scroll={{ x: 'max-content' }} />
      <Modal title="新增安全记录" open={addOpen} onCancel={() => setAddOpen(false)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="category" label="类别" initialValue="课间"><Select options={CATEGORIES.map(v => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item name="content" label="内容"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="action" label="处理情况"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add app/safety/page.tsx
git commit -m "feat: rewrite safety page with antd"
```

---

### Task 19: 培优临界生 `/peiyou`（标准 CRUD + 统计）

**Files:**
- Modify: `app/peiyou/page.tsx`（重写）

**Interfaces:** 资源 `peiyou_records`；列：学生/学科(select 语数英)/薄弱点/目标分数(number)/辅导记录(textarea)；统计：临界生去重人数/辅导记录数。

- [ ] **Step 1: 重写 `app/peiyou/page.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { App, Button, Card, Form, Input, InputNumber, Modal, Select, Statistic, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import type { Row } from '@/lib/types';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import TableToolbar, { useColumnVisibility } from '@/components/table-toolbar';

const SUBJECTS = ['语文', '数学', '英语'];
const TOOLBAR_COLS = [
  { key: 'student_name', label: '学生' }, { key: 'subject', label: '学科' },
  { key: 'weak_point', label: '薄弱点' }, { key: 'target_score', label: '目标分数' },
  { key: 'record', label: '辅导记录' },
];

export default function PeiyouPage() {
  const { message } = App.useApp();
  const { rows, loading, update, create, remove } = useResourceRows('peiyou_records');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:peiyou_records');
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();

  const columns: TableColumnsType<Row> = useMemo(() => [
    ...TOOLBAR_COLS.filter(c => !hidden.has(c.key)).map(c => ({
      title: c.label, dataIndex: c.key,
      render: (_: unknown, r: Row) => (
        <EditableCell
          value={r[c.key]}
          type={c.key === 'subject' ? 'select' : c.key === 'target_score' ? 'number' : c.key === 'record' ? 'textarea' : 'text'}
          options={c.key === 'subject' ? SUBJECTS : undefined}
          onSave={v => update(r.id as number, { [c.key]: v })}
        />
      ),
    })),
    {
      title: '操作', key: 'op', width: 64, fixed: 'right', exportable: false,
      render: (_: unknown, r: Row) => (
        <Button type="link" danger size="small" onClick={async () => {
          try { await remove(r.id as number); message.success('已删除'); } catch { message.error('删除失败'); }
        }}>删除</Button>
      ),
    },
  ], [hidden, update, remove, message]);

  const stats = useMemo(() => {
    const uniq = new Set(rows.map(r => String(r.student_name))).size;
    return [
      { title: '临界生人数', value: uniq },
      { title: '辅导记录', value: rows.length },
    ];
  }, [rows]);

  const submit = async () => {
    try {
      const v = await form.validateFields();
      await create({ student_name: v.student_name ?? '', subject: v.subject ?? '语文', weak_point: v.weak_point ?? '', target_score: v.target_score ?? 85, record: v.record ?? '' });
      message.success('已新增');
      setAddOpen(false); form.resetFields();
    } catch { /* 校验/请求失败 */ }
  };

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {stats.map(s => <Card key={s.title} size="small"><Statistic title={s.title} value={s.value} /></Card>)}
      </div>
      <TableToolbar title="培优临界生台账" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <Table<Row> rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle" pagination={false} scroll={{ x: 'max-content' }} />
      <Modal title="新增培优学生" open={addOpen} onCancel={() => setAddOpen(false)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="student_name" label="学生" rules={[{ required: true, message: '请输入学生' }]}><Input /></Form.Item>
          <Form.Item name="subject" label="学科" initialValue="语文"><Select options={SUBJECTS.map(v => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item name="weak_point" label="薄弱点"><Input /></Form.Item>
          <Form.Item name="target_score" label="目标分数" initialValue={85}><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="record" label="辅导记录"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add app/peiyou/page.tsx
git commit -m "feat: rewrite peiyou page with antd"
```

---

### Task 20: 工作留痕 `/work-logs`（CRUD + 环形饼图）

**Files:**
- Modify: `app/work-logs/page.tsx`（重写）

**Interfaces:** 资源 `work_logs`；列：日期/工作事项/类型(select 8 类)/地点/时长(number)；统计：累计记录/累计时长；下方环形饼图按类型分布（recharts Pie）。

- [ ] **Step 1: 重写 `app/work-logs/page.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { App, Button, Card, DatePicker, Form, Input, InputNumber, Modal, Select, Statistic, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Row } from '@/lib/types';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import TableToolbar, { useColumnVisibility } from '@/components/table-toolbar';
import { CategoryColor } from '@/lib/color-utils';
import dayjs from 'dayjs';

const WORK_TYPES = ['班级管理', '教学教研', '家校沟通', '学生培优', '生涯活动', '安全教育', '会议培训', '心理辅导'];
const TOOLBAR_COLS = [
  { key: 'date', label: '日期' }, { key: 'title', label: '工作事项' },
  { key: 'type', label: '类型' }, { key: 'place', label: '地点' },
  { key: 'hours', label: '时长(小时)' },
];

export default function WorkLogsPage() {
  const { message } = App.useApp();
  const { rows, loading, update, create, remove } = useResourceRows('work_logs');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:work_logs');
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();

  const columns: TableColumnsType<Row> = useMemo(() => [
    ...TOOLBAR_COLS.filter(c => !hidden.has(c.key)).map(c => ({
      title: c.label, dataIndex: c.key,
      render: (_: unknown, r: Row) => (
        <EditableCell
          value={r[c.key]}
          type={c.key === 'date' ? 'date' : c.key === 'type' ? 'select' : c.key === 'hours' ? 'number' : 'text'}
          options={c.key === 'type' ? WORK_TYPES : undefined}
          onSave={v => update(r.id as number, { [c.key]: v })}
        />
      ),
    })),
    {
      title: '操作', key: 'op', width: 64, fixed: 'right', exportable: false,
      render: (_: unknown, r: Row) => (
        <Button type="link" danger size="small" onClick={async () => {
          try { await remove(r.id as number); message.success('已删除'); } catch { message.error('删除失败'); }
        }}>删除</Button>
      ),
    },
  ], [hidden, update, remove, message]);

  const stats = useMemo(() => [
    { title: '累计工作记录', value: rows.length },
    { title: '累计时长', value: rows.reduce((s, r) => s + Number(r.hours), 0).toFixed(1) },
  ], [rows]);

  const pieData = useMemo(() => WORK_TYPES.map(t => ({
    name: t,
    value: rows.filter(r => r.type === t).length,
  })).filter(d => d.value > 0), [rows]);

  const submit = async () => {
    try {
      const v = await form.validateFields();
      await create({ date: v.date ? v.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'), title: v.title ?? '', type: v.type ?? '班级管理', place: v.place ?? '', hours: v.hours ?? 1 });
      message.success('已新增');
      setAddOpen(false); form.resetFields();
    } catch { /* 校验/请求失败 */ }
  };

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {stats.map(s => <Card key={s.title} size="small"><Statistic title={s.title} value={s.value} suffix={s.title.includes('时长') ? '小时' : ''} /></Card>)}
      </div>
      <TableToolbar title="工作留痕" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <Table<Row> rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle" pagination={false} scroll={{ x: 'max-content' }} />
      <Card size="small" className="mt-4"><h3 className="mb-3 text-sm font-semibold text-slate-600" style={{ marginTop: 0 }}>工作类型分布（环形饼图）</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {pieData.map((d, i) => <Cell key={i} fill={CategoryColor(d.name)} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Modal title="新增工作记录" open={addOpen} onCancel={() => setAddOpen(false)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="工作事项" rules={[{ required: true, message: '请输入事项' }]}><Input /></Form.Item>
          <Form.Item name="type" label="类型" initialValue="班级管理"><Select options={WORK_TYPES.map(v => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item name="date" label="日期" initialValue={dayjs()}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="place" label="地点"><Input /></Form.Item>
          <Form.Item name="hours" label="时长(小时)" initialValue={1}><InputNumber min={0} step={0.5} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add app/work-logs/page.tsx
git commit -m "feat: rewrite work-logs page with antd and pie chart"
```

---

### Task 21: 排座位 `/seats`（教室网格 + 安排弹窗 + 导出）

**Files:**
- Modify: `app/seats/page.tsx`（重写）

**Interfaces:**
- Consumes: `get/post/put` from `@/lib/api-client`；`Row`；`downloadCsv`。
- 行为：加载 seats/students/classroom_config；点击座位弹窗列可选学生（未落座学生 + 原座学生）；安排 = `post` 或 `put`；移除 = `put` 空串；导出座位表 CSV。

- [ ] **Step 1: 重写 `app/seats/page.tsx`**

```tsx
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { App, Button, Drawer, List, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { get, post, put } from '@/lib/api-client';
import type { Row } from '@/lib/types';
import { downloadCsv } from '@/lib/csv';

export default function SeatsPage() {
  const { message } = App.useApp();
  const [seats, setSeats] = useState<Row[]>([]);
  const [students, setStudents] = useState<Row[]>([]);
  const [cfg, setCfg] = useState({ row_count: 6, col_count: 8 });
  const [selected, setSelected] = useState<Row | null>(null);
  const reloadRef = useRef(0);

  useEffect(() => {
    Promise.all([
      get<Row[]>('/api/seats'),
      get<Row[]>('/api/students'),
      get<Row[]>('/api/classroom_config'),
    ]).then(([s, st, c]) => {
      setSeats(s);
      setStudents(st);
      const first = c[0];
      if (first) setCfg({ row_count: Number(first.row_count), col_count: Number(first.col_count) });
    });
  }, [reloadRef.current]);

  const grid = useMemo(() => {
    const m = new Map<string, Row>();
    for (const s of seats) m.set(`${s.row_index}-${s.col_index}`, s);
    return m;
  }, [seats]);

  const used = useMemo(() => new Set(seats.map(x => String(x.student_name)).filter(Boolean)), [seats]);

  const assign = async (name: string) => {
    if (!selected) return;
    const seat = grid.get(`${selected.row_index}-${selected.col_index}`);
    try {
      if (seat) await put(`/api/seats/${seat.id}`, { student_name: name });
      else await post('/api/seats', { row_index: selected.row_index, col_index: selected.col_index, student_name: name });
      message.success(`已安排 ${name}`);
      setSelected(null);
      reloadRef.current += 1;
    } catch { message.error('保存失败'); }
  };

  const clearSeat = async () => {
    if (!selected) return;
    const seat = grid.get(`${selected.row_index}-${selected.col_index}`);
    if (!seat) return;
    try { await put(`/api/seats/${seat.id}`, { student_name: '' }); setSelected(null); reloadRef.current += 1; }
    catch { message.error('保存失败'); }
  };

  const exportSeats = () => {
    downloadCsv('座位表.csv', ['位置', '姓名'], seats.map(s => [`${Number(s.row_index) + 1}排${Number(s.col_index) + 1}座`, s.student_name ?? '']));
  };

  const studentNames = useMemo(() =>
    students.filter(s => !used.has(String(s.name)) || String(s.name) === String(selected?.student_name ?? '')),
    [students, used, selected]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <Typography.Title level={4} style={{ margin: 0 }}>排座位</Typography.Title>
        <Button icon={<DownloadOutlined />} onClick={exportSeats}>导出</Button>
      </div>
      <p className="mb-3 text-xs text-slate-500">点击任意座位安排学生；已落座的学生再次点击可移除。</p>
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="mx-auto mb-4 w-40 text-center py-1.5 bg-slate-800 text-white text-xs rounded">讲 台</div>
        <div className="overflow-x-auto">
          <div className="min-w-max mx-auto">
            {Array.from({ length: cfg.row_count }).map((_, r) => (
              <div key={r} className="flex justify-center gap-2 mb-2">
                {Array.from({ length: cfg.col_count }).map((_, c) => {
                  const seat = grid.get(`${r}-${c}`);
                  const name = String(seat?.student_name ?? '');
                  return (
                    <button
                      key={c}
                      onClick={() => setSelected(seat ?? { row_index: r, col_index: c, student_name: '' })}
                      className={`w-14 h-12 rounded-md border text-xs flex items-center justify-center transition-colors ${name ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-300'}`}
                    >
                      {name || '＋'}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Drawer
        title={selected ? `${Number(selected.row_index) + 1} 排 ${Number(selected.col_index) + 1} 座（${String(selected.student_name ?? '空')}）` : '安排座位'}
        open={!!selected}
        onClose={() => setSelected(null)}
        width={320}
      >
        <List
          size="small"
          dataSource={studentNames}
          renderItem={(s) => (
            <List.Item>
              <Button block={false} onClick={() => void assign(String(s.name))}>{String(s.name)}</Button>
            </List.Item>
          )}
        />
        {selected && String(selected.student_name ?? '') && (
          <Button type="link" danger style={{ paddingLeft: 0 }} onClick={() => void clearSeat()}>移除该座位学生</Button>
        )}
      </Drawer>
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 3: 冒烟运行**

Run: `npm run dev`，`/seats`：点座位弹窗安排学生、移除学生、导出 CSV。
Expected: 正常；Ctrl+C 结束。

- [ ] **Step 4: Commit**

```bash
git add app/seats/page.tsx
git commit -m "feat: rewrite seats page with antd drawer and grid"
```

---

### Task 22: 系统设置 `/settings`（编辑 settings + 重置 + 备份）

**Files:**
- Modify: `app/settings/page.tsx`（重写）

**Interfaces:**
- Consumes: `get/post/put` from `@/lib/api-client`。
- 行为：`settings` 表键值表单（6 项）保存；重置 `POST /api/reset`（Popconfirm）；备份下载 `window.open('/api/backup')`。

- [ ] **Step 1: 重写 `app/settings/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { App, Button, Card, Form, Input, Popconfirm, Typography } from 'antd';
import { get, post, put } from '@/lib/api-client';
import type { Row } from '@/lib/types';

const KEYS = [
  { key: 'class_name', label: '班级名称' },
  { key: 'head_teacher', label: '班主任' },
  { key: 'grade_band', label: '年级班次' },
  { key: 'total_count', label: '总人数' },
  { key: 'male_count', label: '男生数' },
  { key: 'female_count', label: '女生数' },
];

export default function SettingsPage() {
  const { message } = App.useApp();
  const [rows, setRows] = useState<Row[]>([]);
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get<Row[]>('/api/settings').then(rs => {
      setRows(rs);
      const m: Record<string, string> = {};
      for (const r of rs) m[String(r.key)] = String(r.value ?? '');
      form.setFieldsValue(m);
    });
  }, [form]);

  const save = async () => {
    setBusy(true);
    try {
      const v = form.getFieldsValue();
      for (const r of rows) {
        if (!KEYS.some(k => k.key === r.key)) continue;
        await put(`/api/settings/${r.id}`, { value: String(v[String(r.key)] ?? '') });
      }
      message.success('已保存');
    } catch { message.error('保存失败'); }
    setBusy(false);
  };

  const reset = async () => {
    setBusy(true);
    try { await post('/api/reset', {}); message.success('已重置'); window.location.reload(); }
    catch { message.error('重置失败'); setBusy(false); }
  };

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>系统设置</Typography.Title>
      <div className="grid md:grid-cols-2 gap-4">
        <Card size="small"><h3 className="mb-3 text-sm font-semibold text-slate-600" style={{ marginTop: 0 }}>班级基础信息</h3>
          <Form form={form} layout="vertical">
            <div className="grid grid-cols-2 gap-3">
              {KEYS.map(k => (
                <Form.Item key={k.key} name={k.key} label={k.label}><Input /></Form.Item>
              ))}
            </div>
            <Button type="primary" onClick={save} loading={busy}>保存</Button>
          </Form>
        </Card>
        <div className="space-y-4">
          <Card size="small"><h3 className="mb-3 text-sm font-semibold text-slate-600" style={{ marginTop: 0 }}>数据维护</h3>
            <div className="flex flex-col gap-2">
              <Popconfirm title="将清空全部演示数据并重新生成，确认？" onConfirm={reset} okText="重置" cancelText="取消">
                <Button type="primary" danger loading={busy}>重置种子数据（重新随机生成）</Button>
              </Popconfirm>
              <Button type="primary" onClick={() => window.open('/api/backup', '_blank')}>备份数据库（下载 app.db）</Button>
            </div>
            <p className="mt-3 text-xs text-slate-400">演示数据均为随机生成的匿名姓名，用于保护学生隐私。</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 3: 冒烟运行**

Run: `npm run dev`，`/settings`：保存班级名、重置、备份下载。
Expected: 正常；Ctrl+C 结束。

- [ ] **Step 4: Commit**

```bash
git add app/settings/page.tsx
git commit -m "feat: rewrite settings page with antd"
```

---

### Task 23: 收尾清理（删除旧组件层 / CSS / csv 导出）

**Files:**
- Delete: `components/crud/crud-page.tsx`、`components/crud/data-table.tsx`、`components/crud/import-modal.tsx`、`components/crud/quick-add.tsx`、`components/crud/types.ts`
- Delete: `components/ui/modal.tsx`、`components/ui/toast.tsx`、`components/ui/stat-card.tsx`、`components/ui/page-header.tsx`、`components/ui/chart-card.tsx`、`components/ui/empty-state.tsx`、`components/ui/inline-edit.tsx`、`components/ui/color-utils.ts`
- Modify: `lib/csv.ts`（删 `exportCsv` 及 `ColumnDef` 导入）
- Modify: `app/globals.css`（删 `.card`/`.btn-primary`）

**Prerequisite:** Tasks 6–22 全部完成且 `npm run build` 已绿（此时旧组件的唯一引用已消失）。

- [ ] **Step 1: 删除旧组件**

Run:
```bash
rm components/crud/crud-page.tsx components/crud/data-table.tsx components/crud/import-modal.tsx components/crud/quick-add.tsx components/crud/types.ts
rm components/ui/modal.tsx components/ui/toast.tsx components/ui/stat-card.tsx components/ui/page-header.tsx components/ui/chart-card.tsx components/ui/empty-state.tsx components/ui/inline-edit.tsx components/ui/color-utils.ts
```

- [ ] **Step 2: 清理 `lib/csv.ts`（去掉依赖 ColumnDef 的 exportCsv）**

替换 `lib/csv.ts` 顶部，把：

```ts
import type { Row } from './types';
import type { ColumnDef } from '@/components/crud/types';

export function exportCsv(rows: Row[], columns: ColumnDef[], filename: string): void {
  columns = columns.filter(c => !c.render && !c.readOnly);
  const head = columns.map(c => c.label).join(',');
  const lines = rows.map(r => columns.map(c => {
    const v = String(r[c.key] ?? '');
    return `"${v.replace(/"/g, '""')}"`;
  }).join(','));
  const blob = new Blob(['﻿' + [head, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

替换为：

```ts
import type { Row } from './types';
```

（页面重写后均用 `downloadCsv`，旧 `exportCsv` 已无使用者，可安全删除；`parseCsv`/`toCsv`/`downloadCsv` 保留。）

- [ ] **Step 3: 清理 `app/globals.css`（删组件辅助类，保留 tailwind 与 body）**

删除 `.card` 与 `.btn-primary` 两段 `@apply` 规则，保留 `@import "tailwindcss";`、`@theme`、`body`。最终文件应为：

```css
@import "tailwindcss";

@theme {
  --color-navy: #1d2b52;        /* 深空藏蓝侧边栏 */
  --color-navy-soft: #26365f;
  --color-bg: #f3f5f9;          /* 浅灰白页面底 */
  --color-accent: #2aa7e6;      /* 湖蓝主按钮 */
  --color-blue: #3b82f6;
  --color-teal: #14b8a6;
  --color-purple: #8b5cf6;
  --color-amber: #f59e0b;
  --color-red: #ef4444;
  --color-warn: #eab308;
}

body {
  @apply bg-bg text-slate-800 antialiased;
}
```

- [ ] **Step 4: 无残留引用检查**

Run: `grep -rn "components/crud\|components/ui\|ToastProvider\|useToast" app components lib || true`
Expected: 无 `app`/`components` 命中（`lib/csv.ts` 已清理）。若仍有命中，说明某页面漏改，回到对应 Task。

- [ ] **Step 5: 验证构建与回归测试**

Run: `npm run build && npm test`
Expected: build PASS；vitest 全部通过（`lib/` 不依赖 UI）。

- [ ] **Step 6: 全站冒烟**

Run: `npm run dev`，逐页点开 17 个路由，确认无运行时错误、无控制台报错。
Expected: 全通过；Ctrl+C 结束。

- [ ] **Step 7: Commit**

```bash
git rm components/crud/crud-page.tsx components/crud/data-table.tsx components/crud/import-modal.tsx components/crud/quick-add.tsx components/crud/types.ts
git rm components/ui/modal.tsx components/ui/toast.tsx components/ui/stat-card.tsx components/ui/page-header.tsx components/ui/chart-card.tsx components/ui/empty-state.tsx components/ui/inline-edit.tsx components/ui/color-utils.ts
git add lib/csv.ts app/globals.css
git commit -m "chore: remove legacy custom component layer after antd migration"
```

---

### Task 24: 最终验收（手动回归清单）

**Files:** 无（验收）。

- [ ] **Step 1: 构建与测试**

Run: `npm run build` 且 `npm test`
Expected: 均通过。

- [ ] **Step 2: 桌面端实测**

Run: `npm run dev`
- `/` 8 张统计卡与快捷操作（含 QuickAdd 新增后到对应页可见）。
- 学生管理：内联编辑保存/回滚、学号排序、性别/层次列筛选、导入（模板下载→改一行→上传）、列显隐本地持久化、删除。
- 课表：改变某单元格学科后语文色块与统计联动。
- 成绩分析：切考试/学科后统计与直方图更新；改分数实时保存。
- 作业管理：录入收缴后进度条更新。
- 生涯家访：Tag 切换类型。
- 排座位：安排/移除/导出。
- 系统设置：保存班级名、重置、备份。
- 其余 CRUD 页各自「新增/编辑/导出/删除」各过一遍。
- 顶栏「编辑/完成」开关：切到「完成」后所有单元格不可编辑。

Expected: 全通过。

- [ ] **Step 3: 移动端实测**

在浏览器 DevTools 切到 375px 视口（或真机同 Wi-Fi 打开 `http://局域网IP:3000`）：
- 侧边栏变 Drawer，汉堡按钮可用，菜单可跳转。
- 各表格横向滚动、列显隐可用。

Expected: 全通过。

- [ ] **Step 4: Step 完成后的收尾**

全部通过后无需提交代码。若验收发现缺陷，记录后回到对应 Task 修复并重新 build/test。

---

## 执行说明

- 任务严格按 1→24 顺序执行；任一任务 `npm run build` 失败先修本任务错误再前进。
- 每个任务独立提交；提交信息前缀遵循 `feat:`/`fix:`/`chore:`/`docs:`。
- 旧组件层在 Task 23 才删除，在此之前勿提前删，以免断链。
- 若 antd v6 某 API 与你预期不同，以 `node_modules/antd/es/**/index.d.ts` 为准微调（如图标命名），并保持改动最小。