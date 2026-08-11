'use client';
import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { useEditable } from './editable-context';

export default function Topbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { editable, toggle } = useEditable();
  const [now, setNow] = useState('');
  const [className, setClassName] = useState('');
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then((rows: { key: string; value: string }[]) => {
      const c = rows.find(r => r.key === 'class_name');
      if (c) setClassName(c.value);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleString('zh-CN', { hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 bg-white/95 backdrop-blur border-b border-slate-200 px-4 h-12">
      <button onClick={onToggleSidebar} className="md:hidden text-slate-600" aria-label="打开菜单"><Menu className="w-5 h-5" /></button>
      <div className="text-sm text-slate-700 font-medium">{className || '班级工作台'}</div>
      <div className="flex-1" />
      <span className="text-xs text-slate-500 hidden sm:inline">{now}</span>
      <button onClick={toggle} className="btn-primary px-3 py-1.5 text-xs">
        {editable ? '完成' : '编辑'}
      </button>
    </header>
  );
}
