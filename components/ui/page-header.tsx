'use client';
import { useToast } from './toast';

interface Props {
  title: string;
  onAdd?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onColumns?: () => void;
}

export default function PageHeader({ title, onAdd, onExport, onImport, onColumns }: Props) {
  const { toast } = useToast();
  return (
    <div className="flex items-center justify-between mb-4 gap-3">
      <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
      <div className="flex gap-2">
        {onColumns && <button className="bg-white border border-slate-300 text-slate-600 rounded-md hover:bg-slate-50 transition-colors px-3 py-1.5 text-xs" onClick={onColumns}>☰ 列</button>}
        {onImport && <button className="bg-white border border-slate-300 text-slate-600 rounded-md hover:bg-slate-50 transition-colors px-3 py-1.5 text-xs" onClick={onImport}>导入</button>}
        {onExport && <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => { onExport(); toast('已导出'); }}>导出</button>}
        {onAdd && <button className="btn-primary px-3 py-1.5 text-xs" onClick={onAdd}>＋新增</button>}
      </div>
    </div>
  );
}
