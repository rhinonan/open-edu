'use client';
import CrudPage from '@/components/crud/crud-page';
import type { CrudPageConfig } from '@/components/crud/types';

const config: CrudPageConfig = {
  resource: 'students',
  title: '学生管理',
  columns: [
    { key: 'name', label: '姓名', width: '90px' },
    { key: 'gender', label: '性别', type: 'select', options: ['男', '女'], width: '70px' },
    { key: 'parent_phone', label: '家长电话', type: 'tel', width: '130px' },
    { key: 'role', label: '班干部职务' },
    { key: 'group_no', label: '小组', type: 'number', width: '70px' },
    { key: 'level', label: '学生层次', type: 'select', options: ['优秀', '良好', '合格', '重点关注'] },
    { key: 'afternoon_care', label: '下午托', type: 'select', options: ['1', '0'], width: '90px' },
    { key: 'remark', label: '备注', type: 'text' },
  ],
  filters: [
    { key: 'gender', label: '性别', options: ['男', '女'] },
    { key: 'afternoon_care', label: '下午托', options: ['1', '0'] },
    { key: 'level', label: '层次', options: ['优秀', '良好', '合格', '重点关注'] },
  ],
  stats: rows => [
    { label: '总人数', value: rows.length, tone: 'blue' },
    { label: '男生', value: rows.filter(r => r.gender === '男').length, tone: 'teal' },
    { label: '女生', value: rows.filter(r => r.gender === '女').length, tone: 'purple' },
    { label: '班干部', value: rows.filter(r => r.role).length, tone: 'amber' },
    { label: '重点关注', value: rows.filter(r => r.level === '重点关注').length, tone: 'red' },
  ],
  defaultNewRow: () => ({ name: '新学生', gender: '男', parent_phone: '', role: '', group_no: 1, level: '良好', afternoon_care: 1, remark: '' }),
};

export default function StudentsPage() {
  return <CrudPage config={config} />;
}
