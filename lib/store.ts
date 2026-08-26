import type { DatabaseSync } from 'node:sqlite';
import type { ResourceKey, Row } from './types';

export const RESOURCES: Record<ResourceKey, string> = {
  students: 'students',
  classroom_config: 'classroom_config',
  leave_records: 'leave_records',
  discipline_records: 'discipline_records',
  grades: 'grades',
  timetable: 'timetable',
  period_slots: 'period_slots',
  teacher_schedule: 'teacher_schedule',
  todos: 'todos',
  conversations: 'conversations',
  home_visits: 'home_visits',
  evaluation: 'evaluation',
  parent_comm: 'parent_comm',
  safety_logs: 'safety_logs',
  work_logs: 'work_logs',
  seats: 'seats',
};

export function tableColumns(db: DatabaseSync, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name);
}

// class_id 由服务端注入；id/class_id 一律剥离
const OUT = new Set(['id', 'class_id']);

function sanitize(db: DatabaseSync, table: string, data: Partial<Row>): Record<string, string | number | null> {
  const cols = new Set(tableColumns(db, table));
  const out: Record<string, string | number | null> = {};
  for (const [k, v] of Object.entries(data)) {
    if (OUT.has(k)) continue;
    if (!cols.has(k)) continue;
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

function table(resource: ResourceKey): string {
  return RESOURCES[resource];
}

export function list(db: DatabaseSync, resource: ResourceKey, classId: number): Row[] {
  const t = table(resource);
  return db.prepare(`SELECT * FROM ${t} WHERE class_id = ? ORDER BY id`).all(classId) as Row[];
}

export function get(db: DatabaseSync, resource: ResourceKey, id: number, classId: number): Row | undefined {
  const t = table(resource);
  return db.prepare(`SELECT * FROM ${t} WHERE id = ? AND class_id = ?`).get(id, classId) as Row | undefined;
}

export function create(db: DatabaseSync, resource: ResourceKey, data: Partial<Row>, classId: number): Row {
  const t = table(resource);
  const clean = sanitize(db, t, data);
  const keys = Object.keys(clean).filter(k => clean[k] !== null);
  if (keys.length === 0) throw new Error('没有可写入的字段');
  const cols = [...keys, 'class_id'];
  const params = cols.map(k => `@${k}`).join(', ');
  const values: Record<string, string | number> = {};
  for (const k of keys) values[k] = clean[k] as string | number;
  values['class_id'] = classId;
  const stmt = db.prepare(`INSERT INTO ${t} (${cols.join(', ')}) VALUES (${params})`);
  const result = stmt.run(values);
  return get(db, resource, Number(result.lastInsertRowid), classId)!;
}

export function update(db: DatabaseSync, resource: ResourceKey, id: number, data: Partial<Row>, classId: number): Row {
  const t = table(resource);
  const clean = sanitize(db, t, data);
  const keys = Object.keys(clean);
  if (keys.length > 0) {
    const sets = keys.map(k => `"${k}" = @${k}`).join(', ');
    const values: Record<string, string | number | null> = { ...clean, id, classId };
    db.prepare(`UPDATE ${t} SET ${sets} WHERE id = @id AND class_id = @classId`).run(values);
  }
  const row = get(db, resource, id, classId);
  if (!row) throw new Error('记录不存在');
  return row;
}

export function remove(db: DatabaseSync, resource: ResourceKey, id: number, classId: number): void {
  const t = table(resource);
  db.prepare(`DELETE FROM ${t} WHERE id = ? AND class_id = ?`).run(id, classId);
}
