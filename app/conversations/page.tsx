'use client';
import { useMemo, useState } from 'react';
import { App, Button, Form, Input, Modal, Popconfirm, Select, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import type { Row } from '@/lib/types';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import TableToolbar, { useColumnVisibility } from '@/components/table-toolbar';
import dayjs from 'dayjs';

const EFFECTS = ['有改善', '需持续跟进', '已解决'];
const TOOLBAR_COLS = [
  { key: 'date', label: '日期' }, { key: 'student_name', label: '学生' },
  { key: 'topic', label: '主题' }, { key: 'content', label: '内容' },
  { key: 'effect', label: '谈话效果' },
];

export default function ConversationsPage() {
  const { message } = App.useApp();
  const { rows, loading, update, create, remove } = useResourceRows('conversations');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:conversations');
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();

  const columns: TableColumnsType<Row> = useMemo(() => [
    ...TOOLBAR_COLS.filter(c => !hidden.has(c.key)).map(c => ({
      title: c.label, dataIndex: c.key,
      render: (_: unknown, r: Row) => (
        <EditableCell
          value={r[c.key]}
          type={c.key === 'date' ? 'date' : c.key === 'effect' ? 'select' : c.key === 'content' ? 'textarea' : 'text'}
          options={c.key === 'effect' ? EFFECTS : undefined}
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
      await create({ date: v.date ? v.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'), student_name: v.student_name ?? '', topic: v.topic ?? '', content: v.content ?? '', effect: v.effect ?? '需持续跟进' });
      message.success('已新增');
      setAddOpen(false); form.resetFields();
    } catch { /* 校验/请求失败 */ }
  };

  return (
    <div>
      <TableToolbar title="谈话记录" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <Table<Row> rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle" pagination={false} scroll={{ x: 'max-content' }} />
      <Modal title="新增谈话记录" open={addOpen} onCancel={() => setAddOpen(false)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="student_name" label="学生" rules={[{ required: true, message: '请输入学生' }]}><Input /></Form.Item>
          <Form.Item name="topic" label="主题"><Input /></Form.Item>
          <Form.Item name="content" label="内容"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="effect" label="谈话效果" initialValue="需持续跟进"><Select options={EFFECTS.map(v => ({ value: v, label: v }))} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
