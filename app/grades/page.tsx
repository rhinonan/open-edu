'use client';
import { useMemo, useState } from 'react';
import { Card, Segmented, Select, Statistic, Typography } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import { CategoryColor } from '@/lib/color-utils';

const SUBJECTS = ['语文', '数学', '英语'];

export default function GradesPage() {
  const { rows, loading, update } = useResourceRows('grades');
  const [exam, setExam] = useState<string | undefined>(undefined);
  const [subject, setSubject] = useState('语文');

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
      <Typography.Title level={4} style={{ marginTop: 0 }}>成绩分析</Typography.Title>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select style={{ width: 200 }} value={currentExam} onChange={setExam} options={exams.map(e => ({ value: e, label: e || '未命名考试' }))} />
        <Segmented options={SUBJECTS} value={subject} onChange={(v) => setSubject(String(v))} />
      </div>
      {loading ? <Card loading /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {stats.map(s => <Card key={s.title} size="small"><Statistic title={s.title} value={s.value} /></Card>)}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Card size="small"><h3 className="mb-3 text-sm font-semibold text-slate-600" style={{ marginTop: 0 }}>分数段分布（直方图）</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histogram}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="人数" fill={CategoryColor(subject)} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card size="small"><h3 className="mb-3 text-sm font-semibold text-slate-600" style={{ marginTop: 0 }}>成绩明细（点击可改）</h3>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-slate-500">
                    <tr><th className="px-3 py-2 text-left font-medium border-b border-gray-200">姓名</th><th className="px-3 py-2 text-left font-medium border-b border-gray-200">分数</th></tr>
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
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
