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
      { label: '本月人次', value: monthRows.length, tone: 'teal' },
      { label: '本月病假占比', value: monthRows.length ? `${Math.round((sick / monthRows.length) * 100)}%` : '0%', tone: 'teal' },
    ];
  },
  defaultNewRow: () => ({ student_name: '', leave_type: '事假', reason: '', start_date: today(), end_date: today(), hours: 8 }),
};

export default function LeavesPage() {
  return <CrudPage config={config} />;
}
