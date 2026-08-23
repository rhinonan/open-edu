'use client';
import { useMemo } from 'react';
import { Modal, Button, Input, Select, Space, Popconfirm } from 'antd';
import { UpOutlined, DownOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useResourceRows } from '@/components/use-resource';

const KINDS = ['正课', '自习', '托管', '陪餐'];

export default function PeriodSlotsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { rows, update, create, remove } = useResourceRows('period_slots');
  const ordered = useMemo(() => [...rows].sort((a, b) => Number(a.seq) - Number(b.seq)), [rows]);

  const move = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= ordered.length) return;
    const a = ordered[index], b = ordered[j];
    await Promise.all([
      update(a.id as number, { seq: Number(b.seq) }),
      update(b.id as number, { seq: Number(a.seq) }),
    ]);
  };

  const add = async () => {
    const maxSeq = ordered.reduce((m, s) => Math.max(m, Number(s.seq)), 0);
    await create({ seq: maxSeq + 1, name: '新时段', start_time: '', end_time: '', kind: '正课' });
  };

  return (
    <Modal title="时段管理" open={open} onCancel={onClose} footer={null} width={720}>
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        {ordered.map((slot, i) => (
          <Space key={slot.id} style={{ width: '100%' }} align="baseline">
            <Button size="small" icon={<UpOutlined />} disabled={i === 0} onClick={() => void move(i, -1)} />
            <Button size="small" icon={<DownOutlined />} disabled={i === ordered.length - 1} onClick={() => void move(i, 1)} />
            <Input size="small" style={{ width: 120 }} defaultValue={String(slot.name)} onBlur={e => void update(slot.id as number, { name: e.target.value })} />
            <Input size="small" style={{ width: 80 }} defaultValue={String(slot.start_time)} onBlur={e => void update(slot.id as number, { start_time: e.target.value })} placeholder="HH:mm" />
            <Input size="small" style={{ width: 80 }} defaultValue={String(slot.end_time)} onBlur={e => void update(slot.id as number, { end_time: e.target.value })} placeholder="HH:mm" />
            <Select size="small" style={{ width: 92 }} value={String(slot.kind)} options={KINDS.map(k => ({ value: k, label: k }))} onChange={v => void update(slot.id as number, { kind: v })} />
            <Popconfirm title="删除该时段将同时删除其课表与授课行，确定？" onConfirm={() => void remove(slot.id as number)}>
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        ))}
        <Button type="dashed" block icon={<PlusOutlined />} onClick={() => void add()}>新增时段</Button>
      </Space>
    </Modal>
  );
}
