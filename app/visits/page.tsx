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
