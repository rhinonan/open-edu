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
