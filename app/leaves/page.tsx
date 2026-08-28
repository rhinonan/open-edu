'use client';
import { useMemo, useState } from 'react';
import { Button } from '@heroui/react';
import DataTable, { type ColumnDef } from '@/components/data-table';
import TableToolbar, { useColumnVisibility, type ToolbarColumn } from '@/components/table-toolbar';
import FormModal, { type FieldDef } from '@/components/form-modal';
import Confirm from '@/components/confirm';
import StatCard from '@/components/stat-card';
import { useResourceRows } from '@/components/use-resource';
import { toast } from '@/lib/toast';
import type { Row } from '@/lib/types';

const today = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};
const LEAVE_TYPES = ['事假', '病假', '公假'];
const TOOLBAR_COLS: ToolbarColumn[] = [
  { key: 'student_name', label: '学生' }, { key: 'leave_type', label: '假别' },
  { key: 'reason', label: '事由' }, { key: 'start_date', label: '开始日期' },
  { key: 'end_date', label: '结束日期' }, { key: 'hours', label: '时长(小时)' },
];

const COLUMNS: ColumnDef[] = [
  { key: 'student_name', label: '学生', type: 'text' },
  { key: 'leave_type', label: '假别', type: 'select', options: LEAVE_TYPES },
  { key: 'reason', label: '事由', type: 'textarea' },
  { key: 'start_date', label: '开始日期', type: 'date' },
  { key: 'end_date', label: '结束日期', type: 'date' },
  { key: 'hours', label: '时长(小时)', type: 'number' },
];

const FIELDS: FieldDef[] = [
  { key: 'student_name', label: '学生', required: true },
  { key: 'leave_type', label: '假别', type: 'select', options: LEAVE_TYPES, initial: '事假' },
  { key: 'reason', label: '事由', type: 'textarea' },
  { key: 'start_date', label: '开始日期', type: 'date' },
  { key: 'end_date', label: '结束日期', type: 'date' },
  { key: 'hours', label: '时长(小时)', type: 'number', initial: '8' },
];

export default function LeavesPage() {
  const { rows, loading, update, create, remove } = useResourceRows('leave_records');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:leave_records');
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const columns = useMemo(() => COLUMNS.filter(c => !hidden.has(c.key)), [hidden]);

  const stats = useMemo(() => {
    const month = today().slice(0, 7);
    const monthRows = rows.filter(r => String(r.start_date).startsWith(month));
    const sick = monthRows.filter(r => r.leave_type === '病假').length;
    return [
      { title: '累计请假记录', value: rows.length },
      { title: '当日请假', value: rows.filter(r => r.start_date === today()).length },
      { title: '本月人次', value: monthRows.length },
      { title: '本月病假占比', value: monthRows.length ? `${Math.round((sick / monthRows.length) * 100)}%` : '0%' },
    ];
  }, [rows]);

  const submit = async (v: Record<string, string | number | null>) => {
    await create({
      student_name: String(v.student_name ?? ''),
      leave_type: String(v.leave_type ?? '事假'),
      reason: String(v.reason ?? ''),
      start_date: String(v.start_date ?? '') || today(),
      end_date: String(v.end_date ?? '') || today(),
      hours: v.hours == null ? 8 : Number(v.hours),
    });
    toast.success('已新增');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(s => <StatCard key={s.title} title={s.title} value={s.value} />)}
      </div>
      <TableToolbar title="请假管理" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <DataTable label="请假管理" columns={columns} rows={rows} loading={loading} onSave={update}
        actions={(r) => <Button variant="danger-soft" size="sm" onPress={() => setDeleting(r)}>删除</Button>} />
      <FormModal title="新增请假" fields={FIELDS} open={addOpen} onClose={() => setAddOpen(false)} onSubmit={submit} />
      <Confirm open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} title="删除记录" message="确定删除该记录？" confirmText="删除" danger
        onConfirm={async () => { if (!deleting) return; try { await remove(deleting.id as number); toast.success('已删除'); } catch { toast.error('删除失败'); } setDeleting(null); }} />
    </div>
  );
}
