'use client';
import { useMemo, useState } from 'react';
import { ListBox, Select, Skeleton, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import StatCard from '@/components/stat-card';
import EditableCell from '@/components/editable-cell';
import { useResourceRows } from '@/components/use-resource';
import { CategoryColor } from '@/lib/color-utils';

const SUBJECTS = ['语文', '数学', '英语'];

export default function GradesPage() {
  const { rows, loading, update } = useResourceRows('grades');
  const [exam, setExam] = useState<string | null>(null);
  const [subject, setSubject] = useState<string>('语文');

  const exams = useMemo(() => [...new Set(rows.map(r => String(r.exam_name)))], [rows]);
  const latestExam = useMemo(() => exams[exams.length - 1] ?? '', [exams]);
  const currentExam = exam ?? latestExam;

  const current = useMemo(() =>
    rows.filter(r => r.exam_name === currentExam && r.subject === subject),
    [rows, currentExam, subject]);

  const stats = useMemo(() => {
    const scores = current.map(r => Number(r.score));
    if (scores.length === 0) return [];
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const pass = Math.round((scores.filter(s => s >= 60).length / scores.length) * 1000) / 10;
    const good = Math.round((scores.filter(s => s >= 85).length / scores.length) * 1000) / 10;
    return [
      { title: '平均分', value: avg.toFixed(1) },
      { title: '及格率', value: `${pass}%` },
      { title: '优秀率(≥85)', value: `${good}%` },
      { title: '最高/最低', value: `${Math.max(...scores)} / ${Math.min(...scores)}` },
    ];
  }, [current]);

  const histogram = useMemo(() => {
    const bins = [
      { label: '<60', min: 0, max: 59 }, { label: '60-69', min: 60, max: 69 },
      { label: '70-79', min: 70, max: 79 }, { label: '80-89', min: 80, max: 89 },
      { label: '90-100', min: 90, max: 100 },
    ];
    return bins.map(b => ({ name: b.label, 人数: current.filter(r => { const s = Number(r.score); return s >= b.min && s <= b.max; }).length }));
  }, [current]);

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-800">成绩分析</h2>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          aria-label="选择考试"
          className="w-52"
          selectedKey={currentExam === '' ? '' : currentExam}
          onSelectionChange={k => setExam(k === null || k === '' ? null : String(k))}
        >
          <Select.Trigger><Select.Value /></Select.Trigger>
          <Select.Indicator />
          <Select.Popover>
            <ListBox>
              {exams.map(e => <ListBox.Item key={e} id={e}>{e || '未命名考试'}</ListBox.Item>)}
            </ListBox>
          </Select.Popover>
        </Select>
        <ToggleButtonGroup selectionMode="single" selectedKeys={new Set([subject])} onSelectionChange={(keys) => { const k = [...keys][0]; if (k) setSubject(String(k)); }}>
          {SUBJECTS.map(s => <ToggleButton key={s} id={s}>{s}</ToggleButton>)}
        </ToggleButtonGroup>
      </div>
      {loading ? <div className="space-y-3"><Skeleton className="h-10 rounded-lg" /><Skeleton className="h-40 rounded-lg" /></div> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {stats.map(s => <StatCard key={s.title} title={s.title} value={s.value} />)}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-600">分数段分布（直方图）</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height={224}>
                  <BarChart data={histogram}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="人数" fill={CategoryColor(subject)} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-600">成绩明细（点击可改）</h3>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-slate-500">
                    <tr>
                      <th className="border-b border-gray-200 px-3 py-2 text-left font-medium">姓名</th>
                      <th className="border-b border-gray-200 px-3 py-2 text-left font-medium">分数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.map(r => (
                      <tr key={r.id} className="border-b border-gray-100">
                        <td className="px-3 py-1.5">{r.student_name}</td>
                        <td className="px-3 py-1.5"><EditableCell value={r.score} type="number" onSave={v => update(r.id as number, { score: v })} /></td>
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
