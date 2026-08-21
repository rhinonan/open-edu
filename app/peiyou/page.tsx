'use client';
import { useMemo, useState } from 'react';
import { App, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Statistic, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import type { Row } from '@/lib/types';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import TableToolbar, { useColumnVisibility } from '@/components/table-toolbar';

const SUBJECTS = ['语文', '数学', '英语'];
const TOOLBAR_COLS = [
  { key: 'student_name', label: '学生' }, { key: 'subject', label: '学科' },
  { key: 'weak_point', label: '薄弱点' }, { key: 'target_score', label: '目标分数' },
  { key: 'record', label: '辅导记录' },
];

export default function PeiyouPage() {
  const { message } = App.useApp();
  const { rows, loading, update, create, remove } = useResourceRows('peiyou_records');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:peiyou_records');
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();

  const columns: TableColumnsType<Row> = useMemo(() => [
    ...TOOLBAR_COLS.filter(c => !hidden.has(c.key)).map(c => ({
      title: c.label, dataIndex: c.key,
      render: (_: unknown, r: Row) => (
        <EditableCell
          value={r[c.key]}
          type={c.key === 'subject' ? 'select' : c.key === 'target_score' ? 'number' : c.key === 'record' ? 'textarea' : 'text'}
          options={c.key === 'subject' ? SUBJECTS : undefined}
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

  const stats = useMemo(() => {
    const uniq = new Set(rows.map(r => String(r.student_name))).size;
    return [
      { title: '临界生人数', value: uniq },
      { title: '辅导记录', value: rows.length },
    ];
  }, [rows]);

  const submit = async () => {
    try {
      const v = await form.validateFields();
      await create({ student_name: v.student_name ?? '', subject: v.subject ?? '语文', weak_point: v.weak_point ?? '', target_score: v.target_score ?? 85, record: v.record ?? '' });
      message.success('已新增');
      setAddOpen(false); form.resetFields();
    } catch { /* 校验/请求失败 */ }
  };

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {stats.map(s => <Card key={s.title} size="small"><Statistic title={s.title} value={s.value} /></Card>)}
      </div>
      <TableToolbar title="培优临界生台账" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <Table<Row> rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle" pagination={false} scroll={{ x: 'max-content' }} />
      <Modal title="新增培优学生" open={addOpen} onCancel={() => setAddOpen(false)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="student_name" label="学生" rules={[{ required: true, message: '请输入学生' }]}><Input /></Form.Item>
          <Form.Item name="subject" label="学科" initialValue="语文"><Select options={SUBJECTS.map(v => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item name="weak_point" label="薄弱点"><Input /></Form.Item>
          <Form.Item name="target_score" label="目标分数" initialValue={85}><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="record" label="辅导记录"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
