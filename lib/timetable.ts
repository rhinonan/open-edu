import type { Row } from './types';

export const SUBJECTS = ['语文', '数学', '英语', '科学', '道德与法治', '体育', '音乐', '美术', '班会', '劳动', ''];

export const KIND_LABELS: Record<string, string> = { 正课: '正课', 自习: '自习', 托管: '托管', 陪餐: '陪餐' };

/** 以 `${weekday}-${period}` 为键把 timetable 行映射到网格 */
export function buildClassGrid(rows: Row[]): Map<string, Row> {
  const m = new Map<string, Row>();
  for (const r of rows) m.set(`${Number(r.weekday)}-${String(r.period)}`, r);
  return m;
}

/** 只统计 subject 非空的行（每班 5 天 × 6 时段 = 30 行） */
export function classStats(rows: Row[]): { total: number; chinese: number } {
  const subjectRows = rows.filter(r => String(r.subject ?? '') !== '');
  return {
    total: subjectRows.length,
    chinese: subjectRows.filter(r => r.is_chinese == 1).length,
  };
}

/** 按学科统计课时，只含非空学科 */
export function subjectDist(rows: Row[]): { name: string; 课时: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const s = String(r.subject ?? '');
    if (!s) continue;
    m.set(s, (m.get(s) ?? 0) + 1);
  }
  return [...m.entries()].map(([name, 课时]) => ({ name, 课时 })).filter(d => d.name);
}
