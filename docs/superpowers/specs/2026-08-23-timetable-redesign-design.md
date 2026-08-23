# 课程表重构设计（班级课表 + 我的授课）

日期：2026-08-23
状态：待评审

## 背景与范围

当前 `app/timetable/page.tsx` 是一个写死的 6 时段 × 5 天网格，时段标签硬编码在 `page.tsx`
(`PERIODS`) 和 `lib/seed.ts` 两处，且「每周总课时」恒等于 30（固定值，无意义）。班主任的实际
需求是两块彼此独立的内容：

1. **本班的课表** —— 学校一天的时段结构：早自习 + 上午正课 4 节 + 中午托 + 陪餐 +
   下午正课 3 节 + 下午托。时段名称、起止时间、是否正课都要可自定义。
2. **班主任自己的授课安排** —— 作为班主任，除了本班，还可能要**去其他班上课**。其他班的课表
   结构和本班不一定相同，所以这部分必须**与本班课表完全解耦、独立维护**，不能把「外出上课」
   叠到本班网格上（会错位）。

本次只动课程表模块及其共享的数据层/API；其他模块（学生、成绩、座位等）不动。项目未部署、
只有演示数据，**不写迁移**：直接改 schema，启动时用哨兵列检测到旧库即 `resetData` 自愈。

### 需求清单

1. 新增可配置的「时段」定义，作为班级课表的时间轴：名称、起止时间、顺序、类型
   （正课 / 自习 / 托管 / 陪餐）全部可增删改。默认 11 个时段（早自习 + 上午正课4 + 中午托 +
   陪餐 + 下午正课3 + 下午托）。
2. 班级课表网格改为按「时段定义」渲染：正课格子可填学科（下拉），非正课格子固定显示类型标签，
   不填学科。
3. 统计卡改为「每周正课总课时 + 语文任教课时」；学科分布图表只统计正课。
4. 新增「我的授课」视图：班主任每周要上的课（星期 + 时段 + 目标班级 + 科目），纯手动维护，
   与本班课表数据无联动。
5. 删除一个时段时，级联删除其下所有 timetable 行与 teacher_schedule 行。

## 数据模型

`lib/schema.ts` 变更（新建库直接生效）：

**新增 `period_slots`（时段定义）**

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | INTEGER PK | 自增 |
| `seq` | INTEGER NOT NULL | 一天内的顺序，1..N，网格行的排序键 |
| `name` | TEXT NOT NULL | 名称，如「早自习」「上午第1节」 |
| `start_time` | TEXT NOT NULL DEFAULT '' | 起 HH:mm |
| `end_time` | TEXT NOT NULL DEFAULT '' | 止 HH:mm |
| `kind` | TEXT NOT NULL DEFAULT '正课' | 正课 / 自习 / 托管 / 陪餐 |

```sql
CREATE TABLE IF NOT EXISTS period_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seq INTEGER NOT NULL,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL DEFAULT '',
  end_time TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT '正课'
);
```

**`timetable` 变更**：把自由文本 `period` 改为外键 `period_id`（关联 `period_slots`），保留
`weekday` / `subject` / `is_chinese`。正课格子才有行；自习/托管/陪餐不落表。

```sql
CREATE TABLE IF NOT EXISTS timetable (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weekday INTEGER NOT NULL DEFAULT 1,
  period_id INTEGER NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  is_chinese INTEGER NOT NULL DEFAULT 0
);
```

**新增 `teacher_schedule`（班主任自己的授课安排）**

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | INTEGER PK | 自增 |
| `weekday` | INTEGER NOT NULL | 1..5 |
| `period_id` | INTEGER NOT NULL | 关联 period_slots（复用学校一天的结构） |
| `class_name` | TEXT NOT NULL DEFAULT '' | 目标班级，本班或别的班，纯文本 |
| `subject` | TEXT NOT NULL DEFAULT '' | 科目 |
| `remark` | TEXT NOT NULL DEFAULT '' | 备注 |

```sql
CREATE TABLE IF NOT EXISTS teacher_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weekday INTEGER NOT NULL DEFAULT 1,
  period_id INTEGER NOT NULL,
  class_name TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  remark TEXT NOT NULL DEFAULT ''
);
```

### RESOURCES 注册

`lib/types.ts` → `ResourceKey` 增加 `'period_slots' | 'teacher_schedule'`；
`lib/store.ts` → `RESOURCES` 增加两项。通用 `app/api/[resource]` 与 `[resource]/[id]` 自动生效。

## 播种与启动自愈

`lib/seed.ts`：

- **period_slots** 默认 11 行（seq 1..11）：

  | seq | name | start | end | kind |
  |---|---|---|---|---|
  | 1 | 早自习 | 08:00 | 08:20 | 自习 |
  | 2 | 上午第1节 | 08:25 | 09:05 | 正课 |
  | 3 | 上午第2节 | 09:15 | 09:55 | 正课 |
  | 4 | 上午第3节 | 10:05 | 10:45 | 正课 |
  | 5 | 上午第4节 | 10:55 | 11:35 | 正课 |
  | 6 | 中午托 | 11:40 | 12:10 | 托管 |
  | 7 | 陪餐 | 12:10 | 12:40 | 陪餐 |
  | 8 | 下午第1节 | 14:00 | 14:40 | 正课 |
  | 9 | 下午第2节 | 14:50 | 15:30 | 正课 |
  | 10 | 下午第3节 | 15:40 | 16:20 | 正课 |
  | 11 | 下午托 | 16:20 | 17:00 | 托管 |

- **timetable**：只为正课时段生成。遍历 11 个时段，`kind === '正课'` 的 7 个 × 5 天 =
  **35** 行，随机科目 + `is_chinese` 标记（语文科 `1`）。自习/托管/陪餐时段不落表。
- **teacher_schedule**：少量演示行，证明是「去别的班上课」的独立数据源，如
  `(1, 2, '长沙青园小学六年级（1）班', '语文')`、`(2, 9, '六年级（2）班', '数学')` 等 2–3 条。
- `resetData` 的 DROP 表清单加入 `period_slots`、`teacher_schedule`。

`lib/db.ts`：`getDb()` 在 `PRAGMA table_info(students)` 检查之外，加 `PRAGMA table_info(timetable)`
是否含 `period_id` 的哨兵判断；`timetable` 存在但缺 `period_id`（旧库）→ `resetData(db)`。既有
`students.idcard` 哨兵保留。

## 班级课表页（app/timetable/page.tsx 重构）

页面用 antd `Tabs` 分两个标签页：**班级课表** / **我的授课**。导航菜单仍指向 `/timetable`，无需改动。

纯函数放 `lib/timetable.ts`（便于测试，页面与测试共用）：

```ts
export const SUBJECTS = ['语文','数学','英语','科学','道德与法治','体育','音乐','美术','班会','劳动',''];
export type PeriodKind = '正课' | '自习' | '托管' | '陪餐';
export const KIND_LABELS: Record<PeriodKind,string> = { 正课: '正课', 自习: '自习', 托管: '托管', 陪餐: '陪餐' };
export function buildClassGrid(slots, rows): Map<string, Row>;   // key `${weekday}-${period_id}`
export function classStats(slots, rows): { total: number; chinese: number }; // 只统计正课学科
export function subjectDist(rows): { name: string; 课时: number }[];          // 只统计学科非空
```

**网格**：行 = `period_slots`（按 `seq` 排序），列 = 周一..周五，关键词 `${weekday}-${period_id}`。

- 首列显示「名称 + 起止时间」（名称一行，时间小字一行）。（上/下午分组着色、合并单元格等纯装饰
  属于可选，本期不做，避免扩大范围。）
- **正课格子**：渲染 `EditableCell`（subject 下拉，复用在搭的 `components/editable-cell.tsx`）。
  - 已有 timetable 行 → `update(id, { subject, is_chinese })`；
  - 无行（空格子）→ 首次保存时 `create({ weekday, period_id, subject, is_chinese })`；
  - `is_chinese = (subject === '语文' ? 1 : 0)`。
- **非正课格子**（自习/托管/陪餐）：静态标签，用 `KIND_LABELS[kind]` 给出淡色 tag，不可编辑。

**统计卡**：`classStats` → 「每周正课总课时」（35 上限）+「语文任教课时」；`subjectDist` 驱动
重写的 Recharts 学科分布（仅正课）。

**时段管理**：卡片右上「时段管理」按钮打开 `PeriodSlotsModal`（新组件
`components/timetable/period-slots-modal.tsx`）：
- 列出全部时段，逐行可编辑 `name` / `start_time` / `end_time` / `kind`（select 正课/自习/托管/陪餐）；
- 上移/下移调整 `seq`；
- 新增一行（默认 kind=正课，seq=当前最大+1）；删除（二次确认）；
- 保存走通用 API：`POST/PUT/DELETE /api/period_slots...`。

**删除时段级联**：`app/api/[resource]/[id]/route.ts` 的 `DELETE` 加分支——当
`resource === 'period_slots'` 时在一个事务里 `DELETE FROM period_slots` + `DELETE FROM timetable
WHERE period_id=id` + `DELETE FROM teacher_schedule WHERE period_id=id`。避免另建文件遮蔽
动态路由，也保证原子性。

## 我的授课页（同一 Tabs 的第二格）

数据源 `teacher_schedule`，纯手动维护。

- **主视图**：表格列出授课安排（星期 / 时段名称+时间 / 目标班级 / 科目 / 备注），新增/编辑/删除。
  「新增授课」打开 `TeacherScheduleModal`：下拉选星期 + 时段（来自 period_slots）+ 班级（文本，
  可带 datalist 提示本班名）+ 科目（select）+ 备注。
- **周总览网格**（辅助、只读）：复用 `period_slots` × 星期，把 teacher_schedule 的行映射到
  `${weekday}-${period_id}`，格子显示「班级 + 科目」，无则显示「空闲」。让班主任一眼看到自己的
  忙闲时段。

## 测试

`tests/seed.test.ts`（更新）：
- `schema` 期望表数组加入 `period_slots`、`teacher_schedule`（仍是 `arrayContaining`，补上更完整）。
- `resetData` 后 `timetable` 计数断言由 30 → **35**（7 正课 × 5 天）。

`tests/timetable.test.ts`（新增）：
- 播种后 `period_slots` 共 11 行，seq 1..11 连续，kind 分布 = 正课 7、自习 1、托管 2、陪餐 1。
- 播种后 `timetable` 共 35 行；每个「正课时段 × 星期」恰好一行，非正课时段无行；`is_chinese`
  只在 `subject='语文'` 时为 1。
- `classStats`：total = 35（正课且有学科），chinese = 语文学科计数；subject 为空不计入。
- `subjectDist`：只含学科非空的条目，课时≥1，语文条目存在。
- `buildClassGrid`：空表/正常数据下 key 正确。
- 级联删除：删一个正课时段 → 其 timetable + teacher_schedule 行同步消失，其他时段行保留。

## 涉及文件清单

| 文件 | 改动 |
|---|---|
| `lib/schema.ts` | 新增 `period_slots`、`teacher_schedule`；`timetable` 改 `period_id` |
| `lib/seed.ts` | 播种时段/35 行正课/演示授课；resetData DROP 清单加表 |
| `lib/db.ts` | 加 `timetable.period_id` 哨兵自愈判断 |
| `lib/types.ts` / `lib/store.ts` | ResourceKey / RESOURCES 加 `period_slots`、`teacher_schedule` |
| `lib/timetable.ts` | 新增纯函数：SUBJECTS / KIND_LABELS / buildClassGrid / classStats / subjectDist |
| `app/api/[resource]/[id]/route.ts` | DELETE 加 `period_slots` 级联分支 |
| `app/timetable/page.tsx` | 重构为 Tabs（班级课表 / 我的授课），复用函数与组件 |
| `components/timetable/period-slots-modal.tsx` | 新增时段管理弹窗 |
| `components/timetable/teacher-schedule-modal.tsx` | 新增授课编辑弹窗 |
| `tests/seed.test.ts` | 表清单 / timetable 计数值(35) 更新 |
| `tests/timetable.test.ts` | 新增播种、统计、网格、级联断言 |
