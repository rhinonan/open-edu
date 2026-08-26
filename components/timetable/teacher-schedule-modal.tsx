'use client';
import { useMemo } from 'react';
import FormModal, { type FieldDef } from '@/components/form-modal';
import type { Row } from '@/lib/types';

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五'];
const SUBJECT_OPTIONS = ['语文', '数学', '英语', '科学', '道德与法治', '体育', '音乐', '美术', '班会', '劳动'];

type Values = { weekday: number; period_id: number; class_name: string; subject: string; remark: string };

export default function TeacherScheduleModal({ open, onClose, editing, slots, onSave, prefill }: {
  open: boolean;
  onClose: () => void;
  editing: Row | null;
  slots: Row[];
  onSave: (v: Values) => Promise<void>;
  prefill?: { weekday: number; period_id: number } | null;
}) {
  const fields = useMemo<FieldDef[]>(() => [
    { key: 'weekday', label: '星期', type: 'select', required: true, options: WEEKDAYS.map((w, i) => ({ value: String(i + 1), label: w })) },
    {
      key: 'period_id', label: '时段', type: 'select', required: true,
      options: [...slots].sort((a, b) => Number(a.seq) - Number(b.seq)).map(s => ({ value: String(s.id), label: `${s.name} ${s.start_time}-${s.end_time}` })),
    },
    { key: 'class_name', label: '目标班级', required: true, placeholder: '如 六年级（2）班' },
    { key: 'subject', label: '科目', type: 'select', required: true, options: SUBJECT_OPTIONS },
    { key: 'remark', label: '备注', type: 'textarea' },
  ], [slots]);

  const initial = editing ? {
    weekday: String(editing.weekday ?? '1'),
    period_id: String(editing.period_id ?? ''),
    class_name: String(editing.class_name ?? ''),
    subject: String(editing.subject ?? ''),
    remark: String(editing.remark ?? ''),
  } : { weekday: String(prefill?.weekday ?? 1), period_id: String(prefill?.period_id ?? '') };

  const submit = async (v: Record<string, string | number | null>) => {
    await onSave({
      weekday: Number(v.weekday ?? 1),
      period_id: Number(v.period_id ?? 0),
      class_name: String(v.class_name ?? ''),
      subject: String(v.subject ?? ''),
      remark: String(v.remark ?? ''),
    });
  };

  return (
    <FormModal
      title={editing ? '编辑授课' : '新增授课'}
      fields={fields}
      open={open}
      onClose={onClose}
      onSubmit={submit}
      initial={initial}
      size="md"
    />
  );
}
