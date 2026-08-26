import type { DatabaseSync } from 'node:sqlite';

export type TemplateSlot = { seq: number; name: string; start_time: string; end_time: string; kind: string };

export interface ScheduleTemplate {
  id: number;
  name: string;
  remark: string;
  slots: TemplateSlot[];
}

export const SLOT_KINDS = ['正课', '自习', '托管', '陪餐'];

export const DEFAULT_SLOTS: TemplateSlot[] = [
  { seq: 1, name: '早自习', start_time: '08:00', end_time: '08:20', kind: '自习' },
  { seq: 2, name: '上午第1节', start_time: '08:25', end_time: '09:05', kind: '正课' },
  { seq: 3, name: '上午第2节', start_time: '09:15', end_time: '09:55', kind: '正课' },
  { seq: 4, name: '上午第3节', start_time: '10:05', end_time: '10:45', kind: '正课' },
  { seq: 5, name: '上午第4节', start_time: '10:55', end_time: '11:35', kind: '正课' },
  { seq: 6, name: '中午托', start_time: '11:40', end_time: '12:10', kind: '托管' },
  { seq: 7, name: '陪餐', start_time: '12:10', end_time: '12:40', kind: '陪餐' },
  { seq: 8, name: '下午第1节', start_time: '14:00', end_time: '14:40', kind: '正课' },
  { seq: 9, name: '下午第2节', start_time: '14:50', end_time: '15:30', kind: '正课' },
  { seq: 10, name: '下午第3节', start_time: '15:40', end_time: '16:20', kind: '正课' },
  { seq: 11, name: '下午托', start_time: '16:20', end_time: '17:00', kind: '托管' },
];

function parseSlots(raw: string): TemplateSlot[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v as TemplateSlot[] : [];
  } catch { return []; }
}

export function listTemplates(db: DatabaseSync): ScheduleTemplate[] {
  const rows = db.prepare('SELECT * FROM schedule_templates ORDER BY id').all() as { id: number; name: string; remark: string; slots: string }[];
  return rows.map(r => ({ id: r.id, name: r.name, remark: r.remark, slots: parseSlots(r.slots) }));
}

export function getTemplate(db: DatabaseSync, id: number): ScheduleTemplate | undefined {
  const r = db.prepare('SELECT * FROM schedule_templates WHERE id = ?').get(id) as { id: number; name: string; remark: string; slots: string } | undefined;
  if (!r) return undefined;
  return { id: r.id, name: r.name, remark: r.remark, slots: parseSlots(r.slots) };
}

export function createTemplate(db: DatabaseSync, name: string, remark: string, slots: TemplateSlot[]): ScheduleTemplate {
  const { lastInsertRowid } = db.prepare('INSERT INTO schedule_templates (name, remark, slots) VALUES (?, ?, ?)')
    .run(name, remark, JSON.stringify(slots));
  return { id: Number(lastInsertRowid), name, remark, slots };
}

export function updateTemplate(db: DatabaseSync, id: number, patch: { name?: string; remark?: string; slots?: TemplateSlot[] }): ScheduleTemplate {
  const prev = db.prepare('SELECT * FROM schedule_templates WHERE id = ?').get(id) as { name: string; remark: string; slots: string };
  if (!prev) throw new Error('模板不存在');
  const name = patch.name ?? prev.name;
  const remark = patch.remark ?? prev.remark;
  const slots = patch.slots ?? parseSlots(prev.slots);
  db.prepare('UPDATE schedule_templates SET name = ?, remark = ?, slots = ? WHERE id = ?').run(name, remark, JSON.stringify(slots), id);
  return { id, name, remark, slots };
}

export function deleteTemplate(db: DatabaseSync, id: number): void {
  db.prepare('DELETE FROM schedule_templates WHERE id = ?').run(id);
}

/** 模板不存在时播种默认「标准作息」，幂等 */
export function seedDefaultTemplate(db: DatabaseSync): void {
  const n = (db.prepare('SELECT COUNT(*) AS n FROM schedule_templates').get() as { n: number }).n;
  if (n > 0) return;
  createTemplate(db, '标准作息', '默认 11 节：早自习 + 4 节上午 + 中托 + 陪餐 + 3 节下午 + 下午托', DEFAULT_SLOTS);
}

/** 把时段行复制进某班 period_slots；该班已有时段则跳过（幂等） */
export function applySlotsToClass(db: DatabaseSync, classId: number, slots: TemplateSlot[]): void {
  const n = (db.prepare('SELECT COUNT(*) AS n FROM period_slots WHERE class_id = ?').get(classId) as { n: number }).n;
  if (n > 0) return;
  const ins = db.prepare('INSERT INTO period_slots (class_id, seq, name, start_time, end_time, kind) VALUES (?, ?, ?, ?, ?, ?)');
  for (const s of slots) ins.run(classId, s.seq, s.name, s.start_time, s.end_time, s.kind);
}

/** 应用某模板到班级；templateId 为空则用默认作息 */
export function applyTemplateToClass(db: DatabaseSync, classId: number, templateId: number | null): void {
  if (templateId == null) {
    applySlotsToClass(db, classId, DEFAULT_SLOTS);
    return;
  }
  const t = getTemplate(db, templateId);
  if (!t) throw new Error('作息模板不存在');
  applySlotsToClass(db, classId, t.slots);
}