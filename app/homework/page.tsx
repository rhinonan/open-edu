'use client';
import { useMemo, useState } from 'react';
import { App, Button, Card, DatePicker, Form, Input, InputNumber, Modal, Progress, Select, Statistic, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import type { Row } from '@/lib/types';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import TableToolbar, { useColumnVisibility } from '@/components/table-toolbar';
import dayjs from 'dayjs';

const SUBJECTS = ['语文', '数学', '英语', '科学', '道德与法治'];
const TOOLBAR_COLS = [
  { key: 'subject', label: '学科' }, { key: 'assign_date', label: '布置日期' },
  { key: 'requirement', label: '作业要求' }, { key: 'deadline', label: '截止时间' },
  { key: 'submitted', label: '已交' }, { key: 'late', label: '迟交' },
  { key: 'missing', label: '未交' }, { key: 'missing_names', label: '未交学生' },
];

const totalOf = (r: Row) => Number(r.submitted) + Number(r.late) + Number(r.missing);

export default function HomeworkPage() {
  const { message } = App.useApp();
  const { rows, loading, update, create, remove } = useResourceRows('homework');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:homework');
  const [addOpen, setAddOpen] = useState(false);
  const [collecting, setCollecting] = useState<Row | null>(null);
  const [form] = Form.useForm();

  const columns: TableColumnsType<Row> = useMemo(() => {
    const base = TOOLBAR_COLS.filter(c => !hidden.has(c.key)).map(c => ({
      title: c.label,
      dataIndex: c.key,
      width: c.key === 'requirement' ? 220 : c.key === 'missing_names' ? 160 : undefined,
      render: (_: unknown, r: Row) => (
        <EditableCell
          value={r[c.key]}
          type={c.key === 'subject' ? 'select' : (c.key === 'assign_date' || c.key === 'deadline') ? 'date' : c.key === 'requirement' ? 'textarea'
            : (c.key === 'submitted' || c.key === 'late' || c.key === 'missing') ? 'number' : 'text'}
          options={c.key === 'subject' ? SUBJECTS : undefined}
          onSave={v => update(r.id as number, { [c.key]: v })}
        />
      ),
    }));
    return [
      ...base,
      {
        title: '收缴进度', key: 'progress', width: 260,
        render: (_: unknown, r: Row) => {
          const total = totalOf(r);
          const pct = total > 0 ? Math.round((Number(r.submitted) / total) * 100) : 0;
          return <Progress percent={pct} size="small" format={() => `${pct}%（已交 ${r.submitted}·迟交 ${r.late}·未交 ${r.missing}）`} />;
        },
      },
      {
        title: '操作', key: 'op', width: 120, fixed: 'right', exportable: false,
        render: (_: unknown, r: Row) => (
          <div className="flex">
            <Button type="link" size="small" onClick={() => {
              setCollecting(r);
              form.setFieldsValue({ submitted: r.submitted, late: r.late, missing: r.missing });
            }}>录入收缴</Button>
            <Button type="link" danger size="small" onClick={async () => {
              try { await remove(r.id as number); message.success('已删除'); } catch { message.error('删除失败'); }
            }}>删除</Button>
          </div>
        ),
      },
    ];
  }, [hidden, update, remove, form, message]);

  const stats = useMemo(() => {
    const avg = rows.length ? Math.round(rows.reduce((s, r) => s + (totalOf(r) > 0 ? Number(r.submitted) / totalOf(r) : 0), 0) / rows.length * 100) : 0;
    const missingAll = rows.reduce((s, r) => s + Number(r.missing), 0);
    return [
      { title: '累计布置作业', value: rows.length },
      { title: '平均提交率', value: `${avg}%` },
      { title: '累计未交人次', value: missingAll },
    ];
  }, [rows]);

  const submit = async () => {
    try {
      const v = await form.validateFields();
      await create({
        subject: v.subject ?? '语文',
        assign_date: v.assign_date ? v.assign_date.format('YYYY-MM-DD') : '',
        requirement: v.requirement ?? '',
        deadline: v.deadline ? v.deadline.format('YYYY-MM-DD') : '',
        submitted: v.submitted ?? 0, late: v.late ?? 0, missing: v.missing ?? 0, missing_names: v.missing_names ?? '',
      });
      message.success('已新增');
      setAddOpen(false); form.resetFields();
    } catch { /* 校验/请求失败 */ }
  };

  const saveCollect = async () => {
    if (!collecting) return;
    try {
      const v = await form.validateFields();
      await update(collecting.id as number, { submitted: v.submitted ?? 0, late: v.late ?? 0, missing: v.missing ?? 0 });
      message.success('已更新收缴情况');
      setCollecting(null);
    } catch { message.error('保存失败'); }
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {stats.map(s => <Card key={s.title} size="small"><Statistic title={s.title} value={s.value} /></Card>)}
      </div>
      <TableToolbar title="作业管理" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} />
      <Table<Row> rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle" pagination={false} scroll={{ x: 'max-content' }} />

      <Modal title="新增作业" open={addOpen} onCancel={() => setAddOpen(false)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="subject" label="学科" initialValue="语文"><Select options={SUBJECTS.map(s => ({ value: s, label: s }))} /></Form.Item>
          <Form.Item name="assign_date" label="布置日期"><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="requirement" label="作业要求"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="deadline" label="截止时间"><DatePicker style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="录入收缴情况" open={!!collecting} onCancel={() => setCollecting(null)} onOk={saveCollect} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="submitted" label="已交"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="late" label="迟交"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="missing" label="未交"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
