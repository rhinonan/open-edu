'use client';
import type { DashboardStats } from '@/lib/types';
import { StatCard } from '../ui/stat-card';

const fmt = (n: number) => n.toLocaleString('zh-CN');

export default function StatsGrid({ s }: { s: DashboardStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      <StatCard label="班级人数" value={`${s.studentCount} 人（男${s.maleCount}/女${s.femaleCount}）`} tone="blue" />
      <StatCard label="当日请假" value={`${s.todayLeaves} 人`} tone="teal" />
      <StatCard label="本周常规违纪" value={`${s.weekDiscipline} 条`} tone="teal" />
      <StatCard label="待办事项" value={`${s.todoPending} 项待办`} tone="purple" />
      <StatCard label="作业收缴率" value={`${s.homeworkSubmitRate}%`} tone="red" />
      <StatCard label="最近单元测平均分" value={s.latestExamAvg == null ? '—' : `${s.latestExamAvg} 分`} tone="blue" />
      <StatCard label="本月工作留痕" value={`${fmt(s.monthWorkLogs)} 条`} tone="teal" />
      <StatCard label="家校沟通" value={`家访${s.homeVisitCount} 次 · 家长会${s.parentMeetingCount} 场（沟通率${s.parentMeetingRate}%）`} tone="amber" />
    </div>
  );
}
