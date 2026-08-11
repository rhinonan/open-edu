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
