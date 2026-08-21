# antd 组件库迁移设计

日期：2026-08-21
状态：已评审通过

## 背景与范围

班主任智慧工作台（Next.js 16 App Router + React 19 + SQLite）当前使用一套自研 UI 组件
（`components/crud/*`、`components/ui/*`、自定义 `app-shell`/`sidebar`/`topbar`），搭配
Tailwind v4 与 lucide-react 图标。本设计将前端组件层**全量重写为 antd v6 原生写法**，
采用 **antd 原生视觉**（放弃 PRD 藏蓝政务配色），同时**保留内联编辑交互**与
「编辑/完成」开关。

**数据层不动**：`lib/`（schema/store/seed/dashboard/csv/import/api-client）、通用 REST 路由
`app/api/[resource]` 与 `[resource]/[id]`、recharts 图表、`tests/` 全部保持不变。

### 需求清单

1. UI 组件全部换成 antd v6，页面按 antd 原生 API 直写（每页自己的 `columns` + `<Table>` + Form 弹窗）。
2. 保留「点击单元格即编辑、失焦/回车保存」的内联编辑体验（用 antd 控件实现）。
3. 仅保留 2 个薄共享件：`EditableCell`（内联编辑）与 `TableToolbar`（新增/导出/导入/列显隐）。
4. 视觉采用 antd 原生默认主题（Ant Blue），全局 `ConfigProvider locale=zhCN` + `dayjs` 中文。
5. 壳层改用 antd `Layout`/`Menu`/`Drawer`，保留「编辑/完成」开关（`EditableContext`）。
6. Tailwind v4 **继续保留**，仅用于布局/间距（`flex`/`grid`/`gap`/响应式），组件交给 antd。

## 依赖与工程基建

| 操作 | 包 |
|---|---|
| 新增 | `antd@^6`、`@ant-design/icons`、`@ant-design/nextjs-registry`、`dayjs` |
| 移除 | `lucide-react` |
| 保留 | `tailwindcss@^4`、`@tailwindcss/postcss`、`recharts`、`eslint-config-next` |

`app/layout.tsx` 组件树（自外向内）：

```
AntdRegistry            // @ant-design/nextjs-registry：SSR 样式抽取，antd×Next App Router 必需
└─ ConfigProvider locale={zhCN}   // antd 中文文案
   └─ App              // antd App：让 message/notification/Modal.context 生效
      └─ <AppShell>{children}</AppShell>
```

`dayjs.locale('zh-cn')` 在入口或布局初始化。

`globals.css`：保留 `@import "tailwindcss"` 与 body 基础样式（含配色 token）；删除
`.card`/`.btn-primary` 辅助类（由 antd `Card`/`Button` 取代）。

## 壳层

替换 `components/app-shell.tsx`、`sidebar.tsx`、`topbar.tsx`：

- antd `Layout`：`Layout.Sider`（桌面常驻）+ `Drawer`（移动端抽屉），菜单用 `Layout.Menu`，
  `items` 数组 + `@ant-design/icons`，沿用现有 17 个菜单项（`/`、`/schedule`、`/timetable`、
  `/students`、`/grades`、`/homework`、`/leaves`、`/discipline`、`/conversations`、
  `/visits`、`/evaluation`、`/seats`、`/parent-comm`、`/safety`、`/peiyou`、
  `/work-logs`、`/settings`）与路由高亮。
- `Layout.Header`：班级名（`/api/settings` 读取 `class_name`）、实时时钟、右侧「编辑/完成」开关。
- `EditableContext`（`components/editable-context.tsx`）**保留原样**：编辑开关默认 `true`，
  `toggle()` 切换；`useEditable()` 供表格/内联编辑判断可编辑态。行为与现状一致（防误触）。

## 表格与内联编辑（核心）

每个 CRUD 页自行组装 antd 原生表格：

- `<Table>`：`columns`：`ColumnType<Row>[]`；`dataSource={rows}`；`rowKey={(r) => r.id}`；
  需要可编辑的列 `render: (v, r) => <EditableCell ... />`；只读/自定义列用各自 `render`。
- `EditableCell`（新组件，`components/editable-cell.tsx`）：
  - 非编辑态：显示值（空值/`null` 显示 `—`），hover 高亮提示可编辑。
  - 编辑态：按 `type` 渲染 antd 控件——`text`/`textarea`→`Input`、`select`→`Select`、
    `number`→`InputNumber`、`date`→`DatePicker`、`tel`→`Input`；`variant="borderless"` 融入单元格。
  - `editable` 为 `false` 时不进入编辑态（尊重「编辑/完成」开关）。
  - 保存：失焦或回车（`textarea` 仅失焦）触发 → 空串按 `nullOnEmpty` 转 `null` →
    `PUT /api/{resource}/{id}` → 成功 `message.success`，失败回滚并提示。
- 删除：`Popconfirm` 二次确认。
- 新增：`TableToolbar` 的「新增」打开 `Modal + Form`，字段按页面 `columns` 定义渲染
  （`Input`/`Select`/`InputNumber`/`DatePicker`），提交 `POST /api/{resource}`。
- `TableToolbar`（新组件，`components/table-toolbar.tsx`）：`Space` + `Button` +
  `Upload`：新增、导出（复用 `lib/csv.ts`）、导入（复用 `lib/import.ts` 的 `importStudents`，
  csv 解析复用 `lib/csv.ts`）、列显隐（`Checkbox` 下拉，localStorage 键沿用 `gzt:cols:{resource}`）。

## 页面重写清单

17 个路由页全部重写，均为 antd 原生写法。主要工作量，每页独立验收：

| 页面 | 说明 |
|---|---|
| 仪表盘 `/` | antd `Statistic`/`Card` + recharts；快捷操作九宫格用 antd `Flex`/Tailwind grid + `Button` |
| 学生管理 `/students` | 全字段内联编辑表，含导入模板、学号排序（`Table` `sorter`）、列显隐 |
| 课表 `/timetable` | 自绘网格用 Tailwind grid + antd `Select`，含 `is_chinese` 授课蓝高亮 |
| 排座位 `/seats` | 桌面布局自绘网格 + antd 控件拖选/编辑座次 |
| 其余 CRUD 页 | 内联编辑表 + 新增/导出/导入/删除，按各自 `ColumnDef` 字段映射 |
| 系统设置 `/settings` | 编辑 `settings` 表 + 重置演示数据（`POST /api/reset`）+ 备份下载（`/api/backup`） |

品类色映射 `components/ui/color-utils.ts` 为纯数据函数（非组件），移到 `lib/color-utils.ts`
保留，供 recharts 图表着色。

## 移除清单

- `components/crud/`（`crud-page.tsx`、`data-table.tsx`、`import-modal.tsx`、`quick-add.tsx`、`types.ts`）
- `components/ui/`（`modal.tsx`、`toast.tsx`、`stat-card.tsx`、`page-header.tsx`、
  `chart-card.tsx`、`empty-state.tsx`、`inline-edit.tsx`；`color-utils.ts` 移到 `lib/`）
- `components/app-shell.tsx`、`components/sidebar.tsx`、`components/topbar.tsx`（重写为 antd 壳）
- `app/globals.css` 中的 `.card`/`.btn-primary` 辅助类
- `package.json` 中 `lucide-react`

保留：`components/editable-context.tsx`、`components/dashboard/`（重写为 antd）、
`components/ui/color-utils.ts`→`lib/color-utils.ts`。

## 测试与验收

- `lib/` 的 vitest 测试不依赖 UI，**保持通过**：`npm test`。
- 构建通过：`npm run build`。
- 浏览器实测（dev 或 build 后 `npm start`）：
  1. 仪表盘渲染统计数据与图表。
  2. 一个代表性 CRUD 页（如学生管理）：内联编辑保存、新增、导入（下载模板+上传）、导出、删除。
  3. 课表、排座位自定义布局正常。
  4. 移动端视口：Sider 变抽屉、菜单可开合；「编辑/完成」开关切换内联编辑可编辑态。

## 全局约束

- 数据层、通用 API、CSV/导入、recharts、测试**一律不动**。
- 文案保持中文；antd 文案经 `ConfigProvider locale=zhCN`。
- 内联编辑保存走 `PUT /api/{resource}/{id}`，`nullOnEmpty` 行为与现状一致。
- 列显隐 localStorage 键沿用 `gzt:cols:{resource}`，不丢失已保存的显隐设置。
- 提交信息沿用仓库风格前缀（`feat:`/`fix:`/`chore:`/`docs:`）。
- AGENTS.md 提示本项目 Next.js 有 breaking changes：如对 Next/antd 集成约定不确定，
  先读 `node_modules/next/dist/docs/` 与 antd v6 迁移文档；复用现有 `page.tsx`/`route.ts` 模式。