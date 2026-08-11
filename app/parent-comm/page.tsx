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
