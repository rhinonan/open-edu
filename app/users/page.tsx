'use client';
import { useEffect, useState } from 'react';
import { Button } from '@heroui/react';
import DataTable, { type ColumnDef } from '@/components/data-table';
import FormModal, { type FieldDef } from '@/components/form-modal';
import Confirm from '@/components/confirm';
import { get, post, put, del } from '@/lib/api-client';
import { toast } from '@/lib/toast';

type User = { id: number; username: string; name: string; role: string; class_id: number | null; created_at: string }

const COLUMNS: ColumnDef[] = [
  { key: 'username', label: '用户名' },
  { key: 'name', label: '姓名' },
  { key: 'role', label: '角色', render: (v) => (String(v) === 'admin' ? '管理员' : '班主任') },
  { key: 'class_id', label: '班级ID', render: (v) => (v === null || v === '' ? '-' : String(v)) },
];

const FIELDS: FieldDef[] = [
  { key: 'username', label: '用户名', required: true },
  { key: 'name', label: '姓名' },
  { key: 'password', label: '密码', required: true },
  { key: 'className', label: '班级名称（留空则不新建班级，需用已有 classId）' },
];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<User | null>(null);

  const load = () => {
    get<{ users: User[] }>('/api/users')
      .then(r => setUsers(r.users))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const create = async (v: Record<string, string | number | null>) => {
    try {
      await post('/api/users', v);
      toast.success('已创建');
      load();
    } catch { toast.error('创建失败'); }
  };

  const resetPwd = async (u: User) => {
    const pwd = window.prompt(`为「${u.name || u.username}」设置新密码`);
    if (!pwd) return;
    try { await put(`/api/users/${u.id}`, { password: pwd }); toast.success('已重置密码'); }
    catch { toast.error('重置失败'); }
  };

  const remove = async () => {
    if (!deleting) return;
    try { await del(`/api/users/${deleting.id}`); toast.success('已删除'); load(); }
    catch { toast.error('删除失败'); }
    setDeleting(null);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="m-0 text-lg font-semibold text-slate-800">用户管理</h2>
        <Button variant="primary" size="sm" onPress={() => setOpen(true)}>新增老师账号</Button>
      </div>
      <DataTable
        label="用户管理"
        columns={COLUMNS}
        rows={users}
        loading={loading}
        actions={(u) => (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onPress={() => resetPwd(u as User)}>重置密码</Button>
            {(u as User).role !== 'admin' && (
              <Button variant="danger-soft" size="sm" onPress={() => setDeleting(u as User)}>删除</Button>
            )}
          </div>
        )}
      />
      <FormModal title="新增老师账号" fields={FIELDS} open={open} onClose={() => setOpen(false)} onSubmit={create} />
      <Confirm open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} title="删除账号" message="确认删除该账号？" confirmText="删除" danger onConfirm={remove} />
    </div>
  );
}
