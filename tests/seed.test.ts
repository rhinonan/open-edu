import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../lib/schema';
import { seedIfEmpty, resetData } from '../lib/seed';

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  return db;
}

describe('schema', () => {
  it('创建全部 18 张表', () => {
    const db = makeDb();
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]).map(t => t.name);
    expect(tables).toEqual(expect.arrayContaining([
      'settings', 'students', 'classroom_config', 'leave_records', 'discipline_records',
      'grades', 'homework', 'schedules', 'timetable', 'todos', 'conversations',
      'home_visits', 'evaluation', 'parent_comm', 'safety_logs', 'peiyou_records',
      'work_logs', 'seats',
    ]));
  });
});

describe('seedIfEmpty', () => {
  it('灌入 45 名随机学生', () => {
    const db = makeDb();
    seedIfEmpty(db);
    const n = (db.prepare('SELECT COUNT(*) AS n FROM students').get() as { n: number }).n;
    expect(n).toBe(45);
  });

  it('幂等：重复调用不重复灌入', () => {
    const db = makeDb();
    seedIfEmpty(db);
    seedIfEmpty(db);
    const n = (db.prepare('SELECT COUNT(*) AS n FROM students').get() as { n: number }).n;
    expect(n).toBe(45);
  });

  it('种子包含 settings 班级名与 classroom_config', () => {
    const db = makeDb();
    seedIfEmpty(db);
    const name = db.prepare("SELECT value FROM settings WHERE key='class_name'").get() as { value: string };
    expect(name.value).toContain('小学');
    const cc = (db.prepare('SELECT COUNT(*) AS n FROM classroom_config').get() as { n: number }).n;
    expect(cc).toBe(1);
  });
});

describe('resetData', () => {
  it('resetData 后重新灌入数据', () => {
    const db = makeDb();
    seedIfEmpty(db);
    db.prepare('DELETE FROM students WHERE id IN (SELECT id FROM students LIMIT 5)').run();
    resetData(db);
    const n = (db.prepare('SELECT COUNT(*) AS n FROM students').get() as { n: number }).n;
    expect(n).toBe(45);
  });
});
