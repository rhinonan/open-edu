'use client';
import { useState } from 'react';
import { post } from '@/lib/api-client';
import { useToast } from '../ui/toast';
import Modal from '../ui/modal';
import type { ColumnDef } from './types';
import type { ResourceKey } from '@/lib/types';

interface Props {
  resource: ResourceKey;
  title: string;
  columns: ColumnDef[];
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
}

export default function QuickAddModal({ resource, title, columns, open, onClose, onDone }: Props) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const submit = async () => {
    const data: Record<string, string | number> = {};
    for (const c of columns) {
      const v = draft[c.key] ?? '';
      data[c.key] = c.type === 'number' ? Number(v) : v;
    }
    try { await post(`/api/${resource}`, data); toast('已记录'); setDraft({}); onClose(); onDone?.(); }
    catch { toast('保存失败', 'err'); }
  };
  return (
    <Modal title={title} open={open} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        {columns.map(c => (
          <label key={c.key} className="flex flex-col gap-1 text-xs text-slate-500">
            {c.label}
            <input className="border border-slate-300 rounded px-2 py-1.5 text-sm"
              type={c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'}
              value={draft[c.key] ?? ''} onChange={e => setDraft({ ...draft, [c.key]: e.target.value })} />
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn-primary px-4 py-1.5 text-sm" onClick={submit}>保存</button>
      </div>
    </Modal>
  );
}
