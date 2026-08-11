'use client';
import { useEffect, useMemo, useState } from 'react';
import { get, put } from '@/lib/api-client';
import type { Row } from '@/lib/types';
import PageHeader from '@/components/ui/page-header';
import { StatRow } from '@/components/ui/stat-card';
import ChartCard from '@/components/ui/chart-card';
import InlineEdit from '@/components/ui/inline-edit';
import { CategoryColor } from '@/components/ui/color-utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const SUBJECTS = ['语文', '数学', '英语'];

export default function GradesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [exam, setExam] = useState('');
  const [subject, setSubject] = useState('语文');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<Row[]>('/api/grades').then(rs => {
      setRows(rs);
      const exams = [...new Set(rs.map(r => String(r.exam_name)))];
      setExam(exams[0] ?? '');
      setLoading(false);
    });
  }, []);

  const exams = useMemo(() => [...new Set(rows.map(r => String(r.exam_name)))], [rows]);
  const current = useMemo(() =>
    rows.filter(r => r.exam_name === exam && r.subject === subject),
  [rows, exam, subject]);

  const stats = useMemo(() => {
    const scores = current.map(r => Number(r.score));
    if (scores.length === 0) return [];
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const pass = scores.filter(s => s >= 60).length;
    const good = scores.filter(s => s >= 85).length;
    return [
      { label: '平均分', value: avg.toFixed(1), tone: 'blue' as const },
      { label: '及格率', value: `${((pass / scores.length) * 100).toFixed(1)}%`, tone: 'teal' as const },
      { label: '优秀率(≥85)', value: `${((good / scores.length) * 100).toFixed(1)}%`, tone: 'purple' as const },
      { label: '最高/最低', value: `${Math.max(...scores)} / ${Math.min(...scores)}`, tone: 'amber' as const },
    ];
  }, [current]);

  const histogram = useMemo(() => {
    const bins = [
      { label: '<60', min: 0, max: 59 }, { label: '60-69', min: 60, max: 69 },
      { label: '70-79', min: 70, max: 79 }, { label: '80-89', min: 80, max: 89 },
      { label: '90-100', min: 90, max: 100 },
    ];
    return bins.map(b => ({ name: b.label, 人数: current.filter(r => {
      const s = Number(r.score); return s >= b.min && s <= b.max;
    }).length }));
  }, [current]);

  const updateScore = async (id: number, score: string | number) => {
    const prev = rows;
    setRows(rows.map(r => r.id === id ? { ...r, score } : r));
    try { const u = await put<Row>(`/api/grades/${id}`, { score }); setRows(rows.map(r => r.id === id ? u : r)); }
    catch { setRows(prev); }
  };

  return (
    <div>
      <PageHeader title="成绩分析" onExport={() => {
        const lines = current.map(r => `${r.student_name},${r.score}`).join('\n');
        const blob = new Blob(['﻿' + `姓名,分数\n${lines}`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${exam}-${subject}.csv`; a.click();
        URL.revokeObjectURL(url);
      }} />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={exam} onChange={e => setExam(e.target.value)} className="border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white">
          {exams.map(e => <option key={e} value={e}>{e || '未命名考试'}</option>)}
        </select>
        <div className="flex gap-1">
          {SUBJECTS.map(s => (
            <button key={s} onClick={() => setSubject(s)}
              className={`px-3 py-1.5 text-sm rounded-md border ${subject === s ? 'bg-accent text-white border-accent' : 'bg-white border-slate-300 text-slate-600'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>
      {loading ? <div className="text-sm text-slate-400 py-8 text-center">加载中…</div> : (
        <>
          <StatRow stats={stats} />
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <ChartCard title="分数段分布（直方图）">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogram}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="人数" fill={CategoryColor(subject)} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-slate-600 mb-3">成绩明细（点击可改）</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500 text-xs">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium border-b border-slate-200">姓名</th>
                      <th className="px-3 py-2 text-left font-medium border-b border-slate-200">分数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.map(r => (
                      <tr key={r.id} className="border-b border-slate-100">
                        <td className="px-3 py-1.5">{r.student_name}</td>
                        <td className="px-3 py-1.5">
                          <InlineEdit value={r.score} type="number" onSave={v => updateScore(r.id as number, v)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
