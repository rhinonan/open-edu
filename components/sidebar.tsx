'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, CalendarDays, CalendarRange, Users, LineChart, NotebookPen,
  UserMinus, TriangleAlert, MessageCircle, Home, Star, Armchair, MessagesSquare,
  ShieldAlert, GraduationCap, History, Settings, type LucideIcon,
} from 'lucide-react';

const MENU: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: '仪表盘', icon: LayoutDashboard },
  { href: '/schedule', label: '日程安排', icon: CalendarDays },
  { href: '/timetable', label: '我的课表', icon: CalendarRange },
  { href: '/students', label: '学生管理', icon: Users },
  { href: '/grades', label: '成绩分析', icon: LineChart },
  { href: '/homework', label: '作业管理', icon: NotebookPen },
  { href: '/leaves', label: '请假管理', icon: UserMinus },
  { href: '/discipline', label: '违纪台账', icon: TriangleAlert },
  { href: '/conversations', label: '谈话记录', icon: MessageCircle },
  { href: '/visits', label: '生涯家访', icon: Home },
  { href: '/evaluation', label: '综合素质评价', icon: Star },
  { href: '/seats', label: '排座位', icon: Armchair },
  { href: '/parent-comm', label: '家校沟通', icon: MessagesSquare },
  { href: '/safety', label: '安全台账', icon: ShieldAlert },
  { href: '/peiyou', label: '培优临界生', icon: GraduationCap },
  { href: '/work-logs', label: '工作留痕', icon: History },
  { href: '/settings', label: '系统设置', icon: Settings },
];

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="w-full h-full flex flex-col gap-0.5 p-2 overflow-y-auto">
      <div className="sticky top-0 z-10 bg-navy px-3 py-4 text-center text-sm font-semibold text-white/90 border-b border-white/10 mb-2">
        班主任智慧工作台
      </div>
      {MENU.map(m => {
        const Icon = m.icon;
        const active = pathname === m.href;
        return (
          <Link
            key={m.href}
            href={m.href}
            onClick={onNavigate}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm transition-colors ${
              active ? 'bg-accent text-white' : 'text-white/75 hover:bg-navy-soft hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{m.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
