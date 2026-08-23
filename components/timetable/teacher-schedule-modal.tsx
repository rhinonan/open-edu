'use client';
import { useEffect } from 'react';
import { Modal, Form, Select, Input } from 'antd';
import type { Row } from '@/lib/types';

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五'];
const SUBJECT_OPTIONS = ['语文', '数学', '英语', '科学', '道德与法治', '体育', '音乐', '美术', '班会', '劳动'];

type Values = { weekday: number; period_id: number; class_name: string; subject: string; remark: string };

export default function TeacherScheduleModal({ open, onClose, editing, slots, onSave }: {
  open: boolean;
  onClose: () => void;
  editing: Row | null;
  slots: Row[];
  onSave: (v: Values) => Promise<void>;
}) {
  const [form] = Form.useForm();
  const slotOptions = [...slots].sort((a, b) => Number(a.seq) - Number(b.seq))
    .map(s => ({ value: Number(s.id), label: `${s.name} ${s.start_time}-${s.end_time}` }));

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(editing ? {
      weekday: Number(editing.weekday),
      period_id: Number(editing.period_id),
      class_name: String(editing.class_name ?? ''),
      subject: String(editing.subject ?? ''),
      remark: String(editing.remark ?? ''),
    } : { weekday: 1, period_id: undefined, class_name: '', subject: '', remark: '' });
  }, [open, editing, form]);

  const submit = async () => {
    const v = await form.validateFields();
    await onSave({ weekday: Number(v.weekday), period_id: Number(v.period_id), class_name: v.class_name, subject: v.subject, remark: v.remark ?? '' });
    onClose();
  };

  return (
    <Modal title={editing ? '编辑授课' : '新增授课'} open={open} onCancel={onClose} onOk={() => void submit()} destroyOnHidden>
      <Form form={form} layout="vertical">
        <Form.Item name="weekday" label="星期" rules={[{ required: true, message: '请选择星期' }]}>
          <Select options={WEEKDAYS.map((w, i) => ({ value: i + 1, label: w }))} />
        </Form.Item>
        <Form.Item name="period_id" label="时段" rules={[{ required: true, message: '请选择时段' }]}>
          <Select options={slotOptions} />
        </Form.Item>
        <Form.Item name="class_name" label="目标班级" rules={[{ required: true, message: '请输入班级' }]}>
          <Input placeholder="如 六年级（2）班" />
        </Form.Item>
        <Form.Item name="subject" label="科目" rules={[{ required: true, message: '请选择科目' }]}>
          <Select options={SUBJECT_OPTIONS.map(s => ({ value: s, label: s }))} />
        </Form.Item>
        <Form.Item name="remark" label="备注"><Input.TextArea rows={2} /></Form.Item>
      </Form>
    </Modal>
  );
}
