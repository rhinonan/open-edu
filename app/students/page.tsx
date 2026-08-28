'use client';
import { useMemo, useState } from 'react';
import { Button } from '@heroui/react';
import DataTable, { type ColumnDef } from '@/components/data-table';
import TableToolbar, { useColumnVisibility, type ToolbarColumn } from '@/components/table-toolbar';
import FormModal, { type FieldDef } from '@/components/form-modal';
import ImportModal, { type ImportResult } from '@/components/import-modal';
import Confirm from '@/components/confirm';
import { useResourceRows } from '@/components/use-resource';
import { parseCsv } from '@/lib/csv';
import { post } from '@/lib/api-client';
import { toast } from '@/lib/toast';
import type { ImportItem } from '@/lib/import';
import type { Row } from '@/lib/types';
import SensitiveValue from '@/components/sensitive-value';

const LEVELS = ['1', '2', '3', '4', '5', '6'];
const TOOLBAR_COLS: ToolbarColumn[] = [
  { key: 'student_no', label: '学号' }, { key: 'name', label: '姓名' },
  { key: 'gender', label: '性别' }, { key: 'parent_name', label: '家长姓名' },
  { key: 'parent_phone', label: '家长电话' }, { key: 'idcard', label: '身份证' },
  { key: 'address', label: '住址' }, { key: 'level', label: '学生层次' },
  { key: 'role', label: '班干部职务' },
  { key: 'noon_care', label: '中午托' }, { key: 'breakfast', label: '早餐' },
  { key: 'afternoon_care', label: '下午托' }, { key: 'remark', label: '备注' },
];

const COLUMNS: ColumnDef[] = [
  { key: 'student_no', label: '学号', type: 'text', sortable: true, sortValue: r => Number(r.student_no) || 0, minWidth: 76, noWrap: true },
  { key: 'name', label: '姓名', type: 'text', minWidth: 84, noWrap: true },
  { key: 'gender', label: '性别', type: 'select', options: ['男', '女'], filterOptions: ['男', '女'], minWidth: 84, noWrap: true },
  { key: 'parent_name', label: '家长姓名', type: 'text', minWidth: 100, noWrap: true },
  { key: 'parent_phone', label: '家长电话', minWidth: 148, noWrap: true, render: v => <SensitiveValue value={v} kind="phone" /> },
  { key: 'idcard', label: '身份证', minWidth: 200, noWrap: true, render: v => <SensitiveValue value={v} kind="idcard" /> },
  { key: 'address', label: '住址', type: 'text', minWidth: 160 },
  { key: 'level', label: '学生层次', type: 'select', options: LEVELS, filterOptions: LEVELS, minWidth: 112, noWrap: true },
  { key: 'role', label: '班干部职务', type: 'text', minWidth: 104, noWrap: true },
  { key: 'noon_care', label: '中午托', type: 'select', options: ['1', '0'], minWidth: 72, noWrap: true },
  { key: 'breakfast', label: '早餐', type: 'select', options: ['1', '0'], minWidth: 60, noWrap: true },
  { key: 'afternoon_care', label: '下午托', type: 'select', options: ['1', '0'], filterOptions: ['1', '0'], minWidth: 100, noWrap: true },
  { key: 'remark', label: '备注', type: 'textarea', minWidth: 160 },
];

const FIELDS: FieldDef[] = [
  { key: 'student_no', label: '学号' },
  { key: 'name', label: '姓名', required: true },
  { key: 'gender', label: '性别', type: 'select', options: ['男', '女'], initial: '男' },
  { key: 'parent_name', label: '家长姓名' },
  { key: 'parent_phone', label: '家长电话' },
  { key: 'idcard', label: '身份证' },
  { key: 'address', label: '住址' },
  { key: 'level', label: '学生层次', type: 'select', options: LEVELS, initial: '4' },
  { key: 'group_no', label: '小组', type: 'number', initial: '1' },
  { key: 'role', label: '班干部职务' },
  { key: 'noon_care', label: '中午托', type: 'select', options: [{ value: '1', label: '是' }, { value: '0', label: '否' }], initial: '0' },
  { key: 'breakfast', label: '早餐', type: 'select', options: [{ value: '1', label: '是' }, { value: '0', label: '否' }], initial: '0' },
  { key: 'afternoon_care', label: '下午托', type: 'select', options: [{ value: '1', label: '是' }, { value: '0', label: '否' }], initial: '1' },
  { key: 'remark', label: '备注', type: 'textarea' },
];

const to01 = (s: string) => (s === '是' || s === '有' || s === '1' ? 1 : 0);

const IMPORT_PROMPT = `请将我的数据按照示例模板整理成 CSV 表格，具体要求：

1. 表头必须与模板完全一致（一字不差）：
学号,姓名,性别,家长姓名,家长电话,身份证,住址,学生层次,班干部职务,中午托,早餐,下午托,备注
2. 学生层次：填 1~6 的数字，没有则填 4
3. 性别：只能填 男 或 女
4. 中午托 / 早餐 / 下午托：只能填 是 或 否
5. 身份证：每行必填，不能留空
6. 学号：没有可留空

请直接输出整理好的 CSV 内容，不要加任何多余的解释、代码块标记或 Markdown。`;

const IMPORT_TEMPLATE_ROWS: (string | number)[][] = [
  ['2026001', '张三', '男', '张三丰', '13800000000', '110101199001010011', '北京市海淀区中关村1号', '4', '班长', '是', '否', '是', ''],
  ['', '李四', '女', '李四娘', '13900000000', '110101199002020022', '北京市朝阳区望京2号', '4', '', '否', '是', '是', ''],
];

function parseRow(f: Record<string, string>, line: number): { ok: true; row: ImportItem } | { ok: false; message: string } {
  const lv = f['level'] === '' ? 4 : Number(f['level']);
  if (!Number.isInteger(lv) || lv < 1 || lv > 6) return { ok: false, message: '学生层次需为 1-6' };
  return {
    ok: true,
    row: {
      line, idcard: f['idcard'] ?? '', student_no: f['student_no'] ?? '', name: f['name'] ?? '',
      gender: f['gender'] || '男', parent_name: f['parent_name'] ?? '', parent_phone: f['parent_phone'] ?? '',
      address: f['address'] ?? '', level: lv, group_no: Number(f['group_no']) || 1,
      role: f['role'] ?? '', noon_care: to01(f['noon_care'] ?? ''), breakfast: to01(f['breakfast'] ?? ''),
      afternoon_care: to01(f['afternoon_care'] ?? ''), remark: f['remark'] ?? '',
    },
  };
}

export default function StudentsPage() {
  const { rows, loading, update, create, remove, reload } = useResourceRows('students');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:students', ['address', 'remark']);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const columns = useMemo(() => COLUMNS.filter(c => !hidden.has(c.key)), [hidden]);

  const onImport = async (text: string): Promise<ImportResult> => {
    const table = parseCsv(text);
    if (table.length < 2) throw new Error('文件为空或只有表头');
    const headerIdx = new Map(table[0].map((h, i) => [h.trim(), i]));
    const items: ImportItem[] = [];
    const skipped: { row: number; message: string }[] = [];
    table.slice(1).forEach((row, idx) => {
      const fields: Record<string, string> = {};
      TOOLBAR_COLS.forEach(col => {
        const i = headerIdx.get(col.label);
        fields[col.key] = i === undefined ? '' : (row[i] ?? '').trim();
      });
      const parsed = parseRow(fields, idx + 2);
      if (parsed.ok) items.push(parsed.row);
      else skipped.push({ row: idx + 2, message: parsed.message });
    });
    const res = await post<ImportResult>('/api/students/import', { rows: items });
    return {
      created: res.created,
      updated: res.updated,
      skipped: res.skipped + skipped.length,
      errors: [...res.errors, ...skipped],
    };
  };

  const submit = async (v: Record<string, string | number | null>) => {
    await create(v);
    toast.success('已新增');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TableToolbar title="学生管理" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} onImport={() => setImportOpen(true)} />
      <DataTable
        label="学生管理"
        columns={columns}
        rows={rows}
        loading={loading}
        onSave={update}
        pageSize={20}
        actions={(r) => <Button variant="danger-soft" size="sm" onPress={() => setDeleting(r)}>删除</Button>}
      />
      <FormModal title="新增学生" fields={FIELDS} open={addOpen} onClose={() => setAddOpen(false)} onSubmit={submit} />
      <ImportModal
        title="学生导入"
        prompt={IMPORT_PROMPT}
        templateFilename="学生导入示例模板.csv"
        templateHeaders={TOOLBAR_COLS.map(c => c.label)}
        templateRows={IMPORT_TEMPLATE_ROWS}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={onImport}
        onSuccess={() => void reload()}
      />
      <Confirm
        open={!!deleting}
        onOpenChange={(o) => { if (!o) setDeleting(null); }}
        title="删除记录"
        message="确定删除该记录？"
        confirmText="删除"
        danger
        onConfirm={async () => {
          if (!deleting) return;
          try { await remove(deleting.id as number); toast.success('已删除'); }
          catch { toast.error('删除失败'); }
          setDeleting(null);
        }}
      />
    </div>
  );
}
