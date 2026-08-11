'use client';
import { useEffect, useMemo, useState } from 'react';
import { get } from '@/lib/api-client';
import type { Row } from '@/lib/types';
import CrudPage from '@/components/crud/crud-page';
import ChartCard from '@/components/ui/chart-card';
import { CategoryColor } from '@/components/ui/color-utils';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { CrudPageConfig } from '@/components/crud/types';

const WORK_TYPES = ['班级管理', '教学教研', '家校沟通', '学生培优', '生涯活动', '安全教育', '会议培训', '心理辅导'];

function WorkChart() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => { get<Row[]>('/api/work_logs').then(setRows); }, []);
  const data = useMemo(() => WORK_TYPES.map(t => ({
    name: t,
    value: rows.filter(r => r.type === t).length,
  })).filter(d => d.value > 0), [rows]);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
          {data.map((d, i) => <Cell key={i} fill={CategoryColor(d.name)} />)}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

const config: CrudPageConfig = {
  resource: 'work_logs',
  title: '工作留痕',
  columns: [
    { key: 'date', label: '日期', type: 'date', width: '120px' },
    { key: 'title', label: '工作事项', type: 'text' },
    { key: 'type', label: '类型', type: 'select', options: WORK_TYPES, width: '110px' },
    { key: 'place', label: '地点', type: 'text' },
    { key: 'hours', label: '时长(小时)', type: 'number', width: '100px' },
  ],
  stats: rows => [
    { label: '累计工作记录', value: rows.length, tone: 'blue' },
    { label: '累计时长', value: `${rows.reduce((s, r) => s + Number(r.hours), 0).toFixed(1)} 小时`, tone: 'teal' },
  ],
  defaultNewRow: () => ({ date: new Date().toISOString().slice(0, 10), title: '', type: '班级管理', place: '', hours: 1 }),
};

export default function WorkLogsPage() {
  return (
    <div>
      <div className="mb-4"><CrudPage config={config} /></div>
      <ChartCard title="工作类型分布（环形饼图）">
        <WorkChart />
      </ChartCard>
    </div>
  );
}
