# HeroUI v3 组件库迁移 Design

> 分支：`feat/migrate-hero-ui`　日期：2026-08-24

**Goal:** 将前端组件层从 antd v6 全量迁移到 HeroUI v3.2.4（`@heroui/react`），**功能全保留**（排序、列级筛选、分页、列显隐、内联编辑、CSV 导入导出、快捷操作），数据层与通用 API 不动。

**Tech Stack:** Next.js 16 App Router、React 19、`@heroui/react@^3.2.4`、lucide-react、Tailwind v4、dayjs（保留做日期计算/格式化）、recharts（图表）、Vitest、TypeScript 严格模式。Node >= 22（本机 24）。

## 1. 目标与边界

- 组件层 antd → HeroUI v3.2.4，功能保真：每页交互与现在一致（含学号排序、性别/层次/类别列筛选、分页、列显隐、内联保存、CSV 导入导出、统计卡、快捷操作、编辑/完成开关）。
- **数据层不动**：`lib/schema.ts`/`lib/store.ts`/`lib/seed.ts`/`lib/db.ts`/`lib/dashboard.ts`/`lib/import.ts`/`lib/api-client.ts`/`lib/csv.ts`、`app/api/**`、`tests/` 一律不改。
- **不做 CDP 测试**。验证手段 = `npm run build`（含 typecheck + lint）+ `npm test`（Vitest 不依赖 UI）+ 手动 `npm run dev` 冒烟。
- 文案保持中文。
- 提交信息沿用仓库前缀（`feat:`/`fix:`/`chore:`/`docs:`）。

## 2. 依赖变更

**新增：**
- `@heroui/react@^3.2.4` — 组件库（自动带入 react-aria、react-aria-components 等）
- `lucide-react` — 图标（替换 `@ant-design/icons`）

**移除：**
- `antd`、`@ant-design/icons`、`@ant-design/nextjs-registry`

**保留：**
- `dayjs`（仍用于日期计算与格式化，如 `dayjs().subtract()`、月份筛选；HeroUI 选择器用 `CalendarDate`，二者之间在 `lib/date.ts` 转换）
- `recharts`（仪表盘/成绩/课表/评价图表）

## 3. 全局接入（HeroUI v3 已核实）

- **无需 Provider**：v3 README 明确 "No Provider wrapper needed"。
- `app/globals.css`：`@import "tailwindcss"` 替换为 `@import "@heroui/styles";`（引入 Tailwind base + 全部组件样式 + 主题变量 + tw-animate 动画），**保留**现有 `@theme` 自定义色板（navy/accent/bg/blue/teal/purple/amber/red/warn）与 `body` 样式。
- `app/layout.tsx`：删除 `AntdRegistry` / `ConfigProvider(locale=zhCN)` / antd `App` 三层包裹，仅保留 `<DayjsLocale /><AppShell>{children}</AppShell>`。

## 4. antd 独有能力 → 自建替代

| antd | HeroUI 方案 |
|---|---|
| `App.useApp().message` | Toast 封装：`components/toast.tsx`（在 layout 挂载 Toast 区域）+ `lib/toast.ts` 暴露 `toast.success/error/warning`；页面统一改用它 |
| `Statistic` | `components/stat-card.tsx`（Tailwind：label + value + suffix） |
| `Segmented` | `ToggleButtonGroup`（单选模式） |
| `Popconfirm` | `AlertDialog` 封装的 `components/confirm.tsx`（受控 open + 确认回调） |
| `Layout`/`Menu`/`Drawer` 壳 | `components/app-shell.tsx` 自定义 Tailwind：桌面固定侧边栏（navy 深色）+ 顶栏（时钟/编辑开关）+ 移动端 `Drawer`；lucide 图标 |
| `Upload`（CSV 导入） | 隐藏 `<input type="file" accept=".csv">` + Button，FileReader 读文本后调 `onImport` |
| `DatePicker`（dayjs） | 表单：HeroUI `DatePicker`（`CalendarDate`）+ `lib/date.ts`（`toCalendarDate('YYYY-MM-DD')` / `toDateString(CalendarDate)`）；`EditableCell` date 内联：原生 `<input type="date">`（内联更稳、移动端友好） |
| `Form` 弹窗 | HeroUI `Form` + 受控 state，各页自行组织字段；必填用 `isRequired`/`validate` 或手动校验 |

## 5. 表格体系（核心）

新建 **`components/data-table.tsx`**：基于 HeroUI `Table`（RAC，原生支持 `sortDescriptor` 排序）的可复用表格，统一封装：

- **排序**：表头 `allowsSorting` + `sortDescriptor`/`onSortChange`，客户端对 `dataSource` 排序。
- **列级筛选**：表头 Popover（`Select`/`CheckboxGroup` 面板），替代 antd 列筛选下拉。
- **分页**：HeroUI `Pagination` + 客户端切片（`pageSize` 可配，students 用 10，其余默认不分页或全量）。
- **列显隐**：沿用 `useColumnVisibility`（localStorage 键 `gzt:cols:*` 不变，不丢用户设置）。
- **内联编辑**：单元格渲染 `EditableCell`（HeroUI `Input`/`NumberField`/`Select`；textarea 用 `TextArea`）。
- **loading**：HeroUI `Skeleton`。
- **导出**：`TableToolbar` 复用 `lib/csv.ts:downloadCsv`。

**`components/table-toolbar.tsx` 重写**：HeroUI `Button`/`Dropdown`/`Checkbox` + 隐藏 file input；`useColumnVisibility` 逻辑保留。

**`components/editable-cell.tsx` 重写**：接口（`EditableType`/`Props`）与编辑语义不变（点按进入、失焦/回车保存、Escape 取消、`editable=false` 禁用、保存失败 `toast.error('保存失败')`），控件换成 HeroUI。

**页面变薄**：每页只提供列配置 + 数据源 + 增改删回调，`DataTable` + `TableToolbar` 全包；手写页（timetable/seats/grades/evaluation/仪表盘）保留自制 UI，仅换控件。

## 6. 壳层与手写页

- `app-shell.tsx`：保留 `EditableProvider`、顶栏时钟（dayjs）、「编辑/完成」开关、`/api/settings` 读班级名；桌面 Sider（navy）+ 移动 Drawer 用自定义 Tailwind + HeroUI `Drawer` 实现；菜单沿用现有路由（13 个业务菜单项 + 系统设置/用户管理，管理员角色逻辑保留）与 lucide 图标。
- 手写页：timetable 网格（`EditableCell` select 选课）、seats 座位格 + HeroUI `Drawer` + 随机排座（`Confirm`）、grades 统计 + 直方图（recharts）+ 内联分数、evaluation 维度内联 + recharts、仪表盘 StatCard + 快捷操作弹窗、login/settings/users 表单。

## 7. 执行顺序（将在 Implementation Plan 细化）

1. **依赖 + 全局接入**：安装 `@heroui/react`、`lucide-react`；改 `globals.css`、`layout.tsx`；同时读安装包 `.d.ts` 核实 Table/Toast/DatePicker/AlertDialog 精确 API。构建保绿。
2. **共享件**：`lib/date.ts`、`lib/toast.ts` + `components/toast.tsx`、`stat-card.tsx`、`confirm.tsx`、重写 `editable-cell.tsx`、新建 `data-table.tsx`、重写 `table-toolbar.tsx`。每步构建保绿。
3. **壳层**：重写 `app-shell.tsx`。
4. **仪表盘** `/`：StatCard 卡 + 快捷操作（QuickAdd 弹窗改用 HeroUI Form）。
5. **表格型 CRUD 页**：students、leaves、discipline、conversations、visits、parent-comm、safety、work-logs、users、settings —— 复用 DataTable + 各页 modal 表单。
6. **手写页**：timetable（含 4 个子组件）、seats、grades、evaluation、login。
7. **收尾**：卸载 antd/@ant-design/icons/@ant-design/nextjs-registry；全量 `grep -r antd app components lib` 无命中；`npm run build` + `npm test` 全绿。

## 8. 风险与对策

- **RAC/HeroUI 精确 API**（Table 排序、Toast、DatePicker 复合 API、AlertDialog 触发）：Task 1 安装后先读 `node_modules/@heroui/react` 类型定义再动手，避免凭记忆写错。
- **CalendarDate ↔ 'YYYY-MM-DD'**：`lib/date.ts` 集中两个转换函数，一处改动。
- **列筛选 UX**：antd 表头筛选下拉改为自实现 Popover 面板，交互等价、视觉为 HeroUI 风格。
- **Toast 挂载**：若 HeroUI Toast 需要容器/区域组件，在 `layout.tsx` 或 `app-shell.tsx` 挂载一次（以安装包 API 为准）。
