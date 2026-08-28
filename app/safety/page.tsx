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

const CATEGORIES = ['课间', '交通', '食品', '消防', '防溺水', '其他'];
const TOOLBAR_COLS: ToolbarColumn[] = [
  { key: 'date', label: '日期' }, { key: 'category', label: '类别' },
  { key: 'content', label: '内容' }, { key: 'action', label: '处理情况' },
];

const COLUMNS: ColumnDef[] = [
  { key: 'date', label: '日期', type: 'date' },
  { key: 'category', label: '类别', type: 'select', options: CATEGORIES, filterOptions: CATEGORIES },
  { key: 'content', label: '内容', type: 'textarea' },
  { key: 'action', label: '处理情况', type: 'text' },
];

const FIELDS: FieldDef[] = [
  { key: 'category', label: '类别', type: 'select', options: CATEGORIES, initial: '课间' },
  { key: 'content', label: '内容', type: 'textarea' },
  { key: 'action', label: '处理情况' },
];

export default function SafetyPage() {
  const { rows, loading, update, create, remove } = useResourceRows('safety_logs');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:safety_logs');
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const columns = useMemo(() => COLUMNS.filter(c => !hidden.has(c.key)), [hidden]);

  const submit = async (v: Record<string, string | number | null>) => {
    await create({
      date: String(v.date ?? '') || dayjs().format('YYYY-MM-DD'),
      category: String(v.category ?? '课间'),
      content: String(v.content ?? ''),
      action: String(v.action ?? ''),
    });
    toast.success('已新增');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TableToolbar title="安全台账" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <DataTable label="安全台账" columns={columns} rows={rows} loading={loading} onSave={update}
        actions={(r) => <Button variant="danger-soft" size="sm" onPress={() => setDeleting(r)}>删除</Button>} />
      <FormModal title="新增安全记录" fields={FIELDS} open={addOpen} onClose={() => setAddOpen(false)} onSubmit={submit} />
      <Confirm open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} title="删除记录" message="确定删除该记录？" confirmText="删除" danger
        onConfirm={async () => { if (!deleting) return; try { await remove(deleting.id as number); toast.success('已删除'); } catch { toast.error('删除失败'); } setDeleting(null); }} />
    </div>
  );
}
