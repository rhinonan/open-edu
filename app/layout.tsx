import type { Metadata } from 'next';
import './globals.css';
import AppShell from '@/components/app-shell';
import DayjsLocale from '@/components/dayjs-locale';
import ToastProvider from '@/components/toast-provider';

export const metadata: Metadata = {
  title: '班主任智慧工作台',
  description: '长沙小学六年级班主任智慧班级管理工作台',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <DayjsLocale />
        <ToastProvider />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
