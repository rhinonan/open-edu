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

const EFFECTS = ['有改善', '需持续跟进', '已解决'];
const TOOLBAR_COLS: ToolbarColumn[] = [
  { key: 'date', label: '日期' }, { key: 'student_name', label: '学生' },
  { key: 'topic', label: '主题' }, { key: 'content', label: '内容' },
  { key: 'effect', label: '谈话效果' },
];

const COLUMNS: ColumnDef[] = [
  { key: 'date', label: '日期', type: 'date' },
  { key: 'student_name', label: '学生', type: 'text' },
  { key: 'topic', label: '主题', type: 'text' },
  { key: 'content', label: '内容', type: 'textarea' },
  { key: 'effect', label: '谈话效果', type: 'select', options: EFFECTS },
];

const FIELDS: FieldDef[] = [
  { key: 'student_name', label: '学生', required: true },
  { key: 'topic', label: '主题' },
  { key: 'content', label: '内容', type: 'textarea' },
  { key: 'effect', label: '谈话效果', type: 'select', options: EFFECTS, initial: '需持续跟进' },
];

export default function ConversationsPage() {
  const { rows, loading, update, create, remove } = useResourceRows('conversations');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:conversations');
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const columns = useMemo(() => COLUMNS.filter(c => !hidden.has(c.key)), [hidden]);

  const submit = async (v: Record<string, string | number | null>) => {
    await create({
      date: String(v.date ?? '') || dayjs().format('YYYY-MM-DD'),
      student_name: String(v.student_name ?? ''),
      topic: String(v.topic ?? ''),
      content: String(v.content ?? ''),
      effect: String(v.effect ?? '需持续跟进'),
    });
    toast.success('已新增');
  };

  return (
    <div>
      <TableToolbar title="谈话记录" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <DataTable label="谈话记录" columns={columns} rows={rows} loading={loading} onSave={update}
        actions={(r) => <Button variant="danger-soft" size="sm" onPress={() => setDeleting(r)}>删除</Button>} />
      <FormModal title="新增谈话记录" fields={FIELDS} open={addOpen} onClose={() => setAddOpen(false)} onSubmit={submit} />
      <Confirm open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} title="删除记录" message="确定删除该记录？" confirmText="删除" danger
        onConfirm={async () => { if (!deleting) return; try { await remove(deleting.id as number); toast.success('已删除'); } catch { toast.error('删除失败'); } setDeleting(null); }} />
    </div>
  );
}
