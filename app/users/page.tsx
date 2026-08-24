'use client';
import { useEffect, useState } from 'react';
import { App, Button, Form, Input, Modal, Popconfirm, Table, Typography } from 'antd';
import { get, post, put, del } from '@/lib/api-client';

interface User { id: number; username: string; name: string; role: string; class_id: number | null; created_at: string }

export default function UsersPage() {
  const { message } = App.useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();

  const load = () => {
    get<{ users: User[] }>('/api/users')
      .then(r => setUsers(r.users))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    const v = await form.validateFields();
    setBusy(true);
    try {
      await post('/api/users', v);
      message.success('已创建');
      setOpen(false);
      form.resetFields();
      load();
    } catch { message.error('创建失败'); }
    setBusy(false);
  };

  const resetPwd = async (u: User) => {
    const pwd = window.prompt(`为「${u.name || u.username}」设置新密码`);
    if (!pwd) return;
    try { await put(`/api/users/${u.id}`, { password: pwd }); message.success('已重置密码'); }
    catch { message.error('重置失败'); }
  };

  const remove = async (u: User) => {
    try { await del(`/api/users/${u.id}`); message.success('已删除'); load(); }
    catch { message.error('删除失败'); }
  };

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>用户管理</Typography.Title>
      <Button type="primary" style={{ marginBottom: 12 }} onClick={() => setOpen(true)}>新增老师账号</Button>
      <Table<User> rowKey="id" size="small" loading={loading} dataSource={users} pagination={false}
        columns={[
          { title: '用户名', dataIndex: 'username' },
          { title: '姓名', dataIndex: 'name' },
          { title: '角色', dataIndex: 'role', render: (r: string) => r === 'admin' ? '管理员' : '班主任' },
          { title: '班级ID', dataIndex: 'class_id', render: (c: number | null) => c ?? '-' },
          { title: '操作', render: (_, u) => (
            <div className="flex gap-2">
              <Button size="small" onClick={() => resetPwd(u)}>重置密码</Button>
              {u.role !== 'admin' && (
                <Popconfirm title="确认删除该账号？" onConfirm={() => remove(u)} okText="删除" cancelText="取消">
                  <Button size="small" danger>删除</Button>
                </Popconfirm>
              )}
            </div>
          )},
        ]} />
      <Modal title="新增老师账号" open={open} onCancel={() => setOpen(false)} onOk={create} confirmLoading={busy}>
        <Form form={form} layout="vertical" initialValues={{ role: 'teacher' }}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}><Input /></Form.Item>
          <Form.Item name="name" label="姓名"><Input /></Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}><Input.Password /></Form.Item>
          <Form.Item name="className" label="班级名称（留空则不新建班级，需用已有 classId）"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
