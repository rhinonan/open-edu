import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../lib/schema';
import { seedIfEmpty } from '../lib/seed';
import { dashboardStats } from '../lib/dashboard';

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  seedIfEmpty(db);
  return db;
}

describe('dashboardStats', () => {
  it('聚合各项统计', () => {
    const db = makeDb();
    const s = dashboardStats(db);
    expect(s.studentCount).toBe(45);
    expect(s.maleCount + s.femaleCount).toBe(45);
    expect(s.todayLeaves).toBeGreaterThanOrEqual(0);
    expect(s.latestExamAvg).toBeGreaterThan(0);
    expect(s.monthWorkLogs).toBeGreaterThan(0);
  });
});
