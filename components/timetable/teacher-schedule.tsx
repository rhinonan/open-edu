'use client';
import { useMemo, useState } from 'react';
import { App, Button, Card, Popconfirm, Table, Tag, Typography } from 'antd';
import type { TableProps } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useResourceRows } from '@/components/use-resource';
import TeacherScheduleModal from './teacher-schedule-modal';
import type { Row } from '@/lib/types';

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五'];

export default function TeacherSchedule() {
  const { rows: ts, loading, update, create, remove } = useResourceRows('teacher_schedule');
  const { rows: slots } = useResourceRows('period_slots');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const { message } = App.useApp();

  const slotById = useMemo(() => new Map(slots.map(s => [Number(s.id), s])), [slots]);
  const orderedSlots = useMemo(() => [...slots].sort((a, b) => Number(a.seq) - Number(b.seq)), [slots]);
  const slotLabel = (id: string | number) => { const s = slotById.get(Number(id)); return s ? `${s.name} ${s.start_time}-${s.end_time}` : `#${id}`; };
  const weekLabel = (wd: string | number) => WEEKDAYS[Number(wd) - 1] ?? String(wd);

  // 周总览：weekday × period_id 映射
  const overview = useMemo(() => {
    const m = new Map<string, Row>();
    for (const r of ts) m.set(`${Number(r.weekday)}-${Number(r.period_id)}`, r);
    return m;
  }, [ts]);

  const sorted = useMemo(() => [...ts].sort((a, b) =>
    Number(a.weekday) - Number(b.weekday)
    || Number(slotById.get(Number(a.period_id))?.seq ?? 0) - Number(slotById.get(Number(b.period_id))?.seq ?? 0)
  ), [ts, slotById]);

  const onSave = async (values: { weekday: number; period_id: number; class_name: string; subject: string; remark: string }) => {
    if (editing) await update(editing.id as number, values);
    else await create(values);
  };

  const columns: TableProps<Row>['columns'] = [
    { title: '星期', dataIndex: 'weekday', render: (v: string | number) => weekLabel(v) },
    { title: '时段', dataIndex: 'period_id', render: (v: string | number) => slotLabel(v) },
    { title: '目标班级', dataIndex: 'class_name', render: (v: string) => v || '—' },
    { title: '科目', dataIndex: 'subject', render: (v: string) => v ? <Tag color="blue">{v}</Tag> : '—' },
    { title: '备注', dataIndex: 'remark', render: (v: string) => v || '—' },
    {
      title: '操作', key: 'actions',
      render: (_: unknown, r: Row) => (
        <div className="space-x-2">
          <Button size="small" onClick={() => { setEditing(r); setModalOpen(true); }}>编辑</Button>
          <Popconfirm title="确定删除该记录？" okText="删除" cancelText="取消" onConfirm={async () => { try { await remove(r.id as number); message.success('已删除'); } catch { message.error('删除失败'); } }}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Typography.Title level={5} style={{ margin: 0 }}>我的授课</Typography.Title>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => { setEditing(null); setModalOpen(true); }}>新增授课</Button>
      </div>
      <Card size="small" className="overflow-x-auto mb-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-xs text-slate-500">
              <th className="px-2 py-2 text-left border-b border-gray-200">时段</th>
              {WEEKDAYS.map(d => <th key={d} className="px-2 py-2 border-b border-gray-200">{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {orderedSlots.map(slot => (
              <tr key={slot.id}>
                <td className="px-2 py-2 border-b border-gray-100 whitespace-nowrap">
                  <div className="text-xs text-slate-700">{String(slot.name)}</div>
                  <div className="text-xs text-slate-400">{String(slot.start_time)}-{String(slot.end_time)}</div>
                </td>
                {WEEKDAYS.map((d, idx) => {
                  const key = `${idx + 1}-${slot.id}`;
                  const r = overview.get(key);
                  return (
                    <td key={key} className="px-2 py-2 border-b border-gray-100 text-center">
                      {r ? (
                        <div>
                          <div className="text-xs text-slate-700">{String(r.class_name)}</div>
                          <div className="text-xs text-blue-600">{String(r.subject)}</div>
                        </div>
                      ) : <span className="text-xs text-slate-300">空闲</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Table rowKey="id" size="small" loading={loading} dataSource={sorted} columns={columns} pagination={false} />
      <TeacherScheduleModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} slots={slots} onSave={onSave} />
    </div>
  );
}
