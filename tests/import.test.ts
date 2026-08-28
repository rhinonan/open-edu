import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from '../lib/schema';
import { seedClass } from '../lib/seed';
import { list, create } from '../lib/store';
import { importStudents, importGrades, type ImportItem, type ImportGradeItem } from '../lib/import';

function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA_SQL);
  const { lastInsertRowid } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('测试班', '王老师', '六年级')`).run();
  const classId = Number(lastInsertRowid);
  seedClass(db, classId);
  return { db, classId };
}

const item = (p: Partial<ImportItem>): ImportItem => ({
  line: 2, student_no: '', name: '导入生', gender: '男', parent_name: '', parent_phone: '',
  idcard: '', address: '', level: 4, group_no: 1, role: '', noon_care: 0, breakfast: 0,
  afternoon_care: 1, remark: '', ...p,
});

describe('importStudents', () => {
  it('新身份证 → INSERT', () => {
    const { db, classId } = makeDb();
    const r = importStudents(db, classId, [item({ idcard: '430102199001010011', name: '新增生' })]);
    expect(r.created).toBe(1);
    expect(r.updated).toBe(0);
    expect(list(db, 'students', classId).length).toBe(3);
  });

  it('已存在身份证 → 覆盖全部字段', () => {
    const { db, classId } = makeDb();
    const first = list(db, 'students', classId)[0];
    const r = importStudents(db, classId, [item({ idcard: String(first.idcard), name: '覆盖名', level: 1, gender: '女' })]);
    expect(r.updated).toBe(1);
    const row = list(db, 'students', classId)[0];
    expect(row.name).toBe('覆盖名');
    expect(row.level).toBe(1);
    expect(row.gender).toBe('女');
    expect(list(db, 'students', classId).length).toBe(2);
  });

  it('空身份证 → 跳过并带行号', () => {
    const { db, classId } = makeDb();
    const r = importStudents(db, classId, [item({ line: 3, idcard: '' })]);
    expect(r.skipped).toBe(1);
    expect(r.errors).toEqual([{ row: 3, message: '缺少身份证' }]);
  });

  it('同批两条相同新身份证 → 一条 insert 一条 update', () => {
    const { db, classId } = makeDb();
    const r = importStudents(db, classId, [item({ idcard: '999' }), item({ idcard: '999', name: '第二次' })]);
    expect(r.created).toBe(1);
    expect(r.updated).toBe(1);
    const row = list(db, 'students', classId).find(x => x.idcard === '999');
    expect(row?.name).toBe('第二次');
  });

  it('跨班同身份证各插一条（班级内唯一）', () => {
    const { db, classId } = makeDb();
    const { lastInsertRowid: cid2 } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES ('六年级（2）班', '李老师', '六年级')`).run();
    seedClass(db, Number(cid2));
    const r = importStudents(db, classId, [item({ idcard: '430102199003030033', name: 'A' })]);
    const r2 = importStudents(db, Number(cid2), [item({ idcard: '430102199003030033', name: 'B' })]);
    expect(r.created).toBe(1);
    expect(r2.created).toBe(1); // 不同班不冲突
  });

  it('新身份证空学号 → INSERT 并自动取 max+1', () => {
    const { db, classId } = makeDb();
    const r = importStudents(db, classId, [item({ idcard: '430102199001020022', name: '无学号生' })]);
    expect(r.created).toBe(1);
    const row = list(db, 'students', classId).find(x => x.idcard === '430102199001020022');
    expect(row?.student_no).toBe('03');
  });
});

const gItem = (p: Partial<ImportGradeItem>): ImportGradeItem => ({
  line: 2, exam_name: '期中考试', subject: '语文', student_name: '王小明', score: 90, ...p,
});

describe('importGrades', () => {
  it('新考试新记录 → INSERT', () => {
    const { db, classId } = makeDb();
    const r = importGrades(db, classId, [gItem({})]);
    expect(r.created).toBe(1);
    expect(r.updated).toBe(0);
    expect(list(db, 'grades', classId).some(x => x.exam_name === '期中考试' && x.subject === '语文' && x.student_name === '王小明' && x.score === 90)).toBe(true);
  });

  it('同考试同科目同学生 → 覆盖分数且不新增', () => {
    const { db, classId } = makeDb();
    const before = list(db, 'grades', classId);
    const first = before[0]!;
    const r = importGrades(db, classId, [gItem({ exam_name: String(first.exam_name), subject: String(first.subject), student_name: String(first.student_name), score: 55 })]);
    expect(r.updated).toBe(1);
    expect(r.created).toBe(0);
    expect(list(db, 'grades', classId).length).toBe(before.length);
    expect(list(db, 'grades', classId)[0].score).toBe(55);
  });

  it('缺少学生姓名 → 跳过并带行号', () => {
    const { db, classId } = makeDb();
    const before = list(db, 'grades', classId).length;
    const r = importGrades(db, classId, [gItem({ line: 3, student_name: '' })]);
    expect(r.skipped).toBe(1);
    expect(r.errors).toEqual([{ row: 3, message: '缺少学生姓名' }]);
    expect(list(db, 'grades', classId).length).toBe(before);
  });

  it('同批两条相同记录 → 一条 insert 一条 update', () => {
    const { db, classId } = makeDb();
    const r = importGrades(db, classId, [gItem({ score: 70 }), gItem({ score: 80 })]);
    expect(r.created).toBe(1);
    expect(r.updated).toBe(1);
    const row = list(db, 'grades', classId).find(x => x.exam_name === '期中考试' && x.subject === '语文' && x.student_name === '王小明');
    expect(row?.score).toBe(80);
  });
});
