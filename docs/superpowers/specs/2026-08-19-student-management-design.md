# 学生管理页增强设计

日期：2026-08-19
状态：已评审通过

## 背景与范围

班主任智慧工作台（Next.js 16 + SQLite）的学生管理页需要增强。当前 `students` 表仅有
姓名/性别/家长电话/班干部职务/小组/学生层次(文字四档)/下午托/备注 8 个字段，学籍信息
不够完整，且无批量导入能力。本项目尚未部署，**无需兼容旧数据**：直接改 schema，已有
本地 `data/app.db` 在启动时检测到缺新列即重置演示数据。

本次范围仅限学生管理页及其共享组件，其他模块（培优临界生、违纪台账、请假管理等）不动。

### 需求清单

1. 学生层次改为 1–6 六档（1 最低 / 6 最高），替换原 优秀/良好/合格/重点关注。
2. 新增「中午托」「早餐」两个 0/1 字段。
3. 新增学号（两位数字），置于姓名前，默认按学号排序。
4. 新增身份证（唯一索引）与住址。
5. 新增家长姓名。
6. 新增 CSV 导入：提供示例模板，按身份证覆盖（upsert）。
7. 列支持显示/隐藏 + 横向滚动（横向滚动已具备，核心是列开关，全局支持）。

## 数据模型

`lib/schema.ts` 中 `students` 表变更（新建库直接生效）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | INTEGER PK | 自增 |
| `student_no` | TEXT NOT NULL DEFAULT '' | 学号，两位 `01…45`，默认排序键 |
| `name` | TEXT NOT NULL | 姓名 |
| `gender` | TEXT NOT NULL DEFAULT '男' | 性别 |
| `parent_name` | TEXT NOT NULL DEFAULT '' | 家长姓名（新增） |
| `parent_phone` | TEXT NOT NULL DEFAULT '' | 家长电话 |
| `idcard` | TEXT | 身份证（新增，可为 NULL） |
| `address` | TEXT NOT NULL DEFAULT '' | 住址（新增） |
| `level` | INTEGER NOT NULL DEFAULT 4 | 1–6 六档分层（原 TEXT 改整数） |
| `group_no` | INTEGER NOT NULL DEFAULT 1 | 小组 |
| `role` | TEXT NOT NULL DEFAULT '' | 班干部职务 |
| `noon_care` | INTEGER NOT NULL DEFAULT 0 | 中午托（新增） |
| `breakfast` | INTEGER NOT NULL DEFAULT 0 | 早餐（新增） |
| `afternoon_care` | INTEGER NOT NULL DEFAULT 1 | 下午托 |
| `remark` | TEXT NOT NULL DEFAULT '' | 备注 |

身份证唯一索引（可为 NULL，多个 NULL 不冲突）：

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_idcard ON students(idcard);
```

## 播种与启动自愈

`lib/seed.ts`：

- 45 名演示学生补齐新字段：
  - 学号按插入顺序 `printf('%02d', i)` 生成 `01…45`。
  - 身份证生成唯一年份为 2013/2014 的 18 位假号（长沙 4301 区段 + 生日 + 顺序号 + 校验位）。
  - 家长姓名从现有姓名字池随机；住址随机「XX 街道 XX 小区」。
  - 中午托/早餐随机 0/1；层次随机 `1 + rand(6)`。
- `resetData` 升级：由「DELETE 全部表」改为「DROP 全部表 → 执行 `SCHEMA_SQL` 重建 → `seedIfEmpty` 重播种」（重置后数据结构与新建一致）。

`lib/db.ts`：`getDb()` 跑完 `SCHEMA_SQL` 后检查 `PRAGMA table_info(students)` 是否含 `idcard`；
缺失（旧库）则调用 `resetData(db)` 自愈。无部署、旧数据不保留，不做逐字段迁移。

## 学生管理页（app/students/page.tsx）

列（新顺序）：

| # | 键 | 标签 | 类型 | 默认显示 |
|---|---|---|---|---|
| 1 | `student_no` | 学号 | text | ✅ |
| 2 | `name` | 姓名 | text | ✅ |
| 3 | `gender` | 性别 | select 男/女 | ✅ |
| 4 | `parent_name` | 家长姓名 | text | ✅ |
| 5 | `parent_phone` | 家长电话 | tel | ✅ |
| 6 | `idcard` | 身份证 | text（`nullOnEmpty`） | ✅ |
| 7 | `address` | 住址 | text | ⬜ 默认隐藏 |
| 8 | `level` | 学生层次 | select 1–6 | ✅ |
| 9 | `group_no` | 小组 | number | ✅ |
| 10 | `role` | 班干部职务 | text | ✅ |
| 11 | `noon_care` | 中午托 | select 1/0 | ✅ |
| 12 | `breakfast` | 早餐 | select 1/0 | ✅ |
| 13 | `afternoon_care` | 下午托 | select 1/0 | ✅ |
| 14 | `remark` | 备注 | text | ⬜ 默认隐藏 |

行为：

- **排序**：`CrudPageConfig` 增加可选 `sortRows`（比较器），对筛选结果应用；学生页按学号
  数值升序。
- **新增**：`defaultNewRow` 签名改为接收 `rows`，学生页自动取「当前最大学号 + 1」补零填入
  `student_no`（可改），其余默认：姓名「新学生」、性别「男」、层次 4、小组 1、下午托 1、
  中午托/早餐 0、家长姓名/电话/身份证/住址/职务/备注 空。
- **身份证唯一**：`ColumnDef` 增加可选 `nullOnEmpty`，`idcard` 列启用——保存前 `''` 转 `NULL`
  （多个空值不冲突）；重复身份证触发唯一索引 → 接口 400 → toast「身份证已存在」。
- **统计卡**：总人数 / 男生 / 女生 / 班干部 / 重点关注(`level === 1` 人数，标签「重点关注(1档)」)。
- **筛选**：性别、下午托、层次（选项改 1–6）三个维持，仅更新层次选项。

## 列显示/隐藏（全局组件）

改动 `PageHeader` + `CrudPage` + `DataTable`，所有 CRUD 页共享：

- **入口**：`PageHeader` 增加可选 `onColumns` 回调，在「导出」旁渲染「☰ 列」按钮；`CrudPage`
  传入后点击弹面板列出全部列标签 + 复选框，勾选即时增删表格列；删除列始终保留。
- **记忆**：localStorage，键 `gzt:cols:<resource>`，存隐藏列的 key 数组。初始化：无记录时用
  `config.defaultHidden`（学生页 = `['address', 'remark']`），有记录以记录为准；其他页无
  defaultHidden，默认全显示。
- **导出 WYSIWYG**：CSV 导出只导出当前可见列。
- **新增弹窗不受影响**：仍编辑全部字段。
- 全局自动生效：成绩/作业/请假等页无需逐页配置即获得「列」按钮。

## CSV 导入（学生页专用）

**入口**：`CrudPageConfig` 增加可选 `importTemplate`；`PageHeader` 增加可选 `onImport` 渲染
「导入」按钮。仅学生页配置，其他页不显示。

**`ImportModal`（新共享组件 components/crud/import-modal.tsx）**：
- 「下载示例模板」按钮：前端生成带 BOM 的 CSV，中文表头 + 2 行示例，格式与导出一致。
- 文件选择 `accept=".csv"`；选中后前端 `parseCsv`（处理引号转义、逗号、换行、去 BOM），
  按中文表头映射为字段，逐行规范化后 POST 到 `/api/students/import`。

**模板表头**（与表格列一致）：
```
学号,姓名,性别,家长姓名,家长电话,身份证,住址,学生层次,小组,班干部职务,中午托,早餐,下午托,备注
```

**逐行规范化**（学生页 `importTemplate.parseRow`，返回 `{ok:true,row} | {ok:false,message}`）：
- 身份证为空 → 跳过并记「第 N 行：缺少身份证」。
- 学生层次：空 → 4；非 1–6 → 跳过记错。
- 中午托/早餐/下午托：接受 `1/0/是/否/有/无` → 归一为 1/0；空 → 0。
- 学号：空 → 自动取当前最大号 + 1。
- 性别：男/女。

**服务端 `app/api/students/import/route.ts`（新静态路由，优先于动态 `[resource]`）**：
- 收 `{ rows }`，核心逻辑在纯函数 `lib/import.ts` 的 `importStudents(db, rows)`，接口与测试共用。
- 事务内逐行：`SELECT id FROM students WHERE idcard=?` → 命中 `UPDATE` 全部字段（覆盖），
  未命中 `INSERT`；`COMMIT`。返回 `{ created, updated, skipped, errors: [{row, message}] }`。

**结果反馈**：弹窗内显示「新增 X · 更新 Y · 跳过 Z」，跳过行逐条列原因；成功后刷新表格。
字段级问题不入库、不半途失败。

## 测试

**更新现有：**
- `tests/store.test.ts`：`create` 中 `level: '良好'` 改为数字（如 `level: 5`）。
- `tests/seed.test.ts`：如有对 level 文本值的断言同步改 1–6。

**新增 `tests/import.test.ts`：**
- 播种后学生具备新字段：学号 `01–45` 连续唯一、身份证 18 位唯一、家长姓名/住址非空、
  中午托/早餐/下午托 ∈ {0,1}、层次 ∈ 1–6。
- `importStudents`：新身份证 → INSERT；已存在身份证 → 覆盖全部字段；空身份证 → 跳过带行号
  错误；同一批两条相同新身份证 → 一条 insert 一条 update；返回计数正确。
- 唯一索引：直接插入重复身份证抛错。
- `resetData` 后新 schema 下可正常重播种。

`tests/dashboard.test.ts`：dashboard 不引用 level/新字段，预计不动。

## 涉及文件清单

| 文件 | 改动 |
|---|---|
| `lib/schema.ts` | students 表新列 + level 整数化 + 唯一索引 |
| `lib/seed.ts` | 新字段播种；resetData 改 DROP→重建 |
| `lib/db.ts` | 启动缺列自愈（resetData） |
| `lib/csv.ts` | 新增 `parseCsv`；导出/模板共用生成 |
| `lib/import.ts` | 新增 `importStudents(db, rows)` 纯函数 |
| `app/api/students/import/route.ts` | 新增导入接口 |
| `app/students/page.tsx` | 新列/排序/统计/筛选/导入配置 |
| `components/crud/types.ts` | ColumnDef 加 `nullOnEmpty`；CrudPageConfig 加 `sortRows`/`defaultHidden`/`importTemplate`；defaultNewRow 接收 rows |
| `components/crud/crud-page.tsx` | 排序、可见列状态 + localStorage + 列面板、导入按钮/弹窗、defaultNewRow(rows) |
| `components/crud/data-table.tsx` | `nullOnEmpty` 保存前转 null、渲染可见列 |
| `components/crud/import-modal.tsx` | 新增导入弹窗 |
| `components/ui/page-header.tsx` | 增加 `onImport`/`onColumns` 按钮 |
| `tests/store.test.ts` / `tests/seed.test.ts` | 同步 level 数值化 |
| `tests/import.test.ts` | 新增导入/播种断言 |
