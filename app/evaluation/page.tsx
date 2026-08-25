'use client';
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import DataTable, { type ColumnDef } from '@/components/data-table';
import TableToolbar, { useColumnVisibility, type ToolbarColumn } from '@/components/table-toolbar';
import { useResourceRows } from '@/components/use-resource';
import { CategoryColor } from '@/lib/color-utils';

const DIMS = [
  { key: 'moral', label: '品德' }, { key: 'study', label: '学习' }, { key: 'sports', label: '体育' },
  { key: 'art', label: '美育' }, { key: 'labor', label: '劳动' },
];
const TOOLBAR_COLS: ToolbarColumn[] = [
  { key: 'student_name', label: '姓名' },
  ...DIMS.map(d => ({ key: d.key, label: d.label })),
  { key: 'comment', label: '评语' },
];

const COLUMNS: ColumnDef[] = [
  { key: 'student_name', label: '姓名' },
  ...DIMS.map(d => ({ key: d.key, label: d.label, type: 'number' as const, align: 'center' as const })),
  { key: 'comment', label: '评语', type: 'textarea' },
];

export default function EvaluationPage() {
  const { rows, loading, update } = useResourceRows('evaluation');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:evaluation');

  const columns = useMemo(() => COLUMNS.filter(c => !hidden.has(c.key)), [hidden]);

  const dimStats = useMemo(() => DIMS.map(d => ({
    name: d.label,
    avg: rows.length ? (rows.reduce((s, r) => s + Number(r[d.key] ?? 3), 0) / rows.length).toFixed(1) : '0',
  })), [rows]);

  return (
    <div>
      <TableToolbar title="综合素质评价" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} />
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-600">各维度平均分（满分 5）</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height={224}>
              <BarChart data={dimStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Bar dataKey="avg" fill={CategoryColor('班级管理')} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-600">评价说明</h3>
          <p className="text-xs leading-relaxed text-slate-500">每项按 1-5 打分（1 很差 / 5 优秀）。点击分数直接修改，实时保存。评语在表格底部。</p>
        </div>
      </div>
      <DataTable label="综合素质评价" columns={columns} rows={rows} loading={loading} onSave={update} />
    </div>
  );
}
