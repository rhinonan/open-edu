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
