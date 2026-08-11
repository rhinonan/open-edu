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
