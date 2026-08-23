'use client';
import { useMemo, useState } from 'react';
import { Button, Card, Typography } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import PeriodSlotsModal from './period-slots-modal';
import { buildClassGrid, classStats, subjectDist, SUBJECTS, KIND_LABELS } from '@/lib/timetable';

const DAYS = ['周一', '周二', '周三', '周四', '周五'];

export default function ClassTimetable() {
  const { rows: slots, loading: slotLoading, reload: slotsReload } = useResourceRows('period_slots');
  const { rows: tt, loading: ttLoading, update, create, reload: ttReload } = useResourceRows('timetable');
  const [slotModalOpen, setSlotModalOpen] = useState(false);

  const ordered = useMemo(() => [...slots].sort((a, b) => Number(a.seq) - Number(b.seq)), [slots]);
  const grid = useMemo(() => buildClassGrid(ordered, tt), [ordered, tt]);
  const stats = useMemo(() => classStats(ordered, tt), [ordered, tt]);
  const bySubject = useMemo(() => subjectDist(tt), [tt]);

  const saveSubject = async (weekday: number, periodId: number, subject: string | number | null) => {
    const v = String(subject ?? '');
    const isChinese = v === '语文' ? 1 : 0;
    const existing = grid.get(`${weekday}-${periodId}`);
    if (existing) await update(existing.id as number, { subject: v, is_chinese: isChinese });
    else await create({ weekday, period_id: periodId, subject: v, is_chinese: isChinese });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Typography.Title level={5} style={{ margin: 0 }}>班级课表</Typography.Title>
        <Button size="small" onClick={() => setSlotModalOpen(true)}>时段管理</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card size="small"><div className="text-xs text-slate-500">每周正课总课时</div><div className="text-xl font-semibold mt-0.5">{stats.total}</div></Card>
        <Card size="small"><div className="text-xs text-slate-500">语文任教课时</div><div className="text-xl font-semibold mt-0.5 text-blue-600">{stats.chinese}</div></Card>
      </div>
      <Card size="small" className="overflow-x-auto mb-4" loading={slotLoading || ttLoading}>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-xs text-slate-500">
              <th className="px-2 py-2 text-left border-b border-gray-200">时段</th>
              {DAYS.map(d => <th key={d} className="px-2 py-2 border-b border-gray-200">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {ordered.map(slot => {
              const isSubject = slot.kind === '正课';
              return (
                <tr key={slot.id}>
                  <td className="px-2 py-2 border-b border-gray-100 whitespace-nowrap">
                    <div className="text-xs text-slate-700">{String(slot.name)}</div>
                    <div className="text-xs text-slate-400">{String(slot.start_time)}-{String(slot.end_time)}</div>
                  </td>
                  {DAYS.map(d => {
                    const wd = DAYS.indexOf(d) + 1;
                    const key = `${wd}-${slot.id}`;
                    const r = grid.get(key);
                    if (!isSubject) {
                      return <td key={key} className="px-2 py-2 border-b border-gray-100 text-center"><span className="text-xs text-slate-400">{KIND_LABELS[String(slot.kind)]}</span></td>;
                    }
                    const chinese = r && r.is_chinese == 1;
                    return (
                      <td key={key} className={`px-2 py-2 border-b border-gray-100 text-center ${chinese ? 'bg-blue-50' : ''}`}>
                        <EditableCell
                          value={r ? r.subject : null}
                          type="select"
                          options={SUBJECTS}
                          onSave={v => saveSubject(wd, Number(slot.id), v)}
                          className={chinese ? 'text-blue-700 font-medium' : 'text-slate-700'}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
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
      <PeriodSlotsModal open={slotModalOpen} onClose={() => { setSlotModalOpen(false); void slotsReload(); void ttReload(); }} />
    </div>
  );
}
