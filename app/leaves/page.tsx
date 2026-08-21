'use client';
import { useMemo, useState } from 'react';
import { App, Button, Card, DatePicker, Form, Input, InputNumber, Modal, Select, Statistic, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import type { Row } from '@/lib/types';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import TableToolbar, { useColumnVisibility } from '@/components/table-toolbar';
import dayjs from 'dayjs';

const today = () => dayjs().format('YYYY-MM-DD');
const LEAVE_TYPES = ['事假', '病假', '公假'];
const TOOLBAR_COLS = [
  { key: 'student_name', label: '学生' }, { key: 'leave_type', label: '假别' },
  { key: 'reason', label: '事由' }, { key: 'start_date', label: '开始日期' },
  { key: 'end_date', label: '结束日期' }, { key: 'hours', label: '时长(小时)' },
];

export default function LeavesPage() {
  const { message } = App.useApp();
  const { rows, loading, update, create, remove } = useResourceRows('leave_records');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:leave_records');
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();

  const columns: TableColumnsType<Row> = useMemo(() => [
    ...TOOLBAR_COLS.filter(c => !hidden.has(c.key)).map(c => ({
      title: c.label, dataIndex: c.key,
      render: (_: unknown, r: Row) => (
        <EditableCell
          value={r[c.key]}
          type={c.key === 'leave_type' ? 'select' : (c.key === 'start_date' || c.key === 'end_date') ? 'date' : c.key === 'reason' ? 'textarea' : c.key === 'hours' ? 'number' : 'text'}
          options={c.key === 'leave_type' ? LEAVE_TYPES : undefined}
          onSave={v => update(r.id as number, { [c.key]: v })}
        />
      ),
    })),
    {
      title: '操作', key: 'op', width: 64, fixed: 'right', exportable: false,
      render: (_: unknown, r: Row) => (
        <Button type="link" danger size="small" onClick={async () => {
          try { await remove(r.id as number); message.success('已删除'); } catch { message.error('删除失败'); }
        }}>删除</Button>
      ),
    },
  ], [hidden, update, remove, message]);

  const stats = useMemo(() => {
    const month = today().slice(0, 7);
    const monthRows = rows.filter(r => String(r.start_date).startsWith(month));
    const sick = monthRows.filter(r => r.leave_type === '病假').length;
    return [
      { title: '累计请假记录', value: rows.length },
      { title: '当日请假', value: rows.filter(r => r.start_date === today()).length },
      { title: '本月人次', value: monthRows.length },
      { title: '本月病假占比', value: monthRows.length ? `${Math.round((sick / monthRows.length) * 100)}%` : '0%' },
    ];
  }, [rows]);

  const submit = async () => {
    try {
      const v = await form.validateFields();
      await create({
        student_name: v.student_name ?? '', leave_type: v.leave_type ?? '事假', reason: v.reason ?? '',
        start_date: v.start_date ? v.start_date.format('YYYY-MM-DD') : today(),
        end_date: v.end_date ? v.end_date.format('YYYY-MM-DD') : today(), hours: v.hours ?? 8,
      });
      message.success('已新增');
      setAddOpen(false); form.resetFields();
    } catch { /* 校验/请求失败 */ }
  };

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {stats.map(s => <Card key={s.title} size="small"><Statistic title={s.title} value={s.value} /></Card>)}
      </div>
      <TableToolbar title="请假管理" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <Table<Row> rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle" pagination={false} scroll={{ x: 'max-content' }} />
      <Modal title="新增请假" open={addOpen} onCancel={() => setAddOpen(false)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="student_name" label="学生" rules={[{ required: true, message: '请输入学生' }]}><Input /></Form.Item>
          <Form.Item name="leave_type" label="假别" initialValue="事假"><Select options={LEAVE_TYPES.map(v => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item name="reason" label="事由"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="start_date" label="开始日期" initialValue={dayjs()}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="end_date" label="结束日期" initialValue={dayjs()}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="hours" label="时长(小时)" initialValue={8}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
