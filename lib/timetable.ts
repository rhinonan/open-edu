import type { DatabaseSync } from 'node:sqlite';
import type { Row } from './types';

export type PeriodKind = '正课' | '自习' | '托管' | '陪餐';

export const SUBJECTS = ['语文', '数学', '英语', '科学', '道德与法治', '体育', '音乐', '美术', '班会', '劳动', ''];

export const KIND_LABELS: Record<string, string> = { 正课: '正课', 自习: '自习', 托管: '托管', 陪餐: '陪餐' };

/** 各学科专属配色：格子背景 / 文字 / 圆点。类名全量写死，便于 Tailwind 自动提取 */
export const SUBJECT_COLORS: Record<string, { cell: string; text: string; dot: string }> = {
  语文: { cell: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  数学: { cell: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  英语: { cell: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  科学: { cell: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  道德与法治: { cell: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  体育: { cell: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  音乐: { cell: 'bg-pink-50', text: 'text-pink-700', dot: 'bg-pink-500' },
  美术: { cell: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  班会: { cell: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500' },
  劳动: { cell: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
};

/** 未配置配色的学科回退为灰色（含空科目） */
export function subjectColor(subject: string): { cell: string; text: string; dot: string } {
  return SUBJECT_COLORS[subject] ?? { cell: '', text: 'text-slate-700', dot: 'bg-slate-400' };
}

/** 以 `${weekday}-${period_id}` 为键把 timetable 行映射到网格 */
export function buildClassGrid(slots: Row[], rows: Row[]): Map<string, Row> {
  const m = new Map<string, Row>();
  for (const r of rows) m.set(`${Number(r.weekday)}-${Number(r.period_id)}`, r);
  return m;
}

/** 只统计正课时段且 subject 非空的行，并按学科分列 */
export function classStats(slots: Row[], rows: Row[]): { total: number; bySubject: Record<string, number> } {
  const zheng = new Set(slots.filter(s => s.kind === '正课').map(s => Number(s.id)));
  const subjectRows = rows.filter(r => zheng.has(Number(r.period_id)) && String(r.subject ?? '') !== '');
  const bySubject: Record<string, number> = {};
  for (const r of subjectRows) {
    const s = String(r.subject);
    bySubject[s] = (bySubject[s] ?? 0) + 1;
  }
  return { total: subjectRows.length, bySubject };
}

/** 删除本班时段并级联删除该班其下 timetable 与 teacher_schedule 行 */
export function removePeriodSlot(db: DatabaseSync, id: number, classId: number): void {
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM timetable WHERE period_id = ? AND class_id = ?').run(id, classId);
    db.prepare('DELETE FROM teacher_schedule WHERE period_id = ? AND class_id = ?').run(id, classId);
    db.prepare('DELETE FROM period_slots WHERE id = ? AND class_id = ?').run(id, classId);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
