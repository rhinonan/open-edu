import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../lib/schema';
import { seedClass } from '../lib/seed';
import { buildClassGrid, classStats, removePeriodSlot, KIND_LABELS, SUBJECTS } from '../lib/timetable';
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

describe('播种：时段与正课', () => {
  it('11 个时段，seq 连续，kind 分布 正课7/自习1/托管2/陪餐1', () => {
    const { db } = makeDb();
    const slots = query<Row>(db, 'SELECT * FROM period_slots ORDER BY seq');
    expect(slots).toHaveLength(11);
    expect(slots.map(s => s.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const count = (k: string) => slots.filter(s => s.kind === k).length;
    expect(count('正课')).toBe(7);
    expect(count('自习')).toBe(1);
    expect(count('托管')).toBe(2);
    expect(count('陪餐')).toBe(1);
  });

  it('35 行正课：每个正课时段×星期一行，无正课 type 的时段无行', () => {
    const { db, classId } = makeDb();
    const slots = query<Row>(db, 'SELECT * FROM period_slots');
    const zheng = slots.filter(s => s.kind === '正课');
    const nonZheng = slots.filter(s => s.kind !== '正课');
    const tt = query<Row>(db, 'SELECT * FROM timetable WHERE class_id = ?', classId);
    expect(tt).toHaveLength(zheng.length * 5);
    const byPeriod = new Map<number, number>();
    for (const r of tt) byPeriod.set(Number(r.period_id), (byPeriod.get(Number(r.period_id)) ?? 0) + 1);
    for (const s of zheng) expect(byPeriod.get(Number(s.id))).toBe(5); // 每周5天各一行
    const used = new Set(tt.map(r => Number(r.period_id)));
    for (const s of nonZheng) expect(used.has(Number(s.id))).toBe(false);
  });

  it('播种 teacher_schedule（含本班与跨班演示行）', () => {
    const { db, classId } = makeDb();
    const ts = query<Row>(db, 'SELECT * FROM teacher_schedule WHERE class_id = ?', classId);
    expect(ts.length).toBeGreaterThanOrEqual(3);
    expect(ts.some(r => String(r.class_name).includes('2）班'))).toBe(true); // 去别的班
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

  it('classStats 只统计正课且有学科的课时；is_chinese 计入 chinese', () => {
    const { db, classId } = makeDb();
    const slots = query<Row>(db, 'SELECT * FROM period_slots');
    const tt = query<Row>(db, 'SELECT * FROM timetable WHERE class_id = ?', classId);
    const stats = classStats(slots, tt);
    expect(stats.total).toBe(35);
    const chinese = tt.filter(r => r.subject === '语文').length;
    expect(stats.chinese).toBe(chinese);
  });

  it('classStats 忽略无学科行', () => {
    const { db, classId } = makeDb();
    const slots = query<Row>(db, 'SELECT * FROM period_slots');
    const tt = query<Row>(db, 'SELECT * FROM timetable WHERE class_id = ?', classId);
    const one = { ...tt[0], subject: '' };
    const stats = classStats(slots, [one]);
    expect(stats.total).toBe(0);
    expect(stats.chinese).toBe(0);
  });

  it('buildClassGrid 以 `${weekday}-${period_id}` 为键', () => {
    const { db, classId } = makeDb();
    const slots = query<Row>(db, 'SELECT * FROM period_slots');
    const tt = query<Row>(db, 'SELECT * FROM timetable WHERE class_id = ?', classId);
    const grid = buildClassGrid(slots, tt);
    const r = tt[0];
    expect(grid.get(`${Number(r.weekday)}-${Number(r.period_id)}`)).toEqual(r);
  });

  it('removePeriodSlot 级联删除其下 timetable 与 teacher_schedule 行', () => {
    const { db, classId } = makeDb();
    const slots = query<Row>(db, 'SELECT * FROM period_slots');
    // 播种的 teacher_schedule 已占用 2/4/9 三个正课时段；选一个未被占用的正课时段，确保插入后计数可控
    const seeded = new Set(query<Row>(db, 'SELECT period_id FROM teacher_schedule WHERE class_id = ?', classId).map(r => Number(r.period_id)));
    const zheng = slots.find(s => s.kind === '正课' && !seeded.has(Number(s.id)))!;
    db.prepare('INSERT INTO teacher_schedule (class_id, weekday, period_id, class_name, subject, remark) VALUES (?, ?, ?, ?, ?, ?)').run(classId, 3, Number(zheng.id), '六年级（2）班', '数学', '');
    const n = (sql: string, ...params: (string | number)[]) => (db.prepare(sql).get(...params) as { n: number }).n;
    expect(n('SELECT COUNT(*) AS n FROM timetable WHERE class_id = ? AND period_id = ?', classId, Number(zheng.id))).toBe(5);
    expect(n('SELECT COUNT(*) AS n FROM teacher_schedule WHERE class_id = ? AND period_id = ?', classId, Number(zheng.id))).toBe(1);
    removePeriodSlot(db, Number(zheng.id));
    expect(n('SELECT COUNT(*) AS n FROM timetable WHERE period_id = ?', Number(zheng.id))).toBe(0);
    expect(n('SELECT COUNT(*) AS n FROM teacher_schedule WHERE period_id = ?', Number(zheng.id))).toBe(0);
    expect(n('SELECT COUNT(*) AS n FROM period_slots WHERE id = ?', Number(zheng.id))).toBe(0);
    expect((db.prepare('SELECT COUNT(*) AS n FROM period_slots').get() as { n: number }).n).toBe(10);
  });
});
