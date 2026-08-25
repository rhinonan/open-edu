'use client';
import { useMemo, useState } from 'react';
import { Button } from '@heroui/react';
import dayjs from 'dayjs';
import DataTable, { type ColumnDef } from '@/components/data-table';
import TableToolbar, { useColumnVisibility, type ToolbarColumn } from '@/components/table-toolbar';
import FormModal, { type FieldDef } from '@/components/form-modal';
import Confirm from '@/components/confirm';
import { useResourceRows } from '@/components/use-resource';
import { toast } from '@/lib/toast';
import type { Row } from '@/lib/types';

const WAYS = ['电话', '微信', '面谈', '通知'];
const TOOLBAR_COLS: ToolbarColumn[] = [
  { key: 'date', label: '日期' }, { key: 'student_name', label: '学生/对象' },
  { key: 'way', label: '方式' }, { key: 'content', label: '沟通内容' },
];

const COLUMNS: ColumnDef[] = [
  { key: 'date', label: '日期', type: 'date' },
  { key: 'student_name', label: '学生/对象', type: 'text' },
  { key: 'way', label: '方式', type: 'select', options: WAYS },
  { key: 'content', label: '沟通内容', type: 'textarea' },
];

const FIELDS: FieldDef[] = [
  { key: 'student_name', label: '学生/对象', required: true },
  { key: 'way', label: '方式', type: 'select', options: WAYS, initial: '微信' },
  { key: 'content', label: '沟通内容', type: 'textarea' },
];

export default function ParentCommPage() {
  const { rows, loading, update, create, remove } = useResourceRows('parent_comm');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:parent_comm');
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const columns = useMemo(() => COLUMNS.filter(c => !hidden.has(c.key)), [hidden]);

  const submit = async (v: Record<string, string | number | null>) => {
    await create({
      date: String(v.date ?? '') || dayjs().format('YYYY-MM-DD'),
      student_name: String(v.student_name ?? ''),
      way: String(v.way ?? '微信'),
      content: String(v.content ?? ''),
    });
    toast.success('已新增');
  };

  return (
    <div>
      <TableToolbar title="家校沟通" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <DataTable label="家校沟通" columns={columns} rows={rows} loading={loading} onSave={update}
        actions={(r) => <Button variant="danger-soft" size="sm" onPress={() => setDeleting(r)}>删除</Button>} />
      <FormModal title="新增沟通记录" fields={FIELDS} open={addOpen} onClose={() => setAddOpen(false)} onSubmit={submit} />
      <Confirm open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} title="删除记录" message="确定删除该记录？" confirmText="删除" danger
        onConfirm={async () => { if (!deleting) return; try { await remove(deleting.id as number); toast.success('已删除'); } catch { toast.error('删除失败'); } setDeleting(null); }} />
    </div>
  );
}
