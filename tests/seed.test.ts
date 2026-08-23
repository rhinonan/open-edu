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
  it('创建全部 15 张表', () => {
    const db = makeDb();
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]).map(t => t.name);
    expect(tables).toEqual(expect.arrayContaining([
      'settings', 'students', 'classroom_config', 'leave_records', 'discipline_records',
      'grades', 'timetable', 'todos', 'conversations',
      'home_visits', 'evaluation', 'parent_comm', 'safety_logs',
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
    const settings = (db.prepare('SELECT COUNT(*) AS n FROM settings').get() as { n: number }).n;
    const workLogs = (db.prepare('SELECT COUNT(*) AS n FROM work_logs').get() as { n: number }).n;
    const timetable = (db.prepare('SELECT COUNT(*) AS n FROM timetable').get() as { n: number }).n;
    const n = (db.prepare('SELECT COUNT(*) AS n FROM students').get() as { n: number }).n;
    expect(settings).toBe(6);
    expect(workLogs).toBe(5);
    expect(timetable).toBe(30);
    expect(n).toBe(45);
  });
});

describe('seed 新学籍字段', () => {
  it('学号连续唯一、身份证 18 位唯一、其余新字段完整', () => {
    const db = makeDb();
    seedIfEmpty(db);
    const rows = db.prepare('SELECT * FROM students ORDER BY student_no').all() as { student_no: string; idcard: string; parent_name: string; address: string; level: number; noon_care: number; breakfast: number; afternoon_care: number }[];
    expect(rows.length).toBe(45);
    expect(rows.map(r => r.student_no)).toEqual(Array.from({ length: 45 }, (_, i) => String(i + 1).padStart(2, '0')));
    const ids = rows.map(r => r.idcard);
    expect(new Set(ids).size).toBe(45);
    ids.forEach(id => expect(id.length).toBe(18));
    rows.forEach(r => {
      expect(r.parent_name).toBeTruthy();
      expect(r.address).toBeTruthy();
      expect([0, 1]).toContain(r.noon_care);
      expect([0, 1]).toContain(r.breakfast);
      expect([0, 1]).toContain(r.afternoon_care);
      expect(r.level).toBeGreaterThanOrEqual(1);
      expect(r.level).toBeLessThanOrEqual(6);
    });
  });
});
