import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../lib/schema';
import { seedIfEmpty } from '../lib/seed';
import { list, get, create, update, remove, tableColumns } from '../lib/store';

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  seedIfEmpty(db);
  return db;
}

describe('store', () => {
  it('list 返回学生并排序', () => {
    const db = makeDb();
    const rows = list(db, 'students');
    expect(rows.length).toBe(45);
    expect(rows[0].name).toBeTruthy();
  });

  it('create 新增并返回带 id 的行', () => {
    const db = makeDb();
    const row = create(db, 'students', { name: '测试生', gender: '男', parent_phone: '13000000000', role: '', group_no: 1, level: 5, afternoon_care: 1, remark: '' });
    expect(row.id).toBeTruthy();
    expect(get(db, 'students', row.id as number)?.name).toBe('测试生');
  });

  it('create 忽略白名单外字段', () => {
    const db = makeDb();
    const row = create(db, 'students', { name: '甲', evil: 'injection' });
    expect((row as unknown as Record<string, unknown>).evil).toBeUndefined();
  });

  it('update 只改指定字段', () => {
    const db = makeDb();
    const row = list(db, 'students')[0];
    const updated = update(db, 'students', row.id as number, { name: '改名后', group_no: 9 });
    expect(updated.name).toBe('改名后');
    expect(updated.group_no).toBe(9);
  });

  it('update 显式 null 清空 idcard 并持久化', () => {
    const db = makeDb();
    const row = list(db, 'students')[0];
    expect(String(row.idcard).length).toBe(18); // 种子行都带身份证
    update(db, 'students', row.id as number, { idcard: null });
    expect(get(db, 'students', row.id as number)?.idcard).toBeNull();
    // 第二个学生同样清空 → 两条 NULL idcard 可共存（SQLite UNIQUE 对 NULL 不冲突）
    const row2 = list(db, 'students')[1];
    update(db, 'students', row2.id as number, { idcard: null });
    expect(get(db, 'students', row2.id as number)?.idcard).toBeNull();
    expect(list(db, 'students').filter(s => s.idcard === null).length).toBe(2);
  });

  it('remove 删除后 list 减少', () => {
    const db = makeDb();
    const before = list(db, 'students').length;
    remove(db, 'students', list(db, 'students')[0].id as number);
    expect(list(db, 'students').length).toBe(before - 1);
  });

  it('tableColumns 来自 PRAGMA', () => {
    const db = makeDb();
    const cols = tableColumns(db, 'students');
    expect(cols).toContain('name');
    expect(cols).toContain('parent_phone');
  });
});
