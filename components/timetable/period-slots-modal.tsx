'use client';
import { useMemo, useState } from 'react';
import { Button, Input, Modal, Select, ListBox } from '@heroui/react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import Confirm from '@/components/confirm';
import { useResourceRows } from '@/components/use-resource';
import { toast } from '@/lib/toast';
import type { Row } from '@/lib/types';

const KINDS = ['正课', '自习', '托管', '陪餐'];

export default function PeriodSlotsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { rows, update, create, remove } = useResourceRows('period_slots');
  const [deleting, setDeleting] = useState<Row | null>(null);
  const ordered = useMemo(() => [...rows].sort((a, b) => Number(a.seq) - Number(b.seq)), [rows]);

  const patch = async (id: number, values: Partial<Row>) => {
    try { await update(id, values); }
    catch { toast.error('保存失败'); }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= ordered.length) return;
    const a = ordered[index], b = ordered[j];
    try {
      await Promise.all([
        update(a.id as number, { seq: Number(b.seq) }),
        update(b.id as number, { seq: Number(a.seq) }),
      ]);
    } catch { toast.error('保存失败'); }
  };

  const add = async () => {
    const maxSeq = ordered.reduce((m, s) => Math.max(m, Number(s.seq)), 0);
    try { await create({ seq: maxSeq + 1, name: '新时段', start_time: '', end_time: '', kind: '正课' }); }
    catch { toast.error('保存失败'); }
  };

  const doDelete = async () => {
    if (!deleting) return;
    try { await remove(deleting.id as number); toast.success('已删除'); }
    catch { toast.error('删除失败'); }
    setDeleting(null);
  };

  return (
    <Modal isOpen={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Modal.Backdrop isDismissable />
      <Modal.Container placement="center" size="md">
        <Modal.Header><Modal.Heading>时段管理</Modal.Heading></Modal.Header>
        <Modal.Body>
          <div className="space-y-2">
            {ordered.map((slot, i) => (
              <div key={slot.id} className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" isIconOnly isDisabled={i === 0} onPress={() => void move(i, -1)}><ArrowUp size={14} /></Button>
                <Button variant="outline" size="sm" isIconOnly isDisabled={i === ordered.length - 1} onPress={() => void move(i, 1)}><ArrowDown size={14} /></Button>
                <Input className="w-28" defaultValue={String(slot.name)} onBlur={e => void patch(slot.id as number, { name: e.target.value })} />
                <Input className="w-20" defaultValue={String(slot.start_time)} onBlur={e => void patch(slot.id as number, { start_time: e.target.value })} placeholder="HH:mm" />
                <Input className="w-20" defaultValue={String(slot.end_time)} onBlur={e => void patch(slot.id as number, { end_time: e.target.value })} placeholder="HH:mm" />
                <Select aria-label="时段类型" className="w-24" selectedKey={String(slot.kind)} onSelectionChange={k => void patch(slot.id as number, { kind: k === null ? '正课' : String(k) })}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Indicator />
                  <Select.Popover>
                    <ListBox>{KINDS.map(k => <ListBox.Item key={k} id={k}>{k}</ListBox.Item>)}</ListBox>
                  </Select.Popover>
                </Select>
                <Button variant="danger-soft" size="sm" isIconOnly onPress={() => setDeleting(slot)}><Trash2 size={14} /></Button>
              </div>
            ))}
          </div>
          <Button variant="outline" fullWidth className="mt-3" onPress={() => void add()}>
            <Plus size={16} /> 新增时段
          </Button>
        </Modal.Body>
      </Modal.Container>
      <Confirm open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} title="删除时段" message="删除该时段将同时删除其课表与授课行，确定？" confirmText="删除" danger onConfirm={doDelete} />
    </Modal>
  );
}
