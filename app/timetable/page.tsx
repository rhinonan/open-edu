'use client';
import { useMemo } from 'react';
import { Card, Typography } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useResourceRows } from '@/components/use-resource';
import type { Row } from '@/lib/types';
import EditableCell from '@/components/editable-cell';

const DAYS = ['周一', '周二', '周三', '周四', '周五'];
const PERIODS = ['早读', '正课', '正课', '正课', '中午托', '下午托'];
const SUBJECTS = ['语文', '数学', '英语', '科学', '道德与法治', '体育', '音乐', '美术', '班会', '劳动', '自习', ''];

export default function TimetablePage() {
  const { rows, loading, update } = useResourceRows('timetable');

  const grid = useMemo(() => {
    const m = new Map<string, Row>();
    const pos = new Map<number, number>();
    for (const r of rows) {
      const wd = Number(r.weekday);
      const p = pos.get(wd) ?? 0;
      pos.set(wd, p + 1);
      m.set(`${wd}-${p}`, r);
    }
    return m;
  }, [rows]);

  const stats = useMemo(() => ({
    total: rows.length,
    chinese: rows.filter(r => r.is_chinese == 1).length,
  }), [rows]);

  const bySubject = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(String(r.subject), (m.get(String(r.subject)) ?? 0) + 1);
    return [...m.entries()].map(([name, 课时]) => ({ name, 课时 })).filter(d => d.name);
  }, [rows]);

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>我的课表</Typography.Title>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card size="small"><div className="text-xs text-slate-500">每周总课时</div><div className="text-xl font-semibold mt-0.5">{stats.total}</div></Card>
        <Card size="small"><div className="text-xs text-slate-500">语文任教课时</div><div className="text-xl font-semibold mt-0.5 text-blue-600">{stats.chinese}</div></Card>
      </div>
      <Card size="small" className="overflow-x-auto mb-4" loading={loading}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-xs text-slate-500">
              <th className="px-2 py-2 text-left border-b border-gray-200">时段</th>
              {DAYS.map(d => <th key={d} className="px-2 py-2 border-b border-gray-200">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((period, i) => (
              <tr key={i}>
                <td className="px-2 py-2 border-b border-gray-100 text-xs text-slate-500 whitespace-nowrap">{period}{i > 0 && i < 4 ? i : ''}</td>
                {DAYS.map(d => {
                  const key = `${DAYS.indexOf(d) + 1}-${i}`;
                  const r = grid.get(key);
                  if (!r) return <td key={key} className="px-2 py-2 border-b border-gray-100" />;
                  const chinese = r.is_chinese == 1;
                  return (
                    <td key={key} className={`px-2 py-2 border-b border-gray-100 text-center ${chinese ? 'bg-blue-50' : ''}`}>
                      <EditableCell
                        value={r.subject}
                        type="select"
                        options={SUBJECTS}
                        onSave={v => update(r.id as number, { subject: v, is_chinese: v === '语文' ? 1 : 0 })}
                        className={chinese ? 'text-blue-700 font-medium' : 'text-slate-700'}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card size="small"><h3 className="mb-3 text-sm font-semibold text-slate-600" style={{ marginTop: 0 }}>课时分布（按学科）</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bySubject}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="课时" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}