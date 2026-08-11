'use client';
import { useEffect, useState } from 'react';
import { get, put, post } from '@/lib/api-client';
import type { Row } from '@/lib/types';
import PageHeader from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';

const KEYS: { key: string; label: string }[] = [
  { key: 'class_name', label: '班级名称' },
  { key: 'head_teacher', label: '班主任' },
  { key: 'grade_band', label: '年级班次' },
  { key: 'total_count', label: '总人数' },
  { key: 'male_count', label: '男生数' },
  { key: 'female_count', label: '女生数' },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get<Row[]>('/api/settings').then(rs => {
      setRows(rs);
      const m: Record<string, string> = {};
      for (const r of rs) m[String(r.key)] = String(r.value ?? '');
      setForm(m);
    });
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      for (const r of rows) {
        if (!KEYS.some(k => k.key === r.key)) continue;
        await put(`/api/settings/${r.id}`, { value: form[String(r.key)] ?? '' });
      }
      toast('已保存');
    } catch { toast('保存失败', 'err'); }
    setBusy(false);
  };

  const reset = async () => {
    if (!confirm('将清空全部演示数据并重新生成，确认？')) return;
    setBusy(true);
    try { await post('/api/reset', {}); toast('已重置'); setBusy(false); location.reload(); }
    catch { toast('重置失败', 'err'); setBusy(false); }
  };

  const backup = () => {
    window.open('/api/backup', '_blank');
  };

  return (
    <div>
      <PageHeader title="系统设置" />
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-600 mb-3">班级基础信息</h3>
          <div className="grid grid-cols-2 gap-3">
            {KEYS.map(k => (
              <label key={k.key} className="flex flex-col gap-1 text-xs text-slate-500">
                {k.label}
                <input className="border border-slate-300 rounded px-2 py-1.5 text-sm"
                  value={form[k.key] ?? ''} onChange={e => setForm({ ...form, [k.key]: e.target.value })} />
              </label>
            ))}
          </div>
          <button className="btn-primary px-4 py-1.5 text-sm mt-4" onClick={save} disabled={busy}>保存</button>
        </div>
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-slate-600 mb-3">数据维护</h3>
            <div className="flex flex-col gap-2">
              <button className="btn-primary px-4 py-2 text-sm" onClick={reset} disabled={busy}>重置种子数据（重新随机生成）</button>
              <button className="btn-primary px-4 py-2 text-sm" onClick={backup}>备份数据库（下载 app.db）</button>
            </div>
            <p className="text-xs text-slate-400 mt-3">演示数据均为随机生成的匿名姓名，用于保护学生隐私。</p>
          </div>
        </div>
      </div>
    </div>
  );
}
