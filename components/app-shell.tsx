'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button, Drawer, Grid, Layout, Menu, Typography } from 'antd';
import {
  AppstoreOutlined, BarChartOutlined, CalendarOutlined,
  CommentOutlined, DashboardOutlined, FileTextOutlined, FlagOutlined,
  HomeOutlined, LogoutOutlined, MenuOutlined, MessageOutlined, SafetyOutlined,
  SettingOutlined, StarOutlined, TeamOutlined, UserAddOutlined, UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { EditableProvider, useEditable } from './editable-context';

interface Me { user: { name: string; role: string; class_id: number | null }; class: { name: string } | null }

// 班级业务页：仅班主任（有 class_id）可见
const BUSINESS_MENU = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/timetable', icon: <CalendarOutlined />, label: '我的课表' },
  { key: '/students', icon: <TeamOutlined />, label: '学生管理' },
  { key: '/grades', icon: <BarChartOutlined />, label: '成绩分析' },
  { key: '/leaves', icon: <UserAddOutlined />, label: '请假管理' },
  { key: '/discipline', icon: <FlagOutlined />, label: '违纪台账' },
  { key: '/conversations', icon: <CommentOutlined />, label: '谈话记录' },
  { key: '/visits', icon: <HomeOutlined />, label: '生涯家访' },
  { key: '/evaluation', icon: <StarOutlined />, label: '综合素质评价' },
  { key: '/seats', icon: <AppstoreOutlined />, label: '排座位' },
  { key: '/parent-comm', icon: <MessageOutlined />, label: '家校沟通' },
  { key: '/safety', icon: <SafetyOutlined />, label: '安全台账' },
  { key: '/work-logs', icon: <FileTextOutlined />, label: '工作留痕' },
];

const SETTINGS_MENU = { key: '/settings', icon: <SettingOutlined />, label: '系统设置' };
const USERS_MENU = { key: '/users', icon: <UserOutlined />, label: '用户管理' };

function ShellHeader({ onOpenDrawer, mobile }: { onOpenDrawer: () => void; mobile: boolean }) {
  const { editable, toggle } = useEditable();
  const router = useRouter();
  const [now, setNow] = useState('');
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.ok ? r.json() : Promise.resolve(null))
      .then((m: Me | null) => setMe(m))
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    const tick = () => setNow(dayjs().format('YYYY-MM-DD HH:mm:ss'));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const logout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.replace('/login');
  };

  const title = me?.class?.name || '班级工作台';
  return (
    <Layout.Header style={{ background: '#fff', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f0f0f0' }}>
      <Button type="text" icon={<MenuOutlined />} onClick={onOpenDrawer} style={{ display: mobile ? undefined : 'none' }} aria-label="打开菜单" />
      <Typography.Text strong>{title}</Typography.Text>
      <div style={{ flex: 1 }} />
      <Typography.Text type="secondary" style={{ fontSize: 12, display: mobile ? 'none' : undefined }}>{now}</Typography.Text>
      <Typography.Text style={{ fontSize: 12, marginLeft: 8 }}>{me?.user?.name ?? ''}</Typography.Text>
      <Button size="small" icon={<LogoutOutlined />} onClick={logout}>退出</Button>
      <Button type={editable ? 'primary' : 'default'} size="small" onClick={toggle}>
        {editable ? '完成' : '编辑'}
      </Button>
    </Layout.Header>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const screens = Grid.useBreakpoint();
  const mobile = !(screens.md ?? false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.ok ? r.json() : Promise.resolve(null))
      .then((m: Me | null) => setRole(m?.user?.role ?? null))
      .catch(() => setRole(null));
  }, []);

  // 管理员无班级：隐藏业务菜单后，把误入班级业务页的 admin 送回系统设置
  useEffect(() => {
    if (role === 'admin' && BUSINESS_MENU.some(m => m.key === pathname)) {
      router.replace('/settings');
    }
  }, [role, pathname, router]);

  if (pathname.startsWith('/login')) return <>{children}</>;

  const menuItems = role === 'admin'
    ? [SETTINGS_MENU, USERS_MENU]
    : [...BUSINESS_MENU, SETTINGS_MENU];

  const menu = (
    <Menu mode="inline" style={{ borderInlineEnd: 0, height: '100%' }}
      selectedKeys={[pathname]} items={menuItems}
      onClick={({ key }) => { router.push(key); setDrawerOpen(false); }} />
  );

  return (
    <EditableProvider>
      <Layout style={{ minHeight: '100vh' }}>
        {mobile ? (
          <Drawer placement="left" size={220} closable={false} open={drawerOpen} onClose={() => setDrawerOpen(false)} styles={{ body: { padding: 0 } }}>
            {menu}
          </Drawer>
        ) : (
          <Layout.Sider width={210} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
            <div style={{ padding: 16, textAlign: 'center', fontWeight: 600 }}>班主任智慧工作台</div>
            {menu}
          </Layout.Sider>
        )}
        <Layout>
          <ShellHeader onOpenDrawer={() => setDrawerOpen(true)} mobile={mobile} />
          <Layout.Content style={{ padding: 16, width: '100%' }}>
            {children}
          </Layout.Content>
        </Layout>
      </Layout>
    </EditableProvider>
  );
}
