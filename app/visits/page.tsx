'use client';
import { useMemo, useState } from 'react';
import { App, Button, Card, Form, Input, Modal, Popconfirm, Select, Statistic, Table, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import type { Row } from '@/lib/types';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import TableToolbar, { useColumnVisibility } from '@/components/table-toolbar';
import dayjs from 'dayjs';

const WAYS = ['电话', '家访', '家长会', '微信'];
const TOOLBAR_COLS = [
  { key: 'date', label: '日期' }, { key: 'student_name', label: '学生' },
  { key: 'way', label: '方式' }, { key: 'content', label: '内容' },
  { key: 'is_meeting', label: '类型', exportable: false },
];

export default function VisitsPage() {
  const { message } = App.useApp();
  const { rows, loading, update, create, remove } = useResourceRows('home_visits');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:home_visits');
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();

  const columns: TableColumnsType<Row> = useMemo(() => [
    ...TOOLBAR_COLS.filter(c => !hidden.has(c.key)).map(c => c.key === 'is_meeting' ? ({
      title: c.label, dataIndex: 'is_meeting', width: 90,
      render: (_: unknown, r: Row) => {
        const meeting = r.is_meeting == 1;
        return (
          <Button size="small" onClick={async () => {
            try { await update(r.id as number, { is_meeting: meeting ? 0 : 1 }); }
            catch { message.error('保存失败'); }
          }}>
            <Tag color={meeting ? 'purple' : 'gold'} style={{ margin: 0 }}>{meeting ? '家长会' : '家访'}</Tag>
          </Button>
        );
      },
    }) : ({
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

  const stats = useMemo(() => {
    const visits = rows.filter(r => r.is_meeting != 1).length;
    const meetings = rows.filter(r => r.is_meeting == 1).length;
    const meetingStudents = new Set(rows.filter(r => r.is_meeting == 1).map(r => String(r.student_name))).size;
    const allStudents = new Set(rows.map(r => String(r.student_name))).size;
    const rate = allStudents > 0 ? Math.round((meetingStudents / allStudents) * 100) : 0;
    return [
      { title: '家访次数', value: visits },
      { title: '家长会场次', value: meetings },
      { title: '家长会参会率', value: `${rate}%` },
    ];
  }, [rows]);

  const submit = async () => {
    try {
      const v = await form.validateFields();
      await create({ date: v.date ? v.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'), student_name: v.student_name ?? '', way: v.way ?? '电话', content: v.content ?? '', is_meeting: 0 });
      message.success('已新增');
      setAddOpen(false); form.resetFields();
    } catch { /* 校验/请求失败 */ }
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {stats.map(s => <Card key={s.title} size="small"><Statistic title={s.title} value={s.value} /></Card>)}
      </div>
      <TableToolbar title="生涯家访" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <Table<Row> rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle" pagination={false} scroll={{ x: 'max-content' }} />
      <Modal title="新增家访记录" open={addOpen} onCancel={() => setAddOpen(false)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="student_name" label="学生" rules={[{ required: true, message: '请输入学生' }]}><Input /></Form.Item>
          <Form.Item name="way" label="方式" initialValue="电话"><Select options={WAYS.map(v => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item name="content" label="内容"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
