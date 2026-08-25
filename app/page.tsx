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
