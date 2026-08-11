import type { DatabaseSync } from 'node:sqlite';
import type { ResourceKey, Row } from './types';

export const RESOURCES: Record<ResourceKey, string> = {
  settings: 'settings',
  students: 'students',
  classroom_config: 'classroom_config',
  leave_records: 'leave_records',
  discipline_records: 'discipline_records',
  grades: 'grades',
  homework: 'homework',
  schedules: 'schedules',
  timetable: 'timetable',
  todos: 'todos',
  conversations: 'conversations',
  home_visits: 'home_visits',
  evaluation: 'evaluation',
  parent_comm: 'parent_comm',
  safety_logs: 'safety_logs',
  peiyou_records: 'peiyou_records',
  work_logs: 'work_logs',
  seats: 'seats',
};

export function tableColumns(db: DatabaseSync, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name);
}

function sanitize(db: DatabaseSync, table: string, data: Partial<Row>): Record<string, string | number> {
  const cols = new Set(tableColumns(db, table));
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === 'id') continue;
    if (!cols.has(k)) continue;
    if (v === null || v === undefined) continue;
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
  const keys = Object.keys(clean);
  if (keys.length === 0) throw new Error('没有可写入的字段');
  const cols = keys.map(k => `"${k}"`).join(', ');
  const params = keys.map(k => `@${k}`).join(', ');
  const stmt = db.prepare(`INSERT INTO ${t} (${cols}) VALUES (${params})`);
  const result = stmt.run({ ...clean });
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
