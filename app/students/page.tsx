'use client';
import { useMemo, useState } from 'react';
import { App, Button, Form, Input, InputNumber, Modal, Select, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import type { Row } from '@/lib/types';
import { useResourceRows } from '@/components/use-resource';
import EditableCell from '@/components/editable-cell';
import TableToolbar, { useColumnVisibility } from '@/components/table-toolbar';
import { parseCsv } from '@/lib/csv';
import { post } from '@/lib/api-client';
import type { ImportItem } from '@/lib/import';

const LEVELS = ['1', '2', '3', '4', '5', '6'];
const TOOLBAR_COLS = [
  { key: 'student_no', label: '学号' }, { key: 'name', label: '姓名' },
  { key: 'gender', label: '性别' }, { key: 'parent_name', label: '家长姓名' },
  { key: 'parent_phone', label: '家长电话' }, { key: 'idcard', label: '身份证' },
  { key: 'address', label: '住址' }, { key: 'level', label: '学生层次' },
  { key: 'group_no', label: '小组' }, { key: 'role', label: '班干部职务' },
  { key: 'noon_care', label: '中午托' }, { key: 'breakfast', label: '早餐' },
  { key: 'afternoon_care', label: '下午托' }, { key: 'remark', label: '备注' },
];

const to01 = (s: string) => (s === '是' || s === '有' || s === '1' ? 1 : 0);

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
  const { message } = App.useApp();
  const { rows, loading, update, create, remove } = useResourceRows('students');
  const { hidden, toggle } = useColumnVisibility('gzt:cols:students', ['address', 'remark']);
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();

  const columns: TableColumnsType<Row> = useMemo(() => {
    const cols = TOOLBAR_COLS.filter(col => !hidden.has(col.key)).map(col => {
      const selectCol = col.key === 'gender' || col.key === 'level' || col.key === 'noon_care' || col.key === 'breakfast' || col.key === 'afternoon_care';
      const options = col.key === 'gender' ? ['男', '女']
        : col.key === 'level' ? LEVELS
        : (col.key === 'noon_care' || col.key === 'breakfast' || col.key === 'afternoon_care') ? ['1', '0'] : undefined;
      return {
        title: col.label,
        dataIndex: col.key,
        width: col.key === 'address' ? 180 : undefined,
        sorter: col.key === 'student_no' ? (a: Row, b: Row) => (Number(a.student_no) || 0) - (Number(b.student_no) || 0) : undefined,
        filters: col.key === 'gender' ? [{ text: '男', value: '男' }, { text: '女', value: '女' }]
          : col.key === 'level' ? LEVELS.map(v => ({ text: v, value: v }))
          : col.key === 'afternoon_care' ? [{ text: '1', value: '1' }, { text: '0', value: '0' }]
          : undefined,
        onFilter: selectCol && options ? (v: unknown, r: Row) => String(r[col.key]) === String(v) : undefined,
        render: (_: unknown, r: Row) => (
          <EditableCell
            value={r[col.key]}
            type={selectCol ? 'select' : col.key === 'parent_phone' ? 'tel' : col.key === 'remark' ? 'textarea' : 'text'}
            options={options}
            nullOnEmpty={col.key === 'idcard'}
            onSave={v => update(r.id as number, { [col.key]: v })}
          />
        ),
      };
    });
    return [
      ...cols,
      {
        title: '操作', key: 'op', width: 64, fixed: 'right', exportable: false,
        render: (_: unknown, r: Row) => (
          <Button type="link" danger size="small" onClick={async () => {
            try { await remove(r.id as number); message.success('已删除'); } catch { message.error('删除失败'); }
          }}>删除</Button>
        ),
      },
    ];
  }, [hidden, update, remove, message]);

  const onImport = async (text: string) => {
    const table = parseCsv(text);
    if (table.length < 2) { message.warning('文件为空或只有表头'); return; }
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
    try {
      const res = await post<{ created: number; updated: number; skipped: number; errors: { row: number; message: string }[] }>('/api/students/import', { rows: items });
      const errs = [...res.errors, ...skipped];
      if (errs.length) message.warning(`新增 ${res.created} · 更新 ${res.updated} · 跳过 ${res.skipped + skipped.length}（${errs[0].row}行: ${errs[0].message} 等）`);
      else message.success(`新增 ${res.created} · 更新 ${res.updated}`);
    } catch { message.error('导入失败'); }
  };

  const submit = async () => {
    try {
      const v = await form.validateFields();
      await create(v);
      message.success('已新增');
      setAddOpen(false); form.resetFields();
    } catch { /* 校验/请求失败 */ }
  };

  return (
    <div>
      <TableToolbar title="学生管理" columns={TOOLBAR_COLS} hidden={hidden} onToggleColumn={toggle} rows={rows} onAdd={() => setAddOpen(true)} onImport={onImport} />
      <Table<Row> rowKey="id" columns={columns} dataSource={rows} loading={loading} size="middle" pagination={{ pageSize: 10, showSizeChanger: false }} scroll={{ x: 'max-content' }} />
      <Modal title="新增学生" open={addOpen} onCancel={() => setAddOpen(false)} onOk={submit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="student_no" label="学号"><Input /></Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}><Input /></Form.Item>
          <Form.Item name="gender" label="性别" initialValue="男"><Select options={['男', '女'].map(v => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item name="parent_name" label="家长姓名"><Input /></Form.Item>
          <Form.Item name="parent_phone" label="家长电话"><Input /></Form.Item>
          <Form.Item name="idcard" label="身份证"><Input /></Form.Item>
          <Form.Item name="address" label="住址"><Input /></Form.Item>
          <Form.Item name="level" label="学生层次" initialValue={4}><InputNumber min={1} max={6} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="group_no" label="小组" initialValue={1}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="role" label="班干部职务"><Input /></Form.Item>
          <Form.Item name="noon_care" label="中午托" initialValue={0}><Select options={[{ value: 1, label: '是' }, { value: 0, label: '否' }]} /></Form.Item>
          <Form.Item name="breakfast" label="早餐" initialValue={0}><Select options={[{ value: 1, label: '是' }, { value: 0, label: '否' }]} /></Form.Item>
          <Form.Item name="afternoon_care" label="下午托" initialValue={1}><Select options={[{ value: 1, label: '是' }, { value: 0, label: '否' }]} /></Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
