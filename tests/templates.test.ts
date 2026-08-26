import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../lib/schema';
import { bootstrap } from '../lib/seed';
import {
  DEFAULT_SLOTS, listTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate,
  seedDefaultTemplate, applyTemplateToClass, type TemplateSlot,
} from '../lib/templates';

function makeDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  return db;
}

const customSlots: TemplateSlot[] = [
  { seq: 1, name: '早自习', start_time: '07:50', end_time: '08:20', kind: '自习' },
  { seq: 2, name: '上午第1节', start_time: '08:30', end_time: '09:10', kind: '正课' },
  { seq: 3, name: '下午第1节', start_time: '14:00', end_time: '14:40', kind: '正课' },
];

describe('作息模板', () => {
  it('DEFAULT_SLOTS 共 11 个，kind 分布正确', () => {
    expect(DEFAULT_SLOTS).toHaveLength(11);
    expect(DEFAULT_SLOTS.map(s => s.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(DEFAULT_SLOTS.filter(s => s.kind === '正课')).toHaveLength(7);
  });

  it('seedDefaultTemplate 播种「标准作息」并幂等', () => {
    const db = makeDb();
    seedDefaultTemplate(db);
    seedDefaultTemplate(db);
    const t = listTemplates(db);
    expect(t).toHaveLength(1);
    expect(t[0].name).toBe('标准作息');
    expect(t[0].slots).toEqual(DEFAULT_SLOTS);
  });

  it('createTemplate/listTemplates/getTemplate 往返带 slots', () => {
    const db = makeDb();
    const t = createTemplate(db, '夏季作息', '备注', customSlots);
    expect(t.id).toBeTruthy();
    const list = listTemplates(db);
    expect(list).toHaveLength(1);
    expect(list[0].slots).toEqual(customSlots);
    expect(getTemplate(db, t.id)?.name).toBe('夏季作息');
  });

  it('updateTemplate 只按 patch 改动并持久化', () => {
    const db = makeDb();
    const t = createTemplate(db, '夏季作息', '备注', customSlots);
    const updated = updateTemplate(db, t.id, { name: '冬季作息', slots: DEFAULT_SLOTS });
    expect(updated.name).toBe('冬季作息');
    expect(updated.slots).toEqual(DEFAULT_SLOTS);
    expect(getTemplate(db, t.id)?.remark).toBe('备注'); // 未改的字段保留
  });

  it('updateTemplate 不存在的模板抛错', () => {
    const db = makeDb();
    expect(() => updateTemplate(db, 999, { name: 'x' })).toThrow();
  });

  it('deleteTemplate 删除后不见', () => {
    const db = makeDb();
    const t = createTemplate(db, '夏季作息', '', customSlots);
    deleteTemplate(db, t.id);
    expect(listTemplates(db)).toHaveLength(0);
  });

  it('applyTemplateToClass 把模板时段复制进班级，且幂等', () => {
    const db = makeDb();
    const { lastInsertRowid } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('测试班', '王老师', '六年级')`).run();
    const classId = Number(lastInsertRowid);
    const t = createTemplate(db, '夏季作息', '', customSlots);
    applyTemplateToClass(db, classId, t.id);
    applyTemplateToClass(db, classId, t.id); // 第二次应跳过
    const rows = db.prepare('SELECT * FROM period_slots WHERE class_id = ? ORDER BY seq').all(classId) as { seq: number; name: string; kind: string; class_id: number }[];
    expect(rows).toHaveLength(customSlots.length);
    expect(rows.every(r => r.class_id === classId)).toBe(true);
    expect(rows.map(r => r.name)).toEqual(customSlots.map(s => s.name));
  });

  it('applyTemplateToClass 缺省用默认作息', () => {
    const db = makeDb();
    const { lastInsertRowid } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('测试班', '王老师', '六年级')`).run();
    const classId = Number(lastInsertRowid);
    applyTemplateToClass(db, classId, null);
    const n = (db.prepare('SELECT COUNT(*) AS n FROM period_slots WHERE class_id = ?').get(classId) as { n: number }).n;
    expect(n).toBe(11);
  });

  it('applyTemplateToClass 模板不存在抛错', () => {
    const db = makeDb();
    expect(() => applyTemplateToClass(db, 1, 999)).toThrow('作息模板不存在');
  });

  it('bootstrap 建出默认作息模板', () => {
    const db = makeDb();
    bootstrap(db);
    const t = listTemplates(db);
    expect(t).toHaveLength(1);
    expect(t[0].name).toBe('标准作息');
  });
});