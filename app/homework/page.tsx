'use client';
import { useState } from 'react';
import CrudPage from '@/components/crud/crud-page';
import Modal from '@/components/ui/modal';
import { put } from '@/lib/api-client';
import type { Row } from '@/lib/types';
import { useToast } from '@/components/ui/toast';
import type { CrudPageConfig } from '@/components/crud/types';

function totalOf(r: Row) { return Number(r.submitted) + Number(r.late) + Number(r.missing); }

function ProgressBar({ row }: { row: Row }) {
  const total = totalOf(row);
  const pct = total > 0 ? Math.round((Number(row.submitted) / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-40">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-red-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 whitespace-nowrap">{pct}%（已交 {row.submitted} · 迟交 {row.late} · 未交 {row.missing}）</span>
    </div>
  );
}

export function CollectButton({ row, onCollect }: { row: Row; onCollect: (r: Row) => void }) {
  return <button className="text-xs text-accent hover:underline" onClick={() => onCollect(row)}>录入收缴</button>;
}

export default function HomeworkPage() {
  const { toast } = useToast();
  const [collecting, setCollecting] = useState<Row | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [reload, setReload] = useState(0);

  const config: CrudPageConfig = {
    resource: 'homework',
    title: '作业管理',
    columns: [
      { key: 'subject', label: '学科', type: 'select', options: ['语文', '数学', '英语', '科学', '道德与法治'], width: '110px' },
      { key: 'assign_date', label: '布置日期', type: 'date', width: '120px' },
      { key: 'requirement', label: '作业要求', type: 'textarea', width: '220px' },
      { key: 'deadline', label: '截止时间', type: 'date', width: '120px' },
      { key: 'submitted', label: '已交', type: 'number', width: '70px' },
      { key: 'late', label: '迟交', type: 'number', width: '70px' },
      { key: 'missing', label: '未交', type: 'number', width: '70px' },
      { key: 'missing_names', label: '未交学生', type: 'text' },
      { key: 'progress', label: '收缴进度', readOnly: true, render: r => <ProgressBar row={r} /> },
      { key: 'collect', label: '操作', readOnly: true, render: r => <CollectButton row={r} onCollect={openCollect} /> },
    ],
    stats: rows => {
      const total = rows.length;
      const avg = total > 0 ? Math.round(rows.reduce((s, r) => s + (totalOf(r) > 0 ? Number(r.submitted) / totalOf(r) : 0), 0) / total * 100) : 0;
      const missingAll = rows.reduce((s, r) => s + Number(r.missing), 0);
      return [
        { label: '累计布置作业', value: total, tone: 'blue' },
        { label: '平均提交率', value: `${avg}%`, tone: 'teal' },
        { label: '累计未交人次', value: missingAll, tone: 'red' },
      ];
    },
    defaultNewRow: () => ({ subject: '语文', assign_date: '', requirement: '', deadline: '', submitted: 0, late: 0, missing: 0, missing_names: '' }),
  };

  const openCollect = (r: Row) => { setCollecting(r); setDraft({ submitted: String(r.submitted), late: String(r.late), missing: String(r.missing) }); };

  const saveCollect = async () => {
    if (!collecting) return;
    try {
      await put(`/api/homework/${collecting.id}`, {
        submitted: Number(draft.submitted) || 0,
        late: Number(draft.late) || 0,
        missing: Number(draft.missing) || 0,
      });
      toast('已更新收缴情况');
      setCollecting(null);
      setReload(n => n + 1);
    } catch { toast('保存失败', 'err'); }
  };

  return (
    <div key={reload}>
      <CrudPage config={config} />
      <Modal title="录入收缴情况" open={!!collecting} onClose={() => setCollecting(null)}>
        <div className="grid grid-cols-3 gap-3">
          {[['submitted', '已交'], ['late', '迟交'], ['missing', '未交']].map(([k, label]) => (
            <label key={k} className="flex flex-col gap-1 text-xs text-slate-500">
              {label}
              <input type="number" className="border border-slate-300 rounded px-2 py-1.5 text-sm"
                value={draft[k] ?? ''} onChange={e => setDraft({ ...draft, [k]: e.target.value })} />
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button className="btn-primary px-4 py-1.5 text-sm" onClick={saveCollect}>保存</button>
        </div>
      </Modal>
    </div>
  );
}
