# antd → HeroUI v3 组件库迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将前端组件层从 antd v6 全量迁移到 `@heroui/react@3.2.4`（HeroUI v3），**功能全保留**（表格排序/列筛选/分页/列显隐/内联编辑/CSV 导入导出、统计卡、快捷操作、编辑开关），数据层与通用 API 不动。

**Architecture:** 与 antd 方案不同，本迁移新建一套共享件把 HeroUI v3（React Aria 底层）的复杂度收敛：`DataTable`（RAC Table 封装：排序/筛选/分页/内联编辑）、`FormModal`（字段配置驱动弹窗表单）、`Confirm`（AlertDialog 确认框）、`StatCard`、重写的 `EditableCell`/`TableToolbar`、`lib/toast.ts`。页面退化为「列配置 + 字段配置 + 回调」的声明式薄壳。日期字段统一用原生 `<input type="date">`（内联与表单一致，免去 CalendarDate 转换层）。无 Provider 包裹（v3 不需要），样式 `@import "@heroui/styles"` 一行引入。

**Tech Stack:** Next.js 16 App Router、React 19、`@heroui/react@3.2.4`、lucide-react、Tailwind v4、dayjs（日期计算/格式化）、recharts（图表）、Vitest、TypeScript 严格模式。Node >= 22（本机 24）。

## Global Constraints

- 数据层 `lib/schema.ts`/`lib/store.ts`/`lib/seed.ts`/`lib/db.ts`/`lib/dashboard.ts`/`lib/import.ts`/`lib/api-client.ts`/`lib/csv.ts`、`app/api/**`、`tests/` **一律不动**。
- **不做 CDP 测试**（不写任何 Playwright/CDP 浏览器自动化）。每任务验证 = `npm run build`（含 typecheck+lint）；最后 `npm test`（Vitest 不依赖 UI）。
- 文案保持中文。`dayjs.locale('zh-cn')` 与 `DayjsLocale` 组件保留（`components/dayjs-locale.tsx` 不动）。
- 列显隐 localStorage 键沿用 `gzt:cols:{resource}`，不丢用户已保存设置（`useColumnVisibility` 逻辑不变，仅换 UI 层）。
- **HeroUI v3 API 以安装包为准**：不确定时先 `grep -E "declare const|<compound>" node_modules/@heroui/react/dist/components/<name>/index.d.ts` 核实（复合组件子件：如 `Modal.Header`/`Modal.Body`；受控用 `isOpen`/`onOpenChange` 或 `state`）。类型定义在 `node_modules/@heroui/react/dist/components/<name>/<name>.d.ts`，变体名（`variant`/`size`/`color`）在 `node_modules/.pnpm/node_modules/@heroui/styles/dist/components/<name>/<name>.styles.d.ts`。
- lucide-react 图标名以实际导出为准：`node -e "console.log(!!require('lucide-react').<Name>)"` 核实；拼错会在 build 报错，替换为存在的图标即可。
- 提交信息沿用仓库前缀（`feat:`/`fix:`/`chore:`/`docs:`）。
- 内联编辑保存仍走 `PUT /api/{resource}/{id}`（`useResourceRows.update`）；`nullOnEmpty` 时空串转 `null`。
- `Button` 用 RAC `onPress`（不是 `onClick`）。`Button` 变体：`variant={primary|secondary|tertiary|danger|danger-soft|ghost|outline}`，`size={sm|md|lg}`，`fullWidth`、`isIconOnly`、`isDisabled`。图标放 children 里（`<Button variant="outline" size="sm"><Icon/> 导出</Button>`）。
- `Input`/`TextArea` 用受控 `value`/`onChange`（字符串）；数字字段统一 `<Input type="number">`，提交/保存时 `Number(v) || 0` 转换。`isRequired`/`isInvalid`/`errorMessage` 用于校验展示。
- `Select` 组合：`<Select selectedKey onSelectionChange size fullWidth isInvalid><Select.Trigger><Select.Value placeholder/></Select.Trigger><Select.Indicator/><Select.Popover><ListBox><ListBox.Item id={v}>{label}</ListBox.Item>…</ListBox></Select.Popover></Select>`。`selectedKey` 为字符串；`onSelectionChange` 回调 `Key | null`。
- `Modal`/`Drawer`/`AlertDialog`/`Popover`/`Dropdown` 受控：`<X isOpen={open} onOpenChange={setOpen}>`。`Modal` 内部用 `.Backdrop/.Container/.Header/.Heading/.Body/.Footer`；`Drawer` 用 `.Backdrop/.Content/.Header/.Heading/.Body/.Footer`；`AlertDialog` 用 `.Backdrop/.Container/.Icon/.Heading/.Body/.Footer`；`Popover` 用 `.Trigger/.Content`。
- Toast：`components/toast-provider.tsx` 在 layout 挂载一次；页面统一 `import { toast } from '@/lib/toast'`，用 `toast.success/warning/error`（`error` 映射 HeroUI 的 `danger`）。
- AGENTS.md 提示本项目 Next.js 有 breaking changes：不确定处先读 `node_modules/next/dist/docs/`。

## File Structure

**Create:**
- `lib/toast.ts` — toast 封装（`success/warning/error/info`，`error`→`danger`）
- `components/toast-provider.tsx` — 挂载 `Toast.Provider`（client 边界）
- `components/stat-card.tsx` — 统计卡（label+value+suffix）
- `components/confirm.tsx` — AlertDialog 确认框
- `components/data-table.tsx` — RAC Table 封装（排序/筛选/分页/列显隐/内联编辑/loading/空态）
- `components/form-modal.tsx` — 字段配置驱动弹窗表单

**Modify (rewrite):**
- `app/globals.css` — `@import "@heroui/styles";` + 保留 `@theme` 色板
- `app/layout.tsx` — 去掉 antd 三层 Provider，挂 `ToastProvider`；保留 `DayjsLocale` + `AppShell`
- `components/editable-cell.tsx` — HeroUI 控件 + 原生 date input
- `components/table-toolbar.tsx` — HeroUI 按钮 + Popover 列菜单 + 隐藏 file input（`useColumnVisibility` 逻辑保留）
- `components/app-shell.tsx` — 自定义 Tailwind 壳（桌面 Sider + 移动 Drawer）
- 16 个路由页 + 4 个 `components/timetable/*`（逐个重写）

**Delete (last cleanup task):**
- 依赖 `antd`、`@ant-design/icons`、`@ant-design/nextjs-registry`

**Dependencies (已装，勿重复安装):** `@heroui/react@3.2.4`、`lucide-react@1.34.0`。Task 1 不再装包，只改 CSS/布局；卸载 antd 三件套放到最后一轮。

---

### Task 1: 全局接入（globals.css / layout / Toast 基建）

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Create: `components/toast-provider.tsx`
- Create: `lib/toast.ts`

**Interfaces:**
- Produces: `lib/toast.ts` 导出 `toast = { success(msg): void; warning(msg): void; error(msg): void; info(msg): void }`。后续所有页面用 `import { toast } from '@/lib/toast'`。
- Produces: `components/toast-provider.tsx` 默认导出无参组件，页面无需引用（layout 挂载）。
- Consumes: `@heroui/react` 的 `Toast`/`toast`（已在 Task 0 安装）。

- [ ] **Step 1: 重写 `app/globals.css`**

把 `@import "tailwindcss";` 替换为 `@import "@heroui/styles";`（HeroUI 样式含 Tailwind base + 组件样式 + 主题变量 + 动画），`@theme` 与 `body` 保留：

```css
@import "@heroui/styles";

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

- [ ] **Step 2: 新建 `components/toast-provider.tsx`**

```tsx
'use client';
import { Toast, toast } from '@heroui/react';

export default function ToastProvider() {
  return <Toast.Provider queue={toast.getQueue()} placement="top-center" />;
}
```

- [ ] **Step 3: 新建 `lib/toast.ts`**

```ts
'use client';
import { toast as heroToast } from '@heroui/react';

export const toast = {
  success: (msg: string) => heroToast.success(msg),
  warning: (msg: string) => heroToast.warning(msg),
  error: (msg: string) => heroToast.danger(msg),
  info: (msg: string) => heroToast.info(msg),
};
```

- [ ] **Step 4: 重写 `app/layout.tsx`**

删除 antd 相关导入与 Provider，挂 `ToastProvider`，其余保留：

```tsx
import type { Metadata } from 'next';
import './globals.css';
import AppShell from '@/components/app-shell';
import DayjsLocale from '@/components/dayjs-locale';
import ToastProvider from '@/components/toast-provider';

export const metadata: Metadata = {
  title: '班主任智慧工作台',
  description: '长沙小学六年级班主任智慧班级管理工作台',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <DayjsLocale />
        <ToastProvider />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: 验证构建**

Run: `npm run build`
Expected: PASS（此刻旧 antd 组件还在，build 应全绿，仅 CSS/布局变化）。

- [ ] **Step 6: Commit**

```bash
git add app/globals.css app/layout.tsx components/toast-provider.tsx lib/toast.ts
git commit -m "feat: switch styles to hero-ui and mount toast provider"
```

---

### Task 2: 共享件 —— StatCard + Confirm

**Files:**
- Create: `components/stat-card.tsx`
- Create: `components/confirm.tsx`

**Interfaces:**
- Produces: `StatCard({ title, value, suffix?, className? })`（无状态展示组件）。
- Produces: `Confirm({ open, onOpenChange, title, message, confirmText?, cancelText?, danger?, onConfirm })`。`onConfirm: () => void | Promise<void>`；确认后由调用方关闭。
- Consumes: `@heroui/react` 的 `AlertDialog`/`Button`。

- [ ] **Step 1: 新建 `components/stat-card.tsx`**

```tsx
export default function StatCard({ title, value, suffix, className }: {
  title: string;
  value: string | number;
  suffix?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white px-4 py-3 ${className ?? ''}`}>
      <div className="text-xs text-slate-500">{title}</div>
      <div className="mt-1 text-xl font-semibold text-slate-800">
        {value}
        {suffix ? <span className="ml-1 text-xs font-normal text-slate-400">{suffix}</span> : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 新建 `components/confirm.tsx`**

```tsx
'use client';
import { AlertDialog, Button } from '@heroui/react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}

export default function Confirm({ open, onOpenChange, title, message, confirmText = '确定', cancelText = '取消', danger, onConfirm }: Props) {
  return (
    <AlertDialog isOpen={open} onOpenChange={onOpenChange}>
      <AlertDialog.Backdrop isDismissable />
      <AlertDialog.Container placement="center" size="sm">
        <AlertDialog.Icon status={danger ? 'danger' : 'default'} />
        <AlertDialog.Heading>{title}</AlertDialog.Heading>
        <AlertDialog.Body>{message}</AlertDialog.Body>
        <AlertDialog.Footer>
          <Button variant="ghost" onPress={() => onOpenChange(false)}>{cancelText}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onPress={() => void onConfirm()}>{confirmText}</Button>
        </AlertDialog.Footer>
      </AlertDialog.Container>
    </AlertDialog>
  );
}
```

- [ ] **Step 3: 验证构建**

Run: `npm run build`
Expected: PASS。若 `AlertDialog.Container` 等子件名报错，以 `node_modules/@heroui/react/dist/components/alert-dialog/index.d.ts` 导出名为准调整。

- [ ] **Step 4: Commit**

```bash
git add components/stat-card.tsx components/confirm.tsx
git commit -m "feat: add stat-card and alert-dialog confirm"
```

---

### Task 3: `EditableCell` 重写（HeroUI 控件）

**Files:**
- Modify: `components/editable-cell.tsx`（整文件重写）

**Interfaces:**
- Consumes: `useEditable()`（`./editable-context`，不动）、`toast` from `@/lib/toast`。
- Produces（接口与旧版一致）:
  - `export type EditableType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'tel'`
  - `interface Props { value: string | number | null; type?: EditableType; options?: string[]; nullOnEmpty?: boolean; onSave: (value: string | number | null) => Promise<void>; className?: string }`
  - `export default function EditableCell(props: Props)`
- 行为契约不变：非编辑态显示值、空值显示 `—`；点按进入编辑；text/number/textarea 失焦或回车保存，select/date 变更即保存；`editable=false` 禁用；保存失败 `toast.error('保存失败')`。**date 类型用原生 `<input type="date">`**。

- [ ] **Step 1: 整文件重写 `components/editable-cell.tsx`**

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Input, ListBox, Select, TextArea } from '@heroui/react';
import { Pencil } from 'lucide-react';
import { useEditable } from './editable-context';
import { toast } from '@/lib/toast';

export type EditableType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'tel';

interface Props {
  value: string | number | null;
  type?: EditableType;
  options?: string[];
  nullOnEmpty?: boolean;
  onSave: (value: string | number | null) => Promise<void>;
  className?: string;
}

const dateInputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-slate-800 focus:border-accent focus:outline-none';

export default function EditableCell({ value, type = 'text', options, nullOnEmpty, onSave, className }: Props) {
  const { editable } = useEditable();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(String(value ?? ''));
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  if (!editable || !editing) {
    const display = value === null || value === '' ? '—' : String(value);
    return (
      <span
        className={`group block w-full rounded px-1 py-0.5 cursor-text ${editable ? 'hover:bg-gray-100' : 'cursor-default'} ${className ?? ''}`}
        title={editable ? '点击编辑' : undefined}
        onClick={() => { if (editable) { setDraft(String(value ?? '')); setEditing(true); } }}
      >
        {display}
        {editable && <Pencil size={11} className="ml-1 inline text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />}
      </span>
    );
  }

  const cancel = () => setEditing(false);
  const save = async (v: string | number | null) => {
    setEditing(false);
    if (String(v) === String(value ?? '')) return;
    try { await onSave(v); }
    catch { toast.error('保存失败'); }
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
        aria-label="选择"
        size="sm"
        className="w-full"
        selectedKey={value === null || value === '' ? '' : String(value)}
        onSelectionChange={(k) => void save(k === null || k === '' ? null : String(k))}
      >
        <Select.Trigger><Select.Value placeholder="选择" /></Select.Trigger>
        <Select.Indicator />
        <Select.Popover>
          <ListBox>
            {options.map(o => <ListBox.Item key={o} id={o}>{o === '' ? '（清空）' : o}</ListBox.Item>)}
          </ListBox>
        </Select.Popover>
      </Select>
    );
  }
  if (type === 'date') {
    return (
      <input
        ref={inputRef}
        type="date"
        autoFocus
        className={dateInputCls}
        defaultValue={String(value ?? '')}
        onBlur={(e) => void save(e.target.value || null)}
      />
    );
  }
  if (type === 'textarea') {
    return (
      <TextArea
        autoFocus rows={2} size="sm" className="w-full"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => void save(nullOnEmpty && draft === '' ? null : draft)}
        onKeyDown={onKey}
      />
    );
  }
  if (type === 'number') {
    return (
      <Input
        ref={inputRef} autoFocus size="sm" type="number" className="w-24"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={onBlurSave}
        onKeyDown={onKey}
      />
    );
  }
  return (
    <Input
      ref={inputRef} size="sm" className="min-w-32"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={onBlurSave}
      onKeyDown={onKey}
    />
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。若 `Select.Indicator`/`TextArea` 等报错，按 Global Constraints 的 grep 命令核实导出名。

- [ ] **Step 3: Commit**

```bash
git add components/editable-cell.tsx
git commit -m "feat: rewrite editable cell with hero-ui controls"
```

---

### Task 4: `DataTable` —— RAC Table 封装（核心）

**Files:**
- Create: `components/data-table.tsx`

**Interfaces:**
- Consumes: `Row` from `@/lib/types`；`EditableCell`（Task 3）；`@heroui/react` 的 `Table/ListBox/Popover/Select/Button/Pagination/Skeleton`；lucide 图标；`SortDescriptor` from `@heroui/react/rac`。
- Produces:
  - `export type CellType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'tel'`
  - `export interface ColumnDef { key: string; label: string; type?: CellType; options?: string[]; nullOnEmpty?: boolean; width?: number | string; sortable?: boolean; sortValue?: (row: Row) => string | number | null; filterOptions?: string[]; align?: 'left' | 'center' | 'right'; render?: (value: unknown, row: Row) => ReactNode }`
  - `export interface DataTableProps { columns: ColumnDef[]; rows: Row[]; loading?: boolean; label: string; onSave?: (id: number, patch: Partial<Row>) => Promise<void>; pageSize?: number; actions?: (row: Row) => ReactNode; emptyText?: string }`
  - `export default function DataTable(props: DataTableProps)`
- 语义：`filterOptions` 的列不可同时 `sortable`（避免表头点击冲突，应用现状即如此）；`sortable` 列用 `sortValue ?? (row => row[key])` 比较；`pageSize` 提供时启用分页；`actions` 提供时渲染右侧「操作」列；`onSave` 为空时 `type` 列退化为只读文本。

- [ ] **Step 1: 新建 `components/data-table.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, ListBox, Pagination, Popover, Select, Skeleton, Table } from '@heroui/react';
import type { SortDescriptor } from '@heroui/react/rac';
import { FilterX, SlidersHorizontal } from 'lucide-react';
import EditableCell from './editable-cell';
import type { Row } from '@/lib/types';

export type CellType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'tel';

export interface ColumnDef {
  key: string;
  label: string;
  type?: CellType;
  options?: string[];
  nullOnEmpty?: boolean;
  width?: number | string;
  sortable?: boolean;
  sortValue?: (row: Row) => string | number | null;
  filterOptions?: string[];
  align?: 'left' | 'center' | 'right';
  render?: (value: unknown, row: Row) => ReactNode;
}

export interface DataTableProps {
  columns: ColumnDef[];
  rows: Row[];
  loading?: boolean;
  label: string;
  onSave?: (id: number, patch: Partial<Row>) => Promise<void>;
  pageSize?: number;
  actions?: (row: Row) => ReactNode;
  emptyText?: string;
}

const compare = (a: string | number | null, b: string | number | null, dir: 'ascending' | 'descending'): number => {
  const na = Number(a); const nb = Number(b);
  const bothNum = a !== null && b !== null && a !== '' && b !== '' && !Number.isNaN(na) && !Number.isNaN(nb);
  const r = bothNum ? na - nb : String(a ?? '').localeCompare(String(b ?? ''), 'zh-CN');
  return dir === 'ascending' ? r : -r;
};

const fmtCell = (v: unknown): string => (v === null || v === '' ? '—' : String(v));

export default function DataTable({ columns, rows, loading, label, onSave, pageSize, actions, emptyText }: DataTableProps) {
  const [sort, setSort] = useState<SortDescriptor>({});
  const [filters, setFilters] = useState<Record<string, string | null>>({});
  const [page, setPage] = useState(1);

  const renderCols = useMemo<Array<ColumnDef & { key: string }>>(() =>
    actions ? [...columns, { key: '__actions', label: '操作' }] : columns,
    [columns, actions]);

  const filtered = useMemo(() => {
    let list = rows;
    for (const col of columns) {
      const fv = filters[col.key];
      if (fv != null && col.filterOptions) list = list.filter(r => String(r[col.key]) === fv);
    }
    if (sort.column && sort.direction) {
      const col = columns.find(c => c.key === sort.column);
      if (col) {
        const keyOf = col.sortValue ?? ((r: Row) => r[col.key] as string | number | null);
        list = [...list].sort((a, b) => compare(keyOf(a), keyOf(b), sort.direction!));
      }
    }
    return list;
  }, [rows, columns, filters, sort]);

  const pageCount = pageSize ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
  const visible = pageSize ? filtered.slice((page - 1) * pageSize, page * pageSize) : filtered;
  const resetPage = () => setPage(1);

  const setFilter = (key: string, v: string | null) => {
    setFilters(prev => ({ ...prev, [key]: v }));
    setPage(1);
  };

  const sortToggle = (key: string) => {
    setSort(prev => {
      if (prev.column === key) {
        if (prev.direction === 'ascending') return { column: key, direction: 'descending' };
        if (prev.direction === 'descending') return {};
        return { column: key, direction: 'ascending' };
      }
      return { column: key, direction: 'ascending' };
    });
    setPage(1);
  };

  const cell = (col: ColumnDef, r: Row): ReactNode => {
    if (col.key === '__actions') return actions!(r);
    if (col.render) return col.render(r[col.key], r);
    if (col.type && onSave) {
      return (
        <EditableCell
          value={r[col.key] as string | number | null}
          type={col.type}
          options={col.options}
          nullOnEmpty={col.nullOnEmpty}
          onSave={v => onSave(Number(r.id), { [col.key]: v })}
        />
      );
    }
    return <span>{fmtCell(r[col.key])}</span>;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-10 rounded-lg" />
      </div>
    );
  }

  return (
    <div>
      <Table.Root>
        <Table.Content aria-label={label} sortDescriptor={sort} onSortChange={(d) => { setSort(d); resetPage(); }}>
          <Table.Header columns={renderCols}>
            {(col: ColumnDef & { key: string }) => (
              <Table.Column
                key={col.key}
                id={col.key}
                allowsSorting={col.sortable}
                isRowHeader={col.key === renderCols[0]?.key}
                width={col.width}
              >
                {({ sortDirection }: { sortDirection?: 'ascending' | 'descending' }) => (
                  <div className="flex items-center gap-1.5">
                    {col.sortable ? (
                      <Table.SortableColumnHeader sortDirection={sortDirection}>{col.label}</Table.SortableColumnHeader>
                    ) : (
                      <span>{col.label}</span>
                    )}
                    {col.filterOptions && (
                      <ColumnFilter col={col} value={filters[col.key] ?? null} onChange={setFilter} />
                    )}
                  </div>
                )}
              </Table.Column>
            )}
          </Table.Header>
          <Table.Body
            items={visible}
            renderEmptyState={() => (
              <div className="py-12 text-center text-sm text-slate-400">{emptyText ?? '暂无数据'}</div>
            )}
          >
            {(item: Row) => (
              <Table.Row id={(item.id as number) ?? item.id}>
                {renderCols.map(col => (
                  <Table.Cell
                    key={col.key}
                    className={col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}
                  >
                    {cell(col, item)}
                  </Table.Cell>
                ))}
              </Table.Row>
            )}
          </Table.Body>
        </Table.Content>
      </Table.Root>
      {pageSize && pageCount > 1 && (
        <Pagination.Root size="sm" className="mt-3 flex justify-end">
          <Pagination.Content>
            <Pagination.Item><Pagination.Previous onPress={() => setPage(p => Math.max(1, p - 1))} /></Pagination.Item>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map(p => (
              <Pagination.Item key={p}>
                <Pagination.Link isActive={p === page} onPress={() => setPage(p)}>{p}</Pagination.Link>
              </Pagination.Item>
            ))}
            <Pagination.Item><Pagination.Next onPress={() => setPage(p => Math.min(pageCount, p + 1))} /></Pagination.Item>
          </Pagination.Content>
        </Pagination.Root>
      )}
    </div>
  );
}

function ColumnFilter({ col, value, onChange }: { col: ColumnDef; value: string | null; onChange: (key: string, v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover isOpen={open} onOpenChange={setOpen} placement="bottom">
      <Popover.Trigger>
        <button
          type="button"
          aria-label={`筛选${col.label}`}
          onClick={(e) => e.stopPropagation()}
          className={`rounded p-0.5 ${value ? 'text-accent' : 'text-slate-400 hover:text-slate-600'}`}
        >
          {value ? <FilterX size={14} /> : <SlidersHorizontal size={14} />}
        </button>
      </Popover.Trigger>
      <Popover.Content>
        <div className="w-44 p-2">
          <Select
            aria-label={`筛选${col.label}`}
            size="sm"
            fullWidth
            selectedKey={value ?? ''}
            onSelectionChange={(k) => onChange(col.key, k === null || k === '' ? null : String(k))}
          >
            <Select.Trigger><Select.Value placeholder="全部" /></Select.Trigger>
            <Select.Indicator />
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="">全部</ListBox.Item>
                {(col.filterOptions ?? []).map(o => <ListBox.Item key={o} id={o}>{o}</ListBox.Item>)}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
      </Popover.Content>
    </Popover>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。注意排查点（若报错按 Global Constraints 核实）：
- `Table.Content`/`Table.Header`/`Table.Column`/`Table.Body`/`Table.Row`/`Table.Cell`/`Table.SortableColumnHeader`/`Table.Root` 子件名。
- RAC `Table.Header columns` render-prop、`Table.Column` children render-prop 的 `sortDirection` 参数。
- `SortDescriptor` 从 `@heroui/react/rac` 导入是否正确。
- `Popover` 受控 `isOpen`/`onOpenChange`、`Table.Body` 的 `renderEmptyState`。

- [ ] **Step 3: Commit**

```bash
git add components/data-table.tsx
git commit -m "feat: data-table wrapping hero-ui rac table with sort/filter/pagination"
```

---

### Task 5: `TableToolbar` 重写

**Files:**
- Modify: `components/table-toolbar.tsx`（整文件重写）

**Interfaces:**
- Consumes: `Row` from `@/lib/types`；`downloadCsv` from `@/lib/csv`；`@heroui/react` 的 `Button/Checkbox/Popover`；lucide 图标。
- Produces（接口与旧版一致）:
  - `useColumnVisibility(storageKey: string, defaultHidden?: string[]): { hidden: Set<string>; toggle(key: string): void }`
  - `export interface ToolbarColumn { key: string; label: string; exportable?: boolean }`
  - `interface Props { title: string; columns: ToolbarColumn[]; hidden: Set<string>; onToggleColumn: (key: string) => void; rows: Row[]; onAdd?: () => void; onImport?: (text: string) => Promise<void> }`
  - `export default function TableToolbar(props: Props)`
- 语义：新增/导出/导入/列显隐按钮；导入用隐藏 `<input type="file" accept=".csv">`，读取文本后调 `onImport`；列菜单用 Popover 内的 Checkbox 列表。

- [ ] **Step 1: 整文件重写 `components/table-toolbar.tsx`**

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Checkbox, Popover } from '@heroui/react';
import { Columns3, Download, Plus, Upload } from 'lucide-react';
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
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [colOpen, setColOpen] = useState(false);

  const exportable = columns.filter(c => (c.exportable ?? true) && !hidden.has(c.key));
  const exportCsv = () => {
    downloadCsv(`${title}.csv`, exportable.map(c => c.label), rows.map(r => exportable.map(c => r[c.key] ?? '')));
  };
  const handleFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => { void onImport!(String(reader.result ?? '')); };
    reader.readAsText(f);
  };

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="m-0 text-lg font-semibold text-slate-800">{title}</h2>
      <div className="flex flex-wrap items-center gap-2">
        {onImport && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
            />
            <Button variant="outline" size="sm" onPress={() => fileRef.current?.click()}>
              <Upload size={16} /> 导入
            </Button>
          </>
        )}
        <Button variant="outline" size="sm" onPress={exportCsv}>
          <Download size={16} /> 导出
        </Button>
        <Popover isOpen={colOpen} onOpenChange={setColOpen} placement="bottom-end">
          <Popover.Trigger>
            <Button variant="outline" size="sm">
              <Columns3 size={16} /> 列
            </Button>
          </Popover.Trigger>
          <Popover.Content>
            <div className="w-44 p-2">
              {columns.map(c => (
                <label key={c.key} className="flex items-center gap-2 px-1 py-1 text-sm text-slate-700">
                  <Checkbox size="sm" isSelected={!hidden.has(c.key)} onChange={() => onToggleColumn(c.key)}>
                    {c.label}
                  </Checkbox>
                </label>
              ))}
            </div>
          </Popover.Content>
        </Popover>
        {onAdd && (
          <Button variant="primary" size="sm" onPress={onAdd}>
            <Plus size={16} /> 新增
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add components/table-toolbar.tsx
git commit -m "feat: rewrite table toolbar with hero-ui buttons and popover column menu"
```

---

### Task 6: `FormModal` —— 字段配置驱动弹窗表单

**Files:**
- Create: `components/form-modal.tsx`

**Interfaces:**
- Consumes: `@heroui/react` 的 `Modal/Button/Input/TextArea/Select/ListBox/Label`。
- Produces:
  - `export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select'`
  - `export interface FieldDef { key: string; label: string; type?: FieldType; options?: Array<string | { value: string; label: string }>; required?: boolean; placeholder?: string; initial?: string | number }`
  - `interface Props { title: string; fields: FieldDef[]; open: boolean; onClose: () => void; onSubmit: (values: Record<string, string | number | null>) => Promise<void> | void; initial?: Record<string, unknown>; size?: 'sm' | 'md' }`
  - `export default function FormModal(props: Props)`
- 语义：打开时按 `initial ?? fields[].initial` 初始化（date 字段无初始时默认今天）；必填校验通过 `required`，保存按钮 `onSubmit(values)` 后由调用方关闭；日期用原生 `<input type="date">`；number 用 `<Input type="number">`（提交转 `Number`，空转 `null`）。
- **注意**：`fields` 变化不应清空正在编辑的值，初始化只在 open 由 false→true 时发生（见下方 `wasOpen` 模式）。

- [ ] **Step 1: 新建 `components/form-modal.tsx`**

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Input, Label, ListBox, Modal, Select, TextArea } from '@heroui/react';

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select';
export interface FieldDef {
  key: string;
  label: string;
  type?: FieldType;
  options?: Array<string | { value: string; label: string }>;
  required?: boolean;
  placeholder?: string;
  initial?: string | number;
}

interface Props {
  title: string;
  fields: FieldDef[];
  open: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, string | number | null>) => Promise<void> | void;
  initial?: Record<string, unknown>;
  size?: 'sm' | 'md';
}

const dateInputCls =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-accent focus:outline-none';

const optsOf = (o?: Array<string | { value: string; label: string }>) =>
  (o ?? []).map(x => (typeof x === 'string' ? { value: x, label: x } : x));

export default function FormModal({ title, fields, open, onClose, onSubmit, initial, size = 'md' }: Props) {
  const [values, setValues] = useState<Record<string, string | number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // fields/initial 用 ref 快照，避免引用变化清空正在编辑的值；只在 open false→true 时初始化
  const fieldsRef = useRef(fields); fieldsRef.current = fields;
  const initialRef = useRef(initial); initialRef.current = initial;
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      const v: Record<string, string | number> = {};
      for (const f of fieldsRef.current) {
        const val = initialRef.current?.[f.key] ?? f.initial ?? '';
        v[f.key] = val === null || val === undefined ? '' : String(val);
      }
      setValues(v);
      setErrors({});
    }
    wasOpen.current = open;
  }, [open]);

  const set = (key: string, val: string | number) => {
    setValues(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const submit = async () => {
    const errs: Record<string, string> = {};
    for (const f of fields) {
      if (f.required && String(values[f.key] ?? '').trim() === '') errs[f.key] = `请填写${f.label}`;
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setBusy(true);
    try {
      const body: Record<string, string | number | null> = {};
      for (const f of fields) {
        const val = values[f.key];
        body[f.key] = f.type === 'number' ? (String(val ?? '').trim() === '' ? null : Number(val)) : String(val ?? '');
      }
      await onSubmit(body);
    } finally { setBusy(false); }
  };

  return (
    <Modal isOpen={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Modal.Backdrop isDismissable />
      <Modal.Container placement="center" size={size}>
        <Modal.Header><Modal.Heading>{title}</Modal.Heading></Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            {fields.map(f => {
              const opts = optsOf(f.options);
              return (
                <div key={f.key}>
                  <Label isRequired={f.required} className="mb-1 block text-sm text-slate-700">{f.label}</Label>
                  {f.type === 'textarea' ? (
                    <TextArea
                      rows={2} size="sm" fullWidth
                      value={String(values[f.key] ?? '')}
                      onChange={e => set(f.key, e.target.value)}
                      isInvalid={!!errors[f.key]}
                    />
                  ) : f.type === 'date' ? (
                    <input
                      type="date"
                      className={dateInputCls}
                      value={String(values[f.key] ?? '')}
                      onChange={e => set(f.key, e.target.value)}
                    />
                  ) : f.type === 'select' ? (
                    <Select
                      aria-label={f.label}
                      size="sm"
                      fullWidth
                      isInvalid={!!errors[f.key]}
                      selectedKey={values[f.key] == null || values[f.key] === '' ? '' : String(values[f.key])}
                      onSelectionChange={(k) => set(f.key, k === null ? '' : String(k))}
                    >
                      <Select.Trigger><Select.Value placeholder={f.placeholder ?? '请选择'} /></Select.Trigger>
                      <Select.Indicator />
                      <Select.Popover>
                        <ListBox>
                          {opts.map(o => <ListBox.Item key={o.value} id={o.value}>{o.label}</ListBox.Item>)}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  ) : (
                    <Input
                      size="sm"
                      fullWidth
                      type={f.type === 'number' ? 'number' : 'text'}
                      value={String(values[f.key] ?? '')}
                      onChange={e => set(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      isInvalid={!!errors[f.key]}
                    />
                  )}
                  {errors[f.key] && <p className="mt-1 text-xs text-red-600">{errors[f.key]}</p>}
                </div>
              );
            })}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onPress={onClose} isDisabled={busy}>取消</Button>
          <Button variant="primary" onPress={() => void submit()} isDisabled={busy}>{busy ? '保存中…' : '保存'}</Button>
        </Modal.Footer>
      </Modal.Container>
    </Modal>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。若 `Label`/`Modal.Heading`/`TextArea` 等报错，按 Global Constraints grep 核实。

- [ ] **Step 3: Commit**

```bash
git add components/form-modal.tsx
git commit -m "feat: field-config-driven form modal with hero-ui controls"
```

---

### Task 7: 壳层 `app-shell` 重写（自定义 Tailwind 侧边栏 + Drawer）

**Files:**
- Modify: `components/app-shell.tsx`（整文件重写）

**Interfaces:**
- Consumes: `EditableProvider`/`useEditable`（`./editable-context`，不动）；`@heroui/react` 的 `Button/Drawer/useMediaQuery`；`/api/me`、`/api/logout`。
- Produces: 新 `AppShell`：桌面固定左侧栏（`bg-navy` 深色，navy 来自 globals.css `@theme`）+ 顶栏（汉堡/班级名/时钟/用户名/退出/编辑开关）+ 移动端 HeroUI `Drawer`。菜单沿用现有路由与角色逻辑（admin 仅见设置+用户管理；admin 误入业务页重定向回 `/settings`）。`/login` 路径裸渲染 children。
- 图标用 lucide；`useMediaQuery('(max-width: 767px)')` 判断移动端。

- [ ] **Step 1: 整文件重写 `components/app-shell.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button, Drawer, useMediaQuery } from '@heroui/react';
import {
  Armchair, BarChart3, CalendarDays, FileClock, Flag, Home, LayoutDashboard,
  LogOut, Menu, MessageSquare, MessagesSquare, Settings, ShieldCheck, Star,
  UserMinus, Users, UsersRound,
} from 'lucide-react';
import dayjs from 'dayjs';
import { EditableProvider, useEditable } from './editable-context';

interface Me { user: { name: string; role: string; class_id: number | null }; class: { name: string } | null }

const BUSINESS = [
  { key: '/', icon: <LayoutDashboard size={18} />, label: '仪表盘' },
  { key: '/timetable', icon: <CalendarDays size={18} />, label: '我的课表' },
  { key: '/students', icon: <Users size={18} />, label: '学生管理' },
  { key: '/grades', icon: <BarChart3 size={18} />, label: '成绩分析' },
  { key: '/leaves', icon: <UserMinus size={18} />, label: '请假管理' },
  { key: '/discipline', icon: <Flag size={18} />, label: '违纪台账' },
  { key: '/conversations', icon: <MessageSquare size={18} />, label: '谈话记录' },
  { key: '/visits', icon: <Home size={18} />, label: '生涯家访' },
  { key: '/evaluation', icon: <Star size={18} />, label: '综合素质评价' },
  { key: '/seats', icon: <Armchair size={18} />, label: '排座位' },
  { key: '/parent-comm', icon: <MessagesSquare size={18} />, label: '家校沟通' },
  { key: '/safety', icon: <ShieldCheck size={18} />, label: '安全台账' },
  { key: '/work-logs', icon: <FileClock size={18} />, label: '工作留痕' },
];
const SETTINGS = { key: '/settings', icon: <Settings size={18} />, label: '系统设置' };
const USERS = { key: '/users', icon: <UsersRound size={18} />, label: '用户管理' };

function ShellHeader({ mobile, me, onOpenDrawer }: { mobile: boolean; me: Me | null; onOpenDrawer: () => void }) {
  const { editable, toggle } = useEditable();
  const router = useRouter();
  const [now, setNow] = useState('');
  useEffect(() => {
    const tick = () => setNow(dayjs().format('YYYY-MM-DD HH:mm:ss'));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  const logout = async () => { await fetch('/api/logout', { method: 'POST' }); router.replace('/login'); };
  return (
    <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5">
      {mobile && (
        <Button variant="ghost" size="sm" isIconOnly aria-label="打开菜单" onPress={onOpenDrawer}>
          <Menu size={20} />
        </Button>
      )}
      <span className="font-semibold text-slate-800">{me?.class?.name || '班级工作台'}</span>
      <div className="flex-1" />
      {!mobile && <span className="text-xs text-slate-400">{now}</span>}
      <span className="text-xs text-slate-500">{me?.user?.name ?? ''}</span>
      <Button variant="outline" size="sm" onPress={logout}>
        <LogOut size={14} /> 退出
      </Button>
      <Button variant={editable ? 'primary' : 'outline'} size="sm" onPress={toggle}>
        {editable ? '完成' : '编辑'}
      </Button>
    </header>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const mobile = useMediaQuery('(max-width: 767px)');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.ok ? r.json() : Promise.resolve(null))
      .then((m: Me | null) => setMe(m))
      .catch(() => setMe(null));
  }, []);

  // 管理员无班级：隐藏业务菜单后，把误入业务页的 admin 送回系统设置
  useEffect(() => {
    if (me?.user?.role === 'admin' && BUSINESS.some(m => m.key === pathname)) {
      router.replace('/settings');
    }
  }, [me, pathname, router]);

  if (pathname.startsWith('/login')) return <>{children}</>;

  const role = me?.user?.role ?? 'teacher';
  const items = role === 'admin' ? [SETTINGS, USERS] : [...BUSINESS, SETTINGS];

  const nav = (
    <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
      {items.map(it => (
        <Link
          key={it.key}
          href={it.key}
          onClick={() => setDrawerOpen(false)}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
            pathname === it.key ? 'bg-white/10 font-medium text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          {it.icon}<span>{it.label}</span>
        </Link>
      ))}
    </nav>
  );

  return (
    <EditableProvider>
      <div className="flex min-h-screen">
        {!mobile && (
          <aside className="fixed inset-y-0 left-0 z-30 flex w-56 flex-col bg-navy text-white">
            <div className="px-4 py-4 text-center font-semibold">班主任智慧工作台</div>
            {nav}
          </aside>
        )}
        <div className={`flex-1 ${mobile ? '' : 'ml-56'}`}>
          <ShellHeader mobile={mobile} me={me} onOpenDrawer={() => setDrawerOpen(true)} />
          <main className="mx-auto w-full max-w-5xl p-4">{children}</main>
        </div>
        {mobile && (
          <Drawer isOpen={drawerOpen} onOpenChange={setDrawerOpen} placement="left">
            <Drawer.Backdrop />
            <Drawer.Content className="w-56">
              <div className="flex h-full flex-col bg-navy text-white">
                <div className="px-4 py-4 text-center font-semibold">班主任智慧工作台</div>
                {nav}
              </div>
            </Drawer.Content>
          </Drawer>
        )}
      </div>
    </EditableProvider>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。若 lucide 图标名不存在（`MessagesSquare`/`FileClock` 等），用 `node -e "console.log(!!require('lucide-react').<Name>)"` 逐个核实，替换为存在的等价图标。

- [ ] **Step 3: 冒烟运行**

Run: `npm run dev`，检查桌面侧边栏（navy）可跳转、顶栏时钟与「编辑/完成」按钮、缩窄窗口时变 Drawer、admin 登录后仅见设置+用户管理。
Expected: 正常；Ctrl+C 结束。

- [ ] **Step 4: Commit**

```bash
git add components/app-shell.tsx
git commit -m "feat: hero-ui shell with custom tailwind sider and mobile drawer"
```

---

### Task 8: 仪表盘 `/`（StatCard + 快捷操作 + FormModal）

**Files:**
- Modify: `app/page.tsx`（整文件重写）

**Interfaces:**
- Consumes: `get/post` from `@/lib/api-client`；`DashboardStats`/`ResourceKey` from `@/lib/types`；`StatCard`（Task 2）；`FormModal`/`FieldDef`（Task 6）；`toast` from `@/lib/toast`。
- Produces: 首页 7 张统计卡 + 快捷操作九宫格 + QuickAdd 弹窗（记违纪/请假登记/谈心谈话/添加待办/发布家校通知/家访记录，`POST /api/{resource}`），`QUICK` 配置与现页一致。

- [ ] **Step 1: 整文件重写 `app/page.tsx`**

```tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@heroui/react';
import { PlusCircle } from 'lucide-react';
import dayjs from 'dayjs';
import { get, post } from '@/lib/api-client';
import StatCard from '@/components/stat-card';
import FormModal, { type FieldDef } from '@/components/form-modal';
import { toast } from '@/lib/toast';
import type { DashboardStats, ResourceKey } from '@/lib/types';

const fmt = (n: number) => n.toLocaleString('zh-CN');

interface QuickDef { label: string; href?: string; quick?: { resource: ResourceKey; title: string; fields: FieldDef[] } }

const QUICK: QuickDef[] = [
  { label: '记违纪', quick: { resource: 'discipline_records', title: '记违纪', fields: [{ key: 'student_name', label: '学生', required: true }, { key: 'category', label: '类别' }, { key: 'content', label: '违纪内容', type: 'textarea' }, { key: 'action', label: '处理方式' }] } },
  { label: '请假登记', quick: { resource: 'leave_records', title: '请假登记', fields: [{ key: 'student_name', label: '学生', required: true }, { key: 'leave_type', label: '假别', type: 'select', options: ['事假', '病假', '公假'], initial: '事假' }, { key: 'reason', label: '事由', type: 'textarea' }, { key: 'start_date', label: '开始日期', type: 'date' }, { key: 'end_date', label: '结束日期', type: 'date' }] } },
  { label: '工作留痕', href: '/work-logs' },
  { label: '谈心谈话', quick: { resource: 'conversations', title: '谈心谈话', fields: [{ key: 'student_name', label: '学生', required: true }, { key: 'topic', label: '主题' }, { key: 'content', label: '内容', type: 'textarea' }, { key: 'effect', label: '效果', type: 'select', options: ['有改善', '需持续跟进', '已解决'], initial: '需持续跟进' }] } },
  { label: '录入成绩', href: '/grades' },
  { label: '添加待办', quick: { resource: 'todos', title: '添加待办', fields: [{ key: 'title', label: '事项', required: true }, { key: 'date', label: '日期', type: 'date' }, { key: 'priority', label: '优先级' }] } },
  { label: '发布家校通知', quick: { resource: 'parent_comm', title: '家校沟通', fields: [{ key: 'student_name', label: '学生/对象', required: true }, { key: 'way', label: '方式', type: 'select', options: ['电话', '微信', '面谈', '通知'], initial: '微信' }, { key: 'content', label: '内容', type: 'textarea' }] } },
  { label: '班级排位', href: '/seats' },
  { label: '学生档案', href: '/students' },
  { label: '家访记录', quick: { resource: 'home_visits', title: '家访记录', fields: [{ key: 'student_name', label: '学生', required: true }, { key: 'way', label: '方式', type: 'select', options: ['电话', '家访', '家长会', '微信'], initial: '电话' }, { key: 'content', label: '内容', type: 'textarea' }] } },
];

export default function HomePage() {
  const [s, setS] = useState<DashboardStats | null>(null);
  const [active, setActive] = useState<QuickDef | null>(null);

  useEffect(() => { get<DashboardStats>('/api/dashboard').then(setS).catch(() => {}); }, []);

  const submit = async (v: Record<string, string | number | null>) => {
    if (!active?.quick) return;
    try {
      await post(`/api/${active.quick.resource}`, v);
      toast.success('已记录');
      setActive(null);
    } catch { toast.error('保存失败'); }
  };

  // date 字段默认今天（对应旧版 initialValue={dayjs()}）
  const activeInitial = useMemo(() => {
    const obj: Record<string, string> = {};
    active?.quick?.fields.forEach(f => { if (f.type === 'date') obj[f.key] = dayjs().format('YYYY-MM-DD'); });
    return obj;
  }, [active]);

  const cards = [
    { title: '班级人数', value: s ? `${s.studentCount} 人` : '—', suffix: s ? `男${s.maleCount}/女${s.femaleCount}` : '' },
    { title: '当日请假', value: s ? `${s.todayLeaves} 人` : '—', suffix: '' },
    { title: '本周常规违纪', value: s ? `${s.weekDiscipline} 条` : '—', suffix: '' },
    { title: '待办事项', value: s ? `${s.todoPending} 项` : '—', suffix: '' },
    { title: '最近单元测平均分', value: s && s.latestExamAvg != null ? `${s.latestExamAvg} 分` : '—', suffix: '' },
    { title: '本月工作留痕', value: s ? `${fmt(s.monthWorkLogs)} 条` : '—', suffix: '' },
    { title: '家校沟通', value: s ? `家访${s.homeVisitCount} 次` : '—', suffix: s ? `家长会${s.parentMeetingCount} 场 / 沟通率${s.parentMeetingRate}%` : '' },
  ];

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(c => <StatCard key={c.title} title={c.title} value={c.value} suffix={c.suffix} />)}
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 font-semibold text-slate-600">快捷操作</h3>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
          {QUICK.map(t => t.href ? (
            <Link key={t.label} href={t.href}>
              <Button variant="outline" fullWidth className="h-14">{t.label}</Button>
            </Link>
          ) : (
            <Button key={t.label} variant="outline" fullWidth className="h-14" onPress={() => setActive(t)}>
              <PlusCircle size={16} /> {t.label}
            </Button>
          ))}
        </div>
      </div>
      <FormModal
        title={active?.quick?.title ?? '快速新增'}
        fields={active?.quick?.fields ?? []}
        open={!!active}
        onClose={() => setActive(null)}
        onSubmit={submit}
        initial={activeInitial}
        size="sm"
      />
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 3: 冒烟运行**

Run: `npm run dev`，`/`：7 张统计卡渲染；点「记违纪」填学生保存，去 `/discipline` 能看到新纪录；Toast 出现于顶部。
Expected: 正常；Ctrl+C 结束。

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: rewrite dashboard with hero-ui stat cards and quick actions"
```

---

### Task 9: 学生管理 `/students`（标杆 CRUD 页：排序/筛选/分页/导入）

**Files:**
- Modify: `app/students/page.tsx`（整文件重写）

**Interfaces:**
- Consumes: `useResourceRows('students')`、`DataTable`/`ColumnDef`（Task 4）、`TableToolbar`/`useColumnVisibility`/`ToolbarColumn`（Task 5）、`FormModal`/`FieldDef`（Task 6）、`Confirm`（Task 2）、`parseCsv`（`@/lib/csv`）、`post`（`@/lib/api-client`）、`ImportItem`（`@/lib/import`）、`toast`。
- Produces: 与现页功能一致的学生管理页。学号列排序；性别/层次/下午托列筛选；身份证列 `nullOnEmpty`；CSV 导入（`parseRow` 照抄现逻辑，`/api/students/import`）；分页 `pageSize=10`；删除走 `Confirm`。

- [ ] **Step 1: 整文件重写 `app/students/page.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { Button } from '@heroui/react';
import DataTable, { type ColumnDef } from '@/components/data-table';
import TableToolbar, { useColumnVisibility, type ToolbarColumn } from '@/components/table-toolbar';
import FormModal, { type FieldDef } from '@/components/form-modal';
import Confirm from '@/components/confirm';
import { useResourceRows } from '@/components/use-resource';
import { parseCsv } from '@/lib/csv';
import { post } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import type { ImportItem } from '@/lib/import';
import type { Row } from '@/lib/types';

const LEVELS = ['1', '2', '3', '4', '5', '6'];
const TOOLBAR_COLS: ToolbarColumn[] = [
  { key: 'student_no', label: '学号' }, { key: 'name', label: '姓名' },
  { key: 'gender', label: '性别' }, { key: 'parent_name', label: '家长姓名' },
  { key: 'parent_phone', label: '家长电话' }, { key: 'idcard', label: '身份证' },
  { key: 'address', label: '住址' }, { key: 'level', label: '学生层次' },
  { key: 'group_no', label: '小组' }, { key: 'role', label: '班干部职务' },
  { key: 'noon_care', label: '中午托' }, { key: 'breakfast', label: '早餐' },
  { key: 'afternoon_care', label: '下午托' }, { key: 'remark', label: '备注' },
];

const COLUMNS: ColumnDef[] = [
  { key: 'student_no', label: '学号', type: 'text', sortable: true, sortValue: r => Number(r.student_no) || 0 },
  { key: 'name', label: '姓名', type: 'text' },
  { key: 'gender', label: '性别', type: 'select', options: ['男', '女'], filterOptions: ['男', '女'] },
  { key: 'parent_name', label: '家长姓名', type: 'text' },
  { key: 'parent_phone', label: '家长电话', type: 'tel' },
  { key: 'idcard', label: '身份证', type: 'text', nullOnEmpty: true },
  { key: 'address', label: '住址', type: 'text', width: 180 },
  { key: 'level', label: '学生层次', type: 'select', options: LEVELS, filterOptions: LEVELS },
  { key: 'group_no', label: '小组', type: 'text' },
  { key: 'role', label: '班干部职务', type: 'text' },
  { key: 'noon_care', label: '中午托', type: 'select', options: ['1', '0'] },
  { key: 'breakfast', label: '早餐', type: 'select', options: ['1', '0'] },
  { key: 'afternoon_care', label: '下午托', type: 'select', options: ['1', '0'], filterOptions: ['1', '0'] },
  { key: 'remark', label: '备注', type: 'textarea' },
];

const FIELDS: FieldDef[] = [
  { key: 'student_no', label: '学号' },
  { key: 'name', label: '姓名', required: true },
  { key: 'gender', label: '性别', type: 'select', options: ['男', '女'], initial: '男' },
  { key: 'parent_name', label: '家长姓名' },
  { key: 'parent_phone', label: '家长电话' },
  { key: 'idcard', label: '身份证' },
  { key: 'address', label: '住址' },
  { key: 'level', label: '学生层次', type: 'select', options: LEVELS, initial: '4' },
  { key: 'group_no', label: '小组', type: 'number', initial: '1' },
  { key: 'role', label: '班干部职务' },
  { key: 'noon_care', label: '中午托', type: 'select', options: [{ value: '1', label: '是' }, { value: '0', label: '否' }], initial: '0' },
  { key: 'breakfast', label: '早餐', type: 'select', options: [{ value: '1', label: '是' }, { value: '0', label: '否' }], initial: '0' },
  { key: 'afternoon_care', label: '下午托', type: 'select', options: [{ value: '1', label: '是' }, { value: '0', label: '否' }], initial: '1' },
  { key: 'remark', label: '备注', type: 'textarea' },
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
  const { rows, loading, update, create, remove } = useResourceRows('students');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:students', ['address', 'remark']);
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const columns = useMemo(() => COLUMNS.filter(c => !hidden.has(c.key)), [hidden]);

  const onImport = async (text: string) => {
    const table = parseCsv(text);
    if (table.length < 2) { toast.warning('文件为空或只有表头'); return; }
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
      if (errs.length) toast.warning(`新增 ${res.created} · 更新 ${res.updated} · 跳过 ${res.skipped + skipped.length}（${errs[0].row}行: ${errs[0].message} 等）`);
      else toast.success(`新增 ${res.created} · 更新 ${res.updated}`);
    } catch { toast.error('导入失败'); }
  };

  const submit = async (v: Record<string, string | number | null>) => {
    await create(v);
    toast.success('已新增');
  };

  return (
    <div>
      <TableToolbar title="学生管理" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} onImport={onImport} />
      <DataTable
        label="学生管理"
        columns={columns}
        rows={rows}
        loading={loading}
        onSave={update}
        pageSize={10}
        actions={(r) => <Button variant="danger-soft" size="sm" onPress={() => setDeleting(r)}>删除</Button>}
      />
      <FormModal title="新增学生" fields={FIELDS} open={addOpen} onClose={() => setAddOpen(false)} onSubmit={submit} />
      <Confirm
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        title="删除记录"
        message="确定删除该记录？"
        confirmText="删除"
        danger
        onConfirm={async () => {
          if (!deleting) return;
          try { await remove(deleting.id as number); toast.success('已删除'); }
          catch { toast.error('删除失败'); }
          setDeleting(null);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 3: 冒烟运行**

Run: `npm run dev`，`/students`：① 学号列点击排序；② 性别/层次列头筛选；③ 删除弹确认框；④ 导出 CSV；⑤ 分页翻页。
Expected: 全通过；Ctrl+C 结束。

- [ ] **Step 4: Commit**

```bash
git add app/students/page.tsx
git commit -m "feat: rewrite students page with hero-ui data-table and import"
```

---

### Task 10: 请假管理 `/leaves`

**Files:**
- Modify: `app/leaves/page.tsx`（整文件重写）

**Interfaces:**
- Consumes: `useResourceRows('leave_records')`、`DataTable`、`TableToolbar`/`useColumnVisibility`、`FormModal`、`Confirm`、`StatCard`、`toast`；`dayjs`（`today()`）。
- 功能：统计卡（累计/当日/本月/病假占比）；表格列（学生/假别/事由/开始/结束/时长）内联编辑；新增弹窗；删除确认。

- [ ] **Step 1: 整文件重写 `app/leaves/page.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { Button } from '@heroui/react';
import DataTable, { type ColumnDef } from '@/components/data-table';
import TableToolbar, { useColumnVisibility, type ToolbarColumn } from '@/components/table-toolbar';
import FormModal, { type FieldDef } from '@/components/form-modal';
import Confirm from '@/components/confirm';
import StatCard from '@/components/stat-card';
import { useResourceRows } from '@/components/use-resource';
import { toast } from '@/lib/toast';
import type { Row } from '@/lib/types';

const today = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};
const LEAVE_TYPES = ['事假', '病假', '公假'];
const TOOLBAR_COLS: ToolbarColumn[] = [
  { key: 'student_name', label: '学生' }, { key: 'leave_type', label: '假别' },
  { key: 'reason', label: '事由' }, { key: 'start_date', label: '开始日期' },
  { key: 'end_date', label: '结束日期' }, { key: 'hours', label: '时长(小时)' },
];

const COLUMNS: ColumnDef[] = [
  { key: 'student_name', label: '学生', type: 'text' },
  { key: 'leave_type', label: '假别', type: 'select', options: LEAVE_TYPES },
  { key: 'reason', label: '事由', type: 'textarea' },
  { key: 'start_date', label: '开始日期', type: 'date' },
  { key: 'end_date', label: '结束日期', type: 'date' },
  { key: 'hours', label: '时长(小时)', type: 'number' },
];

const FIELDS: FieldDef[] = [
  { key: 'student_name', label: '学生', required: true },
  { key: 'leave_type', label: '假别', type: 'select', options: LEAVE_TYPES, initial: '事假' },
  { key: 'reason', label: '事由', type: 'textarea' },
  { key: 'start_date', label: '开始日期', type: 'date' },
  { key: 'end_date', label: '结束日期', type: 'date' },
  { key: 'hours', label: '时长(小时)', type: 'number', initial: '8' },
];

export default function LeavesPage() {
  const { rows, loading, update, create, remove } = useResourceRows('leave_records');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:leave_records');
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const columns = useMemo(() => COLUMNS.filter(c => !hidden.has(c.key)), [hidden]);

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

  const submit = async (v: Record<string, string | number | null>) => {
    await create({
      student_name: String(v.student_name ?? ''),
      leave_type: String(v.leave_type ?? '事假'),
      reason: String(v.reason ?? ''),
      start_date: String(v.start_date ?? '') || today(),
      end_date: String(v.end_date ?? '') || today(),
      hours: v.hours == null ? 8 : Number(v.hours),
    });
    toast.success('已新增');
  };

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(s => <StatCard key={s.title} title={s.title} value={s.value} />)}
      </div>
      <TableToolbar title="请假管理" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <DataTable label="请假管理" columns={columns} rows={rows} loading={loading} onSave={update}
        actions={(r) => <Button variant="danger-soft" size="sm" onPress={() => setDeleting(r)}>删除</Button>} />
      <FormModal title="新增请假" fields={FIELDS} open={addOpen} onClose={() => setAddOpen(false)} onSubmit={submit} />
      <Confirm open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} title="删除记录" message="确定删除该记录？" confirmText="删除" danger
        onConfirm={async () => { if (!deleting) return; try { await remove(deleting.id as number); toast.success('已删除'); } catch { toast.error('删除失败'); } setDeleting(null); }} />
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
git commit -m "feat: rewrite leaves page with hero-ui"
```

---

### Task 11: 违纪台账 `/discipline`

**Files:**
- Modify: `app/discipline/page.tsx`（整文件重写）

**Interfaces:**
- Consumes: `useResourceRows('discipline_records')`、`DataTable`、`TableToolbar`/`useColumnVisibility`、`FormModal`、`Confirm`、`StatCard`、`toast`；`dayjs`。
- 功能：类别列筛选；统计卡（累计条数/本周条数）；表格内联编辑；新增弹窗；删除确认。

- [ ] **Step 1: 整文件重写 `app/discipline/page.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { Button } from '@heroui/react';
import dayjs from 'dayjs';
import DataTable, { type ColumnDef } from '@/components/data-table';
import TableToolbar, { useColumnVisibility, type ToolbarColumn } from '@/components/table-toolbar';
import FormModal, { type FieldDef } from '@/components/form-modal';
import Confirm from '@/components/confirm';
import StatCard from '@/components/stat-card';
import { useResourceRows } from '@/components/use-resource';
import { toast } from '@/lib/toast';
import type { Row } from '@/lib/types';

const CATEGORIES = ['常规纪律', '迟到早退', '课堂表现', '课间行为', '卫生值日'];
const TOOLBAR_COLS: ToolbarColumn[] = [
  { key: 'date', label: '日期' }, { key: 'student_name', label: '学生' },
  { key: 'category', label: '类别' }, { key: 'content', label: '违纪内容' },
  { key: 'action', label: '处理方式' },
];

const COLUMNS: ColumnDef[] = [
  { key: 'date', label: '日期', type: 'date' },
  { key: 'student_name', label: '学生', type: 'text' },
  { key: 'category', label: '类别', type: 'select', options: CATEGORIES, filterOptions: CATEGORIES },
  { key: 'content', label: '违纪内容', type: 'textarea' },
  { key: 'action', label: '处理方式', type: 'text' },
];

const FIELDS: FieldDef[] = [
  { key: 'student_name', label: '学生', required: true },
  { key: 'category', label: '类别', type: 'select', options: CATEGORIES, initial: '常规纪律' },
  { key: 'content', label: '违纪内容', type: 'textarea' },
  { key: 'action', label: '处理方式' },
];

export default function DisciplinePage() {
  const { rows, loading, update, create, remove } = useResourceRows('discipline_records');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:discipline_records');
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const columns = useMemo(() => COLUMNS.filter(c => !hidden.has(c.key)), [hidden]);

  const stats = useMemo(() => [
    { title: '累计条数', value: rows.length },
    { title: '本周条数', value: rows.filter(r => String(r.date) >= dayjs().subtract(6, 'day').format('YYYY-MM-DD')).length },
  ], [rows]);

  const submit = async (v: Record<string, string | number | null>) => {
    await create({
      date: String(v.date ?? '') || dayjs().format('YYYY-MM-DD'),
      student_name: String(v.student_name ?? ''),
      category: String(v.category ?? '常规纪律'),
      content: String(v.content ?? ''),
      action: String(v.action ?? ''),
    });
    toast.success('已新增');
  };

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(s => <StatCard key={s.title} title={s.title} value={s.value} />)}
      </div>
      <TableToolbar title="违纪台账" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <DataTable label="违纪台账" columns={columns} rows={rows} loading={loading} onSave={update}
        actions={(r) => <Button variant="danger-soft" size="sm" onPress={() => setDeleting(r)}>删除</Button>} />
      <FormModal title="新增违纪" fields={FIELDS} open={addOpen} onClose={() => setAddOpen(false)} onSubmit={submit} />
      <Confirm open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} title="删除记录" message="确定删除该记录？" confirmText="删除" danger
        onConfirm={async () => { if (!deleting) return; try { await remove(deleting.id as number); toast.success('已删除'); } catch { toast.error('删除失败'); } setDeleting(null); }} />
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
git commit -m "feat: rewrite discipline page with hero-ui"
```

---

### Task 12: 谈话记录 `/conversations`

**Files:**
- Modify: `app/conversations/page.tsx`（整文件重写）

**Interfaces:**
- Consumes: `useResourceRows('conversations')`、`DataTable`、`TableToolbar`/`useColumnVisibility`、`FormModal`、`Confirm`、`toast`；`dayjs`。
- 功能：无统计卡；表格内联编辑；新增弹窗；删除确认。

- [ ] **Step 1: 整文件重写 `app/conversations/page.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { Button } from '@heroui/react';
import dayjs from 'dayjs';
import DataTable, { type ColumnDef } from '@/components/data-table';
import TableToolbar, { useColumnVisibility, type ToolbarColumn } from '@/components/table-toolbar';
import FormModal, { type FieldDef } from '@/components/form-modal';
import Confirm from '@/components/confirm';
import { useResourceRows } from '@/components/use-resource';
import { toast } from '@/lib/toast';
import type { Row } from '@/lib/types';

const EFFECTS = ['有改善', '需持续跟进', '已解决'];
const TOOLBAR_COLS: ToolbarColumn[] = [
  { key: 'date', label: '日期' }, { key: 'student_name', label: '学生' },
  { key: 'topic', label: '主题' }, { key: 'content', label: '内容' },
  { key: 'effect', label: '谈话效果' },
];

const COLUMNS: ColumnDef[] = [
  { key: 'date', label: '日期', type: 'date' },
  { key: 'student_name', label: '学生', type: 'text' },
  { key: 'topic', label: '主题', type: 'text' },
  { key: 'content', label: '内容', type: 'textarea' },
  { key: 'effect', label: '谈话效果', type: 'select', options: EFFECTS },
];

const FIELDS: FieldDef[] = [
  { key: 'student_name', label: '学生', required: true },
  { key: 'topic', label: '主题' },
  { key: 'content', label: '内容', type: 'textarea' },
  { key: 'effect', label: '谈话效果', type: 'select', options: EFFECTS, initial: '需持续跟进' },
];

export default function ConversationsPage() {
  const { rows, loading, update, create, remove } = useResourceRows('conversations');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:conversations');
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const columns = useMemo(() => COLUMNS.filter(c => !hidden.has(c.key)), [hidden]);

  const submit = async (v: Record<string, string | number | null>) => {
    await create({
      date: String(v.date ?? '') || dayjs().format('YYYY-MM-DD'),
      student_name: String(v.student_name ?? ''),
      topic: String(v.topic ?? ''),
      content: String(v.content ?? ''),
      effect: String(v.effect ?? '需持续跟进'),
    });
    toast.success('已新增');
  };

  return (
    <div>
      <TableToolbar title="谈话记录" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <DataTable label="谈话记录" columns={columns} rows={rows} loading={loading} onSave={update}
        actions={(r) => <Button variant="danger-soft" size="sm" onPress={() => setDeleting(r)}>删除</Button>} />
      <FormModal title="新增谈话记录" fields={FIELDS} open={addOpen} onClose={() => setAddOpen(false)} onSubmit={submit} />
      <Confirm open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} title="删除记录" message="确定删除该记录？" confirmText="删除" danger
        onConfirm={async () => { if (!deleting) return; try { await remove(deleting.id as number); toast.success('已删除'); } catch { toast.error('删除失败'); } setDeleting(null); }} />
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
git commit -m "feat: rewrite conversations page with hero-ui"
```

---

### Task 13: 生涯家访 `/visits`（类型 Tag 切换列）

**Files:**
- Modify: `app/visits/page.tsx`（整文件重写）

**Interfaces:**
- Consumes: `useResourceRows('home_visits')`、`DataTable`、`TableToolbar`/`useColumnVisibility`、`FormModal`、`Confirm`、`StatCard`、`toast`；`@heroui/react` 的 `Button/Chip`；`dayjs`。
- 功能：统计卡（家访次数/家长会场次/参会率）；`is_meeting` 列只读渲染 Chip 按钮（家长会/家访），点击切换；`exportable:false` 不导出；新增弹窗；删除确认。

- [ ] **Step 1: 整文件重写 `app/visits/page.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { Button, Chip } from '@heroui/react';
import dayjs from 'dayjs';
import DataTable, { type ColumnDef } from '@/components/data-table';
import TableToolbar, { useColumnVisibility, type ToolbarColumn } from '@/components/table-toolbar';
import FormModal, { type FieldDef } from '@/components/form-modal';
import Confirm from '@/components/confirm';
import StatCard from '@/components/stat-card';
import { useResourceRows } from '@/components/use-resource';
import { toast } from '@/lib/toast';
import type { Row } from '@/lib/types';

const WAYS = ['电话', '家访', '家长会', '微信'];
const TOOLBAR_COLS: ToolbarColumn[] = [
  { key: 'date', label: '日期' }, { key: 'student_name', label: '学生' },
  { key: 'way', label: '方式' }, { key: 'content', label: '内容' },
  { key: 'is_meeting', label: '类型', exportable: false },
];

const COLUMNS: ColumnDef[] = [
  { key: 'date', label: '日期', type: 'date' },
  { key: 'student_name', label: '学生', type: 'text' },
  { key: 'way', label: '方式', type: 'select', options: WAYS },
  { key: 'content', label: '内容', type: 'textarea' },
  {
    key: 'is_meeting', label: '类型', align: 'center',
    render: (_, r) => {
      const meeting = r.is_meeting == 1;
      return (
        <Button variant="ghost" size="sm" onPress={async () => {
          try { await update(r.id as number, { is_meeting: meeting ? 0 : 1 }); }
          catch { toast.error('保存失败'); }
        }}>
          <Chip size="sm" color={meeting ? 'secondary' : 'warning'}>{meeting ? '家长会' : '家访'}</Chip>
        </Button>
      );
    },
  },
];

const FIELDS: FieldDef[] = [
  { key: 'student_name', label: '学生', required: true },
  { key: 'way', label: '方式', type: 'select', options: WAYS, initial: '电话' },
  { key: 'content', label: '内容', type: 'textarea' },
];

export default function VisitsPage() {
  const { rows, loading, update, create, remove } = useResourceRows('home_visits');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:home_visits');
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const columns = useMemo(() => COLUMNS.filter(c => !hidden.has(c.key)), [hidden]);

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

  const submit = async (v: Record<string, string | number | null>) => {
    await create({
      date: String(v.date ?? '') || dayjs().format('YYYY-MM-DD'),
      student_name: String(v.student_name ?? ''),
      way: String(v.way ?? '电话'),
      content: String(v.content ?? ''),
      is_meeting: 0,
    });
    toast.success('已新增');
  };

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-3">
        {stats.map(s => <StatCard key={s.title} title={s.title} value={s.value} />)}
      </div>
      <TableToolbar title="生涯家访" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <DataTable label="生涯家访" columns={columns} rows={rows} loading={loading} onSave={update}
        actions={(r) => <Button variant="danger-soft" size="sm" onPress={() => setDeleting(r)}>删除</Button>} />
      <FormModal title="新增家访记录" fields={FIELDS} open={addOpen} onClose={() => setAddOpen(false)} onSubmit={submit} />
      <Confirm open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} title="删除记录" message="确定删除该记录？" confirmText="删除" danger
        onConfirm={async () => { if (!deleting) return; try { await remove(deleting.id as number); toast.success('已删除'); } catch { toast.error('删除失败'); } setDeleting(null); }} />
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。若 `Chip` 的 `color` 值不识别（如 `secondary`），用 `grep -oE "chip--[a-z-]+" node_modules/.pnpm/node_modules/@heroui/styles/dist/components/chip/chip.styles.d.ts | sort -u` 查看可用值。

- [ ] **Step 3: Commit**

```bash
git add app/visits/page.tsx
git commit -m "feat: rewrite visits page with hero-ui chip toggle"
```

---

### Task 14: 家校沟通 `/parent-comm`

**Files:**
- Modify: `app/parent-comm/page.tsx`（整文件重写）

**Interfaces:**
- Consumes: `useResourceRows('parent_comm')`、`DataTable`、`TableToolbar`/`useColumnVisibility`、`FormModal`、`Confirm`、`toast`；`dayjs`。
- 功能：无统计卡；表格内联编辑；新增弹窗；删除确认。

- [ ] **Step 1: 整文件重写 `app/parent-comm/page.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { Button } from '@heroui/react';
import dayjs from 'dayjs';
import DataTable, { type ColumnDef } from '@/components/data-table';
import TableToolbar, { useColumnVisibility, type ToolbarColumn } from '@/components/table-toolbar';
import FormModal, { type FieldDef } from '@/components/form-modal';
import Confirm from '@/components/confirm';
import { useResourceRows } from '@/components/use-resource';
import { toast } from '@/lib/toast';
import type { Row } from '@/lib/types';

const WAYS = ['电话', '微信', '面谈', '通知'];
const TOOLBAR_COLS: ToolbarColumn[] = [
  { key: 'date', label: '日期' }, { key: 'student_name', label: '学生/对象' },
  { key: 'way', label: '方式' }, { key: 'content', label: '沟通内容' },
];

const COLUMNS: ColumnDef[] = [
  { key: 'date', label: '日期', type: 'date' },
  { key: 'student_name', label: '学生/对象', type: 'text' },
  { key: 'way', label: '方式', type: 'select', options: WAYS },
  { key: 'content', label: '沟通内容', type: 'textarea' },
];

const FIELDS: FieldDef[] = [
  { key: 'student_name', label: '学生/对象', required: true },
  { key: 'way', label: '方式', type: 'select', options: WAYS, initial: '微信' },
  { key: 'content', label: '沟通内容', type: 'textarea' },
];

export default function ParentCommPage() {
  const { rows, loading, update, create, remove } = useResourceRows('parent_comm');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:parent_comm');
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const columns = useMemo(() => COLUMNS.filter(c => !hidden.has(c.key)), [hidden]);

  const submit = async (v: Record<string, string | number | null>) => {
    await create({
      date: String(v.date ?? '') || dayjs().format('YYYY-MM-DD'),
      student_name: String(v.student_name ?? ''),
      way: String(v.way ?? '微信'),
      content: String(v.content ?? ''),
    });
    toast.success('已新增');
  };

  return (
    <div>
      <TableToolbar title="家校沟通" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <DataTable label="家校沟通" columns={columns} rows={rows} loading={loading} onSave={update}
        actions={(r) => <Button variant="danger-soft" size="sm" onPress={() => setDeleting(r)}>删除</Button>} />
      <FormModal title="新增沟通记录" fields={FIELDS} open={addOpen} onClose={() => setAddOpen(false)} onSubmit={submit} />
      <Confirm open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} title="删除记录" message="确定删除该记录？" confirmText="删除" danger
        onConfirm={async () => { if (!deleting) return; try { await remove(deleting.id as number); toast.success('已删除'); } catch { toast.error('删除失败'); } setDeleting(null); }} />
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
git commit -m "feat: rewrite parent-comm page with hero-ui"
```

---

### Task 15: 安全台账 `/safety`

**Files:**
- Modify: `app/safety/page.tsx`（整文件重写）

**Interfaces:**
- Consumes: `useResourceRows('safety_logs')`、`DataTable`、`TableToolbar`/`useColumnVisibility`、`FormModal`、`Confirm`、`toast`；`dayjs`。
- 功能：类别列筛选；表格内联编辑；新增弹窗；删除确认。

- [ ] **Step 1: 整文件重写 `app/safety/page.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { Button } from '@heroui/react';
import dayjs from 'dayjs';
import DataTable, { type ColumnDef } from '@/components/data-table';
import TableToolbar, { useColumnVisibility, type ToolbarColumn } from '@/components/table-toolbar';
import FormModal, { type FieldDef } from '@/components/form-modal';
import Confirm from '@/components/confirm';
import { useResourceRows } from '@/components/use-resource';
import { toast } from '@/lib/toast';
import type { Row } from '@/lib/types';

const CATEGORIES = ['课间', '交通', '食品', '消防', '防溺水', '其他'];
const TOOLBAR_COLS: ToolbarColumn[] = [
  { key: 'date', label: '日期' }, { key: 'category', label: '类别' },
  { key: 'content', label: '内容' }, { key: 'action', label: '处理情况' },
];

const COLUMNS: ColumnDef[] = [
  { key: 'date', label: '日期', type: 'date' },
  { key: 'category', label: '类别', type: 'select', options: CATEGORIES, filterOptions: CATEGORIES },
  { key: 'content', label: '内容', type: 'textarea' },
  { key: 'action', label: '处理情况', type: 'text' },
];

const FIELDS: FieldDef[] = [
  { key: 'category', label: '类别', type: 'select', options: CATEGORIES, initial: '课间' },
  { key: 'content', label: '内容', type: 'textarea' },
  { key: 'action', label: '处理情况' },
];

export default function SafetyPage() {
  const { rows, loading, update, create, remove } = useResourceRows('safety_logs');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:safety_logs');
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const columns = useMemo(() => COLUMNS.filter(c => !hidden.has(c.key)), [hidden]);

  const submit = async (v: Record<string, string | number | null>) => {
    await create({
      date: String(v.date ?? '') || dayjs().format('YYYY-MM-DD'),
      category: String(v.category ?? '课间'),
      content: String(v.content ?? ''),
      action: String(v.action ?? ''),
    });
    toast.success('已新增');
  };

  return (
    <div>
      <TableToolbar title="安全台账" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <DataTable label="安全台账" columns={columns} rows={rows} loading={loading} onSave={update}
        actions={(r) => <Button variant="danger-soft" size="sm" onPress={() => setDeleting(r)}>删除</Button>} />
      <FormModal title="新增安全记录" fields={FIELDS} open={addOpen} onClose={() => setAddOpen(false)} onSubmit={submit} />
      <Confirm open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} title="删除记录" message="确定删除该记录？" confirmText="删除" danger
        onConfirm={async () => { if (!deleting) return; try { await remove(deleting.id as number); toast.success('已删除'); } catch { toast.error('删除失败'); } setDeleting(null); }} />
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
git commit -m "feat: rewrite safety page with hero-ui"
```

---

### Task 16: 工作留痕 `/work-logs`（环形饼图）

**Files:**
- Modify: `app/work-logs/page.tsx`（整文件重写）

**Interfaces:**
- Consumes: `useResourceRows('work_logs')`、`DataTable`、`TableToolbar`/`useColumnVisibility`、`FormModal`、`Confirm`、`StatCard`、`toast`；`CategoryColor`（`@/lib/color-utils`）；recharts `PieChart/Pie/Cell/Tooltip/ResponsiveContainer/Legend`；`dayjs`。
- 功能：统计卡（累计记录/累计时长）；表格内联编辑；环形饼图（工作类型分布）；新增弹窗；删除确认。

- [ ] **Step 1: 整文件重写 `app/work-logs/page.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { Button } from '@heroui/react';
import dayjs from 'dayjs';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import DataTable, { type ColumnDef } from '@/components/data-table';
import TableToolbar, { useColumnVisibility, type ToolbarColumn } from '@/components/table-toolbar';
import FormModal, { type FieldDef } from '@/components/form-modal';
import Confirm from '@/components/confirm';
import StatCard from '@/components/stat-card';
import { useResourceRows } from '@/components/use-resource';
import { CategoryColor } from '@/lib/color-utils';
import { toast } from '@/lib/toast';
import type { Row } from '@/lib/types';

const WORK_TYPES = ['班级管理', '教学教研', '家校沟通', '学生培优', '生涯活动', '安全教育', '会议培训', '心理辅导'];
const TOOLBAR_COLS: ToolbarColumn[] = [
  { key: 'date', label: '日期' }, { key: 'title', label: '工作事项' },
  { key: 'type', label: '类型' }, { key: 'place', label: '地点' },
  { key: 'hours', label: '时长(小时)' },
];

const COLUMNS: ColumnDef[] = [
  { key: 'date', label: '日期', type: 'date' },
  { key: 'title', label: '工作事项', type: 'text' },
  { key: 'type', label: '类型', type: 'select', options: WORK_TYPES },
  { key: 'place', label: '地点', type: 'text' },
  { key: 'hours', label: '时长(小时)', type: 'number' },
];

const FIELDS: FieldDef[] = [
  { key: 'title', label: '工作事项', required: true },
  { key: 'type', label: '类型', type: 'select', options: WORK_TYPES, initial: '班级管理' },
  { key: 'date', label: '日期', type: 'date' },
  { key: 'place', label: '地点' },
  { key: 'hours', label: '时长(小时)', type: 'number', initial: '1' },
];

export default function WorkLogsPage() {
  const { rows, loading, update, create, remove } = useResourceRows('work_logs');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:work_logs');
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const columns = useMemo(() => COLUMNS.filter(c => !hidden.has(c.key)), [hidden]);

  const stats = useMemo(() => [
    { title: '累计工作记录', value: rows.length },
    { title: '累计时长', value: rows.reduce((s, r) => s + Number(r.hours), 0).toFixed(1), suffix: '小时' },
  ], [rows]);

  const pieData = useMemo(() => WORK_TYPES.map(t => ({
    name: t,
    value: rows.filter(r => r.type === t).length,
  })).filter(d => d.value > 0), [rows]);

  const submit = async (v: Record<string, string | number | null>) => {
    await create({
      date: String(v.date ?? '') || dayjs().format('YYYY-MM-DD'),
      title: String(v.title ?? ''),
      type: String(v.type ?? '班级管理'),
      place: String(v.place ?? ''),
      hours: v.hours == null ? 1 : Number(v.hours),
    });
    toast.success('已新增');
  };

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(s => <StatCard key={s.title} title={s.title} value={s.value} suffix={s.suffix} />)}
      </div>
      <TableToolbar title="工作留痕" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <DataTable label="工作留痕" columns={columns} rows={rows} loading={loading} onSave={update}
        actions={(r) => <Button variant="danger-soft" size="sm" onPress={() => setDeleting(r)}>删除</Button>} />
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-600">工作类型分布（环形饼图）</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height={224}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {pieData.map((d, i) => <Cell key={i} fill={CategoryColor(d.name)} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <FormModal title="新增工作记录" fields={FIELDS} open={addOpen} onClose={() => setAddOpen(false)} onSubmit={submit} />
      <Confirm open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} title="删除记录" message="确定删除该记录？" confirmText="删除" danger
        onConfirm={async () => { if (!deleting) return; try { await remove(deleting.id as number); toast.success('已删除'); } catch { toast.error('删除失败'); } setDeleting(null); }} />
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
git commit -m "feat: rewrite work-logs page with hero-ui and keep pie chart"
```

---

### Task 17: 用户管理 `/users` + 系统设置 `/settings`

**Files:**
- Modify: `app/users/page.tsx`（整文件重写）
- Modify: `app/settings/page.tsx`（整文件重写）

**Interfaces:**
- Users: Consumes `get/post/put/del`（`@/lib/api-client`）、`DataTable`（只读列 + `actions`）、`FormModal`、`Confirm`、`toast`、`@heroui/react` 的 `Button`。功能：账号表格（只读）、重置密码（`window.prompt`）、删除（非 admin）、新增老师账号（username/name/password/className）。
- Settings: Consumes `get/post/put`、`Confirm`、`toast`、`@heroui/react` 的 `Button/Input/Label`。功能：班级基础信息表单（name/head_teacher/grade_band）、重置本班种子数据（Confirm）、备份下载。

- [ ] **Step 1: 整文件重写 `app/users/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { Button } from '@heroui/react';
import DataTable, { type ColumnDef } from '@/components/data-table';
import FormModal, { type FieldDef } from '@/components/form-modal';
import Confirm from '@/components/confirm';
import { get, post, put, del } from '@/lib/api-client';
import { toast } from '@/lib/toast';

interface User { id: number; username: string; name: string; role: string; class_id: number | null; created_at: string }

const COLUMNS: ColumnDef[] = [
  { key: 'username', label: '用户名' },
  { key: 'name', label: '姓名' },
  { key: 'role', label: '角色', render: (v) => (String(v) === 'admin' ? '管理员' : '班主任') },
  { key: 'class_id', label: '班级ID', render: (v) => (v === null || v === '' ? '-' : String(v)) },
];

const FIELDS: FieldDef[] = [
  { key: 'username', label: '用户名', required: true },
  { key: 'name', label: '姓名' },
  { key: 'password', label: '密码', required: true },
  { key: 'className', label: '班级名称（留空则不新建班级，需用已有 classId）' },
];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<User | null>(null);

  const load = () => {
    get<{ users: User[] }>('/api/users')
      .then(r => setUsers(r.users))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const create = async (v: Record<string, string | number | null>) => {
    try {
      await post('/api/users', v);
      toast.success('已创建');
      setOpen(false);
      load();
    } catch { toast.error('创建失败'); }
  };

  const resetPwd = async (u: User) => {
    const pwd = window.prompt(`为「${u.name || u.username}」设置新密码`);
    if (!pwd) return;
    try { await put(`/api/users/${u.id}`, { password: pwd }); toast.success('已重置密码'); }
    catch { toast.error('重置失败'); }
  };

  const remove = async () => {
    if (!deleting) return;
    try { await del(`/api/users/${deleting.id}`); toast.success('已删除'); load(); }
    catch { toast.error('删除失败'); }
    setDeleting(null);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="m-0 text-lg font-semibold text-slate-800">用户管理</h2>
        <Button variant="primary" size="sm" onPress={() => setOpen(true)}>新增老师账号</Button>
      </div>
      <DataTable
        label="用户管理"
        columns={COLUMNS}
        rows={users}
        loading={loading}
        actions={(u) => (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onPress={() => resetPwd(u as User)}>重置密码</Button>
            {(u as User).role !== 'admin' && (
              <Button variant="danger-soft" size="sm" onPress={() => setDeleting(u as User)}>删除</Button>
            )}
          </div>
        )}
      />
      <FormModal title="新增老师账号" fields={FIELDS} open={open} onClose={() => setOpen(false)} onSubmit={create} />
      <Confirm open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} title="删除账号" message="确认删除该账号？" confirmText="删除" danger onConfirm={remove} />
    </div>
  );
}
```

- [ ] **Step 2: 整文件重写 `app/settings/page.tsx`**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { Button, Input, Label } from '@heroui/react';
import Confirm from '@/components/confirm';
import { get, post, put } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import type { Row } from '@/lib/types';

interface Me { user: { name: string; role: string; class_id: number | null }; class: { id: number; name: string; head_teacher: string; grade_band: string } | null }

export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [cls, setCls] = useState({ name: '', head_teacher: '', grade_band: '' });

  useEffect(() => {
    get<Me>('/api/me').then(m => {
      setMe(m);
      if (m.class) setCls({ name: m.class.name, head_teacher: m.class.head_teacher, grade_band: m.class.grade_band });
    });
  }, []);

  const saveClass = async () => {
    const c = me?.class;
    if (!c) { toast.warning('当前账号无关联班级'); return; }
    setBusy(true);
    try { await put<Row>(`/api/classes/${c.id}`, cls); toast.success('已保存'); }
    catch { toast.error('保存失败'); }
    setBusy(false);
  };

  const reset = async () => {
    setBusy(true);
    try { await post('/api/reset', {}); toast.success('已重置本班数据'); location.reload(); }
    catch { toast.error('重置失败'); setBusy(false); }
  };

  const isAdmin = me?.user?.role === 'admin';
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-800">系统设置</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-600">班级基础信息</h3>
          <div className="space-y-3">
            <div><Label className="mb-1 block text-sm text-slate-700">班级名称</Label><Input size="sm" fullWidth value={cls.name} onChange={e => setCls(c => ({ ...c, name: e.target.value }))} /></div>
            <div><Label className="mb-1 block text-sm text-slate-700">班主任</Label><Input size="sm" fullWidth value={cls.head_teacher} onChange={e => setCls(c => ({ ...c, head_teacher: e.target.value }))} /></div>
            <div><Label className="mb-1 block text-sm text-slate-700">年级班次</Label><Input size="sm" fullWidth value={cls.grade_band} onChange={e => setCls(c => ({ ...c, grade_band: e.target.value }))} /></div>
            <Button variant="primary" size="sm" onPress={saveClass} isDisabled={!me?.class || busy}>{busy ? '保存中…' : '保存'}</Button>
          </div>
        </div>
        {(isAdmin || me?.user?.class_id) && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-600">数据维护</h3>
              <div className="flex flex-col gap-2">
                {me?.user?.class_id && (
                  <Button variant="danger" size="sm" onPress={() => setResetOpen(true)} isDisabled={busy}>重置本班种子数据</Button>
                )}
                {isAdmin && (
                  <Button variant="outline" size="sm" onPress={() => window.open('/api/backup', '_blank')}>备份数据库（下载 app.db）</Button>
                )}
              </div>
              <p className="mt-3 text-xs text-slate-400">演示数据均为随机生成的匿名姓名，用于保护学生隐私。</p>
            </div>
          </div>
        )}
      </div>
      <Confirm open={resetOpen} onOpenChange={setResetOpen} title="重置数据" message="将清空本班演示数据并重新生成，确认？" confirmText="重置" danger onConfirm={reset} />
    </div>
  );
}
```

- [ ] **Step 3: 验证构建**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add app/users/page.tsx app/settings/page.tsx
git commit -m "feat: rewrite users and settings pages with hero-ui"
```

---

### Task 18: 综合素质评价 `/evaluation`（维度平均图）

**Files:**
- Modify: `app/evaluation/page.tsx`（整文件重写）

**Interfaces:**
- Consumes: `useResourceRows('evaluation')`、`DataTable`、`TableToolbar`/`useColumnVisibility`、`CategoryColor`；recharts `BarChart/Bar/XAxis/YAxis/CartesianGrid/Tooltip/ResponsiveContainer`。
- 功能：5 维（moral/study/sports/art/labor）1-5 内联数字 + 评语 textarea；维度平均 BarChart。无新增/删除。

- [ ] **Step 1: 整文件重写 `app/evaluation/page.tsx`**

```tsx
'use client';
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import DataTable, { type ColumnDef } from '@/components/data-table';
import TableToolbar, { useColumnVisibility, type ToolbarColumn } from '@/components/table-toolbar';
import { useResourceRows } from '@/components/use-resource';
import { CategoryColor } from '@/lib/color-utils';

const DIMS = [
  { key: 'moral', label: '品德' }, { key: 'study', label: '学习' }, { key: 'sports', label: '体育' },
  { key: 'art', label: '美育' }, { key: 'labor', label: '劳动' },
];
const TOOLBAR_COLS: ToolbarColumn[] = [
  { key: 'student_name', label: '姓名' },
  ...DIMS.map(d => ({ key: d.key, label: d.label })),
  { key: 'comment', label: '评语' },
];

const COLUMNS: ColumnDef[] = [
  { key: 'student_name', label: '姓名' },
  ...DIMS.map(d => ({ key: d.key, label: d.label, type: 'number' as const, align: 'center' as const })),
  { key: 'comment', label: '评语', type: 'textarea' },
];

export default function EvaluationPage() {
  const { rows, loading, update } = useResourceRows('evaluation');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:evaluation');

  const columns = useMemo(() => COLUMNS.filter(c => !hidden.has(c.key)), [hidden]);

  const dimStats = useMemo(() => DIMS.map(d => ({
    name: d.label,
    avg: rows.length ? (rows.reduce((s, r) => s + Number(r[d.key] ?? 3), 0) / rows.length).toFixed(1) : '0',
  })), [rows]);

  return (
    <div>
      <TableToolbar title="综合素质评价" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} />
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-600">各维度平均分（满分 5）</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height={224}>
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
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-600">评价说明</h3>
          <p className="text-xs leading-relaxed text-slate-500">每项按 1-5 打分（1 很差 / 5 优秀）。点击分数直接修改，实时保存。评语在表格底部。</p>
        </div>
      </div>
      <DataTable label="综合素质评价" columns={columns} rows={rows} loading={loading} onSave={update} />
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
git commit -m "feat: rewrite evaluation page with hero-ui data-table"
```

---

### Task 19: 成绩分析 `/grades`

**Files:**
- Modify: `app/grades/page.tsx`（整文件重写）

**Interfaces:**
- Consumes: `useResourceRows('grades')`、`StatCard`、`EditableCell`、`CategoryColor`；`@heroui/react` 的 `Select/ListBox/ToggleButtonGroup/ToggleButton/Skeleton`；recharts 柱状图。
- 功能：考试下拉（无选择取最近一次）+ 学科 ToggleButtonGroup；统计卡（平均分/及格率/优秀率/最高最低）；分数段直方图；右表内联可改分数。

- [ ] **Step 1: 整文件重写 `app/grades/page.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { ListBox, Select, Skeleton, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import StatCard from '@/components/stat-card';
import EditableCell from '@/components/editable-cell';
import { useResourceRows } from '@/components/use-resource';
import { CategoryColor } from '@/lib/color-utils';

const SUBJECTS = ['语文', '数学', '英语'];

export default function GradesPage() {
  const { rows, loading, update } = useResourceRows('grades');
  const [exam, setExam] = useState<string | null>(null);
  const [subject, setSubject] = useState<string>('语文');

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
      <h2 className="mb-4 text-lg font-semibold text-slate-800">成绩分析</h2>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          aria-label="选择考试"
          size="sm"
          className="w-52"
          selectedKey={currentExam === '' ? '' : currentExam}
          onSelectionChange={k => setExam(k === null || k === '' ? null : String(k))}
        >
          <Select.Trigger><Select.Value placeholder="选择考试" /></Select.Trigger>
          <Select.Indicator />
          <Select.Popover>
            <ListBox>
              {exams.map(e => <ListBox.Item key={e} id={e}>{e || '未命名考试'}</ListBox.Item>)}
            </ListBox>
          </Select.Popover>
        </Select>
        <ToggleButtonGroup selectionMode="single" selectedKeys={new Set([subject])} onSelectionChange={(keys) => { const k = [...keys][0]; if (k) setSubject(String(k)); }}>
          {SUBJECTS.map(s => <ToggleButton key={s} value={s}>{s}</ToggleButton>)}
        </ToggleButtonGroup>
      </div>
      {loading ? <div className="space-y-3"><Skeleton className="h-10 rounded-lg" /><Skeleton className="h-40 rounded-lg" /></div> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {stats.map(s => <StatCard key={s.title} title={s.title} value={s.value} />)}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-600">分数段分布（直方图）</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height={224}>
                  <BarChart data={histogram}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="人数" fill={CategoryColor(subject)} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-600">成绩明细（点击可改）</h3>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-slate-500">
                    <tr>
                      <th className="border-b border-gray-200 px-3 py-2 text-left font-medium">姓名</th>
                      <th className="border-b border-gray-200 px-3 py-2 text-left font-medium">分数</th>
                    </tr>
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
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。若 `ToggleButtonGroup`/`ToggleButton` 的 `selectionMode="single"`/`selectedKeys` 用法报错，按 Global Constraints grep `node_modules/@heroui/react/dist/components/toggle-button-group/toggle-button-group.d.ts`。

- [ ] **Step 3: Commit**

```bash
git add app/grades/page.tsx
git commit -m "feat: rewrite grades page with hero-ui select and toggle group"
```

---

### Task 20: 我的课表 `/timetable`（Tabs + 3 个子组件）

**Files:**
- Modify: `app/timetable/page.tsx`（整文件重写）
- Modify: `components/timetable/class-timetable.tsx`（整文件重写）
- Modify: `components/timetable/teacher-schedule.tsx`（整文件重写）
- Modify: `components/timetable/teacher-schedule-modal.tsx`（整文件重写）
- Modify: `components/timetable/period-slots-modal.tsx`（整文件重写）

**Interfaces:**
- Consumes: `useResourceRows('timetable'|'period_slots'|'teacher_schedule')`、`EditableCell`、`FormModal`、`Confirm`、`StatCard`、`toast`；`buildClassGrid/classStats/SUBJECTS/KIND_LABELS` from `@/lib/timetable`（数据层，不动）；`@heroui/react` 的 `Tabs/Button/Input/Select/ListBox/Modal/Chip/Skeleton`。
- 保序逻辑：`weekday` 内按 `period_slots.seq` 排；网格 key 为 `` `${wd}-${periodId}` ``。

- [ ] **Step 1: 重写 `app/timetable/page.tsx`**

```tsx
'use client';
import { Tabs } from '@heroui/react';
import ClassTimetable from '@/components/timetable/class-timetable';
import TeacherSchedule from '@/components/timetable/teacher-schedule';

export default function TimetablePage() {
  return (
    <Tabs>
      <Tabs.List>
        <Tabs.Tab id="class">班级课表</Tabs.Tab>
        <Tabs.Tab id="teacher">我的授课</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel id="class"><ClassTimetable /></Tabs.Panel>
      <Tabs.Panel id="teacher"><TeacherSchedule /></Tabs.Panel>
    </Tabs>
  );
}
```

- [ ] **Step 2: 重写 `components/timetable/class-timetable.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { Button } from '@heroui/react';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import PeriodSlotsModal from './period-slots-modal';
import { buildClassGrid, classStats, SUBJECTS, KIND_LABELS } from '@/lib/timetable';

const DAYS = ['周一', '周二', '周三', '周四', '周五'];

export default function ClassTimetable() {
  const { rows: slots, loading: slotLoading, reload: slotsReload } = useResourceRows('period_slots');
  const { rows: tt, loading: ttLoading, update, create, reload: ttReload } = useResourceRows('timetable');
  const [slotModalOpen, setSlotModalOpen] = useState(false);

  const ordered = useMemo(() => [...slots].sort((a, b) => Number(a.seq) - Number(b.seq)), [slots]);
  const grid = useMemo(() => buildClassGrid(ordered, tt), [ordered, tt]);
  const stats = useMemo(() => classStats(ordered, tt), [ordered, tt]);

  const saveSubject = async (weekday: number, periodId: number, subject: string | number | null) => {
    const v = String(subject ?? '');
    const isChinese = v === '语文' ? 1 : 0;
    const existing = grid.get(`${weekday}-${periodId}`);
    if (existing) await update(existing.id as number, { subject: v, is_chinese: isChinese });
    else await create({ weekday, period_id: periodId, subject: v, is_chinese: isChinese });
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="m-0 text-base font-semibold text-slate-800">班级课表</h3>
        <Button variant="outline" size="sm" onPress={() => setSlotModalOpen(true)}>时段管理</Button>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div className="text-xs text-slate-500">每周正课总课时</div>
          <div className="mt-1 text-xl font-semibold text-slate-800">{stats.total}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div className="text-xs text-slate-500">语文任教课时</div>
          <div className="mt-1 text-xl font-semibold text-blue-600">{stats.chinese}</div>
        </div>
      </div>
      {(slotLoading || ttLoading) ? <div className="space-y-3"><div className="h-10 rounded-lg bg-gray-100 animate-pulse" /><div className="h-10 rounded-lg bg-gray-100 animate-pulse" /></div> : (
        <div className="mb-4 overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-slate-500">
                <th className="border-b border-gray-200 px-2 py-2 text-left">时段</th>
                {DAYS.map(d => <th key={d} className="border-b border-gray-200 px-2 py-2">{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {ordered.map(slot => {
                const isSubject = slot.kind === '正课';
                return (
                  <tr key={slot.id}>
                    <td className="border-b border-gray-100 px-2 py-2 whitespace-nowrap">
                      <div className="text-xs text-slate-700">{String(slot.name)}</div>
                      <div className="text-xs text-slate-400">{String(slot.start_time)}-{String(slot.end_time)}</div>
                    </td>
                    {DAYS.map(d => {
                      const wd = DAYS.indexOf(d) + 1;
                      const key = `${wd}-${slot.id}`;
                      const r = grid.get(key);
                      if (!isSubject) {
                        return <td key={key} className="border-b border-gray-100 px-2 py-2 text-center"><span className="text-xs text-slate-400">{KIND_LABELS[String(slot.kind)]}</span></td>;
                      }
                      const chinese = r && r.is_chinese == 1;
                      return (
                        <td key={key} className={`border-b border-gray-100 px-2 py-2 text-center ${chinese ? 'bg-blue-50' : ''}`}>
                          <EditableCell
                            value={r ? r.subject : null}
                            type="select"
                            options={SUBJECTS}
                            onSave={v => saveSubject(wd, Number(slot.id), v)}
                            className={chinese ? 'font-medium text-blue-700' : 'text-slate-700'}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <PeriodSlotsModal open={slotModalOpen} onClose={() => { setSlotModalOpen(false); void slotsReload(); void ttReload(); }} />
    </div>
  );
}
```

- [ ] **Step 3: 重写 `components/timetable/teacher-schedule.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { Button, Chip } from '@heroui/react';
import { Plus } from 'lucide-react';
import DataTable, { type ColumnDef } from '@/components/data-table';
import TeacherScheduleModal from './teacher-schedule-modal';
import Confirm from '@/components/confirm';
import { useResourceRows } from '@/components/use-resource';
import { toast } from '@/lib/toast';
import type { Row } from '@/lib/types';

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五'];

export default function TeacherSchedule() {
  const { rows: ts, loading, update, create, remove } = useResourceRows('teacher_schedule');
  const { rows: slots } = useResourceRows('period_slots');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const slotById = useMemo(() => new Map(slots.map(s => [Number(s.id), s])), [slots]);
  const orderedSlots = useMemo(() => [...slots].sort((a, b) => Number(a.seq) - Number(b.seq)), [slots]);
  const slotLabel = (id: string | number) => { const s = slotById.get(Number(id)); return s ? `${s.name} ${s.start_time}-${s.end_time}` : `#${id}`; };
  const weekLabel = (wd: string | number) => WEEKDAYS[Number(wd) - 1] ?? String(wd);

  const overview = useMemo(() => {
    const m = new Map<string, Row>();
    for (const r of ts) m.set(`${Number(r.weekday)}-${Number(r.period_id)}`, r);
    return m;
  }, [ts]);

  const sorted = useMemo(() => [...ts].sort((a, b) =>
    Number(a.weekday) - Number(b.weekday)
    || Number(slotById.get(Number(a.period_id))?.seq ?? 0) - Number(slotById.get(Number(b.period_id))?.seq ?? 0)
  ), [ts, slotById]);

  const onSave = async (v: Record<string, string | number | null>) => {
    if (editing) await update(editing.id as number, v);
    else await create(v);
  };

  const COLUMNS: ColumnDef[] = [
    { key: 'weekday', label: '星期', render: (v) => weekLabel(v as string | number) },
    { key: 'period_id', label: '时段', render: (v) => slotLabel(v as string | number) },
    { key: 'class_name', label: '目标班级', render: (v) => String(v || '—') },
    { key: 'subject', label: '科目', render: (v) => v ? <Chip size="sm" color="primary">{String(v)}</Chip> : '—' },
    { key: 'remark', label: '备注', render: (v) => String(v || '—') },
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="m-0 text-base font-semibold text-slate-800">我的授课</h3>
        <Button variant="primary" size="sm" onPress={() => { setEditing(null); setModalOpen(true); }}>
          <Plus size={16} /> 新增授课
        </Button>
      </div>
      <div className="mb-4 overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-slate-500">
              <th className="border-b border-gray-200 px-2 py-2 text-left">时段</th>
              {WEEKDAYS.map(d => <th key={d} className="border-b border-gray-200 px-2 py-2">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {orderedSlots.map(slot => (
              <tr key={slot.id}>
                <td className="border-b border-gray-100 px-2 py-2 whitespace-nowrap">
                  <div className="text-xs text-slate-700">{String(slot.name)}</div>
                  <div className="text-xs text-slate-400">{String(slot.start_time)}-{String(slot.end_time)}</div>
                </td>
                {WEEKDAYS.map((d, idx) => {
                  const key = `${idx + 1}-${slot.id}`;
                  const r = overview.get(key);
                  return (
                    <td key={key} className="border-b border-gray-100 px-2 py-2 text-center">
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
      </div>
      <DataTable
        label="我的授课"
        columns={COLUMNS}
        rows={sorted}
        loading={loading}
        actions={(r) => (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onPress={() => { setEditing(r); setModalOpen(true); }}>编辑</Button>
            <Button variant="danger-soft" size="sm" onPress={() => setDeleting(r)}>删除</Button>
          </div>
        )}
      />
      <TeacherScheduleModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} slots={slots} onSave={onSave} />
      <Confirm open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} title="删除记录" message="确定删除该记录？" confirmText="删除" danger
        onConfirm={async () => { if (!deleting) return; try { await remove(deleting.id as number); toast.success('已删除'); } catch { toast.error('删除失败'); } setDeleting(null); }} />
    </div>
  );
}
```

- [ ] **Step 4: 重写 `components/timetable/teacher-schedule-modal.tsx`**

```tsx
'use client';
import { useMemo } from 'react';
import FormModal, { type FieldDef } from '@/components/form-modal';
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
  const fields = useMemo<FieldDef[]>(() => [
    { key: 'weekday', label: '星期', type: 'select', required: true, options: WEEKDAYS.map((w, i) => ({ value: String(i + 1), label: w })) },
    {
      key: 'period_id', label: '时段', type: 'select', required: true,
      options: [...slots].sort((a, b) => Number(a.seq) - Number(b.seq)).map(s => ({ value: String(s.id), label: `${s.name} ${s.start_time}-${s.end_time}` })),
    },
    { key: 'class_name', label: '目标班级', required: true, placeholder: '如 六年级（2）班' },
    { key: 'subject', label: '科目', type: 'select', required: true, options: SUBJECT_OPTIONS },
    { key: 'remark', label: '备注', type: 'textarea' },
  ], [slots]);

  const initial = editing ? {
    weekday: String(editing.weekday ?? '1'),
    period_id: String(editing.period_id ?? ''),
    class_name: String(editing.class_name ?? ''),
    subject: String(editing.subject ?? ''),
    remark: String(editing.remark ?? ''),
  } : { weekday: '1' };

  const submit = async (v: Record<string, string | number | null>) => {
    await onSave({
      weekday: Number(v.weekday ?? 1),
      period_id: Number(v.period_id ?? 0),
      class_name: String(v.class_name ?? ''),
      subject: String(v.subject ?? ''),
      remark: String(v.remark ?? ''),
    });
  };

  return (
    <FormModal
      title={editing ? '编辑授课' : '新增授课'}
      fields={fields}
      open={open}
      onClose={onClose}
      onSubmit={submit}
      initial={initial}
      size="md"
    />
  );
}
```

- [ ] **Step 5: 重写 `components/timetable/period-slots-modal.tsx`**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { Button, Input, Modal, Select, ListBox } from '@heroui/react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import Confirm from '@/components/confirm';
import { useResourceRows } from '@/components/use-resource';
import { toast } from '@/lib/toast';
import type { Row } from '@/lib/types';

const KINDS = ['正课', '自习', '托管', '陪餐'];

export default function PeriodSlotsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { rows, update, create, remove } = useResourceRows('period_slots');
  const [deleting, setDeleting] = useState<Row | null>(null);
  const ordered = useMemo(() => [...rows].sort((a, b) => Number(a.seq) - Number(b.seq)), [rows]);

  const patch = async (id: number, values: Partial<Row>) => {
    try { await update(id, values); }
    catch { toast.error('保存失败'); }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= ordered.length) return;
    const a = ordered[index], b = ordered[j];
    try {
      await Promise.all([
        update(a.id as number, { seq: Number(b.seq) }),
        update(b.id as number, { seq: Number(a.seq) }),
      ]);
    } catch { toast.error('保存失败'); }
  };

  const add = async () => {
    const maxSeq = ordered.reduce((m, s) => Math.max(m, Number(s.seq)), 0);
    try { await create({ seq: maxSeq + 1, name: '新时段', start_time: '', end_time: '', kind: '正课' }); }
    catch { toast.error('保存失败'); }
  };

  const doDelete = async () => {
    if (!deleting) return;
    try { await remove(deleting.id as number); toast.success('已删除'); }
    catch { toast.error('删除失败'); }
    setDeleting(null);
  };

  return (
    <Modal isOpen={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Modal.Backdrop isDismissable />
      <Modal.Container placement="center" size="md">
        <Modal.Header><Modal.Heading>时段管理</Modal.Heading></Modal.Header>
        <Modal.Body>
          <div className="space-y-2">
            {ordered.map((slot, i) => (
              <div key={slot.id} className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" isIconOnly isDisabled={i === 0} onPress={() => void move(i, -1)}><ArrowUp size={14} /></Button>
                <Button variant="outline" size="sm" isIconOnly isDisabled={i === ordered.length - 1} onPress={() => void move(i, 1)}><ArrowDown size={14} /></Button>
                <Input size="sm" className="w-28" defaultValue={String(slot.name)} onBlur={e => void patch(slot.id as number, { name: e.target.value })} />
                <Input size="sm" className="w-20" defaultValue={String(slot.start_time)} onBlur={e => void patch(slot.id as number, { start_time: e.target.value })} placeholder="HH:mm" />
                <Input size="sm" className="w-20" defaultValue={String(slot.end_time)} onBlur={e => void patch(slot.id as number, { end_time: e.target.value })} placeholder="HH:mm" />
                <Select aria-label="时段类型" size="sm" className="w-24" selectedKey={String(slot.kind)} onSelectionChange={k => void patch(slot.id as number, { kind: k === null ? '正课' : String(k) })}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Indicator />
                  <Select.Popover>
                    <ListBox>{KINDS.map(k => <ListBox.Item key={k} id={k}>{k}</ListBox.Item>)}</ListBox>
                  </Select.Popover>
                </Select>
                <Button variant="danger-soft" size="sm" isIconOnly onPress={() => setDeleting(slot)}><Trash2 size={14} /></Button>
              </div>
            ))}
          </div>
          <Button variant="outline" fullWidth className="mt-3" onPress={() => void add()}>
            <Plus size={16} /> 新增时段
          </Button>
        </Modal.Body>
      </Modal.Container>
      <Confirm open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} title="删除时段" message="删除该时段将同时删除其课表与授课行，确定？" confirmText="删除" danger onConfirm={doDelete} />
    </Modal>
  );
}
```

- [ ] **Step 6: 验证构建**

Run: `npm run build`
Expected: PASS。若 `Tabs.Tab` 的 `id` 与 `Tabs.Panel` 的 `id` 匹配方式、或 `ToggleButtonGroup`/`Select` 组合报错，按 Global Constraints grep 核实。

- [ ] **Step 7: 冒烟运行**

Run: `npm run dev`，`/timetable`：班级课表网格可点选科目、语文标蓝；「时段管理」可上下移/改/加/删；「我的授课」网格与列表、新增授课弹窗（星期/时段/班级/科目）正常。
Expected: 全通过；Ctrl+C 结束。

- [ ] **Step 8: Commit**

```bash
git add app/timetable/page.tsx components/timetable/
git commit -m "feat: rewrite timetable pages with hero-ui"
```

---

### Task 21: 排座位 `/seats`

**Files:**
- Modify: `app/seats/page.tsx`（整文件重写）

**Interfaces:**
- Consumes: `get/post/put/del`（`@/lib/api-client`）、`downloadCsv`（`@/lib/csv`）、`Confirm`、`toast`；`@heroui/react` 的 `Button/Input/Drawer`。
- 功能：座位网格（自定义按钮格）；行/列配置；随机排座/全部移除（Confirm）；导出 CSV；点击座位弹出 Drawer 选学生（`/api/seats`、`/api/students`、`/api/classroom_config`）。

- [ ] **Step 1: 整文件重写 `app/seats/page.tsx`**

```tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Drawer } from '@heroui/react';
import { Download, RefreshCw, Trash2 } from 'lucide-react';
import Confirm from '@/components/confirm';
import { del, get, post, put } from '@/lib/api-client';
import type { Row } from '@/lib/types';
import { downloadCsv } from '@/lib/csv';
import { toast } from '@/lib/toast';

const MAX_DIM = 20;

export default function SeatsPage() {
  const [seats, setSeats] = useState<Row[]>([]);
  const [students, setStudents] = useState<Row[]>([]);
  const [cfg, setCfg] = useState({ row_count: 7, col_count: 8 });
  const [cfgId, setCfgId] = useState<number | null>(null);
  const [rowDraft, setRowDraft] = useState('7');
  const [colDraft, setColDraft] = useState('8');
  const [selected, setSelected] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [confirmRandom, setConfirmRandom] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    Promise.all([
      get<Row[]>('/api/seats'),
      get<Row[]>('/api/students'),
      get<Row[]>('/api/classroom_config'),
    ]).then(([s, st, c]) => {
      setSeats(s);
      setStudents(st);
      const first = c[0];
      if (first) {
        const rowCount = Number(first.row_count) || 7;
        const colCount = Number(first.col_count) || 8;
        setCfg({ row_count: rowCount, col_count: colCount });
        setRowDraft(String(rowCount));
        setColDraft(String(colCount));
        setCfgId(Number(first.id));
      }
    });
  }, [reloadTick]);

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
      toast.success(`已安排 ${name}`);
      setSelected(null);
      setReloadTick(t => t + 1);
    } catch { toast.error('保存失败'); }
  };

  const clearSeat = async () => {
    if (!selected) return;
    const seat = grid.get(`${selected.row_index}-${selected.col_index}`);
    if (!seat) return;
    try { await put(`/api/seats/${seat.id}`, { student_name: '' }); setSelected(null); setReloadTick(t => t + 1); }
    catch { toast.error('保存失败'); }
  };

  const applyConfig = async () => {
    const rowCount = Math.min(MAX_DIM, Math.max(1, Number(rowDraft) || 1));
    const colCount = Math.min(MAX_DIM, Math.max(1, Number(colDraft) || 1));
    setBusy(true);
    try {
      if (cfgId != null) await put(`/api/classroom_config/${cfgId}`, { row_count: rowCount, col_count: colCount });
      else {
        const row = await post<Row>('/api/classroom_config', { row_count: rowCount, col_count: colCount });
        setCfgId(Number(row.id));
      }
      const toDelete = seats.filter(s => Number(s.row_index) >= rowCount || Number(s.col_index) >= colCount);
      if (toDelete.length) await Promise.all(toDelete.map(s => del(`/api/seats/${s.id}`)));
      setCfg({ row_count: rowCount, col_count: colCount });
      setRowDraft(String(rowCount));
      setColDraft(String(colCount));
      setReloadTick(t => t + 1);
      toast.success('已应用');
    } catch { toast.error('保存失败'); }
    setBusy(false);
  };

  const randomSeat = async () => {
    setBusy(true);
    try {
      const res = await post<{ placed: number; total: number }>('/api/seats/random', {
        row_count: cfg.row_count, col_count: cfg.col_count,
      });
      setSelected(null);
      setReloadTick(t => t + 1);
      if (res.placed < res.total) toast.warning(`座位不够，仅安排了 ${res.placed}/${res.total} 人`);
      else toast.success('已按规则随机排座');
    } catch { toast.error('随机排座失败'); }
    setBusy(false);
  };

  const clearAll = async () => {
    setBusy(true);
    try {
      await post('/api/seats/clear', {});
      setSelected(null);
      setReloadTick(t => t + 1);
      toast.success('已移除全部座位学生');
    } catch { toast.error('移除失败'); }
    setBusy(false);
  };

  const exportSeats = () => {
    const headers = Array.from({ length: cfg.col_count }, (_, c) => `第${c + 1}组`);
    const rows = Array.from({ length: cfg.row_count }, (_, r) =>
      Array.from({ length: cfg.col_count }, (_, c) => String(grid.get(`${r}-${c}`)?.student_name ?? '')));
    downloadCsv('座位表.csv', headers, rows);
  };

  const studentNames = useMemo(() =>
    students.filter(s => !used.has(String(s.name)) || String(s.name) === String(selected?.student_name ?? '')),
    [students, used, selected]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-lg font-semibold text-slate-800">排座位</h2>
        <Button variant="outline" size="sm" onPress={exportSeats}><Download size={16} /> 导出</Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-slate-600">
          <span>行</span>
          <Input size="sm" type="number" className="w-16" value={rowDraft} onChange={e => setRowDraft(e.target.value)} />
          <span>列</span>
          <Input size="sm" type="number" className="w-16" value={colDraft} onChange={e => setColDraft(e.target.value)} />
          <Button variant="primary" size="sm" onPress={applyConfig} isDisabled={busy}>应用</Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" isDisabled={busy} onPress={() => setConfirmRandom(true)}><RefreshCw size={14} /> 随机排座</Button>
          <Button variant="danger" size="sm" isDisabled={busy} onPress={() => setConfirmClear(true)}><Trash2 size={14} /> 全部移除</Button>
        </div>
      </div>

      <p className="mb-3 text-xs text-slate-500">竖排为一个小组。点击任意座位安排学生；已落座的学生再次点击可移除。</p>
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mx-auto mb-4 w-40 rounded bg-slate-800 py-1.5 text-center text-xs text-white">讲 台</div>
        <div className="overflow-x-auto">
          <div className="mx-auto min-w-max">
            <div className="mb-1 flex justify-center gap-2">
              {Array.from({ length: cfg.col_count }).map((_, c) => (
                <div key={c} className="w-14 text-center text-xs text-slate-400">第{c + 1}组</div>
              ))}
            </div>
            {Array.from({ length: cfg.row_count }).map((_, r) => (
              <div key={r} className="mb-2 flex justify-center gap-2">
                {Array.from({ length: cfg.col_count }).map((_, c) => {
                  const seat = grid.get(`${r}-${c}`);
                  const name = String(seat?.student_name ?? '');
                  return (
                    <button
                      key={c}
                      onClick={() => setSelected(seat ?? { row_index: r, col_index: c, student_name: '' })}
                      className={`flex h-12 w-14 items-center justify-center rounded-md border text-xs transition-colors ${name ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-300'}`}
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

      <Drawer isOpen={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }} placement="right">
        <Drawer.Backdrop />
        <Drawer.Content>
          <Drawer.Header>
            <Drawer.Heading>
              {selected ? `${Number(selected.row_index) + 1} 排 ${Number(selected.col_index) + 1} 座（${String(selected.student_name ?? '空')}）` : '安排座位'}
            </Drawer.Heading>
          </Drawer.Header>
          <Drawer.Body>
            <div className="space-y-1">
              {studentNames.map(s => (
                <Button key={s.id} variant="outline" size="sm" fullWidth className="justify-start" onPress={() => void assign(String(s.name))}>
                  {String(s.name)}
                </Button>
              ))}
            </div>
            {selected && String(selected.student_name ?? '') && (
              <Button variant="danger-soft" size="sm" className="mt-3" onPress={() => void clearSeat()}>移除该座位学生</Button>
            )}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer>

      <Confirm open={confirmRandom} onOpenChange={setConfirmRandom} title="随机排座"
        message="将清空当前座位，并按「竖排为小组、每组均衡分配 1-6 层级」重新随机排座，确认？" confirmText="排座" onConfirm={randomSeat} />
      <Confirm open={confirmClear} onOpenChange={setConfirmClear} title="全部移除"
        message="将移除所有座位上的学生，确认？" confirmText="移除" danger onConfirm={clearAll} />
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 3: 冒烟运行**

Run: `npm run dev`，`/seats`：网格点座位弹出 Drawer 选学生、应用行列、随机排座/全部移除确认框、导出 CSV。
Expected: 全通过；Ctrl+C 结束。

- [ ] **Step 4: Commit**

```bash
git add app/seats/page.tsx
git commit -m "feat: rewrite seats page with hero-ui drawer and confirms"
```

---

### Task 22: 登录 `/login`

**Files:**
- Modify: `app/login/page.tsx`（整文件重写）

**Interfaces:**
- Consumes: `post`（`@/lib/api-client`）、`toast`；`@heroui/react` 的 `Button/Input/Label`。
- 功能：用户名/密码表单，回车或点按钮登录（`POST /api/login`），失败 `toast.error('用户名或密码错误')`。

- [ ] **Step 1: 整文件重写 `app/login/page.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Label } from '@heroui/react';
import { post } from '@/lib/api-client';
import { toast } from '@/lib/toast';

export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const doLogin = async () => {
    if (!username || !password) return;
    setBusy(true);
    try {
      await post('/api/login', { username, password });
      router.replace('/');
    } catch { toast.error('用户名或密码错误'); }
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-80 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-center text-lg font-semibold text-slate-800">班主任智慧工作台</h1>
        <p className="mb-4 text-center text-sm text-slate-400">请登录</p>
        <div className="space-y-4">
          <div>
            <Label className="mb-1 block text-sm text-slate-700">用户名</Label>
            <Input size="sm" fullWidth autoFocus autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-sm text-slate-700">密码</Label>
            <Input
              size="sm" fullWidth type="password" autoComplete="current-password"
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void doLogin(); } }}
            />
          </div>
          <Button variant="primary" fullWidth onPress={() => void doLogin()} isDisabled={busy}>
            {busy ? '登录中…' : '登录'}
          </Button>
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

Run: `npm run dev`，登出后 `/login`：正确账号回车可登录；错误账号提示 Toast。
Expected: 正常；Ctrl+C 结束。

- [ ] **Step 4: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat: rewrite login page with hero-ui"
```

---

### Task 23: 收尾 —— 卸载 antd、全量验证

**Files:**
- Modify: `package.json`

**Interfaces:**
- 完成：`grep -r "antd" app components lib` 无命中；antd 三依赖移除；`npm run build` + `npm test` 全绿。

- [ ] **Step 1: 确认无 antd 残留**

Run: `grep -rE "from ['\"]antd|@ant-design|App\.useApp|message\.(success|error|warning)" app components lib`
Expected: 无命中（docs/ 下的历史计划文档不算）。

- [ ] **Step 2: 卸载 antd 三件套**

Run: `pnpm remove antd @ant-design/icons @ant-design/nextjs-registry`
Expected: package.json 移除三个依赖；`pnpm ls antd` 无输出。

- [ ] **Step 3: 全量验证**

Run: `npm run build`
Expected: PASS（Next build 含 typecheck + lint）。
Run: `npm test`
Expected: 全部通过（Vitest 不依赖 UI，应保持绿）。

- [ ] **Step 4: 冒烟抽查**

Run: `npm run dev`，抽查 `/`、`/students`、`/timetable`、`/seats`、`/settings`、`/login` 各路由渲染与交互（无 CDP，人工点按）。
Expected: 正常；Ctrl+C 结束。

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "chore: remove antd dependencies after hero-ui migration"
```

---

## 收尾核对（计划完成标准）

- [ ] 全量 `npm run build` 绿（typecheck + lint）。
- [ ] `npm test` 绿。
- [ ] `grep -rE "antd|@ant-design" app components lib package.json` 无命中。
- [ ] 16 个路由页 + 4 个 timetable 组件均无 antd 引用。
- [ ] `useColumnVisibility` 的 localStorage 键未变（`gzt:cols:*`），用户列显隐设置保留。
- [ ] 数据层、`app/api/**`、`tests/` 零改动。

