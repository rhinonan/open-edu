'use client';
import { Row } from '@/lib/types';
import InlineEdit from '../ui/inline-edit';
import EmptyState from '../ui/empty-state';
import type { ColumnDef } from './types';

interface Props {
  rows: Row[];
  columns: ColumnDef[];
  onUpdate: (id: number, patch: Partial<Row>) => Promise<void>;
  onDelete?: (id: number) => void;
  canDelete: boolean;
}

export default function DataTable({ rows, columns, onUpdate, onDelete, canDelete }: Props) {
  if (rows.length === 0) return <EmptyState />;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm whitespace-nowrap">
        <thead className="bg-slate-50 text-slate-500 text-xs">
          <tr>
            {columns.map(c => <th key={c.key} className="px-3 py-2 text-left font-medium border-b border-slate-200">{c.label}</th>)}
            {canDelete && <th className="px-3 py-2 border-b border-slate-200 w-10"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/60">
              {columns.map(c => (
                <td key={c.key} className="px-3 py-1.5" style={c.width ? { minWidth: c.width } : undefined}>
                  {c.render ? c.render(r) : c.readOnly ? (
                    <span className="px-1 py-0.5 block">{r[c.key] === null || r[c.key] === '' ? '—' : String(r[c.key])}</span>
                  ) : (
                    <InlineEdit
                      value={r[c.key]}
                      type={c.type}
                      options={c.options}
                      onSave={v => onUpdate(r.id as number, { [c.key]: c.nullOnEmpty && v === '' ? null : v })}
                    />
                  )}
                </td>
              ))}
              {canDelete && (
                <td className="px-2 py-1.5 text-center">
                  <button
                    className="text-slate-300 hover:text-red-500 text-base"
                    title="删除"
                    onClick={() => { if (confirm('确定删除该记录？')) onDelete?.(r.id as number); }}
                  >×</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
