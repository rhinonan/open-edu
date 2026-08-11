'use client';
import { useEffect, useMemo, useState } from 'react';
import { get, put, post } from '@/lib/api-client';
import type { Row } from '@/lib/types';
import PageHeader from '@/components/ui/page-header';
import { StatRow } from '@/components/ui/stat-card';
import Modal from '@/components/ui/modal';
import InlineEdit from '@/components/ui/inline-edit';
import { useToast } from '@/components/ui/toast';
import { CategoryColor } from '@/components/ui/color-utils';

const TYPES = ['备课', '教研', '培优', '监考', '会议', '其他'];

export default function SchedulePage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const load = () => get<Row[]>('/api/schedules').then(setRows);
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter(r => !filter || r.type === filter), [rows, filter]);

  const toggle = async (r: Row) => {
    const next = r.done == 1 ? 0 : 1;
    setRows(rows.map(x => x.id === r.id ? { ...x, done: next } : x));
    try { await put(`/api/schedules/${r.id}`, { done: next }); }
    catch { toast('保存失败', 'err'); setRows(rows); }
  };

  const update = async (id: number, patch: Partial<Row>) => {
    try { const u = await put<Row>(`/api/schedules/${id}`, patch); setRows(rows.map(r => r.id === id ? u : r)); toast('已保存'); }
    catch { toast('保存失败', 'err'); }
  };

  const submit = async () => {
    try {
      await post('/api/schedules', {
        date: draft.date ?? new Date().toISOString().slice(0, 10),
        title: draft.title ?? '',
        type: draft.type ?? '备课',
        duration_min: Number(draft.duration_min) || 60,
        done: 0,
      });
      setAddOpen(false); setDraft({}); load(); toast('已新增');
    } catch { toast('保存失败', 'err'); }
  };

  return (
    <div>
      <PageHeader title="日程安排" onAdd={() => setAddOpen(true)} />
      <StatRow stats={[
        { label: '全部任务', value: rows.length, tone: 'blue' },
        { label: '备课', value: rows.filter(r => r.type === '备课').length, tone: 'teal' },
        { label: '教研', value: rows.filter(r => r.type === '教研').length, tone: 'purple' },
        { label: '监考', value: rows.filter(r => r.type === '监考').length, tone: 'amber' },
        { label: '会议', value: rows.filter(r => r.type === '会议').length, tone: 'red' },
      ]} />
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setFilter('')} className={`px-3 py-1.5 text-xs rounded-full border ${filter === '' ? 'bg-accent text-white border-accent' : 'bg-white border-slate-300 text-slate-600'}`}>全部</button>
        {TYPES.map(t => (
          <button key={t} onClick={() => setFilter(t)} className={`px-3 py-1.5 text-xs rounded-full border ${filter === t ? 'bg-accent text-white border-accent' : 'bg-white border-slate-300 text-slate-600'}`}>{t}</button>
        ))}
      </div>
      <div className="space-y-2">
        {filtered.map(r => (
          <div key={r.id} className={`card flex items-center gap-3 px-4 py-3 ${r.done == 1 ? 'opacity-60' : ''}`}>
            <button onClick={() => toggle(r)}
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm ${r.done == 1 ? 'bg-teal-500 border-teal-500 text-white' : 'border-slate-300 text-transparent'}`}>
              ✓
            </button>
            <div className="flex-1 min-w-0">
              <div className="font-medium">
                <InlineEdit value={r.title} onSave={v => update(r.id as number, { title: v })} />
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                <span className="inline-block mr-2" style={{ color: CategoryColor(String(r.type)) }}>{String(r.type)}</span>
                <InlineEdit value={r.date} type="date" onSave={v => update(r.id as number, { date: v })} />
              </div>
            </div>
            <span className="text-xs text-slate-500 whitespace-nowrap">
              <InlineEdit value={r.duration_min} type="number" onSave={v => update(r.id as number, { duration_min: v })} />
              <span className="ml-0.5">分钟</span>
            </span>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-sm text-slate-400 py-8 text-center">暂无日程</div>}
      </div>

      <Modal title="新增日程" open={addOpen} onClose={() => setAddOpen(false)}>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-500 col-span-2">标题
            <input className="border border-slate-300 rounded px-2 py-1.5 text-sm" value={draft.title ?? ''} onChange={e => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">日期
            <input type="date" className="border border-slate-300 rounded px-2 py-1.5 text-sm" value={draft.date ?? ''} onChange={e => setDraft({ ...draft, date: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">时长(分钟)
            <input type="number" className="border border-slate-300 rounded px-2 py-1.5 text-sm" value={draft.duration_min ?? ''} onChange={e => setDraft({ ...draft, duration_min: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500 col-span-2">类型
            <select className="border border-slate-300 rounded px-2 py-1.5 text-sm" value={draft.type ?? ''} onChange={e => setDraft({ ...draft, type: e.target.value })}>
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-primary px-4 py-1.5 text-sm" onClick={submit}>保存</button>
        </div>
      </Modal>
    </div>
  );
}
