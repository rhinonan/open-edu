'use client';
import { useMemo, useState } from 'react';
import { Button, Chip } from '@heroui/react';
import { Plus } from 'lucide-react';
import DataTable, { type ColumnDef } from '@/components/data-table';
import TeacherScheduleModal from './teacher-schedule-modal';
import Confirm from '@/components/confirm';
import { useResourceRows } from '@/components/use-resource';
import { toast } from '@/lib/toast';
import type { Row } from '@/lib/types';

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五'];

export default function TeacherSchedule() {
  const { rows: ts, loading, update, create, remove } = useResourceRows('teacher_schedule');
  const { rows: slots } = useResourceRows('period_slots');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const slotById = useMemo(() => new Map(slots.map(s => [Number(s.id), s])), [slots]);
  const orderedSlots = useMemo(() => [...slots].sort((a, b) => Number(a.seq) - Number(b.seq)), [slots]);
  const slotLabel = (id: string | number) => { const s = slotById.get(Number(id)); return s ? `${s.name} ${s.start_time}-${s.end_time}` : `#${id}`; };
  const weekLabel = (wd: string | number) => WEEKDAYS[Number(wd) - 1] ?? String(wd);

  const overview = useMemo(() => {
    const m = new Map<string, Row>();
    for (const r of ts) m.set(`${Number(r.weekday)}-${Number(r.period_id)}`, r);
    return m;
  }, [ts]);

  const sorted = useMemo(() => [...ts].sort((a, b) =>
    Number(a.weekday) - Number(b.weekday)
    || Number(slotById.get(Number(a.period_id))?.seq ?? 0) - Number(slotById.get(Number(b.period_id))?.seq ?? 0)
  ), [ts, slotById]);

  const onSave = async (v: Record<string, string | number | null>) => {
    if (editing) await update(editing.id as number, v);
    else await create(v);
  };

  const COLUMNS: ColumnDef[] = [
    { key: 'weekday', label: '星期', render: (v) => weekLabel(v as string | number) },
    { key: 'period_id', label: '时段', render: (v) => slotLabel(v as string | number) },
    { key: 'class_name', label: '目标班级', render: (v) => String(v || '—') },
    { key: 'subject', label: '科目', render: (v) => v ? <Chip size="sm" color="accent">{String(v)}</Chip> : '—' },
    { key: 'remark', label: '备注', render: (v) => String(v || '—') },
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="m-0 text-base font-semibold text-slate-800">我的授课</h3>
        <Button variant="primary" size="sm" onPress={() => { setEditing(null); setModalOpen(true); }}>
          <Plus size={16} /> 新增授课
        </Button>
      </div>
      <div className="mb-4 overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-slate-500">
              <th className="border-b border-gray-200 px-2 py-2 text-left">时段</th>
              {WEEKDAYS.map(d => <th key={d} className="border-b border-gray-200 px-2 py-2">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {orderedSlots.map(slot => (
              <tr key={slot.id}>
                <td className="border-b border-gray-100 px-2 py-2 whitespace-nowrap">
                  <div className="text-xs text-slate-700">{String(slot.name)}</div>
                  <div className="text-xs text-slate-400">{String(slot.start_time)}-{String(slot.end_time)}</div>
                </td>
                {WEEKDAYS.map((d, idx) => {
                  const key = `${idx + 1}-${slot.id}`;
                  const r = overview.get(key);
                  return (
                    <td key={key} className="border-b border-gray-100 px-2 py-2 text-center">
                      {r ? (
                        <div>
                          <div className="text-xs text-slate-700">{String(r.class_name)}</div>
                          <div className="text-xs text-blue-600">{String(r.subject)}</div>
                        </div>
                      ) : <span className="text-xs text-slate-300">空闲</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DataTable
        label="我的授课"
        columns={COLUMNS}
        rows={sorted}
        loading={loading}
        actions={(r) => (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onPress={() => { setEditing(r); setModalOpen(true); }}>编辑</Button>
            <Button variant="danger-soft" size="sm" onPress={() => setDeleting(r)}>删除</Button>
          </div>
        )}
      />
      <TeacherScheduleModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} slots={slots} onSave={onSave} />
      <Confirm open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} title="删除记录" message="确定删除该记录？" confirmText="删除" danger
        onConfirm={async () => { if (!deleting) return; try { await remove(deleting.id as number); toast.success('已删除'); } catch { toast.error('删除失败'); } setDeleting(null); }} />
    </div>
  );
}
