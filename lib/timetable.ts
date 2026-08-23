import type { DatabaseSync } from 'node:sqlite';
import type { Row } from './types';

export type PeriodKind = '正课' | '自习' | '托管' | '陪餐';

export const SUBJECTS = ['语文', '数学', '英语', '科学', '道德与法治', '体育', '音乐', '美术', '班会', '劳动', ''];

export const KIND_LABELS: Record<string, string> = { 正课: '正课', 自习: '自习', 托管: '托管', 陪餐: '陪餐' };

/** 以 `${weekday}-${period_id}` 为键把 timetable 行映射到网格 */
export function buildClassGrid(slots: Row[], rows: Row[]): Map<string, Row> {
  const m = new Map<string, Row>();
  for (const r of rows) m.set(`${Number(r.weekday)}-${Number(r.period_id)}`, r);
  return m;
}

/** 只统计正课时段且 subject 非空的行 */
export function classStats(slots: Row[], rows: Row[]): { total: number; chinese: number } {
  const zheng = new Set(slots.filter(s => s.kind === '正课').map(s => Number(s.id)));
  const subjectRows = rows.filter(r => zheng.has(Number(r.period_id)) && String(r.subject ?? '') !== '');
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

/** 删除时段并级联删除其下 timetable 与 teacher_schedule 行 */
export function removePeriodSlot(db: DatabaseSync, id: number): void {
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM timetable WHERE period_id = ?').run(id);
    db.prepare('DELETE FROM teacher_schedule WHERE period_id = ?').run(id);
    db.prepare('DELETE FROM period_slots WHERE id = ?').run(id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
