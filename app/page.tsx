'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Avatar, Button, Chip, ListBox, SearchField, Select, Skeleton, Tabs } from '@heroui/react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, PlusCircle, RefreshCw } from 'lucide-react';
import dayjs from 'dayjs';
import { get, post } from '@/lib/api-client';
import { downloadCsv } from '@/lib/csv';
import { useResourceRows } from '@/components/use-resource';
import StatCard from '@/components/stat-card';
import DataTable, { type ColumnDef } from '@/components/data-table';
import FormModal, { type FieldDef } from '@/components/form-modal';
import { toast } from '@/lib/toast';
import type { DashboardStats, ResourceKey, Row } from '@/lib/types';

const fmt = (n: number) => n.toLocaleString('zh-CN');
const pad = (n: number) => String(n).padStart(2, '0');

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

const STU_COLS: ColumnDef[] = [
  { key: 'student_no', label: '学号', type: 'text', sortable: true, sortValue: r => Number(r.student_no) || 0 },
  { key: 'name', label: '姓名', render: (v, r) => <MemberCell name={String(r.name ?? '')} sub={String(r.parent_name ?? '')} /> },
  { key: 'gender', label: '性别', type: 'select', options: ['男', '女'], filterOptions: ['男', '女'], sortable: true },
  { key: 'group_no', label: '小组', type: 'text', sortable: true, sortValue: r => Number(r.group_no) || 0 },
];

function MemberCell({ name, sub }: { name: string; sub: string }) {
  const ch = name?.trim()?.charAt(0) ?? '?';
  return (
    <div className="flex items-center gap-3">
      <Avatar size="sm">
        <Avatar.Fallback className="bg-gradient-to-br from-sky-500 to-purple-600 text-[10px] text-white">{ch}</Avatar.Fallback>
      </Avatar>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-foreground">{name}</div>
        {sub && <div className="truncate text-xs text-muted">{sub}</div>}
      </div>
    </div>
  );
}

const monthsWindow = (n: number) => {
  const now = new Date();
  const out: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: `${d.getMonth() + 1}月` });
  }
  return out;
};

const countByMonth = (rows: Row[], months: { key: string }[]) => {
  const map: Record<string, number> = {};
  months.forEach(m => { map[m.key] = 0; });
  rows.forEach(r => {
    const k = String(r.date ?? '').slice(0, 7);
    if (k in map) map[k] += 1;
  });
  return map;
};

export default function HomePage() {
  const [s, setS] = useState<DashboardStats | null>(null);
  const [tab, setTab] = useState<'overview' | 'quick'>('overview');
  const [active, setActive] = useState<QuickDef | null>(null);
  const [q, setQ] = useState('');
  const [groupMode, setGroupMode] = useState<'group' | 'level'>('group');
  const [monthsCount, setMonthsCount] = useState<number>(12);

  const { rows: students, loading: studentsLoading, reload: reloadStudents, update: updateStudent, remove: removeStudent } = useResourceRows('students');
  const { rows: parentComm, reload: reloadParent } = useResourceRows('parent_comm');
  const { rows: homeVisits, reload: reloadVisits } = useResourceRows('home_visits');

  const load = () => {
    get<DashboardStats>('/api/dashboard').then(setS).catch(() => {});
    reloadStudents();
    reloadParent();
    reloadVisits();
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (v: Record<string, string | number | null>) => {
    if (!active?.quick) return;
    try {
      await post(`/api/${active.quick.resource}`, v);
      toast.success('已记录');
      setActive(null);
    } catch { toast.error('保存失败'); }
  };

  const activeInitial = useMemo(() => {
    const obj: Record<string, string> = {};
    active?.quick?.fields.forEach(f => { if (f.type === 'date') obj[f.key] = dayjs().format('YYYY-MM-DD'); });
    return obj;
  }, [active]);

  const filteredStudents = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return students;
    return students.filter(r =>
      [String(r.name ?? ''), String(r.student_no ?? ''), String(r.parent_name ?? ''), String(r.parent_phone ?? '')]
        .some(v => v.toLowerCase().includes(t)));
  }, [students, q]);

  const cards = useMemo(() => {
    if (!s) return [];
    return [
      { title: '班级人数', value: `${s.studentCount} 人`, chip: { text: `男 ${s.maleCount} · 女 ${s.femaleCount}`, color: 'default' as const } },
      { title: '今日请假', value: `${s.todayLeaves} 人`, chip: s.todayLeaves > 0 ? { text: '需关注', color: 'danger' as const } : { text: '正常', color: 'success' as const } },
      { title: '本周违纪', value: `${s.weekDiscipline} 条`, chip: s.weekDiscipline > 0 ? { text: '有记录', color: 'danger' as const } : { text: '无', color: 'success' as const } },
      { title: '待办事项', value: `${s.todoPending} 项`, chip: s.todoPending > 0 ? { text: '未完成', color: 'warning' as const } : { text: '已清空', color: 'success' as const } },
    ];
  }, [s]);

  const months = useMemo(() => monthsWindow(monthsCount), [monthsCount]);
  const barData = useMemo(() => {
    const map: Record<string, number> = {};
    students.forEach(r => {
      const k = String(r[groupMode === 'group' ? 'group_no' : 'level'] ?? 0);
      map[k] = (map[k] ?? 0) + 1;
    });
    return Object.keys(map)
      .map(Number)
      .filter(n => !Number.isNaN(n))
      .sort((a, b) => a - b)
      .map(n => ({ name: groupMode === 'group' ? pad(n) : `L${n}`, value: map[String(n)] ?? 0 }));
  }, [students, groupMode]);

  const lineData = useMemo(() => {
    const p = countByMonth(parentComm, months);
    const v = countByMonth(homeVisits, months);
    return months.map(m => ({ month: m.label, 沟通: p[m.key] ?? 0, 家访: v[m.key] ?? 0 }));
  }, [parentComm, homeVisits, months]);
  const totalComm = useMemo(() => lineData.reduce((a, x) => a + x.沟通, 0), [lineData]);

  const exportCsv = () => {
    downloadCsv('学生名单.csv', ['学号', '姓名', '性别', '家长姓名', '家长电话', '小组'],
      students.map(r => [String(r.student_no ?? ''), String(r.name ?? ''), String(r.gender ?? ''), String(r.parent_name ?? ''), String(r.parent_phone ?? ''), String(r.group_no ?? '')]));
  };

  return (
    <div className="flex flex-col gap-5">
      <Tabs selectedKey={tab} onSelectionChange={k => setTab(k === 'quick' ? 'quick' : 'overview')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs.ListContainer className="w-fit">
            <Tabs.List aria-label="仪表盘视图">
              <Tabs.Tab id="overview">总览<Tabs.Indicator /></Tabs.Tab>
              <Tabs.Tab id="quick">常用<Tabs.Indicator /></Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="tertiary" size="sm" isIconOnly aria-label="刷新" onPress={load}>
              <RefreshCw size={16} />
            </Button>
            <Select aria-label="统计周期" selectedKey={monthsCount} onSelectionChange={k => setMonthsCount(k == null ? 12 : Number(k))}>
              <Select.Trigger className="h-8 min-h-0 px-3 py-1 text-xs font-medium">
                <Select.Value />
                <Select.Indicator className="size-3.5" />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id={3} textValue="近 3 月">近 3 月</ListBox.Item>
                  <ListBox.Item id={6} textValue="近 6 月">近 6 月</ListBox.Item>
                  <ListBox.Item id={12} textValue="近 12 月">近 12 月</ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
            <Button variant="primary" size="sm" onPress={exportCsv}>
              <Download size={16} /> 导出
            </Button>
          </div>
        </div>

        <Tabs.Panel id="overview" className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {!s ? (
              Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[100px] rounded-2xl" />)
            ) : cards.map(c => <StatCard key={c.title} title={c.title} value={c.value} chip={c.chip} />)}
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-2xl bg-surface p-5 shadow-surface">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground">学生分布</h3>
                <Select aria-label="分组方式" selectedKey={groupMode} onSelectionChange={k => setGroupMode(k === 'level' ? 'level' : 'group')}>
                  <Select.Trigger className="h-8 min-h-0 px-3 py-1 text-xs font-medium">
                    <Select.Value />
                    <Select.Indicator className="size-3.5" />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="group" textValue="按小组">按小组</ListBox.Item>
                      <ListBox.Item id="level" textValue="按学生层次">按学生层次</ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Metric value={s ? `${s.maleCount}` : '—'} label="男生" />
                <Metric value={s ? `${s.femaleCount}` : '—'} label="女生" />
                <Metric value={s ? `${s.studentCount}` : '—'} label="总人数" />
              </div>
              <div className="mt-4 h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={30} />
                    <Tooltip cursor={{ fill: 'var(--surface-hover)' }} />
                    <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl bg-surface p-5 shadow-surface">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground">家校沟通</h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <LegendDot color="var(--accent)" label="沟通" />
                    <LegendDot color="#60a5fa" label="家访" />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-col">
                <span className="text-lg font-semibold tabular-nums text-foreground">{fmt(totalComm)}</span>
                <span className="text-xs text-muted">近 {monthsCount} 月沟通次数</span>
              </div>
              <div className="mt-4 h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} width={30} />
                    <Tooltip />
                    <Line type="monotone" dataKey="沟通" stroke="var(--accent)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="家访" stroke="#60a5fa" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">学生名单</h2>
              <Chip color="default" size="sm" variant="soft">{students.length}</Chip>
              <div className="flex-1" />
              <SearchField aria-label="搜索学生" className="w-full sm:w-[220px]" onChange={setQ}>
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input placeholder="搜索…" type="search" />
                </SearchField.Group>
                <SearchField.ClearButton />
              </SearchField>
            </div>
            <DataTable
              label="学生名单"
              columns={STU_COLS}
              rows={filteredStudents}
              loading={studentsLoading}
              onSave={updateStudent}
              actions={(r) => (
                <Button variant="danger-soft" size="sm" onPress={() => void removeStudent(r.id as number).then(() => toast.success('已删除')).catch(() => toast.error('删除失败'))}>
                  删除
                </Button>
              )}
              emptyText="暂无学生"
            />
          </div>
        </Tabs.Panel>
        <Tabs.Panel id="quick">
          <div className="rounded-2xl bg-surface p-5 shadow-surface">
            <h3 className="mb-3 text-base font-semibold text-foreground">快捷操作</h3>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
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
        </Tabs.Panel>
      </Tabs>

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

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg font-semibold tabular-nums text-foreground">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="size-3 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}
