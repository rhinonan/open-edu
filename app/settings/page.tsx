'use client';
import { useEffect, useState } from 'react';
import { Button, Input, Label } from '@heroui/react';
import Confirm from '@/components/confirm';
import { get, post, put } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import type { Row } from '@/lib/types';

interface Me { user: { name: string; role: string; class_id: number | null }; class: { id: number; name: string; head_teacher: string; grade_band: string } | null }

export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [cls, setCls] = useState({ name: '', head_teacher: '', grade_band: '' });

  useEffect(() => {
    get<Me>('/api/me').then(m => {
      setMe(m);
      if (m.class) setCls({ name: m.class.name, head_teacher: m.class.head_teacher, grade_band: m.class.grade_band });
    });
  }, []);

  const saveClass = async () => {
    const c = me?.class;
    if (!c) { toast.warning('当前账号无关联班级'); return; }
    setBusy(true);
    try { await put<Row>(`/api/classes/${c.id}`, cls); toast.success('已保存'); }
    catch { toast.error('保存失败'); }
    setBusy(false);
  };

  const reset = async () => {
    setBusy(true);
    try { await post('/api/reset', {}); toast.success('已重置本班数据'); location.reload(); }
    catch { toast.error('重置失败'); setBusy(false); }
  };

  const isAdmin = me?.user?.role === 'admin';
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-800">系统设置</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-600">班级基础信息</h3>
          <div className="space-y-3">
            <div><Label className="mb-1 block text-sm text-slate-700">班级名称</Label><Input fullWidth value={cls.name} onChange={e => setCls(c => ({ ...c, name: e.target.value }))} /></div>
            <div><Label className="mb-1 block text-sm text-slate-700">班主任</Label><Input fullWidth value={cls.head_teacher} onChange={e => setCls(c => ({ ...c, head_teacher: e.target.value }))} /></div>
            <div><Label className="mb-1 block text-sm text-slate-700">年级班次</Label><Input fullWidth value={cls.grade_band} onChange={e => setCls(c => ({ ...c, grade_band: e.target.value }))} /></div>
            <Button variant="primary" size="sm" onPress={saveClass} isDisabled={!me?.class || busy}>{busy ? '保存中…' : '保存'}</Button>
          </div>
        </div>
        {(isAdmin || me?.user?.class_id) && (
          <div className="space-y-4">
            <div className="rounded-xl bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-600">数据维护</h3>
              <div className="flex flex-col gap-2">
                {me?.user?.class_id && (
                  <Button variant="danger" size="sm" onPress={() => setResetOpen(true)} isDisabled={busy}>重置本班种子数据</Button>
                )}
                {isAdmin && (
                  <Button variant="outline" size="sm" onPress={() => window.open('/api/backup', '_blank')}>备份数据库（下载 app.db）</Button>
                )}
              </div>
              <p className="mt-3 text-xs text-slate-400">演示数据均为随机生成的匿名姓名，用于保护学生隐私。</p>
            </div>
          </div>
        )}
      </div>
      <Confirm open={resetOpen} onOpenChange={setResetOpen} title="重置数据" message="将清空本班演示数据并重新生成，确认？" confirmText="重置" danger onConfirm={reset} />
    </div>
  );
}
