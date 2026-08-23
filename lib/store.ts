import type { DatabaseSync } from 'node:sqlite';
import type { ResourceKey, Row } from './types';

export const RESOURCES: Record<ResourceKey, string> = {
  settings: 'settings',
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

function sanitize(db: DatabaseSync, table: string, data: Partial<Row>): Record<string, string | number | null> {
  const cols = new Set(tableColumns(db, table));
  const out: Record<string, string | number | null> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === 'id') continue;
    if (!cols.has(k)) continue;
    // 仅跳过“未提供”（undefined）；显式 null 必须保留，用于把可空列（如 idcard）清空
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

function table(resource: ResourceKey): string {
  return RESOURCES[resource];
}

export function list(db: DatabaseSync, resource: ResourceKey): Row[] {
  return db.prepare(`SELECT * FROM ${table(resource)} ORDER BY id`).all() as Row[];
}

export function get(db: DatabaseSync, resource: ResourceKey, id: number): Row | undefined {
  return db.prepare(`SELECT * FROM ${table(resource)} WHERE id = ?`).get(id) as Row | undefined;
}

export function create(db: DatabaseSync, resource: ResourceKey, data: Partial<Row>): Row {
  const t = table(resource);
  const clean = sanitize(db, t, data);
  // null 值不进 INSERT 列：落到列的 NULL 默认值（idcard），避免给 NOT NULL 列显式写 null
  const keys = Object.keys(clean).filter(k => clean[k] !== null);
  if (keys.length === 0) throw new Error('没有可写入的字段');
  const cols = keys.map(k => `"${k}"`).join(', ');
  const params = keys.map(k => `@${k}`).join(', ');
  const values: Record<string, string | number> = {};
  for (const k of keys) values[k] = clean[k] as string | number;
  const stmt = db.prepare(`INSERT INTO ${t} (${cols}) VALUES (${params})`);
  const result = stmt.run(values);
  return get(db, resource, Number(result.lastInsertRowid))!;
}

export function update(db: DatabaseSync, resource: ResourceKey, id: number, data: Partial<Row>): Row {
  const t = table(resource);
  const clean = sanitize(db, t, data);
  const keys = Object.keys(clean);
  if (keys.length > 0) {
    const sets = keys.map(k => `"${k}" = @${k}`).join(', ');
    db.prepare(`UPDATE ${t} SET ${sets} WHERE id = @id`).run({ ...clean, id });
  }
  const row = get(db, resource, id);
  if (!row) throw new Error('记录不存在');
  return row;
}

export function remove(db: DatabaseSync, resource: ResourceKey, id: number): void {
  db.prepare(`DELETE FROM ${table(resource)} WHERE id = ?`).run(id);
}
