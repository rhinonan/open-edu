'use client';
import { useMemo, useState } from 'react';
import { Button } from '@heroui/react';
import dayjs from 'dayjs';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import DataTable, { type ColumnDef } from '@/components/data-table';
import TableToolbar, { useColumnVisibility, type ToolbarColumn } from '@/components/table-toolbar';
import FormModal, { type FieldDef } from '@/components/form-modal';
import Confirm from '@/components/confirm';
import StatCard from '@/components/stat-card';
import { useResourceRows } from '@/components/use-resource';
import { CategoryColor } from '@/lib/color-utils';
import { toast } from '@/lib/toast';
import type { Row } from '@/lib/types';

const WORK_TYPES = ['班级管理', '教学教研', '家校沟通', '学生培优', '生涯活动', '安全教育', '会议培训', '心理辅导'];
const TOOLBAR_COLS: ToolbarColumn[] = [
  { key: 'date', label: '日期' }, { key: 'title', label: '工作事项' },
  { key: 'type', label: '类型' }, { key: 'place', label: '地点' },
  { key: 'hours', label: '时长(小时)' },
];

const COLUMNS: ColumnDef[] = [
  { key: 'date', label: '日期', type: 'date' },
  { key: 'title', label: '工作事项', type: 'text' },
  { key: 'type', label: '类型', type: 'select', options: WORK_TYPES },
  { key: 'place', label: '地点', type: 'text' },
  { key: 'hours', label: '时长(小时)', type: 'number' },
];

const FIELDS: FieldDef[] = [
  { key: 'title', label: '工作事项', required: true },
  { key: 'type', label: '类型', type: 'select', options: WORK_TYPES, initial: '班级管理' },
  { key: 'date', label: '日期', type: 'date' },
  { key: 'place', label: '地点' },
  { key: 'hours', label: '时长(小时)', type: 'number', initial: '1' },
];

export default function WorkLogsPage() {
  const { rows, loading, update, create, remove } = useResourceRows('work_logs');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:work_logs');
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const columns = useMemo(() => COLUMNS.filter(c => !hidden.has(c.key)), [hidden]);

  const stats = useMemo(() => [
    { title: '累计工作记录', value: rows.length },
    { title: '累计时长', value: rows.reduce((s, r) => s + Number(r.hours), 0).toFixed(1), suffix: '小时' },
  ], [rows]);

  const pieData = useMemo(() => WORK_TYPES.map(t => ({
    name: t,
    value: rows.filter(r => r.type === t).length,
  })).filter(d => d.value > 0), [rows]);

  const submit = async (v: Record<string, string | number | null>) => {
    await create({
      date: String(v.date ?? '') || dayjs().format('YYYY-MM-DD'),
      title: String(v.title ?? ''),
      type: String(v.type ?? '班级管理'),
      place: String(v.place ?? ''),
      hours: v.hours == null ? 1 : Number(v.hours),
    });
    toast.success('已新增');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(s => <StatCard key={s.title} title={s.title} value={s.value} suffix={s.suffix} />)}
      </div>
      <TableToolbar title="工作留痕" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <DataTable label="工作留痕" columns={columns} rows={rows} loading={loading} onSave={update}
        actions={(r) => <Button variant="danger-soft" size="sm" onPress={() => setDeleting(r)}>删除</Button>} />
      <div className="mt-4 rounded-xl bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-600">工作类型分布（环形饼图）</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height={224}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {pieData.map((d, i) => <Cell key={i} fill={CategoryColor(d.name)} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <FormModal title="新增工作记录" fields={FIELDS} open={addOpen} onClose={() => setAddOpen(false)} onSubmit={submit} />
      <Confirm open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} title="删除记录" message="确定删除该记录？" confirmText="删除" danger
        onConfirm={async () => { if (!deleting) return; try { await remove(deleting.id as number); toast.success('已删除'); } catch { toast.error('删除失败'); } setDeleting(null); }} />
    </div>
  );
}
