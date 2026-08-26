import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { SCHEMA_SQL } from './schema';
import { resetData, bootstrap } from './seed';

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!db) {
    const dir = join(process.cwd(), 'data');
    mkdirSync(dir, { recursive: true });
    db = new DatabaseSync(join(dir, 'app.db'));
    db.exec('PRAGMA journal_mode = WAL;');
    // 哨兵列：旧库各表缺 class_id 即判定为旧结构，先整体重置再重建
    const classTables = ['students', 'classroom_config', 'leave_records', 'discipline_records', 'grades',
      'timetable', 'period_slots', 'teacher_schedule', 'todos', 'conversations', 'home_visits', 'evaluation', 'parent_comm', 'safety_logs', 'work_logs', 'seats'];
    for (const t of classTables) {
      const cols = (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map(c => c.name);
      if (cols.length > 0 && !cols.includes('class_id')) { resetData(db); break; }
    }
    db.exec(SCHEMA_SQL);
    bootstrap(db);
  }
  return db;
}
