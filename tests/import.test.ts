import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../lib/schema';
import { seedIfEmpty } from '../lib/seed';
import { list, create } from '../lib/store';
import { importStudents, type ImportItem } from '../lib/import';

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  seedIfEmpty(db);
  return db;
}

const item = (p: Partial<ImportItem>): ImportItem => ({
  line: 2, student_no: '', name: '导入生', gender: '男', parent_name: '', parent_phone: '',
  idcard: '', address: '', level: 4, group_no: 1, role: '', noon_care: 0, breakfast: 0,
  afternoon_care: 1, remark: '', ...p,
});

describe('importStudents', () => {
  it('新身份证 → INSERT', () => {
    const db = makeDb();
    const r = importStudents(db, [item({ idcard: '430102199001010011', name: '新增生' })]);
    expect(r.created).toBe(1);
    expect(r.updated).toBe(0);
    expect(list(db, 'students').length).toBe(46);
  });

  it('已存在身份证 → 覆盖全部字段', () => {
    const db = makeDb();
    const first = list(db, 'students')[0];
    const r = importStudents(db, [item({ idcard: String(first.idcard), name: '覆盖名', level: 1, gender: '女' })]);
    expect(r.updated).toBe(1);
    const row = list(db, 'students')[0];
    expect(row.name).toBe('覆盖名');
    expect(row.level).toBe(1);
    expect(row.gender).toBe('女');
    expect(list(db, 'students').length).toBe(45);
  });

  it('空身份证 → 跳过并带行号', () => {
    const db = makeDb();
    const r = importStudents(db, [item({ line: 3, idcard: '' })]);
    expect(r.skipped).toBe(1);
    expect(r.errors).toEqual([{ row: 3, message: '缺少身份证' }]);
  });

  it('同批两条相同新身份证 → 一条 insert 一条 update', () => {
    const db = makeDb();
    const r = importStudents(db, [item({ idcard: '999' }), item({ idcard: '999', name: '第二次' })]);
    expect(r.created).toBe(1);
    expect(r.updated).toBe(1);
    const row = list(db, 'students').find(x => x.idcard === '999');
    expect(row?.name).toBe('第二次');
  });

  it('直接插入重复身份证抛错（唯一索引）', () => {
    const db = makeDb();
    const idc = String(list(db, 'students')[0].idcard);
    expect(() => { create(db, 'students', { name: 'A', idcard: idc }); }).toThrow();
  });

  it('新身份证空学号 → INSERT 并自动取 max+1', () => {
    const db = makeDb();
    const r = importStudents(db, [item({ idcard: '430102199001020022', name: '无学号生' })]);
    expect(r.created).toBe(1);
    const row = list(db, 'students').find(x => x.idcard === '430102199001020022');
    expect(row?.student_no).toBe('46');
  });

  it('已存在身份证空学号 → 保留原学号', () => {
    const db = makeDb();
    const first = list(db, 'students')[0];
    const r = importStudents(db, [item({ idcard: String(first.idcard), name: '覆盖名' })]);
    expect(r.updated).toBe(1);
    const row = list(db, 'students').find(x => x.idcard === String(first.idcard));
    expect(row?.student_no).toBe(String(first.student_no));
  });
});
