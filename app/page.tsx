'use client';
import { useEffect, useState } from 'react';
import { get } from '@/lib/api-client';
import type { DashboardStats } from '@/lib/types';
import StatsGrid from '@/components/dashboard/stats-grid';
import QuickActions from '@/components/dashboard/quick-actions';

export default function HomePage() {
  const [s, setS] = useState<DashboardStats | null>(null);
  useEffect(() => { get<DashboardStats>('/api/dashboard').then(setS); }, []);
  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-800 mb-4">班级工作台</h1>
      {s ? <StatsGrid s={s} /> : <div className="text-sm text-slate-400 py-8 text-center">加载中…</div>}
      <QuickActions />
    </div>
  );
}
