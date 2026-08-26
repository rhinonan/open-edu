'use client';
import { useEffect, useState } from 'react';
import { Button, Input, Label, ListBox, Modal, Select } from '@heroui/react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import Confirm from '@/components/confirm';
import { get, post, put, del } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import { SLOT_KINDS, type TemplateSlot, type ScheduleTemplate } from '@/lib/templates';

interface TemplateBody { name: string; remark: string; slots: TemplateSlot[] }

const emptySlots = (): TemplateSlot[] => [
  { seq: 1, name: '第1节', start_time: '08:00', end_time: '08:40', kind: '正课' },
];

export default function ScheduleTemplatesManager() {
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleTemplate | null>(null);
  const [deleting, setDeleting] = useState<ScheduleTemplate | null>(null);
  const [form, setForm] = useState<TemplateBody>({ name: '', remark: '', slots: [] });
  const [error, setError] = useState('');

  const load = () => {
    get<{ templates: ScheduleTemplate[] }>('/api/schedule-templates')
      .then(r => setTemplates(r.templates))
      .catch(() => toast.error('加载模板失败'));
  };
  useEffect(() => { load(); }, []);

  const startCreate = () => {
    setEditing(null);
    setForm({ name: '', remark: '', slots: emptySlots() });
    setError('');
    setOpen(true);
  };

  const startEdit = (t: ScheduleTemplate) => {
    setEditing(t);
    setForm({ name: t.name, remark: t.remark, slots: t.slots.length ? t.slots.map(s => ({ ...s })) : emptySlots() });
    setError('');
    setOpen(true);
  };

  const patchSlot = (i: number, patch: Partial<TemplateSlot>) => {
    setForm(f => ({ ...f, slots: f.slots.map((s, idx) => idx === i ? { ...s, ...patch } : s) }));
  };

  const save = async () => {
    if (!form.name.trim()) { setError('请填写模板名称'); return; }
    if (!form.slots.length) { setError('请至少配置一个时段'); return; }
    const body: TemplateBody = {
      name: form.name.trim(),
      remark: form.remark.trim(),
      slots: form.slots.map((s, i) => ({ ...s, seq: i + 1 })),
    };
    setBusy(true);
    try {
      if (editing) { await put(`/api/schedule-templates/${editing.id}`, body); toast.success('已保存'); }
      else { await post('/api/schedule-templates', body); toast.success('已创建'); }
      setOpen(false);
      load();
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  };

  const doDelete = async () => {
    if (!deleting) return;
    try { await del(`/api/schedule-templates/${deleting.id}`); toast.success('已删除'); load(); }
    catch { toast.error('删除失败'); }
    setDeleting(null);
  };

  return (
    <div className="rounded-xl bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="m-0 text-sm font-semibold text-slate-600">作息模板</h3>
        <Button variant="primary" size="sm" onPress={startCreate} isDisabled={busy}><Plus size={16} /> 新增模板</Button>
      </div>
      <p className="mb-3 text-xs text-slate-400">新增班级时可选择作息模板，模板时段会复制进该班并可再自定义。</p>
      {templates.length === 0 ? (
        <p className="text-sm text-slate-400">暂无模板</p>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-700">{t.name}</div>
                <div className="truncate text-xs text-slate-400">{t.remark || `${t.slots.length} 个时段`}</div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" onPress={() => startEdit(t)}><Pencil size={14} /> 编辑</Button>
                <Button variant="danger-soft" size="sm" isIconOnly onPress={() => setDeleting(t)} aria-label="删除模板"><Trash2 size={14} /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={open} onOpenChange={(o) => { if (!o) setOpen(false); }}>
        <Modal.Backdrop isDismissable>
          <Modal.Container placement="center" size="lg">
            <Modal.Dialog className="w-[42rem] max-w-[92vw]">
              <Modal.Header><Modal.Heading>{editing ? '编辑作息模板' : '新增作息模板'}</Modal.Heading></Modal.Header>
              <Modal.Body>
                <div className="space-y-3">
                  <div>
                    <Label className="mb-1 block text-sm text-slate-700">模板名称</Label>
                    <Input fullWidth value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="如 夏季作息 / 冬季作息" />
                  </div>
                  <div>
                    <Label className="mb-1 block text-sm text-slate-700">备注</Label>
                    <Input fullWidth value={form.remark} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))} />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <Label className="block text-sm text-slate-700">时段（按顺序对应 seq）</Label>
                      <Button variant="outline" size="sm" onPress={() => setForm(f => ({ ...f, slots: [...f.slots, { seq: f.slots.length + 1, name: '第1节', start_time: '08:00', end_time: '08:40', kind: '正课' }] }))}>
                        <Plus size={14} /> 添加时段
                      </Button>
                    </div>
                    <div className="max-h-72 space-y-2 overflow-auto">
                      {form.slots.map((s, i) => (
                        <div key={i} className="flex flex-wrap items-center gap-2">
                          <span className="w-6 text-center text-xs text-slate-400">{i + 1}</span>
                          <Input className="w-28" value={s.name} onChange={e => patchSlot(i, { name: e.target.value })} />
                          <Input className="w-20" value={s.start_time} onChange={e => patchSlot(i, { start_time: e.target.value })} placeholder="HH:mm" />
                          <Input className="w-20" value={s.end_time} onChange={e => patchSlot(i, { end_time: e.target.value })} placeholder="HH:mm" />
                          <Select aria-label="时段类型" className="w-24" selectedKey={s.kind} onSelectionChange={k => patchSlot(i, { kind: k === null ? '正课' : String(k) })}>
                            <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
                            <Select.Popover>
                              <ListBox>{SLOT_KINDS.map(k => <ListBox.Item key={k} id={k}>{k}</ListBox.Item>)}</ListBox>
                            </Select.Popover>
                          </Select>
                          <Button variant="danger-soft" size="sm" isIconOnly onPress={() => setForm(f => ({ ...f, slots: f.slots.filter((_, idx) => idx !== i) }))} aria-label="删除时段"><Trash2 size={14} /></Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  {error && <p className="text-xs text-red-600">{error}</p>}
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setOpen(false)} isDisabled={busy}>取消</Button>
                <Button variant="primary" onPress={() => void save()} isDisabled={busy}>{busy ? '保存中…' : '保存'}</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      <Confirm open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} title="删除模板" message="删除作息模板不影响已使用它的班级，确认删除？" confirmText="删除" danger onConfirm={doDelete} />
    </div>
  );
}