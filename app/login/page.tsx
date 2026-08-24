'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { post } from '@/lib/api-client';

export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onFinish = async (v: { username: string; password: string }) => {
    setBusy(true);
    try {
      await post('/api/login', v);
      router.replace('/');
    } catch { message.error('用户名或密码错误'); }
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Card className="w-80">
        <div className="text-center mb-4">
          <Typography.Title level={4} style={{ marginTop: 0 }}>班主任智慧工作台</Typography.Title>
          <Typography.Text type="secondary">请登录</Typography.Text>
        </div>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input autoFocus autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={busy}>登录</Button>
        </Form>
      </Card>
    </div>
  );
}
