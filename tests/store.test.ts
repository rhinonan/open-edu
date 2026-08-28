import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../lib/schema';
import { seedClass } from '../lib/seed';
import { list, get, create, update, remove, removeMany, tableColumns } from '../lib/store';

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  const { lastInsertRowid } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('测试班', '王老师', '六年级')`).run();
  const classId = Number(lastInsertRowid);
  seedClass(db, classId);
  return { db, classId };
}

describe('store', () => {
  it('list 只返回本班学生并排序', () => {
    const { db, classId } = makeDb();
    const rows = list(db, 'students', classId);
    expect(rows.length).toBe(2);
    expect(rows[0].name).toBeTruthy();
  });

  it('list 不返回他班数据', () => {
    const { db, classId } = makeDb();
    const { lastInsertRowid: cid2 } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('六年级（2）班', '李老师', '六年级')`).run();
    seedClass(db, Number(cid2));
    expect(list(db, 'students', classId).length).toBe(2); // 只看到自己的班
  });

  it('create 新增并返回带 id 的行，class_id 由本层注入', () => {
    const { db, classId } = makeDb();
    const row = create(db, 'students', { name: '测试生', gender: '男', parent_phone: '13000000000', role: '', group_no: 1, level: 5, afternoon_care: 1, remark: '' }, classId);
    expect(row.id).toBeTruthy();
    expect(get(db, 'students', row.id as number, classId)?.name).toBe('测试生');
  });

  it('客户端伪造 class_id 会被剥离', () => {
    const { db, classId } = makeDb();
    const row = create(db, 'students', { name: '甲', class_id: 999 }, classId) as unknown as { class_id: number };
    expect(row.class_id).toBe(classId); // 忽略客户端传的 999
  });

  it('create 忽略白名单外字段', () => {
    const { db, classId } = makeDb();
    const row = create(db, 'students', { name: '甲', evil: 'injection' }, classId);
    expect((row as unknown as Record<string, unknown>).evil).toBeUndefined();
  });

  it('update 只改指定字段', () => {
    const { db, classId } = makeDb();
    const row = list(db, 'students', classId)[0];
    const updated = update(db, 'students', row.id as number, { name: '改名后', group_no: 9 }, classId);
    expect(updated.name).toBe('改名后');
    expect(updated.group_no).toBe(9);
  });

  it('update 显式 null 清空 idcard 并持久化', () => {
    const { db, classId } = makeDb();
    const row = list(db, 'students', classId)[0];
    expect(String(row.idcard).length).toBe(18);
    update(db, 'students', row.id as number, { idcard: null }, classId);
    expect(get(db, 'students', row.id as number, classId)?.idcard).toBeNull();
    const row2 = list(db, 'students', classId)[1];
    update(db, 'students', row2.id as number, { idcard: null }, classId);
    expect(get(db, 'students', row2.id as number, classId)?.idcard).toBeNull();
    expect(list(db, 'students', classId).filter(s => s.idcard === null).length).toBe(2);
  });

  it('remove 删除后 list 减少', () => {
    const { db, classId } = makeDb();
    const before = list(db, 'students', classId).length;
    remove(db, 'students', list(db, 'students', classId)[0].id as number, classId);
    expect(list(db, 'students', classId).length).toBe(before - 1);
  });

  it('removeMany 批量删除多条，只删本班', () => {
    const { db, classId } = makeDb();
    const { lastInsertRowid: cid2 } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('六年级（2）班', '李老师', '六年级')`).run();
    seedClass(db, Number(cid2));
    const mine = list(db, 'students', classId);
    removeMany(db, 'students', [mine[0].id as number, mine[1].id as number], classId);
    expect(list(db, 'students', classId).length).toBe(0);
    expect(list(db, 'students', Number(cid2)).length).toBe(2); // 他班不受影响
  });

  it('update/remove 越权访问他人班级则抛错/不生效', () => {
    const { db, classId } = makeDb();
    const { lastInsertRowid: cid2 } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('六年级（2）班', '李老师', '六年级')`).run();
    seedClass(db, Number(cid2));
    const other = list(db, 'students', Number(cid2))[0];
    expect(() => update(db, 'students', other.id as number, { name: 'x' }, classId)).toThrow();
    remove(db, 'students', other.id as number, classId);
    expect(list(db, 'students', Number(cid2)).length).toBe(2); // 他班数据未被删
  });

  it('tableColumns 来自 PRAGMA', () => {
    const { db } = makeDb();
    const cols = tableColumns(db, 'students');
    expect(cols).toContain('name');
    expect(cols).toContain('parent_phone');
    expect(cols).toContain('class_id');
  });
});
