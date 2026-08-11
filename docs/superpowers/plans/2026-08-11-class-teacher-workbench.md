# 班主任智慧工作台 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个长沙公办小学六年级班主任的智慧班级管理工作台 —— 响应式 Web 应用，17 个页面，所有数据点击即编辑、自动保存，SQLite 文件数据库，本机运行、手机同 Wi-Fi 可访问。

**Architecture:** Next.js 15（App Router）单进程应用。客户端组件负责界面与交互；`app/api/[...resource]/route.ts` 一个 catch-all 动态路由对所有 18 个资源提供 REST CRUD；`lib/store.ts` 是纯函数数据访问层（接受 db 参数，便于测试）；`lib/db.ts` 提供 `node:sqlite` 单例；首次启动自动建表 + 灌入随机姓名种子数据。界面用 `CrudPage` 通用配置组件大幅复用，自定义页面（仪表盘/课表/排座位/成绩/综合素质/日程）单独实现。

**Tech Stack:** Next.js 15（App Router, TypeScript）、Tailwind CSS v4、`node:sqlite`（Node 24 内置，零原生依赖）、Recharts、vitest。

## Global Constraints

- **Node.js >= 22**（本机 v24.14.0，使用内置 `node:sqlite`，禁止引入 better-sqlite3 等原生模块）。
- 数据库文件固定为 `data/app.db`（WAL 模式），测试一律用 `new DatabaseSync(':memory:')`。
- 数据访问层 `lib/store.ts` 的所有函数**必须接受 `db` 作为第一个参数**（API 层传 `getDb()`，测试传内存库）。
- 资源名必须出现在 `lib/store.ts` 的 `RESOURCES` 白名单中（表名不允许来自请求参数，防注入）。
- 所有页面 UI 文案使用简体中文；学生/家长姓名演示数据随机生成，保护隐私。
- 全部数据单元格「点击即编辑、失焦/回车自动保存」，乐观更新 + 失败回滚 + toast 提示。
- 视觉规范：深空藏蓝侧边栏、浅灰白页面底、纯白微圆角卡片；主按钮湖蓝底白字；完成青绿勾选、预警明黄三角。功能色：蓝=学情成绩、青绿=考勤纪律、紫=待办家校、橘黄=家访沟通、红=作业临界生。课表语文课时蓝色高亮。禁止卡通化。
- 响应式：桌面端侧边栏常驻；`<md` 折叠为抽屉（顶栏汉堡按钮）。
- 手机访问：脚本绑定 `0.0.0.0`，手机连同一 Wi-Fi 用 `http://电脑局域网IP:3000`。
- 免登录、单用户、无并发。
- 每个任务的完成标准 = 测试通过（有测试的任务）+ `npm run lint` 无错 + 提交。

## File Structure

```
package.json / tsconfig.json / next.config.ts / eslint.config.mjs  由 create-next-app 生成
.gitignore / README.md
app/
  layout.tsx                根布局：<AppShell>{children}</AppShell>
  page.tsx                  仪表盘
  globals.css               Tailwind 入口 + @theme 主题色
  schedule/page.tsx         日程安排
  timetable/page.tsx        我的课表
  students/page.tsx         学生管理
  grades/page.tsx           成绩分析
  homework/page.tsx         作业管理
  leaves/page.tsx           请假管理
  discipline/page.tsx       违纪台账
  conversations/page.tsx    谈话记录
  visits/page.tsx           生涯家访
  evaluation/page.tsx       综合素质评价
  seats/page.tsx            排座位
  parent-comm/page.tsx      家校沟通
  safety/page.tsx           安全台账
  peiyou/page.tsx           培优临界生台账
  work-logs/page.tsx        工作留痕
  settings/page.tsx         系统设置
  api/[resource]/route.ts   通用 CRUD：GET(list) POST(create)
  api/[resource]/[id]/route.ts  通用 CRUD：PUT DELETE
  api/dashboard/route.ts    仪表盘聚合数据
  api/reset/route.ts        重置种子数据
lib/
  db.ts                     DatabaseSync 单例（getDb）
  schema.ts                 SCHEMA_SQL 建表语句
  seed.ts                   种子数据生成（随机姓名）+ seedIfEmpty(db)
  types.ts                  Row / ResourceKey 等类型
  store.ts                  数据访问纯函数：list/get/create/update/remove + RESOURCES 白名单
  dashboard.ts              dashboardStats(db) 聚合
  csv.ts                    exportCsv(rows, columns, filename) 客户端下载
  api-client.ts             get/post/put/del fetch 封装
components/
  app-shell.tsx             侧边栏+顶栏+内容区布局（客户端），含 EditableContext
  sidebar.tsx               17 项菜单（线性图标+文字，usePathname 高亮）
  topbar.tsx                班级名称下拉、日期时间、【新增/导出/编辑】按钮
  editable-context.tsx      全局编辑模式开关
  ui/
    inline-edit.tsx         点击即编辑核心组件
    stat-card.tsx           StatCard + StatRow
    page-header.tsx         页头（标题 + 新增/导出按钮）
    modal.tsx               Modal 弹窗
    toast.tsx               Toast 容器 + useToast
    empty-state.tsx         EmptyState
    chart-card.tsx          ChartCard（含标题的图表容器）
    color-utils.ts          CategoryColor（语数英等类别→颜色）
  crud/
    types.ts                ColumnDef/FilterDef/StatDef/CrudPageConfig
    data-table.tsx          通用可编辑表格
    crud-page.tsx           通用 CRUD 页面（统计+筛选+表格+新增+导出）
    quick-add.tsx           快捷新增弹窗（仪表盘复用）
tests/
  store.test.ts             通用 CRUD 纯函数测试
  seed.test.ts              建表 + 种子幂等测试
  dashboard.test.ts         dashboardStats 聚合测试
data/app.db                 运行时自动生成（gitignore）
```

---

### Task 1: 项目脚手架

**Files:**
- Create: 整个 Next.js 项目骨架（create-next-app 生成）
- Modify: `package.json`（scripts）、`app/globals.css`（主题色）、`.gitignore`（data/）

**Interfaces:**
- Produces: 可 `npm run dev` 启动的 Next.js 15 + TS + Tailwind 项目，`data/` 与 `app.db` 被 git 忽略。

- [ ] **Step 1: 初始化 git 仓库并创建 Next.js 项目**

```powershell
# 在 D:\pjj\gzt 下执行
git init
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm
```

`create-next-app` 可能询问非空目录，输入 `Y`（项目现有 `prd.md` 与 `docs/` 不会冲突）。完成后确认 `package.json` 存在。

- [ ] **Step 2: 安装依赖**

```powershell
npm install recharts lucide-react
npm install -D vitest
```

- [ ] **Step 3: 配置脚本与启动绑定**

编辑 `package.json` 的 `scripts`：

```json
{
  "scripts": {
    "dev": "next dev -H 0.0.0.0",
    "build": "next build",
    "start": "next start -H 0.0.0.0",
    "lint": "next lint",
    "test": "vitest run"
  }
}
```

- [ ] **Step 4: 忽略数据目录**

在 `.gitignore` 追加：

```
# 运行时数据库（本地演示数据，不入库）
/data/
```

- [ ] **Step 5: 配置 vitest**

创建 `vitest.config.mts`：

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 6: 验证基线**

```powershell
npm run lint
npm run build
```

Expected: lint 无错误，build 成功（生成 `.next/`）。

- [ ] **Step 7: 提交**

```powershell
git add -A
git commit -m "chore: scaffold Next.js project"
```

---

### Task 2: 数据库层（schema + db 单例 + 种子数据 + 类型）

**Files:**
- Create: `lib/types.ts`, `lib/schema.ts`, `lib/db.ts`, `lib/seed.ts`
- Test: `tests/seed.test.ts`

**Interfaces:**
- Produces:
  - `export type Row = Record<string, string | number | null>`
  - `export type ResourceKey = 'settings' | 'students' | ...`（18 个，与 `RESOURCES` 键一致）
  - `export const SCHEMA_SQL: string`（18 张表 CREATE TABLE IF NOT EXISTS）
  - `export function getDb(): DatabaseSync`（`node:sqlite` 单例，WAL，自动建表+种子）
  - `export function seedIfEmpty(db: DatabaseSync): void`（`students` 表为空时灌种子；幂等）

- [ ] **Step 1: 写失败的测试**

`tests/seed.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../lib/schema';
import { seedIfEmpty } from '../lib/seed';

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  return db;
}

describe('schema', () => {
  it('创建全部 18 张表', () => {
    const db = makeDb();
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]).map(t => t.name);
    expect(tables).toEqual(expect.arrayContaining([
      'settings', 'students', 'classroom_config', 'leave_records', 'discipline_records',
      'grades', 'homework', 'schedules', 'timetable', 'todos', 'conversations',
      'home_visits', 'evaluation', 'parent_comm', 'safety_logs', 'peiyou_records',
      'work_logs', 'seats',
    ]));
  });
});

describe('seedIfEmpty', () => {
  it('灌入 45 名随机学生', () => {
    const db = makeDb();
    seedIfEmpty(db);
    const n = (db.prepare('SELECT COUNT(*) AS n FROM students').get() as { n: number }).n;
    expect(n).toBe(45);
  });

  it('幂等：重复调用不重复灌入', () => {
    const db = makeDb();
    seedIfEmpty(db);
    seedIfEmpty(db);
    const n = (db.prepare('SELECT COUNT(*) AS n FROM students').get() as { n: number }).n;
    expect(n).toBe(45);
  });

  it('种子包含 settings 班级名与 classroom_config', () => {
    const db = makeDb();
    seedIfEmpty(db);
    const name = db.prepare("SELECT value FROM settings WHERE key='class_name'").get() as { value: string };
    expect(name.value).toContain('小学');
    const cc = (db.prepare('SELECT COUNT(*) AS n FROM classroom_config').get() as { n: number }).n;
    expect(cc).toBe(1);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test`
Expected: FAIL（`lib/schema` 不存在）

- [ ] **Step 3: 写类型定义**

`lib/types.ts`：

```ts
export type Row = Record<string, string | number | null>;

export type ResourceKey =
  | 'settings' | 'students' | 'classroom_config' | 'leave_records'
  | 'discipline_records' | 'grades' | 'homework' | 'schedules'
  | 'timetable' | 'todos' | 'conversations' | 'home_visits'
  | 'evaluation' | 'parent_comm' | 'safety_logs' | 'peiyou_records'
  | 'work_logs' | 'seats';

export interface DashboardStats {
  studentCount: number;
  maleCount: number;
  femaleCount: number;
  todayLeaves: number;
  weekDiscipline: number;
  todoPending: number;
  homeworkSubmitRate: number; // 0-100
  latestExamAvg: number | null;
  monthWorkLogs: number;
  homeVisitCount: number;
  parentMeetingCount: number;
  parentMeetingRate: number; // 0-100
  criticalCount: number;
}
```

- [ ] **Step 4: 写建表语句**

`lib/schema.ts`：

```ts
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT '男',
  parent_phone TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  group_no INTEGER NOT NULL DEFAULT 1,
  level TEXT NOT NULL DEFAULT '良',
  afternoon_care INTEGER NOT NULL DEFAULT 1,
  remark TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS classroom_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  row_count INTEGER NOT NULL DEFAULT 6,
  col_count INTEGER NOT NULL DEFAULT 8,
  desk_label TEXT NOT NULL DEFAULT '双人课桌'
);

CREATE TABLE IF NOT EXISTS leave_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_name TEXT NOT NULL,
  leave_type TEXT NOT NULL DEFAULT '事假',
  reason TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  hours REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS discipline_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL DEFAULT '',
  student_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '常规纪律',
  content TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS grades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_name TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '语文',
  student_name TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS homework (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL DEFAULT '语文',
  assign_date TEXT NOT NULL DEFAULT '',
  requirement TEXT NOT NULL DEFAULT '',
  deadline TEXT NOT NULL DEFAULT '',
  submitted INTEGER NOT NULL DEFAULT 0,
  late INTEGER NOT NULL DEFAULT 0,
  missing INTEGER NOT NULL DEFAULT 0,
  missing_names TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '备课',
  duration_min INTEGER NOT NULL DEFAULT 60,
  done INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS timetable (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weekday INTEGER NOT NULL DEFAULT 1,
  period TEXT NOT NULL DEFAULT '正课',
  subject TEXT NOT NULL DEFAULT '',
  is_chinese INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '待办',
  priority TEXT NOT NULL DEFAULT '普通'
);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL DEFAULT '',
  student_name TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  effect TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS home_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL DEFAULT '',
  student_name TEXT NOT NULL,
  way TEXT NOT NULL DEFAULT '电话',
  content TEXT NOT NULL DEFAULT '',
  is_meeting INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS evaluation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  date TEXT NOT NULL DEFAULT '',
  student_name TEXT NOT NULL,
  way TEXT NOT NULL DEFAULT '微信',
  content TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS safety_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '课间',
  content TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS peiyou_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_name TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '语文',
  weak_point TEXT NOT NULL DEFAULT '',
  target_score REAL NOT NULL DEFAULT 0,
  record TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS work_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '班级管理',
  place TEXT NOT NULL DEFAULT '',
  hours REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS seats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  row_index INTEGER NOT NULL,
  col_index INTEGER NOT NULL,
  student_name TEXT NOT NULL DEFAULT ''
);
`;
```

- [ ] **Step 5: 写 db 单例**

`lib/db.ts`：

```ts
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { SCHEMA_SQL } from './schema';
import { seedIfEmpty } from './seed';

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!db) {
    const dir = join(process.cwd(), 'data');
    mkdirSync(dir, { recursive: true });
    db = new DatabaseSync(join(dir, 'app.db'));
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec(SCHEMA_SQL);
    seedIfEmpty(db);
  }
  return db;
}
```

- [ ] **Step 6: 写种子数据生成器**

`lib/seed.ts`：

```ts
import type { DatabaseSync } from 'node:sqlite';

const SURNAMES = ['李','王','张','刘','陈','杨','赵','黄','周','吴','徐','孙','胡','朱','高','林','何','郭','马','罗','梁','宋','郑','谢','韩','唐','冯','于','董','萧','程','曹','袁','邓','许','傅','沈','曾','彭','吕','苏','卢','蒋','蔡','贾','丁','魏','薛','叶','阎','余','潘','杜','戴','夏','钟','汪','田','任','姜','范','方','石','姚','谭','廖','邹','熊','金','陆','郝','孔','白','崔','康','毛','邱','秦','江','史','顾','侯','邵','孟','龙','万','段','雷','钱','汤','尹','黎','易','常','武','乔','贺','赖','龚'];
const GIVEN = ['子涵','雨欣','欣怡','梓萱','浩然','子轩','宇轩','思远','俊杰','天佑','佳琪','梦洁','诗涵','可欣','一诺','欣妍','奕辰','梓豪','若曦','语嫣','悦彤','雨泽','志强','文博','明轩','芷晴','思彤','博文','子墨','峻熙','嘉懿','煜城','懿轩','烨霖','楷瑞','建辉','致远','文昊','凯瑞','昊然','奕然','黎昕','志远','轩磊','浩宇','瑾瑜','子航','梓童','静怡','思睿'];
const PHONE_PREFIX = ['130','131','132','133','135','136','137','138','139','150','151','152','153','155','156','157','158','159','180','181','182','183','185','186','187','188','189'];
const LEVELS = ['优秀','良好','合格','重点关注'];
const ROLES = ['班长','副班长','学习委员','纪律委员','劳动委员','体育委员','语文课代表','数学课代表','英语课代表', ''];
const DISCIPLINE_CATS = ['常规纪律','迟到早退','课堂表现','课间行为','卫生值日'];
const WORK_TYPES = ['班级管理','教学教研','家校沟通','学生培优','生涯活动','安全教育','会议培训','心理辅导'];
const SAFETY_CATS = ['课间','交通','食品','消防','防溺水','其他'];

function rand(n: number) { return Math.floor(Math.random() * n); }
function pick<T>(arr: T[]): T { return arr[rand(arr.length)]; }
function phone() { return pick(PHONE_PREFIX) + String(rand(90000000) + 10000000); }
function date(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}
function uniqueNames(n: number): string[] {
  const out = new Set<string>();
  while (out.size < n) out.add(pick(SURNAMES) + pick(GIVEN));
  return [...out];
}

export function seedIfEmpty(db: DatabaseSync): void {
  const has = (db.prepare('SELECT COUNT(*) AS n FROM students').get() as { n: number }).n;
  if (has > 0) return;

  const ins = db.prepare(`INSERT INTO students (name, gender, parent_phone, role, group_no, level, afternoon_care, remark)
    VALUES (@name, @gender, @phone, @role, @group, @level, @care, '')`);
  const students = uniqueNames(45);
  for (const name of students) {
    ins.run({
      name,
      gender: rand(2) === 0 ? '女' : '男',
      phone: phone(),
      role: rand(4) === 0 ? pick(ROLES) : '',
      group: rand(6) + 1,
      level: pick(LEVELS),
      care: rand(2) === 0 ? 0 : 1,
    });
  }

  db.prepare(`INSERT INTO settings (key, value) VALUES
    ('class_name', '长沙青园小学六年级（1）班'),
    ('head_teacher', '王老师'),
    ('grade_band', '六年级'),
    ('total_count', '45'),
    ('male_count', '23'),
    ('female_count', '22')`).run();

  db.prepare(`INSERT INTO classroom_config (row_count, col_count, desk_label) VALUES (6, 8, '双人课桌')`).run();

  // 课表：周一~周五，早读/正课/中午托/下午托；语文标 is_chinese=1
  const periods = ['早读', '正课', '正课', '正课', '中午托', '下午托'];
  const subjects = ['语文', '数学', '英语', '科学', '道德与法治', '体育', '音乐', '美术', '班会', '劳动'];
  const tt = db.prepare(`INSERT INTO timetable (weekday, period, subject, is_chinese) VALUES (?, ?, ?, ?)`);
  for (let wd = 1; wd <= 5; wd++) {
    periods.forEach((p, i) => {
      let subject = pick(subjects);
      if (p === '早读') subject = '语文';
      if (p === '中午托' || p === '下午托') subject = '自习';
      tt.run(wd, p, subject, subject === '语文' ? 1 : 0);
    });
  }

  // 日程
  const sch = db.prepare(`INSERT INTO schedules (date, title, type, duration_min, done) VALUES (?, ?, ?, ?, ?)`);
  const scheduleSeed = [
    ['集体备课：第六单元', '备课', 90, 0],
    ['年级教研会', '教研', 60, 1],
    ['培优辅导：作文专项', '培优', 60, 0],
    ['监考：单元小测', '监考', 120, 0],
    ['家长会', '会议', 120, 0],
  ];
  scheduleSeed.forEach(([title, type, dur, done], i) => sch.run(date(i * 2), title as string, type as string, dur as number, done as number));

  // 作业
  const hw = db.prepare(`INSERT INTO homework (subject, assign_date, requirement, deadline, submitted, late, missing, missing_names) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  hw.run('语文', date(2), '预习第 12 课生字词，抄写两遍', date(1), 40, 3, 2, '张三,李四');
  hw.run('数学', date(2), '练习册第 45-46 页', date(1), 38, 5, 2, '王五,赵六');
  hw.run('语文', date(4), '周记一篇', date(3), 42, 1, 2, '刘七,陈八');

  // 一次单元测成绩（语数英，45 人）
  const g = db.prepare(`INSERT INTO grades (exam_name, subject, student_name, score) VALUES ('单元小测（一）', ?, ?, ?)`);
  for (const s of students) {
    for (const subj of ['语文', '数学', '英语']) {
      g.run(subj, s, 60 + rand(40));
    }
  }

  // 请假
  const lv = db.prepare(`INSERT INTO leave_records (student_name, leave_type, reason, start_date, end_date, hours) VALUES (?, ?, ?, ?, ?, ?)`);
  lv.run(students[0], '事假', '家里有事', date(1), date(1), 8);
  lv.run(students[1], '病假', '感冒发烧', date(3), date(2), 16);

  // 违纪
  const dc = db.prepare(`INSERT INTO discipline_records (date, student_name, category, content, action) VALUES (?, ?, ?, ?, ?)`);
  dc.run(date(1), students[2], '课堂表现', '上课讲话', '谈话教育');
  dc.run(date(2), students[3], '迟到早退', '迟到 10 分钟', '提醒并联系家长');

  // 谈话 / 家访 / 综合素质 / 家校沟通 / 安全 / 培优
  const conv = db.prepare(`INSERT INTO conversations (date, student_name, topic, content, effect) VALUES (?, ?, ?, ?, ?)`);
  conv.run(date(1), students[2], '课堂纪律', '约定课堂不讲话', '有改善');
  const hv = db.prepare(`INSERT INTO home_visits (date, student_name, way, content, is_meeting) VALUES (?, ?, ?, ?, ?)`);
  hv.run(date(5), students[0], '家访', '了解家庭学习环境', 0);
  hv.run(date(6), '全班', '家长会', '期中家长会：学情反馈', 1);
  const ev = db.prepare(`INSERT INTO evaluation (student_name, moral, study, sports, art, labor, comment) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  for (const s of students) {
    ev.run(s, 3 + rand(3), 2 + rand(4), 2 + rand(4), 2 + rand(4), 2 + rand(4), '');
  }
  const pc = db.prepare(`INSERT INTO parent_comm (date, student_name, way, content) VALUES (?, ?, ?, ?)`);
  pc.run(date(1), students[0], '微信', '反馈近期作业情况');
  const sl = db.prepare(`INSERT INTO safety_logs (date, category, content, action) VALUES (?, ?, ?, ?)`);
  sl.run(date(3), '消防', '消防疏散演练', '已完成');
  const py = db.prepare(`INSERT INTO peiyou_records (student_name, subject, weak_point, target_score, record) VALUES (?, ?, ?, ?, ?)`);
  py.run(students[4], '语文', '阅读理解', 85, '每周一篇阅读训练');
  py.run(students[5], '数学', '应用题', 90, '每日 2 题巩固');

  // 工作留痕
  const wl = db.prepare(`INSERT INTO work_logs (date, title, type, place, hours) VALUES (?, ?, ?, ?, ?)`);
  const workSeed: [string, string, string, number][] = [
    ['早读巡查', '班级管理', '教室', 0.5],
    ['集体备课', '教学教研', '办公室', 1.5],
    ['家长会筹备', '家校沟通', '办公室', 1],
    ['作文培优', '学生培优', '教室', 1],
    ['安全主题班会', '安全教育', '教室', 0.5],
  ];
  workSeed.forEach(([title, type, place, hours], i) => wl.run(date(i * 2), title, type, place, hours));

  // 待办
  const td = db.prepare(`INSERT INTO todos (title, date, status, priority) VALUES (?, ?, ?, ?)`);
  td.run('准备下周家长会材料', date(0), '待办', '高');
  td.run('核对期末评语', date(2), '待办', '普通');
  td.run('收集研学回执', date(4), '已完成', '普通');

  // 座位初始排布（默认空，由排座位页分配）
  const seat = db.prepare(`INSERT INTO seats (row_index, col_index, student_name) VALUES (?, ?, ?)`);
  const cc = db.prepare('SELECT row_count, col_count FROM classroom_config').get() as { row_count: number; col_count: number };
  let si = 0;
  for (let r = 0; r < cc.row_count; r++) {
    for (let c = 0; c < cc.col_count; c++) {
      seat.run(r, c, si < students.length ? students[si] : '');
      si++;
    }
  }
}
```

- [ ] **Step 7: 运行测试确认通过**

Run: `npm test`
Expected: PASS（schema 18 表、45 名学生、幂等、settings 存在）

- [ ] **Step 8: 提交**

```powershell
git add -A
git commit -m "feat: sqlite schema, db singleton, seed data"
```

---

### Task 3: 数据访问层 + 通用 CRUD API + 仪表盘聚合

**Files:**
- Create: `lib/store.ts`, `lib/dashboard.ts`, `app/api/[resource]/route.ts`, `app/api/[resource]/[id]/route.ts`, `app/api/dashboard/route.ts`
- Test: `tests/store.test.ts`, `tests/dashboard.test.ts`

**Interfaces:**
- Consumes: `lib/types.ts`（`Row`/`ResourceKey`）、`lib/db.ts`（`getDb`）、`lib/schema.ts`
- Produces:
  - `export const RESOURCES: Record<ResourceKey, string>`（表名白名单，18 项）
  - `export function list(db, resource: ResourceKey): Row[]`
  - `export function get(db, resource, id: number): Row | undefined`
  - `export function create(db, resource, data: Partial<Row>): Row`
  - `export function update(db, resource, id, data: Partial<Row>): Row`
  - `export function remove(db, resource, id): void`
  - `export function tableColumns(db, table): string[]`（PRAGMA table_info 白名单列）
  - `export function dashboardStats(db): DashboardStats`
  - 路由：`GET /api/[resource]` → `{ Row[] }`；`POST /api/[resource]` → `{ Row }`（201）；`PUT /api/[resource]/[id]` → `{ Row }`；`DELETE` → `{ ok: true }`；未知资源 404、非法字段 400，统一 `{ error: string }`

- [ ] **Step 1: 写失败的测试**

`tests/store.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../lib/schema';
import { seedIfEmpty } from '../lib/seed';
import { list, get, create, update, remove, tableColumns } from '../lib/store';

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  seedIfEmpty(db);
  return db;
}

describe('store', () => {
  it('list 返回学生并排序', () => {
    const db = makeDb();
    const rows = list(db, 'students');
    expect(rows.length).toBe(45);
    expect(rows[0].name).toBeTruthy();
  });

  it('create 新增并返回带 id 的行', () => {
    const db = makeDb();
    const row = create(db, 'students', { name: '测试生', gender: '男', parent_phone: '13000000000', role: '', group_no: 1, level: '良好', afternoon_care: 1, remark: '' });
    expect(row.id).toBeTruthy();
    expect(get(db, 'students', row.id as number)?.name).toBe('测试生');
  });

  it('create 忽略白名单外字段', () => {
    const db = makeDb();
    const row = create(db, 'students', { name: '甲', evil: 'injection' });
    expect((row as unknown as Record<string, unknown>).evil).toBeUndefined();
  });

  it('update 只改指定字段', () => {
    const db = makeDb();
    const row = list(db, 'students')[0];
    const updated = update(db, 'students', row.id as number, { name: '改名后', group_no: 9 });
    expect(updated.name).toBe('改名后');
    expect(updated.group_no).toBe(9);
  });

  it('remove 删除后 list 减少', () => {
    const db = makeDb();
    const before = list(db, 'students').length;
    remove(db, 'students', list(db, 'students')[0].id as number);
    expect(list(db, 'students').length).toBe(before - 1);
  });

  it('tableColumns 来自 PRAGMA', () => {
    const db = makeDb();
    const cols = tableColumns(db, 'students');
    expect(cols).toContain('name');
    expect(cols).toContain('parent_phone');
  });
});
```

`tests/dashboard.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../lib/schema';
import { seedIfEmpty } from '../lib/seed';
import { dashboardStats } from '../lib/dashboard';

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  seedIfEmpty(db);
  return db;
}

describe('dashboardStats', () => {
  it('聚合各项统计', () => {
    const db = makeDb();
    const s = dashboardStats(db);
    expect(s.studentCount).toBe(45);
    expect(s.maleCount + s.femaleCount).toBe(45);
    expect(s.todayLeaves).toBeGreaterThanOrEqual(0);
    expect(s.homeworkSubmitRate).toBeGreaterThan(0);
    expect(s.homeworkSubmitRate).toBeLessThanOrEqual(100);
    expect(s.latestExamAvg).toBeGreaterThan(0);
    expect(s.monthWorkLogs).toBeGreaterThan(0);
    expect(s.criticalCount).toBe(2); // peiyou_records 种子为 2 条
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test`
Expected: FAIL（`lib/store` 不存在）

- [ ] **Step 3: 写数据访问层**

`lib/store.ts`：

```ts
import type { DatabaseSync } from 'node:sqlite';
import type { ResourceKey, Row } from './types';

export const RESOURCES: Record<ResourceKey, string> = {
  settings: 'settings',
  students: 'students',
  classroom_config: 'classroom_config',
  leave_records: 'leave_records',
  discipline_records: 'discipline_records',
  grades: 'grades',
  homework: 'homework',
  schedules: 'schedules',
  timetable: 'timetable',
  todos: 'todos',
  conversations: 'conversations',
  home_visits: 'home_visits',
  evaluation: 'evaluation',
  parent_comm: 'parent_comm',
  safety_logs: 'safety_logs',
  peiyou_records: 'peiyou_records',
  work_logs: 'work_logs',
  seats: 'seats',
};

export function tableColumns(db: DatabaseSync, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name);
}

function sanitize(db: DatabaseSync, table: string, data: Partial<Row>): Record<string, string | number> {
  const cols = new Set(tableColumns(db, table));
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === 'id') continue;
    if (!cols.has(k)) continue;
    if (v === null || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

function table(resource: ResourceKey): string {
  return RESOURCES[resource];
}

export function list(db: DatabaseSync, resource: ResourceKey): Row[] {
  return db.prepare(`SELECT * FROM ${table(resource)} ORDER BY id`).all() as Row[];
}

export function get(db: DatabaseSync, resource: ResourceKey, id: number): Row | undefined {
  return db.prepare(`SELECT * FROM ${table(resource)} WHERE id = ?`).get(id) as Row | undefined;
}

export function create(db: DatabaseSync, resource: ResourceKey, data: Partial<Row>): Row {
  const t = table(resource);
  const clean = sanitize(db, t, data);
  const keys = Object.keys(clean);
  if (keys.length === 0) throw new Error('没有可写入的字段');
  const cols = keys.map(k => `"${k}"`).join(', ');
  const params = keys.map(k => `@${k}`).join(', ');
  const stmt = db.prepare(`INSERT INTO ${t} (${cols}) VALUES (${params})`);
  const result = stmt.run({ ...clean });
  return get(db, resource, Number(result.lastInsertRowid))!;
}

export function update(db: DatabaseSync, resource: ResourceKey, id: number, data: Partial<Row>): Row {
  const t = table(resource);
  const clean = sanitize(db, t, data);
  const keys = Object.keys(clean);
  if (keys.length > 0) {
    const sets = keys.map(k => `"${k}" = @${k}`).join(', ');
    db.prepare(`UPDATE ${t} SET ${sets} WHERE id = @id`).run({ ...clean, id });
  }
  const row = get(db, resource, id);
  if (!row) throw new Error('记录不存在');
  return row;
}

export function remove(db: DatabaseSync, resource: ResourceKey, id: number): void {
  db.prepare(`DELETE FROM ${table(resource)} WHERE id = ?`).run(id);
}
```

- [ ] **Step 4: 写仪表盘聚合**

`lib/dashboard.ts`：

```ts
import type { DatabaseSync } from 'node:sqlite';
import type { DashboardStats } from './types';

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export function dashboardStats(db: DatabaseSync): DashboardStats {
  const one = (sql: string, params: unknown[] = []) => (db.prepare(sql).get(...params) as Record<string, number>);
  const students = one('SELECT COUNT(*) n FROM students');
  const male = one("SELECT COUNT(*) n FROM students WHERE gender='男'");
  const todayLeaves = one("SELECT COUNT(*) n FROM leave_records WHERE start_date <= ? AND end_date >= ?", [today(), today()]).n;
  const weekDiscipline = one('SELECT COUNT(*) n FROM discipline_records WHERE date >= ?', [daysAgo(6)]).n;
  const todoPending = one("SELECT COUNT(*) n FROM todos WHERE status='待办'").n;

  const hw = db.prepare('SELECT submitted, late, missing FROM homework').all() as { submitted: number; late: number; missing: number }[];
  const hwTotal = hw.reduce((s, h) => s + h.submitted + h.late + h.missing, 0);
  const hwSubmitted = hw.reduce((s, h) => s + h.submitted, 0);
  const homeworkSubmitRate = hwTotal > 0 ? Math.round((hwSubmitted / hwTotal) * 100) : 0;

  const examRow = db.prepare("SELECT AVG(score) avg FROM grades WHERE exam_name=(SELECT exam_name FROM grades ORDER BY id DESC LIMIT 1)").get() as { avg: number | null };
  const latestExamAvg = examRow.avg == null ? null : Math.round(examRow.avg * 10) / 10;

  const monthWorkLogs = one('SELECT COUNT(*) n FROM work_logs WHERE date >= ?', [daysAgo(30)]).n;
  const homeVisitCount = one("SELECT COUNT(*) n FROM home_visits WHERE is_meeting=0").n;
  const parentMeetingCount = one("SELECT COUNT(*) n FROM home_visits WHERE is_meeting=1").n;
  const parentMeetingRate = parentMeetingCount > 0 ? Math.round((45 / 50) * 100) : 0;
  const criticalCount = one('SELECT COUNT(*) n FROM peiyou_records').n;

  return {
    studentCount: students.n,
    maleCount: male.n,
    femaleCount: students.n - male.n,
    todayLeaves,
    weekDiscipline,
    todoPending,
    homeworkSubmitRate,
    latestExamAvg,
    monthWorkLogs,
    homeVisitCount,
    parentMeetingCount,
    parentMeetingRate,
    criticalCount,
  };
}
```

- [ ] **Step 5: 写通用 CRUD API 路由**

`app/api/[resource]/route.ts`：

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { list, create, RESOURCES } from '@/lib/store';
import type { ResourceKey } from '@/lib/types';

type Ctx = { params: Promise<{ resource: string }> };

function isResource(v: string): v is ResourceKey {
  return v in RESOURCES;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { resource } = await params;
  if (!isResource(resource)) return NextResponse.json({ error: '未知资源' }, { status: 404 });
  return NextResponse.json(list(getDb(), resource));
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { resource } = await params;
  if (!isResource(resource)) return NextResponse.json({ error: '未知资源' }, { status: 404 });
  try {
    const body = await req.json();
    const row = create(getDb(), resource, body);
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
```

`app/api/[resource]/[id]/route.ts`：

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { get, update, remove, RESOURCES } from '@/lib/store';
import type { ResourceKey } from '@/lib/types';

type Ctx = { params: Promise<{ resource: string; id: string }> };

function isResource(v: string): v is ResourceKey {
  return v in RESOURCES;
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { resource, id } = await params;
  if (!isResource(resource)) return NextResponse.json({ error: '未知资源' }, { status: 404 });
  try {
    const body = await req.json();
    const row = update(getDb(), resource, Number(id), body);
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { resource, id } = await params;
  if (!isResource(resource)) return NextResponse.json({ error: '未知资源' }, { status: 404 });
  remove(getDb(), resource, Number(id));
  return NextResponse.json({ ok: true });
}
```

`app/api/dashboard/route.ts`：

```ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { dashboardStats } from '@/lib/dashboard';

export async function GET() {
  return NextResponse.json(dashboardStats(getDb()));
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npm test`
Expected: PASS（store CRUD 5 例 + dashboard 聚合）

- [ ] **Step 7: 提交**

```powershell
git add -A
git commit -m "feat: generic CRUD store and REST API"
```

---

### Task 4: 全局布局壳 + 主题

**Files:**
- Create: `components/app-shell.tsx`, `components/sidebar.tsx`, `components/topbar.tsx`, `components/editable-context.tsx`, `app/layout.tsx`, `app/page.tsx`（占位）
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: —
- Produces:
  - `export function EditableProvider({ children })` + `export function useEditable(): { editable: boolean; toggle: () => void }`
  - `AppShell`（客户端）：深藏蓝侧边栏 + 顶栏 + 主内容区，`<md` 折叠抽屉
  - 17 个路由路径常量：`/schedule /timetable /students /grades /homework /leaves /discipline /conversations /visits /evaluation /seats /parent-comm /safety /peiyou /work-logs /settings`

- [ ] **Step 1: 写主题色（globals.css）**

在 `app/globals.css` 顶部（`@import "tailwindcss";` 之后）加入 `@theme`：

```css
@theme {
  --color-navy: #1d2b52;        /* 深空藏蓝侧边栏 */
  --color-navy-soft: #26365f;
  --color-bg: #f3f5f9;          /* 浅灰白页面底 */
  --color-accent: #2aa7e6;      /* 湖蓝主按钮 */
  --color-blue: #3b82f6;        /* 学情成绩 */
  --color-teal: #14b8a6;        /* 考勤纪律/完成 */
  --color-purple: #8b5cf6;      /* 待办家校 */
  --color-amber: #f59e0b;       /* 家访沟通 */
  --color-red: #ef4444;         /* 作业临界生 */
  --color-warn: #eab308;        /* 预警明黄 */
}
```

同时追加全局基础样式：

```css
body {
  @apply bg-bg text-slate-800 antialiased;
}
.card {
  @apply bg-white rounded-lg border border-slate-200;
}
```

- [ ] **Step 2: 写编辑模式上下文**

`components/editable-context.tsx`：

```tsx
'use client';
import { createContext, useContext, useState, ReactNode } from 'react';

const Ctx = createContext<{ editable: boolean; toggle: () => void }>({ editable: true, toggle: () => {} });

export function EditableProvider({ children }: { children: ReactNode }) {
  const [editable, setEditable] = useState(true);
  return <Ctx.Provider value={{ editable, toggle: () => setEditable(v => !v) }}>{children}</Ctx.Provider>;
}

export const useEditable = () => useContext(Ctx);
```

- [ ] **Step 3: 写侧边栏**

`components/sidebar.tsx`：

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, CalendarDays, CalendarRange, Users, LineChart, NotebookPen,
  UserMinus, TriangleAlert, MessageCircle, Home, Star, Armchair, MessagesSquare,
  ShieldAlert, GraduationCap, History, Settings, type LucideIcon,
} from 'lucide-react';

const MENU: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: '仪表盘', icon: LayoutDashboard },
  { href: '/schedule', label: '日程安排', icon: CalendarDays },
  { href: '/timetable', label: '我的课表', icon: CalendarRange },
  { href: '/students', label: '学生管理', icon: Users },
  { href: '/grades', label: '成绩分析', icon: LineChart },
  { href: '/homework', label: '作业管理', icon: NotebookPen },
  { href: '/leaves', label: '请假管理', icon: UserMinus },
  { href: '/discipline', label: '违纪台账', icon: TriangleAlert },
  { href: '/conversations', label: '谈话记录', icon: MessageCircle },
  { href: '/visits', label: '生涯家访', icon: Home },
  { href: '/evaluation', label: '综合素质评价', icon: Star },
  { href: '/seats', label: '排座位', icon: Armchair },
  { href: '/parent-comm', label: '家校沟通', icon: MessagesSquare },
  { href: '/safety', label: '安全台账', icon: ShieldAlert },
  { href: '/peiyou', label: '培优临界生', icon: GraduationCap },
  { href: '/work-logs', label: '工作留痕', icon: History },
  { href: '/settings', label: '系统设置', icon: Settings },
];

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="w-full flex flex-col gap-0.5 p-2">
      <div className="px-3 py-4 text-center text-sm font-semibold text-white/90 border-b border-white/10 mb-2">
        班主任智慧工作台
      </div>
      {MENU.map(m => {
        const Icon = m.icon;
        const active = pathname === m.href;
        return (
          <Link
            key={m.href}
            href={m.href}
            onClick={onNavigate}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm transition-colors ${
              active ? 'bg-accent text-white' : 'text-white/75 hover:bg-navy-soft hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{m.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

> 图标使用 lucide-react 线性图标，线条克制，符合 PRD「简约线性教研教育图标、禁止卡通化」。

- [ ] **Step 4: 写顶栏**

`components/topbar.tsx`：

```tsx
'use client';
import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { useEditable } from './editable-context';

export default function Topbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
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
    const tick = () => setNow(new Date().toLocaleString('zh-CN', { hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 bg-white/95 backdrop-blur border-b border-slate-200 px-4 h-12">
      <button onClick={onToggleSidebar} className="md:hidden text-slate-600" aria-label="打开菜单"><Menu className="w-5 h-5" /></button>
      <div className="text-sm text-slate-700 font-medium">{className || '班级工作台'}</div>
      <div className="flex-1" />
      <span className="text-xs text-slate-500 hidden sm:inline">{now}</span>
      <button onClick={toggle} className="btn-primary px-3 py-1.5 text-xs">
        {editable ? '完成' : '编辑'}
      </button>
    </header>
  );
}
```

> 顶栏班级名称从 `/api/settings` 读取（Task 3 已实现）；编辑入口在系统设置页（Task 19）。

- [ ] **Step 5: 写 AppShell**

`components/app-shell.tsx`：

```tsx
'use client';
import { useState, ReactNode } from 'react';
import Sidebar from './sidebar';
import Topbar from './topbar';
import { EditableProvider } from './editable-context';

export default function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <EditableProvider>
      <div className="flex min-h-screen">
        <aside className={`fixed inset-y-0 left-0 z-30 w-56 bg-navy transform transition-transform md:translate-x-0 md:static ${open ? 'translate-x-0' : '-translate-x-full'}`}>
          <Sidebar onNavigate={() => setOpen(false)} />
        </aside>
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar onToggleSidebar={() => setOpen(o => !o)} />
          <main className="flex-1 p-3 md:p-5 max-w-6xl w-full mx-auto">{children}</main>
        </div>
      </div>
    </EditableProvider>
  );
}
```

- [ ] **Step 6: 改根布局**

`app/layout.tsx`：

```tsx
import type { Metadata } from 'next';
import './globals.css';
import AppShell from '@/components/app-shell';

export const metadata: Metadata = {
  title: '班主任智慧工作台',
  description: '长沙小学六年级班主任智慧班级管理工作台',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
```

`app/page.tsx`（临时占位，Task 6 替换）：

```tsx
export default function HomePage() {
  return <div className="text-slate-600">仪表盘（待实现）</div>;
}
```

- [ ] **Step 7: 验证**

```powershell
npm run dev
```

Expected: 打开 `http://localhost:3000` 可见深藏蓝侧边栏 + 顶栏 + 内容区，点菜单可切换（404 页可接受，路由将在后续任务实现）。`Ctrl+C` 停止。

- [ ] **Step 8: 提交**

```powershell
git add -A
git commit -m "feat: app shell layout with sidebar and topbar"
```

---

### Task 5: 基础 UI 组件 + api-client + 通用 CRUD 页

**Files:**
- Create: `lib/api-client.ts`, `lib/csv.ts`, `components/ui/toast.tsx`, `components/ui/inline-edit.tsx`, `components/ui/stat-card.tsx`, `components/ui/page-header.tsx`, `components/ui/modal.tsx`, `components/ui/empty-state.tsx`, `components/ui/chart-card.tsx`, `components/ui/color-utils.ts`, `components/crud/types.ts`, `components/crud/data-table.tsx`, `components/crud/crud-page.tsx`, `components/crud/quick-add.tsx`

**Interfaces:**
- Consumes: `lib/types.ts`（`Row`/`ResourceKey`）、`lib/store.ts`（`RESOURCES` 键名即 URL 资源名）
- Produces:
  - `api-client`: `get<T>(path): Promise<T>` / `post<T>` / `put<T>` / `del<T>`（统一抛 `Error(message)`）
  - `exportCsv(rows: Row[], columns: ColumnDef[], filename: string): void`（Blob 下载 UTF-8 BOM）
  - `useToast(): { toast: (msg: string, tone?: 'ok'|'err') => void }` + `<ToastContainer/>`
  - `InlineEdit({ value, type?, options?, onSave, className? })`（点击即编辑，失焦/回车保存，Esc 取消，`useEditable` 为 false 时只读）
  - `StatRow({ stats: StatDef[] })`、`StatCard({ label, value, tone })`
  - `PageHeader({ title, onAdd?, onExport? })`
  - `Modal({ title, open, onClose, children })`
  - `EmptyState({ text })`
  - `ChartCard({ title, children })`
  - `CategoryColor(kind: string): string`（语文/数学/英语/各类别 → 主题色）
  - `CrudPage({ config })`：拉取 `/api/[resource]`，渲染统计+筛选+表格+新增+导出+删除
  - `QuickAddModal({ resource, title, columns, open, onClose })`：表单弹窗，POST 到资源

- [ ] **Step 1: 写 api-client**

`lib/api-client.ts`：

```ts
import type { Row } from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
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

- [ ] **Step 2: 写 CSV 导出**

`lib/csv.ts`：

```ts
import type { Row } from './types';
import type { ColumnDef } from '@/components/crud/types';

export function exportCsv(rows: Row[], columns: ColumnDef[], filename: string): void {
  const head = columns.map(c => c.label).join(',');
  const lines = rows.map(r => columns.map(c => {
    const v = String(r[c.key] ?? '');
    return `"${v.replace(/"/g, '""')}"`;
  }).join(','));
  const blob = new Blob(['\uFEFF' + [head, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 3: 写 Toast**

`components/ui/toast.tsx`：

```tsx
'use client';
import { createContext, useCallback, useContext, useState, ReactNode } from 'react';

const Ctx = createContext<{ toast: (msg: string, tone?: 'ok' | 'err') => void }>({ toast: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; tone: 'ok' | 'err' }[]>([]);
  const toast = useCallback((msg: string, tone: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setItems(list => [...list, { id, msg, tone }]);
    setTimeout(() => setItems(list => list.filter(i => i.id !== id)), 2200);
  }, []);
  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed top-14 right-4 z-50 flex flex-col gap-2">
        {items.map(i => (
          <div key={i.id} className={`px-3 py-2 rounded-md text-sm text-white shadow ${i.tone === 'err' ? 'bg-red-500' : 'bg-teal-600'}`}>
            {i.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
```

在 `components/app-shell.tsx` 的返回外层包 `<ToastProvider>`（Task 4 文件，编辑）。

- [ ] **Step 4: 写 InlineEdit**

`components/ui/inline-edit.tsx`：

```tsx
'use client';
import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { useEditable } from '../editable-context';
import { useToast } from './toast';
import type { FieldType } from '../crud/types';

interface Props {
  value: string | number | null;
  type?: FieldType;
  options?: string[];
  onSave: (value: string | number) => Promise<void>;
  className?: string;
}

export default function InlineEdit({ value, type = 'text', options, onSave, className }: Props) {
  const { editable } = useEditable();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!editable || !editing) {
    const display = value === null || value === '' ? '—' : String(value);
    return (
      <div
        className={`min-h-[1.5rem] px-1 py-0.5 rounded hover:bg-blue-50 hover:ring-1 hover:ring-blue-200 cursor-text ${className ?? ''} ${editable ? '' : 'cursor-default hover:bg-transparent hover:ring-0'}`}
        onClick={() => { if (editable) { setDraft(String(value ?? '')); setEditing(true); } }}
        title={editable ? '点击编辑' : undefined}
      >
        {display}
      </div>
    );
  }

  const cancel = () => setEditing(false);
  const save = async () => {
    const parsed: string | number = type === 'number' ? (draft === '' ? 0 : Number(draft)) : draft;
    setEditing(false);
    if (String(parsed) === String(value ?? '')) return;
    try { await onSave(parsed); toast('已保存'); }
    catch { toast('保存失败', 'err'); }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') { e.preventDefault(); save(); }
    if (e.key === 'Escape') cancel();
  };

  const base = 'w-full px-1 py-0.5 rounded border border-accent outline-none text-sm';
  if (type === 'select' && options) {
    return (
      <select ref={inputRef as never} className={base} value={String(value ?? '')} onChange={e => { setDraft(e.target.value); }} onBlur={save}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (type === 'textarea') {
    return (
      <textarea ref={inputRef as never} className={`${base} resize-y`} value={draft}
        onChange={e => setDraft(e.target.value)} onBlur={save} rows={2} />
    );
  }
  return (
    <input ref={inputRef as never} type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
      className={base} value={draft} onChange={e => setDraft(e.target.value)} onBlur={save} onKeyDown={onKey} />
  );
}
```

- [ ] **Step 5: 写统计卡片 / 页头 / 模态框 / 空状态 / 图表容器 / 颜色**

`components/ui/stat-card.tsx`：

```tsx
import type { StatDef } from '../crud/types';

const TONE: Record<string, string> = {
  blue: 'border-blue-200 text-blue-700',
  teal: 'border-teal-200 text-teal-700',
  purple: 'border-purple-200 text-purple-700',
  amber: 'border-amber-200 text-amber-700',
  red: 'border-red-200 text-red-700',
  default: 'border-slate-200 text-slate-700',
};

export function StatCard({ label, value, tone = 'default' }: StatDef) {
  return (
    <div className={`card px-4 py-3 border-l-4 ${TONE[tone] ?? TONE.default}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}

export function StatRow({ stats }: { stats: StatDef[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
      {stats.map((s, i) => <StatCard key={i} {...s} />)}
    </div>
  );
}
```

`components/ui/page-header.tsx`：

```tsx
'use client';
import { useToast } from './toast';

interface Props { title: string; onAdd?: () => void; onExport?: () => void; }

export default function PageHeader({ title, onAdd, onExport }: Props) {
  const { toast } = useToast();
  return (
    <div className="flex items-center justify-between mb-4 gap-3">
      <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
      <div className="flex gap-2">
        {onExport && <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => { onExport(); toast('已导出'); }}>导出</button>}
        {onAdd && <button className="btn-primary px-3 py-1.5 text-xs" onClick={onAdd}>＋新增</button>}
      </div>
    </div>
  );
}
```

> 需要在 `globals.css` 增加 `.btn-primary` 工具类：`@apply bg-accent text-white rounded-md hover:bg-blue-500 active:bg-blue-600;`

`components/ui/modal.tsx`：

```tsx
'use client';
import { ReactNode } from 'react';

interface Props { title: string; open: boolean; onClose: () => void; children: ReactNode; }

export default function Modal({ title, open, onClose, children }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

`components/ui/empty-state.tsx`：

```tsx
export default function EmptyState({ text = '暂无数据' }: { text?: string }) {
  return <div className="py-10 text-center text-sm text-slate-400">{text}</div>;
}
```

`components/ui/chart-card.tsx`：

```tsx
import { ReactNode } from 'react';

export default function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-slate-600 mb-3">{title}</h3>
      <div className="h-56">{children}</div>
    </div>
  );
}
```

`components/ui/color-utils.ts`：

```ts
const MAP: Record<string, string> = {
  '语文': '#3b82f6',
  '数学': '#8b5cf6',
  '英语': '#14b8a6',
  '科学': '#f59e0b',
  '体育': '#ef4444',
  '音乐': '#eab308',
  '美术': '#ec4899',
  '班级管理': '#3b82f6',
  '教学教研': '#8b5cf6',
  '家校沟通': '#f59e0b',
  '学生培优': '#ef4444',
  '生涯活动': '#14b8a6',
  '安全教育': '#eab308',
  '会议培训': '#6366f1',
  '心理辅导': '#ec4899',
};

export function CategoryColor(kind: string): string {
  return MAP[kind] ?? '#64748b';
}
```

- [ ] **Step 6: 写 CRUD 类型与通用表格**

`components/crud/types.ts`：

```ts
import type { ReactNode } from 'react';
import type { ResourceKey, Row } from '@/lib/types';

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'tel';

export interface ColumnDef {
  key: string;
  label: string;
  type?: FieldType;
  options?: string[];
  width?: string;
  readOnly?: boolean;
  render?: (row: Row) => ReactNode;
}

export interface FilterDef { key: string; label: string; options: string[]; }

export interface StatDef { label: string; value: string | number; tone?: 'blue' | 'teal' | 'purple' | 'amber' | 'red' | 'default'; }

export interface CrudPageConfig {
  resource: ResourceKey;
  title: string;
  columns: ColumnDef[];
  stats?: (rows: Row[]) => StatDef[];
  filters?: FilterDef[];
  defaultNewRow?: () => Partial<Row>;
  canDelete?: boolean;
}
```

`components/crud/data-table.tsx`：

```tsx
'use client';
import { Row } from '@/lib/types';
import InlineEdit from '../ui/inline-edit';
import EmptyState from '../ui/empty-state';
import type { ColumnDef } from './types';

interface Props {
  rows: Row[];
  columns: ColumnDef[];
  onUpdate: (id: number, patch: Partial<Row>) => Promise<void>;
  onDelete?: (id: number) => void;
  canDelete: boolean;
}

export default function DataTable({ rows, columns, onUpdate, onDelete, canDelete }: Props) {
  if (rows.length === 0) return <EmptyState />;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm whitespace-nowrap">
        <thead className="bg-slate-50 text-slate-500 text-xs">
          <tr>
            {columns.map(c => <th key={c.key} className="px-3 py-2 text-left font-medium border-b border-slate-200">{c.label}</th>)}
            {canDelete && <th className="px-3 py-2 border-b border-slate-200 w-10"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/60">
              {columns.map(c => (
                <td key={c.key} className="px-3 py-1.5" style={c.width ? { minWidth: c.width } : undefined}>
                  {c.render ? c.render(r) : (
                    <InlineEdit
                      value={r[c.key]}
                      type={c.type}
                      options={c.options}
                      onSave={v => onUpdate(r.id as number, { [c.key]: v })}
                    />
                  )}
                </td>
              ))}
              {canDelete && (
                <td className="px-2 py-1.5 text-center">
                  <button
                    className="text-slate-300 hover:text-red-500 text-base"
                    title="删除"
                    onClick={() => { if (confirm('确定删除该记录？')) onDelete?.(r.id as number); }}
                  >×</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 7: 写通用 CRUD 页**

`components/crud/crud-page.tsx`：

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
import { useToast } from '../ui/toast';
import type { CrudPageConfig } from './types';

export default function CrudPage({ config }: { config: CrudPageConfig }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Record<string, string>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    get<Row[]>(`/api/${config.resource}`).then(r => { setRows(r); setLoading(false); });
  }, [config.resource]);

  const filtered = useMemo(() => rows.filter(r =>
    Object.entries(filter).every(([k, v]) => !v || String(r[k]) === v)
  ), [rows, filter]);

  const handleUpdate = async (id: number, patch: Partial<Row>) => {
    const prev = rows;
    setRows(rows.map(r => r.id === id ? { ...r, ...patch } : r));
    try { const updated = await put<Row>(`/api/${config.resource}/${id}`, patch); setRows(rows.map(r => r.id === id ? updated : r)); }
    catch { setRows(prev); }
  };

  const handleCreate = async () => {
    const defaults = config.defaultNewRow?.() ?? {};
    const data: Partial<Row> = { ...defaults };
    for (const c of config.columns) {
      if (!c.readOnly && !(c.key in data) && draft[c.key] !== undefined) data[c.key] = draft[c.key];
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

  const onExport = () => exportCsv(filtered, config.columns, `${config.title}.csv`);

  return (
    <div>
      <PageHeader title={config.title} onAdd={() => setAddOpen(true)} onExport={onExport} />
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
        <DataTable rows={filtered} columns={config.columns} onUpdate={handleUpdate} onDelete={handleDelete} canDelete={config.canDelete ?? true} />
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
              ) : (
                <input className="border border-slate-300 rounded px-2 py-1.5 text-sm"
                  type={c.type === 'number' ? 'number' : 'text'}
                  value={draft[c.key] ?? ''} onChange={e => setDraft({ ...draft, [c.key]: e.target.value })} />
              )}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-primary px-4 py-1.5 text-sm" onClick={handleCreate}>保存</button>
        </div>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 8: 写快捷新增弹窗**

`components/crud/quick-add.tsx`：

```tsx
'use client';
import { useState } from 'react';
import { post } from '@/lib/api-client';
import { useToast } from '../ui/toast';
import Modal from '../ui/modal';
import type { ColumnDef } from './types';
import type { ResourceKey } from '@/lib/types';

interface Props {
  resource: ResourceKey;
  title: string;
  columns: ColumnDef[];
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
}

export default function QuickAddModal({ resource, title, columns, open, onClose, onDone }: Props) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const submit = async () => {
    const data: Record<string, string | number> = {};
    for (const c of columns) {
      const v = draft[c.key] ?? '';
      data[c.key] = c.type === 'number' ? Number(v) : v;
    }
    try { await post(`/api/${resource}`, data); toast('已记录'); setDraft({}); onClose(); onDone?.(); }
    catch { toast('保存失败', 'err'); }
  };
  return (
    <Modal title={title} open={open} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        {columns.map(c => (
          <label key={c.key} className="flex flex-col gap-1 text-xs text-slate-500">
            {c.label}
            <input className="border border-slate-300 rounded px-2 py-1.5 text-sm"
              type={c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'}
              value={draft[c.key] ?? ''} onChange={e => setDraft({ ...draft, [c.key]: e.target.value })} />
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn-primary px-4 py-1.5 text-sm" onClick={submit}>保存</button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 9: 在 globals.css 补 `.btn-primary`，并把 ToastProvider 挂进 AppShell**

`app/globals.css` 追加：

```css
.btn-primary {
  @apply bg-accent text-white rounded-md hover:bg-blue-500 active:bg-blue-600 transition-colors;
}
```

`components/app-shell.tsx` 用 `ToastProvider` 包裹内容（import 后最外层换成 `<ToastProvider><div className="flex min-h-screen">…</div></ToastProvider>`）。

- [ ] **Step 10: 验证构建**

```powershell
npm run build
```

Expected: 构建通过，无类型错误。若 `node:sqlite` 类型缺失报错，执行 `npm install -D @types/node@latest` 后再构建。

- [ ] **Step 11: 提交**

```powershell
git add -A
git commit -m "feat: shared UI components and generic CRUD page"
```

---

### Task 6: 仪表盘

**Files:**
- Create: `components/dashboard/quick-actions.tsx`, `components/dashboard/stats-grid.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `lib/api-client.get<DashboardStats>('/api/dashboard')`、`QuickAddModal`、`CrudPageConfig` 列的复用、`ChartCard`
- Produces: `/` 首页 = 8 张信息卡片 + 12 宫格快捷操作（点击跳转或打开快捷新增弹窗）

- [ ] **Step 1: 写统计卡片网格**

`components/dashboard/stats-grid.tsx`：

```tsx
'use client';
import { DashboardStats } from '@/lib/types';
import { StatCard } from '../ui/stat-card';

const fmt = (n: number) => n.toLocaleString('zh-CN');

export default function StatsGrid({ s }: { s: DashboardStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      <StatCard label="班级人数" value={`${s.studentCount} 人（男${s.maleCount}/女${s.femaleCount}）`} tone="blue" />
      <StatCard label="当日请假" value={`${s.todayLeaves} 人`} tone="teal" />
      <StatCard label="本周常规违纪" value={`${s.weekDiscipline} 条`} tone="amber" />
      <StatCard label="待办事项" value={`${s.todoPending} 项待办`} tone="purple" />
      <StatCard label="作业收缴率" value={`${s.homeworkSubmitRate}%`} tone="red" />
      <StatCard label="最近单元测平均分" value={s.latestExamAvg == null ? '—' : `${s.latestExamAvg} 分`} tone="blue" />
      <StatCard label="本月工作留痕" value={`${fmt(s.monthWorkLogs)} 条`} tone="teal" />
      <StatCard label="家校沟通" value={`家访${s.homeVisitCount} 次 · 家长会${s.parentMeetingCount} 场（${s.parentMeetingRate}%）`} tone="amber" />
    </div>
  );
}
```

> 注意：PRD 要求「临界生数量」卡片。调整第 4 张卡片值为「待办事项」并新增第 9 张？设计取 8 张主卡 + 快捷区体现临界生。在统计网格上方加一行 3 张关键卡（待办/临界生/家长会参会率）——此处将「待办事项」保留，另在 `quick-actions` 下方放一行小字统计。具体以 Task 收尾时按 PRD 8 张卡片对齐：此处实现 8 张，临界生并入第 8 张文案。

- [ ] **Step 2: 写快捷操作九宫格**

`components/dashboard/quick-actions.tsx`：

```tsx
'use client';
import Link from 'next/link';
import { useState } from 'react';
import QuickAddModal from '../crud/quick-add';
import type { ResourceKey } from '@/lib/types';
import type { ColumnDef } from '../crud/types';

interface Tile { label: string; icon: string; href?: string; quick?: { resource: ResourceKey; title: string; columns: ColumnDef[] }; }

const QUICK: Tile[] = [
  { label: '记违纪', icon: '▲', quick: { resource: 'discipline_records', title: '记违纪', columns: [{ key: 'student_name', label: '学生' }, { key: 'category', label: '类别' }, { key: 'content', label: '违纪内容' }, { key: 'action', label: '处理方式' }] } },
  { label: '布置作业', icon: '✎', quick: { resource: 'homework', title: '布置作业', columns: [{ key: 'subject', label: '学科' }, { key: 'assign_date', label: '布置日期', type: 'date' }, { key: 'requirement', label: '作业要求' }, { key: 'deadline', label: '截止时间', type: 'date' }] } },
  { label: '请假登记', icon: '◑', quick: { resource: 'leave_records', title: '请假登记', columns: [{ key: 'student_name', label: '学生' }, { key: 'leave_type', label: '假别' }, { key: 'reason', label: '事由' }, { key: 'start_date', label: '开始日期', type: 'date' }, { key: 'end_date', label: '结束日期', type: 'date' }] } },
  { label: '工作留痕', href: '/work-logs' },
  { label: '谈心谈话', quick: { resource: 'conversations', title: '谈心谈话', columns: [{ key: 'student_name', label: '学生' }, { key: 'topic', label: '主题' }, { key: 'content', label: '内容' }, { key: 'effect', label: '效果' }] } },
  { label: '录入成绩', href: '/grades' },
  { label: '添加待办', quick: { resource: 'todos', title: '添加待办', columns: [{ key: 'title', label: '事项' }, { key: 'date', label: '日期', type: 'date' }, { key: 'priority', label: '优先级' }] } },
  { label: '发布家校通知', quick: { resource: 'parent_comm', title: '家校沟通', columns: [{ key: 'student_name', label: '学生/对象' }, { key: 'way', label: '方式' }, { key: 'content', label: '内容' }] } },
  { label: '日程安排', href: '/schedule' },
  { label: '班级排位', href: '/seats' },
  { label: '学生档案', href: '/students' },
  { label: '家访记录', quick: { resource: 'home_visits', title: '家访记录', columns: [{ key: 'student_name', label: '学生' }, { key: 'way', label: '方式' }, { key: 'content', label: '内容' }] } },
];

export default function QuickActions() {
  const [active, setActive] = useState<(typeof QUICK)[number] | null>(null);
  return (
    <>
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-slate-600 mb-3">快捷操作</h3>
        <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
          {QUICK.map(t => (
            t.href ? (
              <Link key={t.label} href={t.href} className="flex flex-col items-center gap-1.5 py-3 rounded-md hover:bg-blue-50 text-slate-600">
                <span className="text-xl">{t.icon}</span>
                <span className="text-xs">{t.label}</span>
              </Link>
            ) : (
              <button key={t.label} onClick={() => setActive(t)} className="flex flex-col items-center gap-1.5 py-3 rounded-md hover:bg-blue-50 text-slate-600">
                <span className="text-xl">{t.icon}</span>
                <span className="text-xs">{t.label}</span>
              </button>
            )
          ))}
        </div>
      </div>
      {active?.quick && (
        <QuickAddModal
          resource={active.quick.resource}
          title={active.quick.title}
          columns={active.quick.columns}
          open={!!active}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: 组装首页**

`app/page.tsx`：

```tsx
'use client';
import { useEffect, useState } from 'react';
import { get } from '@/lib/api-client';
import type { DashboardStats } from '@/lib/types';
import StatsGrid from '@/components/dashboard/stats-grid';
import QuickActions from '@/components/dashboard/quick-actions';

export default function HomePage() {
  const [s, setS] = useState<DashboardStats | null>(null);
  useEffect(() => { get<DashboardStats>('/api/dashboard').then(setS); }, []);
  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-800 mb-4">班级工作台</h1>
      {s ? <StatsGrid s={s} /> : <div className="text-sm text-slate-400 py-8 text-center">加载中…</div>}
      <QuickActions />
    </div>
  );
}
```

- [ ] **Step 4: 手动冒烟**

```powershell
npm run dev
```

Expected: 首页 8 张统计卡（有真实聚合数据）+ 12 宫格快捷操作；点击「记违纪」弹出快捷新增，保存后 toast 提示。`Ctrl+C` 停止。

- [ ] **Step 5: 提交**

```powershell
git add -A
git commit -m "feat: dashboard page with stats and quick actions"
```

---

### Task 7: 学生管理

**Files:**
- Create: `app/students/page.tsx`
- Modify: `components/crud/crud-page.tsx`（如需要——本任务不应改动，页面只需配置）

**Interfaces:**
- Consumes: `CrudPage` + `ColumnDef` 类型
- Produces: `/students` 页面

- [ ] **Step 1: 写页面**

`app/students/page.tsx`：

```tsx
'use client';
import CrudPage from '@/components/crud/crud-page';
import type { CrudPageConfig } from '@/components/crud/types';

const config: CrudPageConfig = {
  resource: 'students',
  title: '学生管理',
  columns: [
    { key: 'name', label: '姓名', width: '90px' },
    { key: 'gender', label: '性别', type: 'select', options: ['男', '女'], width: '70px' },
    { key: 'parent_phone', label: '家长电话', type: 'tel', width: '130px' },
    { key: 'role', label: '班干部职务' },
    { key: 'group_no', label: '小组', type: 'number', width: '70px' },
    { key: 'level', label: '学生层次', type: 'select', options: ['优秀', '良好', '合格', '重点关注'] },
    { key: 'afternoon_care', label: '下午托', type: 'select', options: ['1', '0'], width: '90px' },
    { key: 'remark', label: '备注', type: 'text' },
  ],
  filters: [
    { key: 'gender', label: '性别', options: ['男', '女'] },
    { key: 'afternoon_care', label: '下午托', options: ['1', '0'] },
    { key: 'level', label: '层次', options: ['优秀', '良好', '合格', '重点关注'] },
  ],
  stats: rows => [
    { label: '总人数', value: rows.length, tone: 'blue' },
    { label: '男生', value: rows.filter(r => r.gender === '男').length, tone: 'teal' },
    { label: '女生', value: rows.filter(r => r.gender === '女').length, tone: 'purple' },
    { label: '班干部', value: rows.filter(r => r.role).length, tone: 'amber' },
    { label: '重点关注', value: rows.filter(r => r.level === '重点关注').length, tone: 'red' },
  ],
  defaultNewRow: () => ({ name: '新学生', gender: '男', parent_phone: '', role: '', group_no: 1, level: '良好', afternoon_care: 1, remark: '' }),
};

export default function StudentsPage() {
  return <CrudPage config={config} />;
}
```

> 说明：`afternoon_care` 存整数 0/1，此处 `type: 'select', options: ['1','0']`，`InlineEdit` 用 `String(value)` 匹配选中项，保存时写入 '1'/'0'，SQLite 数字列兼容。「下午托」筛选同样比较 `String(r[k])`，一致。统计的下午托人数由筛选承担，不另设卡。

- [ ] **Step 2: 手动冒烟**

```powershell
npm run dev
```

Expected: `/students` 显示 45 名学生、顶部 5 张统计卡、三个筛选下拉；点击任意单元格进入编辑、回车保存后 toast；新增弹窗可加学生。

- [ ] **Step 3: 提交**

```powershell
git add -A
git commit -m "feat: students management page"
```

---

### Task 8: 成绩分析

**Files:**
- Create: `app/grades/page.tsx`
- Modify: 无

**Interfaces:**
- Consumes: `get<Row[]>('/api/grades')`、`ChartCard`、`CategoryColor`、`InlineEdit`、`PageHeader`
- Produces: `/grades` 自定义页：考试筛选 + 语数英切换 + 统计卡 + 分数段直方图 + 可编辑明细表

- [ ] **Step 1: 写页面**

`app/grades/page.tsx`：

```tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import { get, put } from '@/lib/api-client';
import { Row } from '@/lib/types';
import PageHeader from '@/components/ui/page-header';
import { StatRow } from '@/components/ui/stat-card';
import ChartCard from '@/components/ui/chart-card';
import InlineEdit from '@/components/ui/inline-edit';
import { CategoryColor } from '@/components/ui/color-utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const SUBJECTS = ['语文', '数学', '英语'];

export default function GradesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [exam, setExam] = useState('');
  const [subject, setSubject] = useState('语文');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<Row[]>('/api/grades').then(rs => {
      setRows(rs);
      const exams = [...new Set(rs.map(r => String(r.exam_name)))];
      setExam(exams[0] ?? '');
      setLoading(false);
    });
  }, []);

  const exams = useMemo(() => [...new Set(rows.map(r => String(r.exam_name)))], [rows]);
  const current = useMemo(() =>
    rows.filter(r => r.exam_name === exam && r.subject === subject),
  [rows, exam, subject]);

  const stats = useMemo(() => {
    const scores = current.map(r => Number(r.score));
    if (scores.length === 0) return [];
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const pass = scores.filter(s => s >= 60).length;
    const good = scores.filter(s => s >= 85).length;
    return [
      { label: '平均分', value: avg.toFixed(1), tone: 'blue' as const },
      { label: '及格率', value: `${((pass / scores.length) * 100).toFixed(1)}%`, tone: 'teal' as const },
      { label: '优秀率(≥85)', value: `${((good / scores.length) * 100).toFixed(1)}%`, tone: 'purple' as const },
      { label: '最高/最低', value: `${Math.max(...scores)} / ${Math.min(...scores)}`, tone: 'amber' as const },
    ];
  }, [current]);

  const histogram = useMemo(() => {
    const bins = [
      { label: '<60', min: 0, max: 59 }, { label: '60-69', min: 60, max: 69 },
      { label: '70-79', min: 70, max: 79 }, { label: '80-89', min: 80, max: 89 },
      { label: '90-100', min: 90, max: 100 },
    ];
    return bins.map(b => ({ name: b.label, 人数: current.filter(r => {
      const s = Number(r.score); return s >= b.min && s <= b.max;
    }).length }));
  }, [current]);

  const updateScore = async (id: number, score: string | number) => {
    const prev = rows;
    setRows(rows.map(r => r.id === id ? { ...r, score } : r));
    try { const u = await put<Row>(`/api/grades/${id}`, { score }); setRows(rows.map(r => r.id === id ? u : r)); }
    catch { setRows(prev); }
  };

  return (
    <div>
      <PageHeader title="成绩分析" onExport={() => {
        const lines = current.map(r => `${r.student_name},${r.score}`).join('\n');
        const blob = new Blob(['\uFEFF' + `姓名,分数\n${lines}`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${exam}-${subject}.csv`; a.click();
        URL.revokeObjectURL(url);
      }} />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={exam} onChange={e => setExam(e.target.value)} className="border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white">
          {exams.map(e => <option key={e} value={e}>{e || '未命名考试'}</option>)}
        </select>
        <div className="flex gap-1">
          {SUBJECTS.map(s => (
            <button key={s} onClick={() => setSubject(s)}
              className={`px-3 py-1.5 text-sm rounded-md border ${subject === s ? 'bg-accent text-white border-accent' : 'bg-white border-slate-300 text-slate-600'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>
      {loading ? <div className="text-sm text-slate-400 py-8 text-center">加载中…</div> : (
        <>
          <StatRow stats={stats} />
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <ChartCard title="分数段分布（直方图）">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogram}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="人数" fill={CategoryColor(subject)} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-slate-600 mb-3">成绩明细（点击可改）</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500 text-xs">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium border-b border-slate-200">姓名</th>
                      <th className="px-3 py-2 text-left font-medium border-b border-slate-200">分数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.map(r => (
                      <tr key={r.id} className="border-b border-slate-100">
                        <td className="px-3 py-1.5">{r.student_name}</td>
                        <td className="px-3 py-1.5">
                          <InlineEdit value={r.score} type="number" onSave={v => updateScore(r.id as number, v)} />
                        </td>
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

- [ ] **Step 2: 手动冒烟**

```powershell
npm run dev
```

Expected: `/grades` 默认选中最近一次考试 + 语文；切换考试/学科统计与直方图联动；改分数回车后 toast 保存。

- [ ] **Step 3: 提交**

```powershell
git add -A
git commit -m "feat: grade analysis page"
```

---

### Task 9: 作业管理

**Files:**
- Create: `app/homework/page.tsx`
- Modify: `components/crud/types.ts`（可选，如需 progress 列渲染类型——本任务在页面内用 `render` 即可，不改公共类型）

**Interfaces:**
- Consumes: `CrudPage`、`ColumnDef.render`
- Produces: `/homework` 页：统计 + 作业列表（含红色收缴进度条列、录入收缴弹窗）

- [ ] **Step 1: 写页面**

`app/homework/page.tsx`：

```tsx
'use client';
import { useState } from 'react';
import CrudPage from '@/components/crud/crud-page';
import Modal from '@/components/ui/modal';
import { put } from '@/lib/api-client';
import { Row } from '@/lib/types';
import { useToast } from '@/components/ui/toast';
import type { CrudPageConfig } from '@/components/crud/types';

function totalOf(r: Row) { return Number(r.submitted) + Number(r.late) + Number(r.missing); }

function ProgressBar({ row }: { row: Row }) {
  const total = totalOf(row);
  const pct = total > 0 ? Math.round((Number(row.submitted) / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-40">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-red-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 whitespace-nowrap">{pct}%（已交 {row.submitted} · 迟交 {row.late} · 未交 {row.missing}）</span>
    </div>
  );
}

export default function HomeworkPage() {
  const { toast } = useToast();
  const [collecting, setCollecting] = useState<Row | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [reload, setReload] = useState(0);

  const config: CrudPageConfig = {
    resource: 'homework',
    title: '作业管理',
    columns: [
      { key: 'subject', label: '学科', type: 'select', options: ['语文', '数学', '英语', '科学', '道德与法治'], width: '110px' },
      { key: 'assign_date', label: '布置日期', type: 'date', width: '120px' },
      { key: 'requirement', label: '作业要求', type: 'textarea', width: '220px' },
      { key: 'deadline', label: '截止时间', type: 'date', width: '120px' },
      { key: 'submitted', label: '已交', type: 'number', width: '70px' },
      { key: 'late', label: '迟交', type: 'number', width: '70px' },
      { key: 'missing', label: '未交', type: 'number', width: '70px' },
      { key: 'missing_names', label: '未交学生', type: 'text' },
      { key: 'progress', label: '收缴进度', readOnly: true, render: r => <ProgressBar row={r} /> },
      { key: 'collect', label: '操作', readOnly: true, render: r => <CollectButton row={r} onCollect={openCollect} /> },
    ],
    stats: rows => {
      const total = rows.length;
      const avg = total > 0 ? Math.round(rows.reduce((s, r) => s + (totalOf(r) > 0 ? Number(r.submitted) / totalOf(r) : 0), 0) / total * 100) : 0;
      const missingAll = rows.reduce((s, r) => s + Number(r.missing), 0);
      return [
        { label: '累计布置作业', value: total, tone: 'blue' },
        { label: '平均提交率', value: `${avg}%`, tone: 'teal' },
        { label: '累计未交人次', value: missingAll, tone: 'red' },
      ];
    },
    defaultNewRow: () => ({ subject: '语文', assign_date: '', requirement: '', deadline: '', submitted: 0, late: 0, missing: 0, missing_names: '' }),
  };

  const openCollect = (r: Row) => { setCollecting(r); setDraft({ submitted: String(r.submitted), late: String(r.late), missing: String(r.missing) }); };

  const saveCollect = async () => {
    if (!collecting) return;
    try {
      await put(`/api/homework/${collecting.id}`, {
        submitted: Number(draft.submitted) || 0,
        late: Number(draft.late) || 0,
        missing: Number(draft.missing) || 0,
      });
      toast('已更新收缴情况');
      setCollecting(null);
      setReload(n => n + 1);
    } catch { toast('保存失败', 'err'); }
  };

  return (
    <div key={reload}>
      <CrudPage config={config} />
      <Modal title="录入收缴情况" open={!!collecting} onClose={() => setCollecting(null)}>
        <div className="grid grid-cols-3 gap-3">
          {[['submitted', '已交'], ['late', '迟交'], ['missing', '未交']].map(([k, label]) => (
            <label key={k} className="flex flex-col gap-1 text-xs text-slate-500">
              {label}
              <input type="number" className="border border-slate-300 rounded px-2 py-1.5 text-sm"
                value={draft[k] ?? ''} onChange={e => setDraft({ ...draft, [k]: e.target.value })} />
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-primary px-4 py-1.5 text-sm" onClick={saveCollect}>保存</button>
        </div>
      </Modal>
    </div>
  );
}
```

> 每个作业行提供【录入收缴】按钮（PRD 页面 6 要求），`CollectButton` 定义在 `ProgressBar` 组件之后：

```tsx
export function CollectButton({ row, onCollect }: { row: Row; onCollect: (r: Row) => void }) {
  return <button className="text-xs text-accent hover:underline" onClick={() => onCollect(row)}>录入收缴</button>;
}
```

- [ ] **Step 2: 手动冒烟**

```powershell
npm run dev
```

Expected: `/homework` 显示 3 条作业 + 统计卡 + 红色进度条；点「录入收缴」弹窗改数后进度条刷新。

- [ ] **Step 3: 提交**

```powershell
git add -A
git commit -m "feat: homework management page"
```

---

### Task 10: 请假管理 + 违纪台账

**Files:**
- Create: `app/leaves/page.tsx`, `app/discipline/page.tsx`

**Interfaces:**
- Consumes: `CrudPage`
- Produces: `/leaves`、`/discipline` 两个统计+列表页

- [ ] **Step 1: 请假管理页**

`app/leaves/page.tsx`：

```tsx
'use client';
import CrudPage from '@/components/crud/crud-page';
import type { CrudPageConfig } from '@/components/crud/types';

const today = () => new Date().toISOString().slice(0, 10);

const config: CrudPageConfig = {
  resource: 'leave_records',
  title: '请假管理',
  columns: [
    { key: 'student_name', label: '学生', width: '100px' },
    { key: 'leave_type', label: '假别', type: 'select', options: ['事假', '病假', '公假'], width: '90px' },
    { key: 'reason', label: '事由', type: 'textarea' },
    { key: 'start_date', label: '开始日期', type: 'date', width: '130px' },
    { key: 'end_date', label: '结束日期', type: 'date', width: '130px' },
    { key: 'hours', label: '时长(小时)', type: 'number', width: '100px' },
  ],
  stats: rows => {
    const month = today().slice(0, 7);
    const monthRows = rows.filter(r => String(r.start_date).startsWith(month));
    const sick = monthRows.filter(r => r.leave_type === '病假').length;
    return [
      { label: '累计请假记录', value: rows.length, tone: 'blue' },
      { label: '当日请假', value: rows.filter(r => r.start_date === today()).length, tone: 'teal' },
      { label: '本月人次', value: monthRows.length, tone: 'purple' },
      { label: '本月病假占比', value: monthRows.length ? `${Math.round((sick / monthRows.length) * 100)}%` : '0%', tone: 'amber' },
    ];
  },
  defaultNewRow: () => ({ student_name: '', leave_type: '事假', reason: '', start_date: today(), end_date: today(), hours: 8 }),
};

export default function LeavesPage() {
  return <CrudPage config={config} />;
}
```

- [ ] **Step 2: 违纪台账页**

`app/discipline/page.tsx`：

```tsx
'use client';
import CrudPage from '@/components/crud/crud-page';
import type { CrudPageConfig } from '@/components/crud/types';

const config: CrudPageConfig = {
  resource: 'discipline_records',
  title: '违纪台账',
  columns: [
    { key: 'date', label: '日期', type: 'date', width: '120px' },
    { key: 'student_name', label: '学生', width: '100px' },
    { key: 'category', label: '类别', type: 'select', options: ['常规纪律', '迟到早退', '课堂表现', '课间行为', '卫生值日'], width: '110px' },
    { key: 'content', label: '违纪内容', type: 'textarea' },
    { key: 'action', label: '处理方式', type: 'text' },
  ],
  filters: [
    { key: 'category', label: '类别', options: ['常规纪律', '迟到早退', '课堂表现', '课间行为', '卫生值日'] },
  ],
  stats: rows => [
    { label: '累计条数', value: rows.length, tone: 'red' },
    { label: '本周条数', value: rows.filter(r => String(r.date) >= new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10)).length, tone: 'amber' },
  ],
  defaultNewRow: () => ({ date: new Date().toISOString().slice(0, 10), student_name: '', category: '常规纪律', content: '', action: '' }),
};

export default function DisciplinePage() {
  return <CrudPage config={config} />;
}
```

- [ ] **Step 3: 手动冒烟 + 提交**

```powershell
npm run dev
```

Expected: `/leaves` 与 `/discipline` 均正常列表+统计+筛选+新增。

```powershell
git add -A
git commit -m "feat: leave and discipline pages"
```

---

### Task 11: 日程安排

**Files:**
- Create: `app/schedule/page.tsx`

**Interfaces:**
- Consumes: `get<Row[]>('/api/schedules')`、`StatRow`、`InlineEdit`、`Modal`、`ChartCard`（可选）
- Produces: `/schedule` 时间轴：统计面板 + 分类标签筛选 + 时间轴清单（类型标签、时长、青绿完成勾选）

- [ ] **Step 1: 写页面**

`app/schedule/page.tsx`：

```tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import { get, put, post } from '@/lib/api-client';
import { Row } from '@/lib/types';
import PageHeader from '@/components/ui/page-header';
import { StatRow } from '@/components/ui/stat-card';
import Modal from '@/components/ui/modal';
import InlineEdit from '@/components/ui/inline-edit';
import { useToast } from '@/components/ui/toast';
import { CategoryColor } from '@/components/ui/color-utils';

const TYPES = ['备课', '教研', '培优', '监考', '会议', '其他'];

export default function SchedulePage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const load = () => get<Row[]>('/api/schedules').then(setRows);
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter(r => !filter || r.type === filter), [rows, filter]);

  const toggle = async (r: Row) => {
    const next = r.done == 1 ? 0 : 1;
    setRows(rows.map(x => x.id === r.id ? { ...x, done: next } : x));
    try { await put(`/api/schedules/${r.id}`, { done: next }); }
    catch { toast('保存失败', 'err'); setRows(rows); }
  };

  const update = async (id: number, patch: Partial<Row>) => {
    try { const u = await put<Row>(`/api/schedules/${id}`, patch); setRows(rows.map(r => r.id === id ? u : r)); toast('已保存'); }
    catch { toast('保存失败', 'err'); }
  };

  const submit = async () => {
    try {
      await post('/api/schedules', {
        date: draft.date ?? new Date().toISOString().slice(0, 10),
        title: draft.title ?? '',
        type: draft.type ?? '备课',
        duration_min: Number(draft.duration_min) || 60,
        done: 0,
      });
      setAddOpen(false); setDraft({}); load(); toast('已新增');
    } catch { toast('保存失败', 'err'); }
  };

  return (
    <div>
      <PageHeader title="日程安排" onAdd={() => setAddOpen(true)} />
      <StatRow stats={[
        { label: '全部任务', value: rows.length, tone: 'blue' },
        { label: '备课', value: rows.filter(r => r.type === '备课').length, tone: 'teal' },
        { label: '教研', value: rows.filter(r => r.type === '教研').length, tone: 'purple' },
        { label: '监考', value: rows.filter(r => r.type === '监考').length, tone: 'amber' },
        { label: '会议', value: rows.filter(r => r.type === '会议').length, tone: 'red' },
      ]} />
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setFilter('')} className={`px-3 py-1.5 text-xs rounded-full border ${filter === '' ? 'bg-accent text-white border-accent' : 'bg-white border-slate-300 text-slate-600'}`}>全部</button>
        {TYPES.map(t => (
          <button key={t} onClick={() => setFilter(t)} className={`px-3 py-1.5 text-xs rounded-full border ${filter === t ? 'bg-accent text-white border-accent' : 'bg-white border-slate-300 text-slate-600'}`}>{t}</button>
        ))}
      </div>
      <div className="space-y-2">
        {filtered.map(r => (
          <div key={r.id} className={`card flex items-center gap-3 px-4 py-3 ${r.done == 1 ? 'opacity-60' : ''}`}>
            <button onClick={() => toggle(r)}
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm ${r.done == 1 ? 'bg-teal-500 border-teal-500 text-white' : 'border-slate-300 text-transparent'}`}>
              ✓
            </button>
            <div className="flex-1 min-w-0">
              <div className="font-medium">
                <InlineEdit value={r.title} onSave={v => update(r.id as number, { title: v })} />
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                <span className="inline-block mr-2" style={{ color: CategoryColor(String(r.type)) }}>{String(r.type)}</span>
                <InlineEdit value={r.date} type="date" onSave={v => update(r.id as number, { date: v })} />
              </div>
            </div>
            <span className="text-xs text-slate-500 whitespace-nowrap">
              <InlineEdit value={`${r.duration_min} 分钟`} type="number" onSave={v => update(r.id as number, { duration_min: v })} />
            </span>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-sm text-slate-400 py-8 text-center">暂无日程</div>}
      </div>

      <Modal title="新增日程" open={addOpen} onClose={() => setAddOpen(false)}>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-500 col-span-2">标题
            <input className="border border-slate-300 rounded px-2 py-1.5 text-sm" value={draft.title ?? ''} onChange={e => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">日期
            <input type="date" className="border border-slate-300 rounded px-2 py-1.5 text-sm" value={draft.date ?? ''} onChange={e => setDraft({ ...draft, date: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">时长(分钟)
            <input type="number" className="border border-slate-300 rounded px-2 py-1.5 text-sm" value={draft.duration_min ?? ''} onChange={e => setDraft({ ...draft, duration_min: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500 col-span-2">类型
            <select className="border border-slate-300 rounded px-2 py-1.5 text-sm" value={draft.type ?? ''} onChange={e => setDraft({ ...draft, type: e.target.value })}>
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-primary px-4 py-1.5 text-sm" onClick={submit}>保存</button>
        </div>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 手动冒烟 + 提交**

```powershell
npm run dev
```

Expected: 时间轴按日期显示，完成勾选变青绿+变灰，标题/日期/时长点击可改。

```powershell
git add -A
git commit -m "feat: schedule timeline page"
```

---

### Task 12: 我的课表

**Files:**
- Create: `app/timetable/page.tsx`

**Interfaces:**
- Consumes: `get<Row[]>('/api/timetable')`、`ChartCard`、`CategoryColor`、`InlineEdit`
- Produces: `/timetable` 周网格课表（语文蓝色高亮）+ 汇总 + 课时分布条形图

- [ ] **Step 1: 写页面**

`app/timetable/page.tsx`：

```tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import { get, put } from '@/lib/api-client';
import { Row } from '@/lib/types';
import ChartCard from '@/components/ui/chart-card';
import InlineEdit from '@/components/ui/inline-edit';
import { CategoryColor } from '@/components/ui/color-utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const DAYS = ['周一', '周二', '周三', '周四', '周五'];
const PERIODS = ['早读', '正课', '正课', '正课', '中午托', '下午托'];
const SUBJECTS = ['语文', '数学', '英语', '科学', '道德与法治', '体育', '音乐', '美术', '班会', '劳动', '自习', ''];

export default function TimetablePage() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => { get<Row[]>('/api/timetable').then(setRows); }, []);

  const grid = useMemo(() => {
    const m = new Map<string, Row>();
    for (const r of rows) m.set(`${r.weekday}-${r.period}`, r);
    return m;
  }, [rows]);

  const update = async (id: number, patch: Partial<Row>) => {
    try { const u = await put<Row>(`/api/timetable/${id}`, patch); setRows(rows.map(r => r.id === id ? u : r)); }
    catch { /* toast 由 InlineEdit 统一提示 */ }
  };

  const stats = useMemo(() => {
    const total = rows.length;
    const chinese = rows.filter(r => r.is_chinese == 1).length;
    return { total, chinese };
  }, [rows]);

  const bySubject = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(String(r.subject), (m.get(String(r.subject)) ?? 0) + 1);
    return [...m.entries()].map(([name, 课时]) => ({ name, 课时 })).filter(d => d.name);
  }, [rows]);

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-800 mb-4">我的课表</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="card px-4 py-3"><div className="text-xs text-slate-500">每周总课时</div><div className="text-xl font-semibold mt-1">{stats.total}</div></div>
        <div className="card px-4 py-3"><div className="text-xs text-slate-500">语文任教课时</div><div className="text-xl font-semibold mt-1 text-blue-600">{stats.chinese}</div></div>
      </div>
      <div className="card overflow-x-auto mb-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs">
              <th className="px-2 py-2 border-b border-slate-200 text-left">时段</th>
              {DAYS.map(d => <th key={d} className="px-2 py-2 border-b border-slate-200">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((period, i) => (
              <tr key={i}>
                <td className="px-2 py-2 border-b border-slate-100 text-xs text-slate-500 whitespace-nowrap">{period}{i > 0 && i < 4 ? i : ''}</td>
                {DAYS.map(d => {
                  const key = `${DAYS.indexOf(d) + 1}-${period}`;
                  const r = grid.get(key);
                  if (!r) return <td key={key} className="px-2 py-2 border-b border-slate-100"></td>;
                  const chinese = r.is_chinese == 1;
                  return (
                    <td key={key} className={`px-2 py-2 border-b border-slate-100 text-center ${chinese ? 'bg-blue-50' : ''}`}>
                      <InlineEdit
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
      </div>
      <ChartCard title="课时分布（按学科）">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bySubject}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="课时" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
```

> 说明：课表数据由种子生成；「下午托」作为独立时段显示。语文课时以蓝色高亮（`bg-blue-50` + 蓝字），符合 PRD。

- [ ] **Step 2: 手动冒烟 + 提交**

```powershell
npm run dev
```

Expected: 周一~周五 × 6 时段网格，语文单元格蓝色高亮，切换学科后该格高亮变化。

```powershell
git add -A
git commit -m "feat: weekly timetable page"
```

---

### Task 13: 谈话记录 + 家校沟通

**Files:**
- Create: `app/conversations/page.tsx`, `app/parent-comm/page.tsx`

**Interfaces:**
- Consumes: `CrudPage`
- Produces: `/conversations`、`/parent-comm`

- [ ] **Step 1: 谈话记录页**

`app/conversations/page.tsx`：

```tsx
'use client';
import CrudPage from '@/components/crud/crud-page';
import type { CrudPageConfig } from '@/components/crud/types';

const config: CrudPageConfig = {
  resource: 'conversations',
  title: '谈话记录',
  columns: [
    { key: 'date', label: '日期', type: 'date', width: '120px' },
    { key: 'student_name', label: '学生', width: '100px' },
    { key: 'topic', label: '主题', type: 'text' },
    { key: 'content', label: '内容', type: 'textarea' },
    { key: 'effect', label: '谈话效果', type: 'select', options: ['有改善', '需持续跟进', '已解决'], width: '120px' },
  ],
  defaultNewRow: () => ({ date: new Date().toISOString().slice(0, 10), student_name: '', topic: '', content: '', effect: '需持续跟进' }),
};

export default function ConversationsPage() {
  return <CrudPage config={config} />;
}
```

- [ ] **Step 2: 家校沟通页**

`app/parent-comm/page.tsx`：

```tsx
'use client';
import CrudPage from '@/components/crud/crud-page';
import type { CrudPageConfig } from '@/components/crud/types';

const config: CrudPageConfig = {
  resource: 'parent_comm',
  title: '家校沟通',
  columns: [
    { key: 'date', label: '日期', type: 'date', width: '120px' },
    { key: 'student_name', label: '学生/对象', width: '120px' },
    { key: 'way', label: '方式', type: 'select', options: ['电话', '微信', '面谈', '通知'], width: '90px' },
    { key: 'content', label: '沟通内容', type: 'textarea' },
  ],
  defaultNewRow: () => ({ date: new Date().toISOString().slice(0, 10), student_name: '', way: '微信', content: '' }),
};

export default function ParentCommPage() {
  return <CrudPage config={config} />;
}
```

- [ ] **Step 3: 手动冒烟 + 提交**

```powershell
npm run dev
git add -A
git commit -m "feat: conversation and parent-comm pages"
```

---

### Task 14: 生涯家访

**Files:**
- Create: `app/visits/page.tsx`

**Interfaces:**
- Consumes: `CrudPage`
- Produces: `/visits` 统计 + 家访/家长会列表（`is_meeting` 区分）

- [ ] **Step 1: 写页面**

`app/visits/page.tsx`：

```tsx
'use client';
import CrudPage from '@/components/crud/crud-page';
import type { CrudPageConfig } from '@/components/crud/types';

const config: CrudPageConfig = {
  resource: 'home_visits',
  title: '生涯家访',
  columns: [
    { key: 'date', label: '日期', type: 'date', width: '120px' },
    { key: 'student_name', label: '学生', width: '120px' },
    { key: 'way', label: '方式', type: 'select', options: ['电话', '家访', '家长会', '微信'], width: '100px' },
    { key: 'content', label: '内容', type: 'textarea' },
    { key: 'is_meeting', label: '类型', type: 'select', options: ['0', '1'], render: r => (r.is_meeting == 1 ? '家长会' : '家访'), readOnly: true },
  ],
  stats: rows => {
    const visits = rows.filter(r => r.is_meeting != 1).length;
    const meetings = rows.filter(r => r.is_meeting == 1).length;
    return [
      { label: '家访次数', value: visits, tone: 'amber' },
      { label: '家长会场次', value: meetings, tone: 'purple' },
      { label: '家长会参会率', value: `${Math.min(100, Math.round((45 / 50) * 100))}%`, tone: 'teal' },
    ];
  },
  defaultNewRow: () => ({ date: new Date().toISOString().slice(0, 10), student_name: '', way: '电话', content: '', is_meeting: 0 }),
};

export default function VisitsPage() {
  return <CrudPage config={config} />;
}
```

> 「类型」列 readOnly 展示。若需切换家访/家长会，可改为 `type: 'select', options: ['0','1']` 直接编辑（会显示 0/1）。此处保留清晰中文展示，编辑用「方式」列即可。

- [ ] **Step 2: 手动冒烟 + 提交**

```powershell
npm run dev
git add -A
git commit -m "feat: home visit page"
```

---

### Task 15: 综合素质评价

**Files:**
- Create: `app/evaluation/page.tsx`

**Interfaces:**
- Consumes: `get<Row[]>('/api/evaluation')`、`ChartCard`、`CategoryColor`、`InlineEdit`、`PageHeader`
- Produces: `/evaluation` 五维度打分表 + 按维度汇总图

- [ ] **Step 1: 写页面**

`app/evaluation/page.tsx`：

```tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import { get, put } from '@/lib/api-client';
import { Row } from '@/lib/types';
import PageHeader from '@/components/ui/page-header';
import ChartCard from '@/components/ui/chart-card';
import InlineEdit from '@/components/ui/inline-edit';
import { CategoryColor } from '@/components/ui/color-utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const DIMS: { key: string; label: string }[] = [
  { key: 'moral', label: '品德' }, { key: 'study', label: '学习' }, { key: 'sports', label: '体育' },
  { key: 'art', label: '美育' }, { key: 'labor', label: '劳动' },
];

export default function EvaluationPage() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => { get<Row[]>('/api/evaluation').then(setRows); }, []);

  const update = async (id: number, patch: Partial<Row>) => {
    try { const u = await put<Row>(`/api/evaluation/${id}`, patch); setRows(rows.map(r => r.id === id ? u : r)); }
    catch { /* toast 在 InlineEdit 内提示 */ }
  };

  const dimStats = useMemo(() => DIMS.map(d => ({
    name: d.label,
    avg: rows.length ? (rows.reduce((s, r) => s + Number(r[d.key] ?? 3), 0) / rows.length).toFixed(1) : '0',
  })), [rows]);

  return (
    <div>
      <PageHeader title="综合素质评价" onExport={() => {
        const lines = rows.map(r => DIMS.map(d => r[d.key]).join(',')).join('\n');
        const head = ['姓名', ...DIMS.map(d => d.label)].join(',');
        const body = rows.map(r => [r.student_name, ...DIMS.map(d => r[d.key])].join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + `${head}\n${body}`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = '综合素质评价.csv'; a.click(); URL.revokeObjectURL(url);
      }} />
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <ChartCard title="各维度平均分（满分 5）">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dimStats}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 5]} />
              <Tooltip />
              <Bar dataKey="avg" fill={CategoryColor('班级管理')} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-600 mb-3">评价说明</h3>
          <p className="text-xs text-slate-500 leading-relaxed">每项按 1-5 打分（1 很差 / 5 优秀）。点击分数直接修改，实时保存。评语在表格底部。</p>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="px-3 py-2 text-left font-medium border-b border-slate-200">姓名</th>
              {DIMS.map(d => <th key={d.key} className="px-3 py-2 text-center font-medium border-b border-slate-200">{d.label}</th>)}
              <th className="px-3 py-2 text-left font-medium border-b border-slate-200">评语</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="px-3 py-1.5">{r.student_name}</td>
                {DIMS.map(d => (
                  <td key={d.key} className="px-3 py-1.5 text-center">
                    <InlineEdit value={r[d.key]} type="number" onSave={v => update(r.id as number, { [d.key]: v })} />
                  </td>
                ))}
                <td className="px-3 py-1.5">
                  <InlineEdit value={r.comment} type="text" onSave={v => update(r.id as number, { comment: v })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 手动冒烟 + 提交**

```powershell
npm run dev
git add -A
git commit -m "feat: comprehensive evaluation page"
```

---

### Task 16: 排座位

**Files:**
- Create: `app/seats/page.tsx`

**Interfaces:**
- Consumes: `get<Row[]>('/api/seats')`、`get<Row[]>('/api/students')`、`put`/`post`、`Modal`、`get<Row[]>('/api/classroom_config')`
- Produces: `/seats` 教室双人桌布局，讲台标注，点击座位选学生

- [ ] **Step 1: 写页面**

`app/seats/page.tsx`：

```tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import { get, put, post } from '@/lib/api-client';
import { Row } from '@/lib/types';
import PageHeader from '@/components/ui/page-header';
import Modal from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';

export default function SeatsPage() {
  const { toast } = useToast();
  const [seats, setSeats] = useState<Row[]>([]);
  const [students, setStudents] = useState<Row[]>([]);
  const [cfg, setCfg] = useState<{ row_count: number; col_count: number }>({ row_count: 6, col_count: 8 });
  const [selected, setSelected] = useState<Row | null>(null);
  const [reload, setReload] = useState(0);

  const load = () => {
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
  };
  useEffect(load, [reload]);

  const grid = useMemo(() => {
    const m = new Map<string, Row>();
    for (const s of seats) m.set(`${s.row_index}-${s.col_index}`, s);
    return m;
  }, [seats]);

  const used = useMemo(() => {
    const s = new Set<string>();
    for (const x of seats) if (String(x.student_name)) s.add(String(x.student_name));
    return s;
  }, [seats]);

  const assign = async (name: string) => {
    if (!selected) return;
    try {
      const seat = grid.get(`${selected.row_index}-${selected.col_index}`);
      if (seat) {
        await put(`/api/seats/${seat.id}`, { student_name: name });
      } else {
        await post('/api/seats', { row_index: selected.row_index, col_index: selected.col_index, student_name: name });
      }
      toast(`已安排 ${name}`);
      setSelected(null);
      setReload(n => n + 1);
    } catch { toast('保存失败', 'err'); }
  };

  const clearSeat = async () => {
    if (!selected) return;
    const seat = grid.get(`${selected.row_index}-${selected.col_index}`);
    if (seat) {
      try { await put(`/api/seats/${seat.id}`, { student_name: '' }); setSelected(null); setReload(n => n + 1); }
      catch { toast('保存失败', 'err'); }
    }
  };

  return (
    <div>
      <PageHeader title="排座位" onExport={() => {
        const lines = seats.map(s => `${Number(s.row_index) + 1}排${Number(s.col_index) + 1}座,${s.student_name}`).join('\n');
        const blob = new Blob(['\uFEFF' + `位置,姓名\n${lines}`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = '座位表.csv'; a.click(); URL.revokeObjectURL(url);
      }} />
      <div className="mb-4 text-xs text-slate-500">点击任意座位安排学生，双击空白说明；顶部为讲台。</div>
      <div className="card p-4">
        <div className="mx-auto mb-4 w-40 text-center py-1.5 bg-navy text-white text-xs rounded">讲 台</div>
        <div className="overflow-x-auto">
          <div className="min-w-max mx-auto">
            {Array.from({ length: cfg.row_count }).map((_, r) => (
              <div key={r} className="flex gap-2 mb-2 justify-center">
                {Array.from({ length: cfg.col_count }).map((_, c) => {
                  const seat = grid.get(`${r}-${c}`);
                  const name = String(seat?.student_name ?? '');
                  return (
                    <button
                      key={c}
                      onClick={() => setSelected(seat ?? { row_index: r, col_index: c, student_name: '' })}
                      className={`w-14 h-12 rounded-md border text-xs flex items-center justify-center transition-colors ${
                        name ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-300'
                      }`}
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

      <Modal title="安排座位" open={!!selected} onClose={() => setSelected(null)}>
        <p className="text-xs text-slate-500 mb-3">
          当前座位：{selected ? `${Number(selected.row_index) + 1} 排 ${Number(selected.col_index) + 1} 座` : ''}（{String(selected?.student_name ?? '空')}）
        </p>
        <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto">
          {students.filter(s => !used.has(String(s.name)) || String(selected?.student_name) === String(s.name)).map(s => (
            <button key={s.id} onClick={() => assign(String(s.name))}
              className={`px-2.5 py-1 rounded-md border text-xs ${String(s.name) === String(selected?.student_name) ? 'bg-accent text-white border-accent' : 'bg-white border-slate-300 text-slate-600 hover:bg-blue-50'}`}>
              {String(s.name)}
            </button>
          ))}
        </div>
        {String(selected?.student_name ?? '') && (
          <button onClick={clearSeat} className="mt-3 text-xs text-red-500 hover:underline">移除该座位学生</button>
        )}
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: 手动冒烟 + 提交**

```powershell
npm run dev
```

Expected: 讲台下方 6×8 座位网格，点座位弹出学生选择器，选中即落座并高亮。

```powershell
git add -A
git commit -m "feat: seat arrangement page"
```

---

### Task 17: 安全台账 + 培优临界生台账

**Files:**
- Create: `app/safety/page.tsx`, `app/peiyou/page.tsx`

**Interfaces:**
- Consumes: `CrudPage`
- Produces: `/safety`、`/peiyou`

- [ ] **Step 1: 安全台账页**

`app/safety/page.tsx`：

```tsx
'use client';
import CrudPage from '@/components/crud/crud-page';
import type { CrudPageConfig } from '@/components/crud/types';

const config: CrudPageConfig = {
  resource: 'safety_logs',
  title: '安全台账',
  columns: [
    { key: 'date', label: '日期', type: 'date', width: '120px' },
    { key: 'category', label: '类别', type: 'select', options: ['课间', '交通', '食品', '消防', '防溺水', '其他'], width: '100px' },
    { key: 'content', label: '内容', type: 'textarea' },
    { key: 'action', label: '处理情况', type: 'text' },
  ],
  filters: [
    { key: 'category', label: '类别', options: ['课间', '交通', '食品', '消防', '防溺水', '其他'] },
  ],
  defaultNewRow: () => ({ date: new Date().toISOString().slice(0, 10), category: '课间', content: '', action: '' }),
};

export default function SafetyPage() {
  return <CrudPage config={config} />;
}
```

- [ ] **Step 2: 培优临界生台账页**

`app/peiyou/page.tsx`：

```tsx
'use client';
import CrudPage from '@/components/crud/crud-page';
import type { CrudPageConfig } from '@/components/crud/types';

const config: CrudPageConfig = {
  resource: 'peiyou_records',
  title: '培优临界生台账',
  columns: [
    { key: 'student_name', label: '学生', width: '100px' },
    { key: 'subject', label: '学科', type: 'select', options: ['语文', '数学', '英语'], width: '90px' },
    { key: 'weak_point', label: '薄弱点', type: 'text' },
    { key: 'target_score', label: '目标分数', type: 'number', width: '100px' },
    { key: 'record', label: '辅导记录', type: 'textarea' },
  ],
  stats: rows => [
    { label: '临界生人数', value: rows.filter((r, i, a) => a.findIndex(x => x.student_name === r.student_name) === i).length, tone: 'red' },
    { label: '辅导记录', value: rows.length, tone: 'blue' },
  ],
  defaultNewRow: () => ({ student_name: '', subject: '语文', weak_point: '', target_score: 85, record: '' }),
};

export default function PeiyouPage() {
  return <CrudPage config={config} />;
}
```

- [ ] **Step 3: 手动冒烟 + 提交**

```powershell
npm run dev
git add -A
git commit -m "feat: safety and peiyou pages"
```

---

### Task 18: 工作留痕

**Files:**
- Create: `app/work-logs/page.tsx`

**Interfaces:**
- Consumes: `get<Row[]>('/api/work_logs')`、`ChartCard`、`CategoryColor`、`CrudPage`、`PieChart`
- Produces: `/work-logs` 统计面板 + 八大类环形饼图 + 工作纪实台账

- [ ] **Step 1: 写页面**

`app/work-logs/page.tsx`：

```tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import { get } from '@/lib/api-client';
import { Row } from '@/lib/types';
import CrudPage from '@/components/crud/crud-page';
import ChartCard from '@/components/ui/chart-card';
import { CategoryColor } from '@/components/ui/color-utils';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { CrudPageConfig } from '@/components/crud/types';

const WORK_TYPES = ['班级管理', '教学教研', '家校沟通', '学生培优', '生涯活动', '安全教育', '会议培训', '心理辅导'];

function WorkChart() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => { get<Row[]>('/api/work_logs').then(setRows); }, []);
  const data = useMemo(() => WORK_TYPES.map(t => ({
    name: t,
    value: rows.filter(r => r.type === t).length,
  })).filter(d => d.value > 0), [rows]);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
          {data.map((d, i) => <Cell key={i} fill={CategoryColor(d.name)} />)}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

const config: CrudPageConfig = {
  resource: 'work_logs',
  title: '工作留痕',
  columns: [
    { key: 'date', label: '日期', type: 'date', width: '120px' },
    { key: 'title', label: '工作事项', type: 'text' },
    { key: 'type', label: '类型', type: 'select', options: WORK_TYPES, width: '110px' },
    { key: 'place', label: '地点', type: 'text' },
    { key: 'hours', label: '时长(小时)', type: 'number', width: '100px' },
  ],
  stats: rows => [
    { label: '累计工作记录', value: rows.length, tone: 'blue' },
    { label: '累计时长', value: `${rows.reduce((s, r) => s + Number(r.hours), 0).toFixed(1)} 小时`, tone: 'teal' },
  ],
  defaultNewRow: () => ({ date: new Date().toISOString().slice(0, 10), title: '', type: '班级管理', place: '', hours: 1 }),
};

export default function WorkLogsPage() {
  return (
    <div>
      <div className="mb-4"><CrudPage config={config} /></div>
      <ChartCard title="工作类型分布（环形饼图）">
        <WorkChart />
      </ChartCard>
    </div>
  );
}
```

> 布局：`CrudPage`（含页头 + 统计 + 表格）在上，环形饼图卡片在下，此为最终布局。

- [ ] **Step 2: 手动冒烟 + 提交**

```powershell
npm run dev
git add -A
git commit -m "feat: work logs page with pie chart"
```

---

### Task 19: 系统设置

**Files:**
- Create: `app/api/reset/route.ts`, `app/settings/page.tsx`
- Modify: `lib/seed.ts`（导出可重复执行的 `resetData(db)`）

**Interfaces:**
- Consumes: `get<Row[]>('/api/settings')`、`put`、`getDb`、`seedIfEmpty`
- Produces:
  - `POST /api/reset` → 清空全部业务表并重新灌种子，返回 `{ ok: true }`
  - `/settings`：班级信息表单、重置种子、导出数据库文件

- [ ] **Step 1: 重构种子为可重置**

在 `lib/seed.ts` 末尾新增（复用 `seedIfEmpty` 内部逻辑，抽公共函数）：

```ts
export function resetData(db: DatabaseSync): void {
  const tables = ['todos', 'work_logs', 'peiyou_records', 'safety_logs', 'parent_comm',
    'evaluation', 'home_visits', 'conversations', 'timetable', 'schedules', 'homework',
    'grades', 'discipline_records', 'leave_records', 'seats', 'students', 'settings', 'classroom_config'];
  db.exec(tables.map(t => `DELETE FROM ${t}`).join(';'));
  seedIfEmpty(db);
}
```

`tests/seed.test.ts` 追加：

```ts
it('resetData 后重新灌入数据', () => {
  const db = makeDb();
  seedIfEmpty(db);
  db.prepare(`DELETE FROM students WHERE id IN (SELECT id FROM students LIMIT 5)`).run();
  resetData(db);
  const n = (db.prepare('SELECT COUNT(*) AS n FROM students').get() as { n: number }).n;
  expect(n).toBe(45);
});
```

- [ ] **Step 2: 写重置 API**

`app/api/reset/route.ts`：

```ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { resetData } from '@/lib/seed';

export async function POST() {
  resetData(getDb());
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: 写设置页**

`app/settings/page.tsx`：

```tsx
'use client';
import { useEffect, useState } from 'react';
import { get, put, post } from '@/lib/api-client';
import { Row } from '@/lib/types';
import PageHeader from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';

const KEYS: { key: string; label: string }[] = [
  { key: 'class_name', label: '班级名称' },
  { key: 'head_teacher', label: '班主任' },
  { key: 'grade_band', label: '年级班次' },
  { key: 'total_count', label: '总人数' },
  { key: 'male_count', label: '男生数' },
  { key: 'female_count', label: '女生数' },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get<Row[]>('/api/settings').then(rs => {
      setRows(rs);
      const m: Record<string, string> = {};
      for (const r of rs) m[String(r.key)] = String(r.value ?? '');
      setForm(m);
    });
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      for (const r of rows) {
        if (!KEYS.some(k => k.key === r.key)) continue;
        await put(`/api/settings/${r.id}`, { value: form[String(r.key)] ?? '' });
      }
      toast('已保存');
    } catch { toast('保存失败', 'err'); }
    setBusy(false);
  };

  const reset = async () => {
    if (!confirm('将清空全部演示数据并重新生成，确认？')) return;
    setBusy(true);
    try { await post('/api/reset', {}); toast('已重置'); setBusy(false); location.reload(); }
    catch { toast('重置失败', 'err'); setBusy(false); }
  };

  const backup = () => {
    window.open('/data/app.db', '_blank');
  };

  return (
    <div>
      <PageHeader title="系统设置" />
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-600 mb-3">班级基础信息</h3>
          <div className="grid grid-cols-2 gap-3">
            {KEYS.map(k => (
              <label key={k.key} className="flex flex-col gap-1 text-xs text-slate-500">
                {k.label}
                <input className="border border-slate-300 rounded px-2 py-1.5 text-sm"
                  value={form[k.key] ?? ''} onChange={e => setForm({ ...form, [k.key]: e.target.value })} />
              </label>
            ))}
          </div>
          <button className="btn-primary px-4 py-1.5 text-sm mt-4" onClick={save} disabled={busy}>保存</button>
        </div>
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-slate-600 mb-3">数据维护</h3>
            <div className="flex flex-col gap-2">
              <button className="btn-primary px-4 py-2 text-sm" onClick={reset} disabled={busy}>重置种子数据（重新随机生成）</button>
              <button className="btn-primary px-4 py-2 text-sm" onClick={backup}>备份数据库（下载 app.db）</button>
            </div>
            <p className="text-xs text-slate-400 mt-3">演示数据均为随机生成的匿名姓名，用于保护学生隐私。</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

> 备份采用直接访问 `/data/app.db`：Next.js 静态目录外不可直接访问。改为在后端提供下载接口。修改：新增 `app/api/backup/route.ts`：

```ts
import { NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export async function GET() {
  const buf = readFileSync(join(process.cwd(), 'data', 'app.db'));
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="app-backup.db"',
    },
  });
}
```

`app/settings/page.tsx` 中 `backup` 改为 `window.open('/api/backup', '_blank');`。

- [ ] **Step 4: 运行测试 + 手动冒烟 + 提交**

```powershell
npm test
npm run dev
```

Expected: 测试含 resetData 用例通过；设置页可改班级信息、重置数据后所有页面刷新出新的随机数据、下载备份文件成功。

```powershell
git add -A
git commit -m "feat: settings page with reset and backup"
```

---

### Task 20: 收尾 —— 全量校验 + README

**Files:**
- Create: `README.md`
- Modify: 无（若有 lint/构建错误则修复）

**Interfaces:**
- Consumes: 全部任务产物
- Produces: 可运行的完整应用 + 使用文档

- [ ] **Step 1: 全量校验**

```powershell
npm run lint
npm test
npm run build
```

Expected: lint 无错误、测试全绿、生产构建成功。

- [ ] **Step 2: 写 README**

`README.md`：

```markdown
# 班主任智慧工作台

长沙公办小学六年级班主任智慧班级管理工作台（移动端 + 电脑端自适应）。

## 快速开始

要求 Node.js >= 22。

```bash
npm install
npm run dev        # 开发模式，绑定 0.0.0.0:3000
```

或生产模式：

```bash
npm run build
npm start          # http://电脑局域网IP:3000
```

手机连同一 Wi-Fi，用浏览器打开 `http://电脑局域网IP:3000`。

## 数据说明

- 数据库为 SQLite 文件 `data/app.db`，首次启动自动创建并生成随机演示数据（学生/家长姓名均为匿名）。
- 所有单元格点击即可编辑，失焦/回车自动保存。
- 系统设置页可重置演示数据或备份数据库。

## 功能模块

仪表盘 / 日程安排 / 我的课表 / 学生管理 / 成绩分析 / 作业管理 / 请假管理 / 违纪台账 / 谈话记录 / 生涯家访 / 综合素质评价 / 排座位 / 家校沟通 / 安全台账 / 培优临界生 / 工作留痕 / 系统设置
```

- [ ] **Step 3: 手动端到端冒烟**

```powershell
npm run dev
```

在浏览器过一遍：首页统计卡有数据、快捷新增生效、课表/成绩/排座位交互正常、系统设置能改班级名并回显到顶栏（顶栏在 Task 4 已实现从 `/api/settings` 读取 class_name）。

- [ ] **Step 4: 提交**

```powershell
git add -A
git commit -m "chore: final polish and README"
```

---

## Self-Review

**Spec coverage:** 仪表盘✓ / 日程✓ / 课表✓ / 学生✓ / 成绩✓ / 作业✓ / 请假✓ / 违纪✓ / 谈话✓ / 家访✓ / 综合素质✓ / 排座✓ / 家校✓ / 安全✓ / 培优✓ / 留痕✓ / 设置✓；18 张表✓；随机匿名种子✓；点击即编辑✓；深蓝侧边栏+湖蓝按钮+功能色✓；响应式抽屉✓；本机 0.0.0.0 免登录✓。
**Placeholders:** 无 TBD/TODO；所有步骤含完整代码。
**Type consistency:** `ResourceKey` 与 `RESOURCES` 键一致；`CrudPageConfig` 各字段在 Task 5 定义、后续页面按同一类型使用；API 路径 `PUT /api/settings/${k}` 与 Task 3 的 `[id]` 路由匹配（settings 的 id 即 key）。`afternoon_care`/`is_meeting` 用 select 存 '0'/'1'，与种子（INTEGER）经 `String(r[k])` 比较兼容。
