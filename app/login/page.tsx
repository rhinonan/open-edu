'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Label } from '@heroui/react';
import { post } from '@/lib/api-client';
import { toast } from '@/lib/toast';

export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const doLogin = async () => {
    if (!username || !password) return;
    setBusy(true);
    try {
      await post('/api/login', { username, password });
      router.replace('/');
    } catch { toast.error('用户名或密码错误'); }
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-80 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-center text-lg font-semibold text-slate-800">班主任智慧工作台</h1>
        <p className="mb-4 text-center text-sm text-slate-400">请登录</p>
        <div className="space-y-4">
          <div>
            <Label className="mb-1 block text-sm text-slate-700">用户名</Label>
            <Input fullWidth autoFocus autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-sm text-slate-700">密码</Label>
            <Input
              fullWidth type="password" autoComplete="current-password"
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void doLogin(); } }}
            />
          </div>
          <Button variant="primary" fullWidth onPress={() => void doLogin()} isDisabled={busy}>
            {busy ? '登录中…' : '登录'}
          </Button>
        </div>
      </div>
    </div>
  );
}