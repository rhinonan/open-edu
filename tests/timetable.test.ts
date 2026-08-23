import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../lib/schema';
import { seedClass } from '../lib/seed';
import { buildClassGrid, classStats, subjectDist, KIND_LABELS, SUBJECTS } from '../lib/timetable';
import type { Row } from '../lib/types';

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  const { lastInsertRowid } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('测试班', '王老师', '六年级')`).run();
  const classId = Number(lastInsertRowid);
  seedClass(db, classId);
  return { db, classId };
}
function query<T>(db: DatabaseSync, sql: string, ...params: (string | number)[]): T[] {
  return db.prepare(sql).all(...params) as unknown as T[];
}

describe('播种：班级课表', () => {
  it('每班 30 行课表：5 天 × 6 时段', () => {
    const { db, classId } = makeDb();
    const tt = query<Row>(db, 'SELECT * FROM timetable WHERE class_id = ?', classId);
    expect(tt).toHaveLength(30);
    const perDay = new Map<number, number>();
    for (const r of tt) perDay.set(Number(r.weekday), (perDay.get(Number(r.weekday)) ?? 0) + 1);
    expect([...perDay.values()]).toEqual([6, 6, 6, 6, 6]);
  });

  it('早读固定语文、托管固定自习，is_chinese 只在语文时为 1', () => {
    const { db, classId } = makeDb();
    const tt = query<Row>(db, 'SELECT * FROM timetable WHERE class_id = ?', classId);
    expect(tt).toHaveLength(30);
    for (const r of tt) {
      if (r.period === '早读') expect(r.subject).toBe('语文');
      if (r.period === '中午托' || r.period === '下午托') expect(r.subject).toBe('自习');
      expect(r.is_chinese).toBe(r.subject === '语文' ? 1 : 0);
    }
  });
});

describe('纯函数', () => {
  it('KIND_LABELS 覆盖四类', () => {
    expect(KIND_LABELS['正课']).toBe('正课');
    expect(KIND_LABELS['自习']).toBe('自习');
    expect(KIND_LABELS['托管']).toBe('托管');
    expect(KIND_LABELS['陪餐']).toBe('陪餐');
  });

  it('SUBJECTS 含空串（用于清空）', () => {
    expect(SUBJECTS).toContain('');
  });

  it('classStats 统计非空学科课时与语文课时', () => {
    const { db, classId } = makeDb();
    const tt = query<Row>(db, 'SELECT * FROM timetable WHERE class_id = ?', classId);
    const stats = classStats(tt);
    expect(stats.total).toBe(30);
    const chinese = tt.filter(r => r.subject === '语文').length;
    expect(stats.chinese).toBe(chinese);
  });

  it('classStats 忽略无学科行', () => {
    const { db, classId } = makeDb();
    const tt = query<Row>(db, 'SELECT * FROM timetable WHERE class_id = ?', classId);
    const one = { ...tt[0], subject: '' };
    const stats = classStats([one]);
    expect(stats.total).toBe(0);
    expect(stats.chinese).toBe(0);
  });

  it('subjectDist 只含非空学科且按课时统计', () => {
    const { db, classId } = makeDb();
    const tt = query<Row>(db, 'SELECT * FROM timetable WHERE class_id = ?', classId);
    const dist = subjectDist(tt);
    const distinct = [...new Set(tt.map(r => String(r.subject ?? '')).filter(s => s))];
    expect(dist.every(d => d.name)).toBe(true);
    const sum = dist.reduce((a, d) => a + d.课时, 0);
    expect(sum).toBe(30);
    // 学科集合与 timetable 中的非空学科一致
    expect(dist.map(d => d.name).sort()).toEqual([...distinct].sort());
  });

  it('buildClassGrid 以 `${weekday}-${period}` 为键', () => {
    const { db, classId } = makeDb();
    const tt = query<Row>(db, 'SELECT * FROM timetable WHERE class_id = ?', classId);
    const grid = buildClassGrid(tt);
    const r = tt[0];
    expect(grid.get(`${Number(r.weekday)}-${String(r.period)}`)).toEqual(r);
  });
});
