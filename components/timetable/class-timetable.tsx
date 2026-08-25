'use client';
import { useMemo, useState } from 'react';
import { Button } from '@heroui/react';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import PeriodSlotsModal from './period-slots-modal';
import { buildClassGrid, classStats, SUBJECTS, KIND_LABELS } from '@/lib/timetable';

const DAYS = ['周一', '周二', '周三', '周四', '周五'];

export default function ClassTimetable() {
  const { rows: slots, loading: slotLoading, reload: slotsReload } = useResourceRows('period_slots');
  const { rows: tt, loading: ttLoading, update, create, reload: ttReload } = useResourceRows('timetable');
  const [slotModalOpen, setSlotModalOpen] = useState(false);

  const ordered = useMemo(() => [...slots].sort((a, b) => Number(a.seq) - Number(b.seq)), [slots]);
  const grid = useMemo(() => buildClassGrid(ordered, tt), [ordered, tt]);
  const stats = useMemo(() => classStats(ordered, tt), [ordered, tt]);

  const saveSubject = async (weekday: number, periodId: number, subject: string | number | null) => {
    const v = String(subject ?? '');
    const isChinese = v === '语文' ? 1 : 0;
    const existing = grid.get(`${weekday}-${periodId}`);
    if (existing) await update(existing.id as number, { subject: v, is_chinese: isChinese });
    else await create({ weekday, period_id: periodId, subject: v, is_chinese: isChinese });
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="m-0 text-base font-semibold text-slate-800">班级课表</h3>
        <Button variant="outline" size="sm" onPress={() => setSlotModalOpen(true)}>时段管理</Button>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div className="text-xs text-slate-500">每周正课总课时</div>
          <div className="mt-1 text-xl font-semibold text-slate-800">{stats.total}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <div className="text-xs text-slate-500">语文任教课时</div>
          <div className="mt-1 text-xl font-semibold text-blue-600">{stats.chinese}</div>
        </div>
      </div>
      {(slotLoading || ttLoading) ? <div className="space-y-3"><div className="h-10 rounded-lg bg-gray-100 animate-pulse" /><div className="h-10 rounded-lg bg-gray-100 animate-pulse" /></div> : (
        <div className="mb-4 overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-slate-500">
                <th className="border-b border-gray-200 px-2 py-2 text-left">时段</th>
                {DAYS.map(d => <th key={d} className="border-b border-gray-200 px-2 py-2">{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {ordered.map(slot => {
                const isSubject = slot.kind === '正课';
                return (
                  <tr key={slot.id}>
                    <td className="border-b border-gray-100 px-2 py-2 whitespace-nowrap">
                      <div className="text-xs text-slate-700">{String(slot.name)}</div>
                      <div className="text-xs text-slate-400">{String(slot.start_time)}-{String(slot.end_time)}</div>
                    </td>
                    {DAYS.map(d => {
                      const wd = DAYS.indexOf(d) + 1;
                      const key = `${wd}-${slot.id}`;
                      const r = grid.get(key);
                      if (!isSubject) {
                        return <td key={key} className="border-b border-gray-100 px-2 py-2 text-center"><span className="text-xs text-slate-400">{KIND_LABELS[String(slot.kind)]}</span></td>;
                      }
                      const chinese = r && r.is_chinese == 1;
                      return (
                        <td key={key} className={`border-b border-gray-100 px-2 py-2 text-center ${chinese ? 'bg-blue-50' : ''}`}>
                          <EditableCell
                            value={r ? r.subject : null}
                            type="select"
                            options={SUBJECTS}
                            onSave={v => saveSubject(wd, Number(slot.id), v)}
                            className={chinese ? 'font-medium text-blue-700' : 'text-slate-700'}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <PeriodSlotsModal open={slotModalOpen} onClose={() => { setSlotModalOpen(false); void slotsReload(); void ttReload(); }} />
    </div>
  );
}
