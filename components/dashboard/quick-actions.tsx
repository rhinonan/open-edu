'use client';
import Link from 'next/link';
import { useState } from 'react';
import QuickAddModal from '../crud/quick-add';
import type { ResourceKey } from '@/lib/types';
import type { ColumnDef } from '../crud/types';

interface Tile { label: string; icon: string; href?: string; quick?: { resource: ResourceKey; title: string; columns: ColumnDef[] }; }

const QUICK: Tile[] = [
  { label: '记违纪', icon: '▲', quick: { resource: 'discipline_records', title: '记违纪', columns: [{ key: 'student_name', label: '学生' }, { key: 'category', label: '类别' }, { key: 'content', label: '违纪内容' }, { key: 'action', label: '处理方式' }] } },
  { label: '布置作业', icon: '✎', quick: { resource: 'homework', title: '布置作业', columns: [{ key: 'subject', label: '学科' }, { key: 'assign_date', label: '布置日期', type: 'date' }, { key: 'requirement', label: '作业要求' }, { key: 'deadline', label: '截止时间', type: 'date' }] } },
  { label: '请假登记', icon: '◑', quick: { resource: 'leave_records', title: '请假登记', columns: [{ key: 'student_name', label: '学生' }, { key: 'leave_type', label: '假别' }, { key: 'reason', label: '事由' }, { key: 'start_date', label: '开始日期', type: 'date' }, { key: 'end_date', label: '结束日期', type: 'date' }] } },
  { label: '工作留痕', icon: '▦', href: '/work-logs' },
  { label: '谈心谈话', icon: '☏', quick: { resource: 'conversations', title: '谈心谈话', columns: [{ key: 'student_name', label: '学生' }, { key: 'topic', label: '主题' }, { key: 'content', label: '内容' }, { key: 'effect', label: '效果' }] } },
  { label: '录入成绩', icon: '▥', href: '/grades' },
  { label: '添加待办', icon: '◈', quick: { resource: 'todos', title: '添加待办', columns: [{ key: 'title', label: '事项' }, { key: 'date', label: '日期', type: 'date' }, { key: 'priority', label: '优先级' }] } },
  { label: '发布家校通知', icon: '✉', quick: { resource: 'parent_comm', title: '家校沟通', columns: [{ key: 'student_name', label: '学生/对象' }, { key: 'way', label: '方式' }, { key: 'content', label: '内容' }] } },
  { label: '日程安排', icon: '◷', href: '/schedule' },
  { label: '班级排位', icon: '▤', href: '/seats' },
  { label: '学生档案', icon: '◧', href: '/students' },
  { label: '家访记录', icon: '⌂', quick: { resource: 'home_visits', title: '家访记录', columns: [{ key: 'student_name', label: '学生' }, { key: 'way', label: '方式' }, { key: 'content', label: '内容' }] } },
];

export default function QuickActions() {
  const [active, setActive] = useState<(typeof QUICK)[number] | null>(null);
  return (
    <>
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-slate-600 mb-3">快捷操作</h3>
        <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
          {QUICK.map(t => (
            t.href ? (
              <Link key={t.label} href={t.href} className="flex flex-col items-center gap-1.5 py-3 rounded-md hover:bg-blue-50 text-slate-600">
                <span className="text-xl">{t.icon}</span>
                <span className="text-xs">{t.label}</span>
              </Link>
            ) : (
              <button key={t.label} onClick={() => setActive(t)} className="flex flex-col items-center gap-1.5 py-3 rounded-md hover:bg-blue-50 text-slate-600">
                <span className="text-xl">{t.icon}</span>
                <span className="text-xs">{t.label}</span>
              </button>
            )
          ))}
        </div>
      </div>
      {active?.quick && (
        <QuickAddModal
          resource={active.quick.resource}
          title={active.quick.title}
          columns={active.quick.columns}
          open={!!active}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}
