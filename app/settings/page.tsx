'use client';
import { useEffect, useState } from 'react';
import { App, Button, Card, Form, Input, Popconfirm, Typography } from 'antd';
import { get, post, put } from '@/lib/api-client';
import type { Row } from '@/lib/types';

interface Me { user: { name: string; role: string; class_id: number | null }; class: { id: number; name: string; head_teacher: string; grade_band: string } | null }

export default function SettingsPage() {
  const { message } = App.useApp();
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    get<Me>('/api/me').then(m => {
      setMe(m);
      if (m.class) form.setFieldsValue({ name: m.class.name, head_teacher: m.class.head_teacher, grade_band: m.class.grade_band });
    });
  }, [form]);

  const saveClass = async () => {
    const cls = me?.class;
    if (!cls) { message.warning('当前账号无关联班级'); return; }
    setBusy(true);
    try {
      const v = form.getFieldsValue();
      const row = await put<Row>(`/api/classes/${cls.id}`, v);
      void row;
      message.success('已保存');
    } catch { message.error('保存失败'); }
    setBusy(false);
  };

  const reset = async () => {
    setBusy(true);
    try { await post('/api/reset', {}); message.success('已重置本班数据'); location.reload(); }
    catch { message.error('重置失败'); setBusy(false); }
  };

  const isAdmin = me?.user?.role === 'admin';
  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>系统设置</Typography.Title>
      <div className="grid md:grid-cols-2 gap-4">
        <Card size="small"><h3 className="mb-3 text-sm font-semibold text-slate-600" style={{ marginTop: 0 }}>班级基础信息</h3>
          <Form form={form} layout="vertical">
            <div className="grid grid-cols-2 gap-3">
              <Form.Item name="name" label="班级名称"><Input /></Form.Item>
              <Form.Item name="head_teacher" label="班主任"><Input /></Form.Item>
              <Form.Item name="grade_band" label="年级班次"><Input /></Form.Item>
            </div>
            <Button type="primary" onClick={saveClass} loading={busy} disabled={!me?.class}>保存</Button>
          </Form>
        </Card>
        <div className="space-y-4">
          {(isAdmin || me?.user?.class_id) && (
            <Card size="small"><h3 className="mb-3 text-sm font-semibold text-slate-600" style={{ marginTop: 0 }}>数据维护</h3>
              <div className="flex flex-col gap-2">
                {me?.user?.class_id && (
                  <Popconfirm title="将清空本班演示数据并重新生成，确认？" onConfirm={reset} okText="重置" cancelText="取消">
                    <Button type="primary" danger loading={busy}>重置本班种子数据</Button>
                  </Popconfirm>
                )}
                {isAdmin && (
                  <Button type="primary" onClick={() => window.open('/api/backup', '_blank')}>备份数据库（下载 app.db）</Button>
                )}
              </div>
              <p className="mt-3 text-xs text-slate-400">演示数据均为随机生成的匿名姓名，用于保护学生隐私。</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
