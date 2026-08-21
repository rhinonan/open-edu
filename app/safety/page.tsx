'use client';
import { useMemo, useState } from 'react';
import { App, Button, Form, Input, Modal, Popconfirm, Select, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import type { Row } from '@/lib/types';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import TableToolbar, { useColumnVisibility } from '@/components/table-toolbar';
import dayjs from 'dayjs';

const CATEGORIES = ['课间', '交通', '食品', '消防', '防溺水', '其他'];
const TOOLBAR_COLS = [
  { key: 'date', label: '日期' }, { key: 'category', label: '类别' },
  { key: 'content', label: '内容' }, { key: 'action', label: '处理情况' },
];

export default function SafetyPage() {
  const { message } = App.useApp();
  const { rows, loading, update, create, remove } = useResourceRows('safety_logs');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:safety_logs');
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

  const submit = async () => {
    try {
      const v = await form.validateFields();
      await create({ date: v.date ? v.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'), category: v.category ?? '课间', content: v.content ?? '', action: v.action ?? '' });
      message.success('已新增');
      setAddOpen(false); form.resetFields();
    } catch { /* 校验/请求失败 */ }
  };

  return (
    <div>
      <TableToolbar title="安全台账" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <Table<Row> rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle" pagination={false} scroll={{ x: 'max-content' }} />
      <Modal title="新增安全记录" open={addOpen} onCancel={() => setAddOpen(false)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="category" label="类别" initialValue="课间"><Select options={CATEGORIES.map(v => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item name="content" label="内容"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="action" label="处理情况"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
