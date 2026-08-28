'use client';
import { useMemo, useState } from 'react';
import { Button } from '@heroui/react';
import dayjs from 'dayjs';
import DataTable, { type ColumnDef } from '@/components/data-table';
import TableToolbar, { useColumnVisibility, type ToolbarColumn } from '@/components/table-toolbar';
import FormModal, { type FieldDef } from '@/components/form-modal';
import Confirm from '@/components/confirm';
import StatCard from '@/components/stat-card';
import { useResourceRows } from '@/components/use-resource';
import { toast } from '@/lib/toast';
import type { Row } from '@/lib/types';

const CATEGORIES = ['常规纪律', '迟到早退', '课堂表现', '课间行为', '卫生值日'];
const TOOLBAR_COLS: ToolbarColumn[] = [
  { key: 'date', label: '日期' }, { key: 'student_name', label: '学生' },
  { key: 'category', label: '类别' }, { key: 'content', label: '违纪内容' },
  { key: 'action', label: '处理方式' },
];

const COLUMNS: ColumnDef[] = [
  { key: 'date', label: '日期', type: 'date' },
  { key: 'student_name', label: '学生', type: 'text' },
  { key: 'category', label: '类别', type: 'select', options: CATEGORIES, filterOptions: CATEGORIES },
  { key: 'content', label: '违纪内容', type: 'textarea' },
  { key: 'action', label: '处理方式', type: 'text' },
];

const FIELDS: FieldDef[] = [
  { key: 'student_name', label: '学生', required: true },
  { key: 'category', label: '类别', type: 'select', options: CATEGORIES, initial: '常规纪律' },
  { key: 'content', label: '违纪内容', type: 'textarea' },
  { key: 'action', label: '处理方式' },
];

export default function DisciplinePage() {
  const { rows, loading, update, create, remove } = useResourceRows('discipline_records');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:discipline_records');
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const columns = useMemo(() => COLUMNS.filter(c => !hidden.has(c.key)), [hidden]);

  const stats = useMemo(() => [
    { title: '累计条数', value: rows.length },
    { title: '本周条数', value: rows.filter(r => String(r.date) >= dayjs().subtract(6, 'day').format('YYYY-MM-DD')).length },
  ], [rows]);

  const submit = async (v: Record<string, string | number | null>) => {
    await create({
      date: String(v.date ?? '') || dayjs().format('YYYY-MM-DD'),
      student_name: String(v.student_name ?? ''),
      category: String(v.category ?? '常规纪律'),
      content: String(v.content ?? ''),
      action: String(v.action ?? ''),
    });
    toast.success('已新增');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(s => <StatCard key={s.title} title={s.title} value={s.value} />)}
      </div>
      <TableToolbar title="违纪台账" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <DataTable label="违纪台账" columns={columns} rows={rows} loading={loading} onSave={update}
        actions={(r) => <Button variant="danger-soft" size="sm" onPress={() => setDeleting(r)}>删除</Button>} />
      <FormModal title="新增违纪" fields={FIELDS} open={addOpen} onClose={() => setAddOpen(false)} onSubmit={submit} />
      <Confirm open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} title="删除记录" message="确定删除该记录？" confirmText="删除" danger
        onConfirm={async () => { if (!deleting) return; try { await remove(deleting.id as number); toast.success('已删除'); } catch { toast.error('删除失败'); } setDeleting(null); }} />
    </div>
  );
}
