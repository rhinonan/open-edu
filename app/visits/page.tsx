'use client';
import { useMemo, useState } from 'react';
import { Button, Chip } from '@heroui/react';
import dayjs from 'dayjs';
import DataTable, { type ColumnDef } from '@/components/data-table';
import TableToolbar, { useColumnVisibility, type ToolbarColumn } from '@/components/table-toolbar';
import FormModal, { type FieldDef } from '@/components/form-modal';
import Confirm from '@/components/confirm';
import StatCard from '@/components/stat-card';
import { useResourceRows } from '@/components/use-resource';
import { toast } from '@/lib/toast';
import type { Row } from '@/lib/types';

const WAYS = ['电话', '家访', '家长会', '微信'];
const TOOLBAR_COLS: ToolbarColumn[] = [
  { key: 'date', label: '日期' }, { key: 'student_name', label: '学生' },
  { key: 'way', label: '方式' }, { key: 'content', label: '内容' },
  { key: 'is_meeting', label: '类型', exportable: false },
];

// update 来自组件内 useResourceRows，故以工厂函数传入 render 闭包
const COLUMNS = (update: (id: number, patch: Partial<Row>) => Promise<void>): ColumnDef[] => [
  { key: 'date', label: '日期', type: 'date' },
  { key: 'student_name', label: '学生', type: 'text' },
  { key: 'way', label: '方式', type: 'select', options: WAYS },
  { key: 'content', label: '内容', type: 'textarea' },
  {
    key: 'is_meeting', label: '类型', align: 'center',
    render: (_, r) => {
      const meeting = r.is_meeting == 1;
      return (
        <Button variant="ghost" size="sm" onPress={async () => {
          try { await update(r.id as number, { is_meeting: meeting ? 0 : 1 }); }
          catch { toast.error('保存失败'); }
        }}>
          <Chip size="sm" color={meeting ? 'accent' : 'warning'}>{meeting ? '家长会' : '家访'}</Chip>
        </Button>
      );
    },
  },
];

const FIELDS: FieldDef[] = [
  { key: 'student_name', label: '学生', required: true },
  { key: 'way', label: '方式', type: 'select', options: WAYS, initial: '电话' },
  { key: 'content', label: '内容', type: 'textarea' },
];

export default function VisitsPage() {
  const { rows, loading, update, create, remove } = useResourceRows('home_visits');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:home_visits');
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const columns = useMemo(() => COLUMNS(update).filter(c => !hidden.has(c.key)), [hidden, update]);

  const stats = useMemo(() => {
    const visits = rows.filter(r => r.is_meeting != 1).length;
    const meetings = rows.filter(r => r.is_meeting == 1).length;
    const meetingStudents = new Set(rows.filter(r => r.is_meeting == 1).map(r => String(r.student_name))).size;
    const allStudents = new Set(rows.map(r => String(r.student_name))).size;
    const rate = allStudents > 0 ? Math.round((meetingStudents / allStudents) * 100) : 0;
    return [
      { title: '家访次数', value: visits },
      { title: '家长会场次', value: meetings },
      { title: '家长会参会率', value: `${rate}%` },
    ];
  }, [rows]);

  const submit = async (v: Record<string, string | number | null>) => {
    await create({
      date: String(v.date ?? '') || dayjs().format('YYYY-MM-DD'),
      student_name: String(v.student_name ?? ''),
      way: String(v.way ?? '电话'),
      content: String(v.content ?? ''),
      is_meeting: 0,
    });
    toast.success('已新增');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 grid grid-cols-3 gap-3">
        {stats.map(s => <StatCard key={s.title} title={s.title} value={s.value} />)}
      </div>
      <TableToolbar title="生涯家访" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <DataTable label="生涯家访" columns={columns} rows={rows} loading={loading} onSave={update}
        actions={(r) => <Button variant="danger-soft" size="sm" onPress={() => setDeleting(r)}>删除</Button>} />
      <FormModal title="新增家访记录" fields={FIELDS} open={addOpen} onClose={() => setAddOpen(false)} onSubmit={submit} />
      <Confirm open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} title="删除记录" message="确定删除该记录？" confirmText="删除" danger
        onConfirm={async () => { if (!deleting) return; try { await remove(deleting.id as number); toast.success('已删除'); } catch { toast.error('删除失败'); } setDeleting(null); }} />
    </div>
  );
}
