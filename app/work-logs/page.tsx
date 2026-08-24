'use client';
import { useMemo, useState } from 'react';
import { App, Button, Card, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Select, Statistic, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Row } from '@/lib/types';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import TableToolbar, { useColumnVisibility } from '@/components/table-toolbar';
import { CategoryColor } from '@/lib/color-utils';
import dayjs from 'dayjs';

const WORK_TYPES = ['班级管理', '教学教研', '家校沟通', '学生培优', '生涯活动', '安全教育', '会议培训', '心理辅导'];
const TOOLBAR_COLS = [
  { key: 'date', label: '日期' }, { key: 'title', label: '工作事项' },
  { key: 'type', label: '类型' }, { key: 'place', label: '地点' },
  { key: 'hours', label: '时长(小时)' },
];

export default function WorkLogsPage() {
  const { message } = App.useApp();
  const { rows, loading, update, create, remove } = useResourceRows('work_logs');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:work_logs');
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();

  const columns: TableColumnsType<Row> = useMemo(() => [
    ...TOOLBAR_COLS.filter(c => !hidden.has(c.key)).map(c => ({
      title: c.label, dataIndex: c.key,
      render: (_: unknown, r: Row) => (
        <EditableCell
          value={r[c.key]}
          type={c.key === 'date' ? 'date' : c.key === 'type' ? 'select' : c.key === 'hours' ? 'number' : 'text'}
          options={c.key === 'type' ? WORK_TYPES : undefined}
          onSave={v => update(r.id as number, { [c.key]: v })}
        />
      ),
    })),
    {
      title: '操作', key: 'op', width: 64, fixed: 'right', exportable: false,
      render: (_: unknown, r: Row) => (
        <Popconfirm title="确定删除该记录？" okText="删除" cancelText="取消" onConfirm={async () => { try { await remove(r.id as number); message.success('已删除'); } catch { message.error('删除失败'); } }}>
          <Button type="link" danger size="small">删除</Button>
        </Popconfirm>
      ),
    },
  ], [hidden, update, remove, message]);

  const stats = useMemo(() => [
    { title: '累计工作记录', value: rows.length },
    { title: '累计时长', value: rows.reduce((s, r) => s + Number(r.hours), 0).toFixed(1) },
  ], [rows]);

  const pieData = useMemo(() => WORK_TYPES.map(t => ({
    name: t,
    value: rows.filter(r => r.type === t).length,
  })).filter(d => d.value > 0), [rows]);

  const submit = async () => {
    try {
      const v = await form.validateFields();
      await create({ date: v.date ? v.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'), title: v.title ?? '', type: v.type ?? '班级管理', place: v.place ?? '', hours: v.hours ?? 1 });
      message.success('已新增');
      setAddOpen(false); form.resetFields();
    } catch { /* 校验/请求失败 */ }
  };

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {stats.map(s => <Card key={s.title} size="small"><Statistic title={s.title} value={s.value} suffix={s.title.includes('时长') ? '小时' : ''} /></Card>)}
      </div>
      <TableToolbar title="工作留痕" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <Table<Row> rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle" pagination={false} scroll={{ x: 'max-content' }} />
      <Card size="small" className="mt-4"><h3 className="mb-3 text-sm font-semibold text-slate-600" style={{ marginTop: 0 }}>工作类型分布（环形饼图）</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height={224}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {pieData.map((d, i) => <Cell key={i} fill={CategoryColor(d.name)} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Modal title="新增工作记录" open={addOpen} onCancel={() => setAddOpen(false)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="工作事项" rules={[{ required: true, message: '请输入事项' }]}><Input /></Form.Item>
          <Form.Item name="type" label="类型" initialValue="班级管理"><Select options={WORK_TYPES.map(v => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item name="date" label="日期" initialValue={dayjs()}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="place" label="地点"><Input /></Form.Item>
          <Form.Item name="hours" label="时长(小时)" initialValue={1}><InputNumber min={0} step={0.5} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
