import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../lib/schema';
import { seedClass } from '../lib/seed';
import { dashboardStats } from '../lib/dashboard';

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  const { lastInsertRowid } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('测试班', '王老师', '六年级')`).run();
  const classId = Number(lastInsertRowid);
  seedClass(db, classId);
  return { db, classId };
}

describe('dashboardStats', () => {
  it('聚合各项统计（按班）', () => {
    const { db, classId } = makeDb();
    const s = dashboardStats(db, classId);
    expect(s.studentCount).toBe(45);
    expect(s.maleCount + s.femaleCount).toBe(45);
    expect(s.todayLeaves).toBeGreaterThanOrEqual(0);
    expect(s.latestExamAvg).toBeGreaterThan(0);
    expect(s.monthWorkLogs).toBeGreaterThan(0);
  });
});
