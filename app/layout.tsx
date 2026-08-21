import type { Metadata } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { App, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import './globals.css';
import AppShell from '@/components/app-shell';
import DayjsLocale from '@/components/dayjs-locale';

dayjs.locale('zh-cn');

export const metadata: Metadata = {
  title: '班主任智慧工作台',
  description: '长沙小学六年级班主任智慧班级管理工作台',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdRegistry>
          <ConfigProvider locale={zhCN}>
            <App>
              <DayjsLocale />
              <AppShell>{children}</AppShell>
            </App>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
