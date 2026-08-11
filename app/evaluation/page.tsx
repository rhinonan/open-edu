'use client';
import { useEffect, useMemo, useState } from 'react';
import { get, put } from '@/lib/api-client';
import type { Row } from '@/lib/types';
import PageHeader from '@/components/ui/page-header';
import ChartCard from '@/components/ui/chart-card';
import InlineEdit from '@/components/ui/inline-edit';
import { CategoryColor } from '@/components/ui/color-utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const DIMS: { key: string; label: string }[] = [
  { key: 'moral', label: '品德' }, { key: 'study', label: '学习' }, { key: 'sports', label: '体育' },
  { key: 'art', label: '美育' }, { key: 'labor', label: '劳动' },
];

export default function EvaluationPage() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => { get<Row[]>('/api/evaluation').then(setRows); }, []);

  const update = async (id: number, patch: Partial<Row>) => {
    try {
      const u = await put<Row>(`/api/evaluation/${id}`, patch);
      setRows(rows.map(r => r.id === id ? u : r));
    } catch (e) {
      throw e; // 让 InlineEdit 统一弹「保存失败」（与成绩/日程页一致）
    }
  };

  const dimStats = useMemo(() => DIMS.map(d => ({
    name: d.label,
    avg: rows.length ? (rows.reduce((s, r) => s + Number(r[d.key] ?? 3), 0) / rows.length).toFixed(1) : '0',
  })), [rows]);

  return (
    <div>
      <PageHeader title="综合素质评价" onExport={() => {
        const head = ['姓名', ...DIMS.map(d => d.label)].join(',');
        const body = rows.map(r => [r.student_name, ...DIMS.map(d => r[d.key])].join(',')).join('\n');
        const blob = new Blob(['﻿' + `${head}\n${body}`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = '综合素质评价.csv'; a.click(); URL.revokeObjectURL(url);
      }} />
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <ChartCard title="各维度平均分（满分 5）">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dimStats}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 5]} />
              <Tooltip />
              <Bar dataKey="avg" fill={CategoryColor('班级管理')} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-600 mb-3">评价说明</h3>
          <p className="text-xs text-slate-500 leading-relaxed">每项按 1-5 打分（1 很差 / 5 优秀）。点击分数直接修改，实时保存。评语在表格底部。</p>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="px-3 py-2 text-left font-medium border-b border-slate-200">姓名</th>
              {DIMS.map(d => <th key={d.key} className="px-3 py-2 text-center font-medium border-b border-slate-200">{d.label}</th>)}
              <th className="px-3 py-2 text-left font-medium border-b border-slate-200">评语</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="px-3 py-1.5">{r.student_name}</td>
                {DIMS.map(d => (
                  <td key={d.key} className="px-3 py-1.5 text-center">
                    <InlineEdit value={r[d.key]} type="number" onSave={v => update(r.id as number, { [d.key]: v })} />
                  </td>
                ))}
                <td className="px-3 py-1.5">
                  <InlineEdit value={r.comment} type="text" onSave={v => update(r.id as number, { comment: v })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
