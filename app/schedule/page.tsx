'use client';
import { useMemo, useState } from 'react';
import { App, Button, Card, Checkbox, DatePicker, Form, Input, InputNumber, Modal, Segmented, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { Row } from '@/lib/types';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import { CategoryColor } from '@/lib/color-utils';
import dayjs from 'dayjs';

const TYPE_OPTS = ['全部', '备课', '教研', '培优', '监考', '会议', '其他'];
const COUNT_TYPES = ['备课', '教研', '培优', '监考', '会议'];

export default function SchedulePage() {
  const { message } = App.useApp();
  const { rows, loading, update, create } = useResourceRows('schedules');
  const [filter, setFilter] = useState('全部');
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();

  const filtered = useMemo(() => rows.filter(r => filter === '全部' || r.type === filter), [rows, filter]);

  const toggleDone = async (r: Row) => {
    const next = r.done == 1 ? 0 : 1;
    try { await update(r.id as number, { done: next }); }
    catch { message.error('保存失败'); }
  };

  const submit = async () => {
    try {
      const v = await form.validateFields();
      await create({
        date: v.date ? v.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        title: v.title ?? '', type: v.type ?? '备课', duration_min: Number(v.duration_min) || 60, done: 0,
      });
      message.success('已新增');
      setAddOpen(false); form.resetFields();
    } catch { /* 校验/请求失败 */ }
  };

  const stats = useMemo(() => [
    { label: '全部任务', value: rows.length },
    ...COUNT_TYPES.map(t => ({ label: t, value: rows.filter(r => r.type === t).length })),
  ], [rows]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <Typography.Title level={4} style={{ margin: 0 }}>日程安排</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>新增</Button>
      </div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
        {stats.map(s => (
          <Card key={s.label} size="small"><div className="text-xs text-slate-500">{s.label}</div><div className="text-xl font-semibold mt-0.5">{s.value}</div></Card>
        ))}
      </div>
      <Segmented options={TYPE_OPTS} value={filter} onChange={(v) => setFilter(String(v))} className="mb-4" />
      {loading ? <Card loading /> : (
        <div className="space-y-2">
          {filtered.map(r => (
            <Card key={r.id} size="small" className={r.done == 1 ? 'opacity-60' : ''}>
              <div className="flex items-center gap-3">
                <Checkbox checked={r.done == 1} onChange={() => void toggleDone(r)} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">
                    <EditableCell value={r.title} onSave={v => update(r.id as number, { title: v })} />
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                    <span style={{ color: CategoryColor(String(r.type)) }}>{String(r.type)}</span>
                    <EditableCell value={r.date} type="date" onSave={v => update(r.id as number, { date: v })} />
                  </div>
                </div>
                <span className="text-xs text-slate-500 whitespace-nowrap">
                  <EditableCell value={r.duration_min} type="number" onSave={v => update(r.id as number, { duration_min: v })} />
                  <span className="ml-0.5">分钟</span>
                </span>
              </div>
            </Card>
          ))}
          {filtered.length === 0 && <Card size="small"><div className="py-6 text-center text-slate-400">暂无日程</div></Card>}
        </div>
      )}
      <Modal title="新增日程" open={addOpen} onCancel={() => setAddOpen(false)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}><Input /></Form.Item>
          <Form.Item name="date" label="日期" initialValue={dayjs()}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="duration_min" label="时长(分钟)" initialValue={60}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="type" label="类型" initialValue="备课"><Segmented options={COUNT_TYPES.concat('其他')} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
