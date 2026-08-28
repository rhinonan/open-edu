'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Avatar, Button, Chip, Drawer, useMediaQuery } from '@heroui/react';
import {
  Armchair, BarChart3, CalendarDays, FileClock, Flag, Home, LayoutDashboard,
  LogOut, MessageSquare, MessagesSquare, Settings, ShieldCheck, Star,
  UserMinus, Users, UsersRound,
} from 'lucide-react';
import dayjs from 'dayjs';
import { EditableProvider } from './editable-context';

interface Me { user: { name: string; role: string; class_id: number | null }; class: { name: string } | null }

interface NavItem { key: string; icon: React.ReactNode; label: string; badge?: string }

const BUSINESS: NavItem[] = [
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
  { key: '/parent-comm', icon: <MessagesSquare size={18} />, label: '家校沟通', badge: '新' },
  { key: '/safety', icon: <ShieldCheck size={18} />, label: '安全台账' },
  { key: '/work-logs', icon: <FileClock size={18} />, label: '工作留痕' },
];
const SETTINGS: NavItem = { key: '/settings', icon: <Settings size={18} />, label: '系统设置' };
const USERS: NavItem = { key: '/users', icon: <UsersRound size={18} />, label: '用户管理' };

const ROLE_LABEL: Record<string, string> = { admin: '管理员', teacher: '班主任' };

const initials = (name: string) => (name?.trim() ? name.trim().charAt(0).toUpperCase() : '?');

const greeting = () => {
  const h = dayjs().hour();
  if (h < 6) return '凌晨好';
  if (h < 12) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
};

function ShellHeader({ mobile, me, onOpenDrawer }: { mobile: boolean; me: Me | null; onOpenDrawer: () => void }) {
  const [now, setNow] = useState('');
  useEffect(() => {
    const tick = () => setNow(dayjs().format('MM-DD HH:mm'));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  const name = me?.user?.name ?? '';
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-separator bg-surface px-5">
      {mobile && (
        <Button variant="ghost" size="sm" isIconOnly aria-label="打开菜单" onPress={onOpenDrawer}>
          <MenuIcon />
        </Button>
      )}
      <h1 className="truncate text-xl font-semibold text-foreground">
        {greeting()}，{name}
      </h1>
      <div className="flex-1" />
      <span className="hidden text-xs font-medium text-muted sm:inline">{now}</span>
    </header>
  );
}

function MenuIcon() {
  return (
    <svg className="size-5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Profile({ me }: { me: Me | null }) {
  const name = me?.user?.name ?? '老师';
  const role = ROLE_LABEL[me?.user?.role ?? 'teacher'] ?? '';
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <Avatar size="md">
        <Avatar.Fallback className="bg-gradient-to-br from-sky-500 to-purple-600 font-medium text-white">
          {initials(name)}
        </Avatar.Fallback>
      </Avatar>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-foreground">{name}</div>
        <div className="truncate text-xs font-medium text-muted">{me?.class?.name || role}</div>
      </div>
    </div>
  );
}

function SidebarNav({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
      {items.map(it => {
        const active = pathname === it.key;
        return (
          <Link
            key={it.key}
            href={it.key}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
              active
                ? 'bg-accent-soft font-medium text-accent-soft-foreground'
                : 'text-muted hover:bg-surface-secondary hover:text-foreground'
            }`}
          >
            {it.icon}
            <span className="flex-1 truncate">{it.label}</span>
            {it.badge && <Chip color="success" size="sm" variant="soft">{it.badge}</Chip>}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="border-t border-separator px-3 py-3">
      <button
        type="button"
        onClick={onLogout}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-secondary hover:text-foreground"
      >
        <LogOut size={18} />
        <span>退出登录</span>
      </button>
    </div>
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

  const logout = async () => { await fetch('/api/logout', { method: 'POST' }); router.replace('/login'); };
  const onNavigate = () => setDrawerOpen(false);

  const sidebar = (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-separator bg-surface">
      <Profile me={me} />
      <SidebarNav items={items} pathname={pathname} />
      <SidebarFooter onLogout={() => void logout()} />
    </aside>
  );

  return (
    <EditableProvider>
      <div className="flex h-dvh overflow-hidden bg-background">
        {!mobile && sidebar}
        <div className={`flex h-full min-h-0 flex-1 flex-col ${mobile ? '' : 'pl-64'}`}>
          <ShellHeader mobile={mobile} me={me} onOpenDrawer={() => setDrawerOpen(true)} />
          <main className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-5 pb-4 pt-4">{children}</main>
        </div>
        {mobile && (
          <Drawer isOpen={drawerOpen} onOpenChange={setDrawerOpen}>
            <Drawer.Backdrop>
              <Drawer.Content placement="left" className="w-64">
                <Drawer.Dialog>
                  <div className="flex h-full flex-col bg-surface">
                    <Profile me={me} />
                    <SidebarNav items={items} pathname={pathname} onNavigate={onNavigate} />
                    <SidebarFooter onLogout={() => void logout()} />
                  </div>
                </Drawer.Dialog>
              </Drawer.Content>
            </Drawer.Backdrop>
          </Drawer>
        )}
      </div>
    </EditableProvider>
  );
}
