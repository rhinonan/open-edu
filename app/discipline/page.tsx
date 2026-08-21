'use client';
import { useMemo, useState } from 'react';
import { App, Button, Card, DatePicker, Form, Input, Modal, Popconfirm, Select, Statistic, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import type { Row } from '@/lib/types';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import TableToolbar, { useColumnVisibility } from '@/components/table-toolbar';
import dayjs from 'dayjs';

const today = () => dayjs().format('YYYY-MM-DD');
const CATEGORIES = ['常规纪律', '迟到早退', '课堂表现', '课间行为', '卫生值日'];
const TOOLBAR_COLS = [
  { key: 'date', label: '日期' }, { key: 'student_name', label: '学生' },
  { key: 'category', label: '类别' }, { key: 'content', label: '违纪内容' },
  { key: 'action', label: '处理方式' },
];

export default function DisciplinePage() {
  const { message } = App.useApp();
  const { rows, loading, update, create, remove } = useResourceRows('discipline_records');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:discipline_records');
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();

  const columns: TableColumnsType<Row> = useMemo(() => [
    ...TOOLBAR_COLS.filter(c => !hidden.has(c.key)).map(c => ({
      title: c.label, dataIndex: c.key,
      filters: c.key === 'category' ? CATEGORIES.map(v => ({ text: v, value: v })) : undefined,
      onFilter: c.key === 'category' ? (v: unknown, r: Row) => String(r.category) === String(v) : undefined,
      render: (_: unknown, r: Row) => (
        <EditableCell
          value={r[c.key]}
          type={c.key === 'date' ? 'date' : c.key === 'category' ? 'select' : c.key === 'content' ? 'textarea' : 'text'}
          options={c.key === 'category' ? CATEGORIES : undefined}
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
    { title: '累计条数', value: rows.length },
    { title: '本周条数', value: rows.filter(r => String(r.date) >= dayjs().subtract(6, 'day').format('YYYY-MM-DD')).length },
  ], [rows]);

  const submit = async () => {
    try {
      const v = await form.validateFields();
      await create({ date: v.date ? v.date.format('YYYY-MM-DD') : today(), student_name: v.student_name ?? '', category: v.category ?? '常规纪律', content: v.content ?? '', action: v.action ?? '' });
      message.success('已新增');
      setAddOpen(false); form.resetFields();
    } catch { /* 校验/请求失败 */ }
  };

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {stats.map(s => <Card key={s.title} size="small"><Statistic title={s.title} value={s.value} /></Card>)}
      </div>
      <TableToolbar title="违纪台账" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <Table<Row> rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle" pagination={false} scroll={{ x: 'max-content' }} />
      <Modal title="新增违纪" open={addOpen} onCancel={() => setAddOpen(false)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="student_name" label="学生" rules={[{ required: true, message: '请输入学生' }]}><Input /></Form.Item>
          <Form.Item name="category" label="类别" initialValue="常规纪律"><Select options={CATEGORIES.map(v => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item name="content" label="违纪内容"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="action" label="处理方式"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
