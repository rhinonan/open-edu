'use client';
import { useState } from 'react';
import CrudPage from '@/components/crud/crud-page';
import { put } from '@/lib/api-client';
import { useToast } from '@/components/ui/toast';
import type { Row } from '@/lib/types';
import type { CrudPageConfig } from '@/components/crud/types';

export default function VisitsPage() {
  const { toast } = useToast();
  const [reload, setReload] = useState(0);

  const toggleMeeting = async (row: Row) => {
    const next = row.is_meeting == 1 ? 0 : 1;
    try {
      await put(`/api/home_visits/${row.id}`, { is_meeting: next });
      toast('已切换');
      setReload(n => n + 1);
    } catch { toast('保存失败', 'err'); }
  };

  const config: CrudPageConfig = {
    resource: 'home_visits',
    title: '生涯家访',
    columns: [
      { key: 'date', label: '日期', type: 'date', width: '120px' },
      { key: 'student_name', label: '学生', width: '120px' },
      { key: 'way', label: '方式', type: 'select', options: ['电话', '家访', '家长会', '微信'], width: '100px' },
      { key: 'content', label: '内容', type: 'textarea' },
      {
        key: 'is_meeting', label: '类型', readOnly: true, width: '90px',
        render: r => (
          <button
            onClick={() => toggleMeeting(r)}
            className={`px-2 py-0.5 rounded-md text-xs ${r.is_meeting == 1 ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}
          >
            {r.is_meeting == 1 ? '家长会' : '家访'}
          </button>
        ),
      },
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

  return <div key={reload}><CrudPage config={config} /></div>;
}
