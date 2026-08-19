'use client';
import CrudPage from '@/components/crud/crud-page';
import type { CrudPageConfig } from '@/components/crud/types';
import type { ImportItem } from '@/lib/import';

const nextNo = (rows: { student_no?: string | number | null }[]) =>
  String((rows.reduce((m, r) => Math.max(m, Number(r.student_no) || 0), 0) + 1)).padStart(2, '0');

const to01 = (s: string) => (s === '是' || s === '有' || s === '1' ? 1 : 0);

const config: CrudPageConfig = {
  resource: 'students',
  title: '学生管理',
  columns: [
    { key: 'student_no', label: '学号', width: '60px' },
    { key: 'name', label: '姓名', width: '90px' },
    { key: 'gender', label: '性别', type: 'select', options: ['男', '女'], width: '70px' },
    { key: 'parent_name', label: '家长姓名', width: '100px' },
    { key: 'parent_phone', label: '家长电话', type: 'tel', width: '130px' },
    { key: 'idcard', label: '身份证', nullOnEmpty: true, width: '160px' },
    { key: 'address', label: '住址', width: '160px' },
    { key: 'level', label: '学生层次', type: 'select', options: ['1', '2', '3', '4', '5', '6'], width: '90px' },
    { key: 'group_no', label: '小组', type: 'number', width: '70px' },
    { key: 'role', label: '班干部职务' },
    { key: 'noon_care', label: '中午托', type: 'select', options: ['1', '0'], width: '90px' },
    { key: 'breakfast', label: '早餐', type: 'select', options: ['1', '0'], width: '90px' },
    { key: 'afternoon_care', label: '下午托', type: 'select', options: ['1', '0'], width: '90px' },
    { key: 'remark', label: '备注', type: 'text' },
  ],
  defaultHidden: ['address', 'remark'],
  sortRows: (a, b) => (Number(a.student_no) || 0) - (Number(b.student_no) || 0),
  filters: [
    { key: 'gender', label: '性别', options: ['男', '女'] },
    { key: 'afternoon_care', label: '下午托', options: ['1', '0'] },
    { key: 'level', label: '层次', options: ['1', '2', '3', '4', '5', '6'] },
  ],
  stats: rows => [
    { label: '总人数', value: rows.length, tone: 'blue' },
    { label: '男生', value: rows.filter(r => r.gender === '男').length, tone: 'teal' },
    { label: '女生', value: rows.filter(r => r.gender === '女').length, tone: 'purple' },
    { label: '班干部', value: rows.filter(r => r.role).length, tone: 'amber' },
    { label: '重点关注(1档)', value: rows.filter(r => Number(r.level) === 1).length, tone: 'red' },
  ],
  defaultNewRow: rows => ({
    student_no: nextNo(rows),
    name: '新学生', gender: '男', parent_name: '', parent_phone: '', idcard: null,
    address: '', level: 4, group_no: 1, role: '', noon_care: 0, breakfast: 0,
    afternoon_care: 1, remark: '',
  }),
  importTemplate: {
    filename: '学生导入模板.csv',
    columns: [
      { key: 'student_no', label: '学号' },
      { key: 'name', label: '姓名' },
      { key: 'gender', label: '性别' },
      { key: 'parent_name', label: '家长姓名' },
      { key: 'parent_phone', label: '家长电话' },
      { key: 'idcard', label: '身份证' },
      { key: 'address', label: '住址' },
      { key: 'level', label: '学生层次' },
      { key: 'group_no', label: '小组' },
      { key: 'role', label: '班干部职务' },
      { key: 'noon_care', label: '中午托' },
      { key: 'breakfast', label: '早餐' },
      { key: 'afternoon_care', label: '下午托' },
      { key: 'remark', label: '备注' },
    ],
    exampleRow: { student_no: '46', name: '示例学生', gender: '男', parent_name: '示例家长', parent_phone: '13800000000', idcard: '430102201301010011', address: '青园街道示例小区', level: 4, group_no: 2, role: '语文课代表', noon_care: 1, breakfast: 0, afternoon_care: 1, remark: '' },
    parseRow: (f, line): { ok: true; row: ImportItem } | { ok: false; message: string } => {
      const lv = f['level'] === '' ? 4 : Number(f['level']);
      if (!Number.isInteger(lv) || lv < 1 || lv > 6) return { ok: false, message: '学生层次需为 1-6' };
      return {
        ok: true,
        row: {
          line,
          idcard: f['idcard'] ?? '',
          student_no: f['student_no'] ?? '',
          name: f['name'] ?? '',
          gender: f['gender'] || '男',
          parent_name: f['parent_name'] ?? '',
          parent_phone: f['parent_phone'] ?? '',
          address: f['address'] ?? '',
          level: lv,
          group_no: Number(f['group_no']) || 1,
          role: f['role'] ?? '',
          noon_care: to01(f['noon_care'] ?? ''),
          breakfast: to01(f['breakfast'] ?? ''),
          afternoon_care: to01(f['afternoon_care'] ?? ''),
          remark: f['remark'] ?? '',
        },
      };
    },
  },
};

export default function StudentsPage() {
  return <CrudPage config={config} />;
}
