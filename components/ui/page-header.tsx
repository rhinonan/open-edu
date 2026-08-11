'use client';
import { useToast } from './toast';

interface Props { title: string; onAdd?: () => void; onExport?: () => void; }

export default function PageHeader({ title, onAdd, onExport }: Props) {
  const { toast } = useToast();
  return (
    <div className="flex items-center justify-between mb-4 gap-3">
      <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
      <div className="flex gap-2">
        {onExport && <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => { onExport(); toast('已导出'); }}>导出</button>}
        {onAdd && <button className="btn-primary px-3 py-1.5 text-xs" onClick={onAdd}>＋新增</button>}
      </div>
    </div>
  );
}
