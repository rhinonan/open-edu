'use client';
import { useMemo, useState } from 'react';
import { Button, ListBox, Select, Skeleton, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Upload } from 'lucide-react';
import ImportModal, { type ImportResult } from '@/components/import-modal';
import StatCard from '@/components/stat-card';
import EditableCell from '@/components/editable-cell';
import { useResourceRows } from '@/components/use-resource';
import { CategoryColor } from '@/lib/color-utils';
import { parseCsv } from '@/lib/csv';
import { post } from '@/lib/api-client';
import type { ImportGradeItem } from '@/lib/import';

const SUBJECTS = ['语文', '数学', '英语'];

const IMPORT_COLS = [
  { key: 'exam_name', label: '考试' },
  { key: 'subject', label: '科目' },
  { key: 'student_name', label: '学生姓名' },
  { key: 'score', label: '分数' },
];

const IMPORT_PROMPT = `请将我的数据按照示例模板整理成 CSV 表格，具体要求：

1. 表头必须与模板完全一致（一字不差）：
考试,科目,学生姓名,分数
2. 科目：只能填 语文、数学 或 英语
3. 分数：填 0~100 之间的数字
4. 学生姓名：每行必填，不能留空
5. 考试：同一批数据保持同一个考试名称（没有则填 期中考试）

请直接输出整理好的 CSV 内容，不要加任何多余的解释、代码块标记或 Markdown。`;

const IMPORT_TEMPLATE_ROWS: (string | number)[][] = [
  ['期中考试', '语文', '张三', '95'],
  ['期中考试', '数学', '李四', '88'],
];

function parseGradeRow(f: Record<string, string>, line: number): { ok: true; row: ImportGradeItem } | { ok: false; message: string } {
  const score = Number(f['score']);
  if (!f['student_name']) return { ok: false, message: '缺少学生姓名' };
  if (!SUBJECTS.includes(f['subject'])) return { ok: false, message: '科目需为语文/数学/英语' };
  if (!Number.isFinite(score) || score < 0 || score > 100) return { ok: false, message: '分数需为 0-100 的数字' };
  return {
    ok: true,
    row: { line, exam_name: f['exam_name'] ?? '', subject: f['subject'], student_name: f['student_name'], score },
  };
}

export default function GradesPage() {
  const { rows, loading, update, reload } = useResourceRows('grades');
  const [importOpen, setImportOpen] = useState(false);
  const [exam, setExam] = useState<string | null>(null);
  const [subject, setSubject] = useState<string>('语文');

  const exams = useMemo(() => [...new Set(rows.map(r => String(r.exam_name)))], [rows]);
  const latestExam = useMemo(() => exams[exams.length - 1] ?? '', [exams]);
  const currentExam = exam ?? latestExam;

  const current = useMemo(() =>
    rows.filter(r => r.exam_name === currentExam && r.subject === subject),
    [rows, currentExam, subject]);

  const stats = useMemo(() => {
    const scores = current.map(r => Number(r.score));
    if (scores.length === 0) return [];
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const pass = Math.round((scores.filter(s => s >= 60).length / scores.length) * 1000) / 10;
    const good = Math.round((scores.filter(s => s >= 85).length / scores.length) * 1000) / 10;
    return [
      { title: '平均分', value: avg.toFixed(1) },
      { title: '及格率', value: `${pass}%` },
      { title: '优秀率(≥85)', value: `${good}%` },
      { title: '最高/最低', value: `${Math.max(...scores)} / ${Math.min(...scores)}` },
    ];
  }, [current]);

  const histogram = useMemo(() => {
    const bins = [
      { label: '<60', min: 0, max: 59 }, { label: '60-69', min: 60, max: 69 },
      { label: '70-79', min: 70, max: 79 }, { label: '80-89', min: 80, max: 89 },
      { label: '90-100', min: 90, max: 100 },
    ];
    return bins.map(b => ({ name: b.label, 人数: current.filter(r => { const s = Number(r.score); return s >= b.min && s <= b.max; }).length }));
  }, [current]);

  const onImport = async (text: string): Promise<ImportResult> => {
    const table = parseCsv(text);
    if (table.length < 2) throw new Error('文件为空或只有表头');
    const headerIdx = new Map(table[0].map((h, i) => [h.trim(), i]));
    const items: ImportGradeItem[] = [];
    const localErrors: { row: number; message: string }[] = [];
    table.slice(1).forEach((row, idx) => {
      if (row.length === 1 && row[0].trim() === '') return; // 跳过空行
      const fields: Record<string, string> = {};
      IMPORT_COLS.forEach(col => {
        const i = headerIdx.get(col.label);
        fields[col.key] = i === undefined ? '' : (row[i] ?? '').trim();
      });
      const parsed = parseGradeRow(fields, idx + 2);
      if (parsed.ok) items.push(parsed.row);
      else localErrors.push({ row: idx + 2, message: parsed.message });
    });
    if (items.length === 0) throw new Error('没有可导入的有效数据');
    const res = await post<ImportResult>('/api/grades/import', { rows: items });
    return {
      created: res.created,
      updated: res.updated,
      skipped: res.skipped + localErrors.length,
      errors: [...res.errors, ...localErrors],
    };
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-semibold text-slate-800">成绩分析</h2>
        <Button variant="outline" size="sm" onPress={() => setImportOpen(true)}>
          <Upload size={16} /> 导入
        </Button>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          aria-label="选择考试"
          className="w-52"
          placeholder="选择考试"
          selectedKey={currentExam === '' ? '' : currentExam}
          onSelectionChange={k => setExam(k === null || k === '' ? null : String(k))}
        >
          <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
          <Select.Popover>
            <ListBox>
              {exams.map(e => <ListBox.Item key={e} id={e}>{e || '未命名考试'}</ListBox.Item>)}
            </ListBox>
          </Select.Popover>
        </Select>
        <ToggleButtonGroup selectionMode="single" selectedKeys={new Set([subject])} onSelectionChange={(keys) => { const k = [...keys][0]; if (k) setSubject(String(k)); }}>
          {SUBJECTS.map(s => <ToggleButton key={s} id={s}>{s}</ToggleButton>)}
        </ToggleButtonGroup>
      </div>
      {loading ? <div className="space-y-3"><Skeleton className="h-10 rounded-lg" /><Skeleton className="h-40 rounded-lg" /></div> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {stats.map(s => <StatCard key={s.title} title={s.title} value={s.value} />)}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-600">分数段分布（直方图）</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height={224}>
                  <BarChart data={histogram}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="人数" fill={CategoryColor(subject)} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-xl bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-600">成绩明细（点击可改）</h3>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-slate-500">
                    <tr>
                      <th className="border-b border-gray-200 px-3 py-2 text-left font-medium">姓名</th>
                      <th className="border-b border-gray-200 px-3 py-2 text-left font-medium">分数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {current.map(r => (
                      <tr key={r.id} className="border-b border-gray-100">
                        <td className="px-3 py-1.5">{r.student_name}</td>
                        <td className="px-3 py-1.5"><EditableCell value={r.score} type="number" onSave={v => update(r.id as number, { score: v })} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
      <ImportModal
        title="成绩导入"
        prompt={IMPORT_PROMPT}
        templateFilename="成绩导入示例模板.csv"
        templateHeaders={IMPORT_COLS.map(c => c.label)}
        templateRows={IMPORT_TEMPLATE_ROWS}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={onImport}
        onSuccess={() => void reload()}
      />
    </div>
  );
}
