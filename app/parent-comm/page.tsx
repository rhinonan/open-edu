'use client';
import { useMemo, useState } from 'react';
import { App, Button, Form, Input, Modal, Popconfirm, Select, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import type { Row } from '@/lib/types';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import TableToolbar, { useColumnVisibility } from '@/components/table-toolbar';
import dayjs from 'dayjs';

const WAYS = ['电话', '微信', '面谈', '通知'];
const TOOLBAR_COLS = [
  { key: 'date', label: '日期' }, { key: 'student_name', label: '学生/对象' },
  { key: 'way', label: '方式' }, { key: 'content', label: '沟通内容' },
];

export default function ParentCommPage() {
  const { message } = App.useApp();
  const { rows, loading, update, create, remove } = useResourceRows('parent_comm');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:parent_comm');
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();

  const columns: TableColumnsType<Row> = useMemo(() => [
    ...TOOLBAR_COLS.filter(c => !hidden.has(c.key)).map(c => ({
      title: c.label, dataIndex: c.key,
      render: (_: unknown, r: Row) => (
        <EditableCell
          value={r[c.key]}
          type={c.key === 'date' ? 'date' : c.key === 'way' ? 'select' : c.key === 'content' ? 'textarea' : 'text'}
          options={c.key === 'way' ? WAYS : undefined}
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

  const submit = async () => {
    try {
      const v = await form.validateFields();
      await create({ date: v.date ? v.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'), student_name: v.student_name ?? '', way: v.way ?? '微信', content: v.content ?? '' });
      message.success('已新增');
      setAddOpen(false); form.resetFields();
    } catch { /* 校验/请求失败 */ }
  };

  return (
    <div>
      <TableToolbar title="家校沟通" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <Table<Row> rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle" pagination={false} scroll={{ x: 'max-content' }} />
      <Modal title="新增沟通记录" open={addOpen} onCancel={() => setAddOpen(false)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="student_name" label="学生/对象" rules={[{ required: true, message: '请输入对象' }]}><Input /></Form.Item>
          <Form.Item name="way" label="方式" initialValue="微信"><Select options={WAYS.map(v => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item name="content" label="沟通内容"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
