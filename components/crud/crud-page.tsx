'use client';
import { useEffect, useMemo, useState } from 'react';
import { Row } from '@/lib/types';
import { get, post, put, del } from '@/lib/api-client';
import { exportCsv } from '@/lib/csv';
import PageHeader from '../ui/page-header';
import { StatRow } from '../ui/stat-card';
import Modal from '../ui/modal';
import DataTable from './data-table';
import { useToast } from '../ui/toast';
import type { CrudPageConfig } from './types';

export default function CrudPage({ config }: { config: CrudPageConfig }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Record<string, string>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    get<Row[]>(`/api/${config.resource}`).then(r => { setRows(r); setLoading(false); });
  }, [config.resource]);

  const filtered = useMemo(() => rows.filter(r =>
    Object.entries(filter).every(([k, v]) => !v || String(r[k]) === v)
  ), [rows, filter]);

  const handleUpdate = async (id: number, patch: Partial<Row>) => {
    const prev = rows;
    setRows(rows.map(r => r.id === id ? ({ ...r, ...patch } as Row) : r));
    try { const updated = await put<Row>(`/api/${config.resource}/${id}`, patch); setRows(rows.map(r => r.id === id ? updated : r)); }
    catch { setRows(prev); }
  };

  const handleCreate = async () => {
    const defaults = config.defaultNewRow?.() ?? {};
    const data: Partial<Row> = { ...defaults };
    for (const c of config.columns) {
      if (!c.readOnly && !(c.key in data) && draft[c.key] !== undefined) data[c.key] = draft[c.key];
    }
    try {
      const row = await post<Row>(`/api/${config.resource}`, data);
      setRows([...rows, row]);
      setAddOpen(false);
      setDraft({});
      toast('已新增');
    } catch { toast('新增失败', 'err'); }
  };

  const handleDelete = async (id: number) => {
    try { await del(`/api/${config.resource}/${id}`); setRows(rows.filter(r => r.id !== id)); toast('已删除'); }
    catch { toast('删除失败', 'err'); }
  };

  const onExport = () => exportCsv(filtered, config.columns, `${config.title}.csv`);

  return (
    <div>
      <PageHeader title={config.title} onAdd={() => setAddOpen(true)} onExport={onExport} />
      {config.stats && <StatRow stats={config.stats(filtered)} />}
      {config.filters && (
        <div className="flex flex-wrap gap-2 mb-3">
          {config.filters.map(f => (
            <select key={f.key} value={filter[f.key] ?? ''} onChange={e => setFilter({ ...filter, [f.key]: e.target.value })}
              className="border border-slate-300 rounded-md px-2 py-1 text-xs bg-white">
              <option value="">全部{f.label}</option>
              {f.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}
        </div>
      )}
      {loading ? <div className="text-sm text-slate-400 py-8 text-center">加载中…</div> : (
        <DataTable rows={filtered} columns={config.columns} onUpdate={handleUpdate} onDelete={handleDelete} canDelete={config.canDelete ?? true} />
      )}

      <Modal title={`新增${config.title.replace(/管理$/, '')}`} open={addOpen} onClose={() => setAddOpen(false)}>
        <div className="grid grid-cols-2 gap-3">
          {config.columns.filter(c => !c.readOnly).map(c => (
            <label key={c.key} className="flex flex-col gap-1 text-xs text-slate-500">
              {c.label}
              {c.type === 'select' ? (
                <select className="border border-slate-300 rounded px-2 py-1.5 text-sm" value={draft[c.key] ?? ''}
                  onChange={e => setDraft({ ...draft, [c.key]: e.target.value })}>
                  <option value="">请选择</option>
                  {c.options?.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input className="border border-slate-300 rounded px-2 py-1.5 text-sm"
                  type={c.type === 'number' ? 'number' : 'text'}
                  value={draft[c.key] ?? ''} onChange={e => setDraft({ ...draft, [c.key]: e.target.value })} />
              )}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-primary px-4 py-1.5 text-sm" onClick={handleCreate}>保存</button>
        </div>
      </Modal>
    </div>
  );
}
