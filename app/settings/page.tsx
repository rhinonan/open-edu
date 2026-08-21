'use client';
import { useEffect, useState } from 'react';
import { App, Button, Card, Form, Input, Popconfirm, Typography } from 'antd';
import { get, post, put } from '@/lib/api-client';
import type { Row } from '@/lib/types';

const KEYS = [
  { key: 'class_name', label: '班级名称' },
  { key: 'head_teacher', label: '班主任' },
  { key: 'grade_band', label: '年级班次' },
  { key: 'total_count', label: '总人数' },
  { key: 'male_count', label: '男生数' },
  { key: 'female_count', label: '女生数' },
];

export default function SettingsPage() {
  const { message } = App.useApp();
  const [rows, setRows] = useState<Row[]>([]);
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get<Row[]>('/api/settings').then(rs => {
      setRows(rs);
      const m: Record<string, string> = {};
      for (const r of rs) m[String(r.key)] = String(r.value ?? '');
      form.setFieldsValue(m);
    });
  }, [form]);

  const save = async () => {
    setBusy(true);
    try {
      const v = form.getFieldsValue();
      for (const r of rows) {
        if (!KEYS.some(k => k.key === r.key)) continue;
        await put(`/api/settings/${r.id}`, { value: String(v[String(r.key)] ?? '') });
      }
      message.success('已保存');
    } catch { message.error('保存失败'); }
    setBusy(false);
  };

  const reset = async () => {
    setBusy(true);
    try { await post('/api/reset', {}); message.success('已重置'); window.location.reload(); }
    catch { message.error('重置失败'); setBusy(false); }
  };

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>系统设置</Typography.Title>
      <div className="grid md:grid-cols-2 gap-4">
        <Card size="small"><h3 className="mb-3 text-sm font-semibold text-slate-600" style={{ marginTop: 0 }}>班级基础信息</h3>
          <Form form={form} layout="vertical">
            <div className="grid grid-cols-2 gap-3">
              {KEYS.map(k => (
                <Form.Item key={k.key} name={k.key} label={k.label}><Input /></Form.Item>
              ))}
            </div>
            <Button type="primary" onClick={save} loading={busy}>保存</Button>
          </Form>
        </Card>
        <div className="space-y-4">
          <Card size="small"><h3 className="mb-3 text-sm font-semibold text-slate-600" style={{ marginTop: 0 }}>数据维护</h3>
            <div className="flex flex-col gap-2">
              <Popconfirm title="将清空全部演示数据并重新生成，确认？" onConfirm={reset} okText="重置" cancelText="取消">
                <Button type="primary" danger loading={busy}>重置种子数据（重新随机生成）</Button>
              </Popconfirm>
              <Button type="primary" onClick={() => window.open('/api/backup', '_blank')}>备份数据库（下载 app.db）</Button>
            </div>
            <p className="mt-3 text-xs text-slate-400">演示数据均为随机生成的匿名姓名，用于保护学生隐私。</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
