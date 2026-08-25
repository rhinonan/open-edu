'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button, Drawer, useMediaQuery } from '@heroui/react';
import {
  Armchair, BarChart3, CalendarDays, FileClock, Flag, Home, LayoutDashboard,
  LogOut, Menu, MessageSquare, MessagesSquare, Settings, ShieldCheck, Star,
  UserMinus, Users, UsersRound,
} from 'lucide-react';
import dayjs from 'dayjs';
import { EditableProvider, useEditable } from './editable-context';

interface Me { user: { name: string; role: string; class_id: number | null }; class: { name: string } | null }

const BUSINESS = [
  { key: '/', icon: <LayoutDashboard size={18} />, label: '仪表盘' },
  { key: '/timetable', icon: <CalendarDays size={18} />, label: '我的课表' },
  { key: '/students', icon: <Users size={18} />, label: '学生管理' },
  { key: '/grades', icon: <BarChart3 size={18} />, label: '成绩分析' },
  { key: '/leaves', icon: <UserMinus size={18} />, label: '请假管理' },
  { key: '/discipline', icon: <Flag size={18} />, label: '违纪台账' },
  { key: '/conversations', icon: <MessageSquare size={18} />, label: '谈话记录' },
  { key: '/visits', icon: <Home size={18} />, label: '生涯家访' },
  { key: '/evaluation', icon: <Star size={18} />, label: '综合素质评价' },
  { key: '/seats', icon: <Armchair size={18} />, label: '排座位' },
  { key: '/parent-comm', icon: <MessagesSquare size={18} />, label: '家校沟通' },
  { key: '/safety', icon: <ShieldCheck size={18} />, label: '安全台账' },
  { key: '/work-logs', icon: <FileClock size={18} />, label: '工作留痕' },
];
const SETTINGS = { key: '/settings', icon: <Settings size={18} />, label: '系统设置' };
const USERS = { key: '/users', icon: <UsersRound size={18} />, label: '用户管理' };

function ShellHeader({ mobile, me, onOpenDrawer }: { mobile: boolean; me: Me | null; onOpenDrawer: () => void }) {
  const { editable, toggle } = useEditable();
  const router = useRouter();
  const [now, setNow] = useState('');
  useEffect(() => {
    const tick = () => setNow(dayjs().format('YYYY-MM-DD HH:mm:ss'));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  const logout = async () => { await fetch('/api/logout', { method: 'POST' }); router.replace('/login'); };
  return (
    <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2.5">
      {mobile && (
        <Button variant="ghost" size="sm" isIconOnly aria-label="打开菜单" onPress={onOpenDrawer}>
          <Menu size={20} />
        </Button>
      )}
      <span className="font-semibold text-slate-800">{me?.class?.name || '班级工作台'}</span>
      <div className="flex-1" />
      {!mobile && <span className="text-xs text-slate-400">{now}</span>}
      <span className="text-xs text-slate-500">{me?.user?.name ?? ''}</span>
      <Button variant="outline" size="sm" onPress={logout}>
        <LogOut size={14} /> 退出
      </Button>
      <Button variant={editable ? 'primary' : 'outline'} size="sm" onPress={toggle}>
        {editable ? '完成' : '编辑'}
      </Button>
    </header>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const mobile = useMediaQuery('(max-width: 767px)', { initializeWithValue: false });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.ok ? r.json() : Promise.resolve(null))
      .then((m: Me | null) => setMe(m))
      .catch(() => setMe(null));
  }, []);

  // 管理员无班级：隐藏业务菜单后，把误入业务页的 admin 送回系统设置
  useEffect(() => {
    if (me?.user?.role === 'admin' && BUSINESS.some(m => m.key === pathname)) {
      router.replace('/settings');
    }
  }, [me, pathname, router]);

  if (pathname.startsWith('/login')) return <>{children}</>;

  const role = me?.user?.role ?? 'teacher';
  const items = role === 'admin' ? [SETTINGS, USERS] : [...BUSINESS, SETTINGS];

  const nav = (
    <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
      {items.map(it => (
        <Link
          key={it.key}
          href={it.key}
          onClick={() => setDrawerOpen(false)}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
            pathname === it.key ? 'bg-white/10 font-medium text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          {it.icon}<span>{it.label}</span>
        </Link>
      ))}
    </nav>
  );

  return (
    <EditableProvider>
      <div className="flex min-h-screen">
        {!mobile && (
          <aside className="fixed inset-y-0 left-0 z-30 flex w-56 flex-col bg-navy text-white">
            <div className="px-4 py-4 text-center font-semibold">班主任智慧工作台</div>
            {nav}
          </aside>
        )}
        <div className={`flex-1 ${mobile ? '' : 'ml-56'}`}>
          <ShellHeader mobile={mobile} me={me} onOpenDrawer={() => setDrawerOpen(true)} />
          <main className="mx-auto w-full max-w-5xl p-4">{children}</main>
        </div>
        {mobile && (
          <Drawer isOpen={drawerOpen} onOpenChange={setDrawerOpen}>
            <Drawer.Backdrop />
            <Drawer.Content placement="left" className="w-56">
              <div className="flex h-full flex-col bg-navy text-white">
                <div className="px-4 py-4 text-center font-semibold">班主任智慧工作台</div>
                {nav}
              </div>
            </Drawer.Content>
          </Drawer>
        )}
      </div>
    </EditableProvider>
  );
}
