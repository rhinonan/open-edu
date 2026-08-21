'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button, Drawer, Grid, Layout, Menu, Typography } from 'antd';
import {
  AppstoreOutlined, BarChartOutlined, BookOutlined, CalendarOutlined,
  CommentOutlined, DashboardOutlined, FileTextOutlined, FlagOutlined,
  HomeOutlined, MenuOutlined, MessageOutlined, SafetyOutlined,
  SettingOutlined, StarOutlined, TeamOutlined, UserAddOutlined, UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { EditableProvider, useEditable } from './editable-context';

const MENU_ITEMS = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/schedule', icon: <CalendarOutlined />, label: '日程安排' },
  { key: '/timetable', icon: <CalendarOutlined />, label: '我的课表' },
  { key: '/students', icon: <TeamOutlined />, label: '学生管理' },
  { key: '/grades', icon: <BarChartOutlined />, label: '成绩分析' },
  { key: '/homework', icon: <BookOutlined />, label: '作业管理' },
  { key: '/leaves', icon: <UserAddOutlined />, label: '请假管理' },
  { key: '/discipline', icon: <FlagOutlined />, label: '违纪台账' },
  { key: '/conversations', icon: <CommentOutlined />, label: '谈话记录' },
  { key: '/visits', icon: <HomeOutlined />, label: '生涯家访' },
  { key: '/evaluation', icon: <StarOutlined />, label: '综合素质评价' },
  { key: '/seats', icon: <AppstoreOutlined />, label: '排座位' },
  { key: '/parent-comm', icon: <MessageOutlined />, label: '家校沟通' },
  { key: '/safety', icon: <SafetyOutlined />, label: '安全台账' },
  { key: '/peiyou', icon: <UserOutlined />, label: '培优临界生' },
  { key: '/work-logs', icon: <FileTextOutlined />, label: '工作留痕' },
  { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
];

function ShellHeader({ onOpenDrawer, mobile }: { onOpenDrawer: () => void; mobile: boolean }) {
  const { editable, toggle } = useEditable();
  const [now, setNow] = useState('');
  const [className, setClassName] = useState('');
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then((rows: { key: string; value: string }[]) => {
      const c = rows.find(r => r.key === 'class_name');
      if (c) setClassName(c.value);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    const tick = () => setNow(dayjs().format('YYYY-MM-DD HH:mm:ss'));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <Layout.Header style={{ background: '#fff', padding: '0 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f0f0f0' }}>
      <Button type="text" icon={<MenuOutlined />} onClick={onOpenDrawer} style={{ display: mobile ? undefined : 'none' }} aria-label="打开菜单" />
      <Typography.Text strong>{className || '班级工作台'}</Typography.Text>
      <div style={{ flex: 1 }} />
      <Typography.Text type="secondary" style={{ fontSize: 12, display: mobile ? 'none' : undefined }}>{now}</Typography.Text>
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

  const menu = (
    <Menu
      mode="inline"
      style={{ borderInlineEnd: 0, height: '100%' }}
      selectedKeys={[pathname]}
      items={MENU_ITEMS}
      onClick={({ key }) => { router.push(key); setDrawerOpen(false); }}
    />
  );

  return (
    <EditableProvider>
      <Layout style={{ minHeight: '100vh' }}>
        {mobile ? (
          <Drawer placement="left" width={220} closable={false} open={drawerOpen} onClose={() => setDrawerOpen(false)} styles={{ body: { padding: 0 } }}>
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
          <Layout.Content style={{ padding: 16, width: '100%', maxWidth: 1152, margin: '0 auto' }}>
            {children}
          </Layout.Content>
        </Layout>
      </Layout>
    </EditableProvider>
  );
}
