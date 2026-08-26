import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../lib/schema';
import { bootstrap, resetData, seedClass, resetClass } from '../lib/seed';

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  const { lastInsertRowid } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('长沙青园小学六年级（1）班', '王老师', '六年级')`).run();
  seedClass(db, Number(lastInsertRowid));
  return { db, classId: Number(lastInsertRowid) };
}

describe('schema', () => {
  it('创建全部 19 张表', () => {
    const { db } = makeDb();
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]).map(t => t.name);
    expect(tables).toEqual(expect.arrayContaining([
      'classes', 'users', 'sessions', 'students', 'classroom_config', 'leave_records', 'discipline_records',
      'grades', 'timetable', 'period_slots', 'schedule_templates', 'teacher_schedule', 'todos', 'conversations',
      'home_visits', 'evaluation', 'parent_comm', 'safety_logs',
      'work_logs', 'seats',
    ]));
    expect(tables).not.toContain('settings');
  });

  it('students 唯一索引按 (class_id, idcard)', () => {
    const { db } = makeDb();
    const idx = db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_students_idcard'").get() as { sql: string };
    expect(idx.sql).toContain('(class_id, idcard)');
  });
});

describe('seedClass', () => {
  it('灌入 45 名随机学生，且带对 class_id', () => {
    const { db, classId } = makeDb();
    const n = (db.prepare('SELECT COUNT(*) AS n FROM students WHERE class_id = ?').get(classId) as { n: number }).n;
    expect(n).toBe(45);
  });

  it('两班互相隔离', () => {
    const { db } = makeDb();
    const { lastInsertRowid: cid2 } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('六年级（2）班', '李老师', '六年级')`).run();
    seedClass(db, Number(cid2));
    const r = (db.prepare('SELECT class_id, COUNT(*) AS n FROM students GROUP BY class_id ORDER BY class_id').all() as { class_id: number; n: number }[]);
    expect(r).toEqual([{ class_id: 1, n: 45 }, { class_id: 2, n: 45 }]);
  });

  it('每班各自有 11 个时段，彼此隔离', () => {
    const { db } = makeDb();
    const { lastInsertRowid: cid2 } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('六年级（2）班', '李老师', '六年级')`).run();
    seedClass(db, Number(cid2));
    const per = (db.prepare('SELECT class_id, COUNT(*) AS n FROM period_slots GROUP BY class_id').all() as { class_id: number; n: number }[]);
    expect(per).toEqual([{ class_id: 1, n: 11 }, { class_id: 2, n: 11 }]);
    const all = (db.prepare('SELECT COUNT(*) AS n FROM period_slots').get() as { n: number }).n;
    expect(all).toBe(22);
  });

  it('包含 classroom_config 与课表', () => {
    const { db, classId } = makeDb();
    const cc = (db.prepare('SELECT COUNT(*) AS n FROM classroom_config WHERE class_id = ?').get(classId) as { n: number }).n;
    const tt = (db.prepare('SELECT COUNT(*) AS n FROM timetable WHERE class_id = ?').get(classId) as { n: number }).n;
    expect(cc).toBe(1);
    expect(tt).toBe(35);
  });
});

describe('bootstrap', () => {
  it('users 为空时创建 admin 与 demo 老师 + 一个班', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(SCHEMA_SQL);
    const { createdAdmin } = bootstrap(db);
    expect(createdAdmin).toBe(true);
    const users = db.prepare('SELECT username, role, class_id FROM users ORDER BY id').all() as { username: string; role: string; class_id: number | null }[];
    expect(users.map(u => u.username)).toEqual(['admin', 'demo']);
    expect(users.find(u => u.username === 'demo')?.class_id).toBeTruthy();
    expect((db.prepare('SELECT COUNT(*) AS n FROM classes').get() as { n: number }).n).toBe(1);
  });

  it('已有 users 则不再引导', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(SCHEMA_SQL);
    bootstrap(db);
    const again = bootstrap(db);
    expect(again.createdAdmin).toBe(false);
    expect((db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n).toBe(2);
  });
});

describe('resetClass', () => {
  it('只重置本班数据，不影响他班', () => {
    const { db } = makeDb();
    const { lastInsertRowid: cid2 } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('六年级（2）班', '李老师', '六年级')`).run();
    seedClass(db, Number(cid2));
    db.prepare('DELETE FROM students WHERE class_id = 1 AND id IN (SELECT id FROM students WHERE class_id = 1 LIMIT 5)').run();
    resetClass(db, 1);
    expect((db.prepare('SELECT COUNT(*) AS n FROM students WHERE class_id = 1').get() as { n: number }).n).toBe(45);
    expect((db.prepare('SELECT COUNT(*) AS n FROM students WHERE class_id = 2').get() as { n: number }).n).toBe(45);
  });
});

describe('resetData', () => {
  it('全库重置后回到引导态', () => {
    const { db } = makeDb();
    resetData(db);
    expect((db.prepare('SELECT COUNT(*) AS n FROM classes').get() as { n: number }).n).toBe(1);
    expect((db.prepare('SELECT COUNT(*) AS n FROM students').get() as { n: number }).n).toBe(45);
  });
});
