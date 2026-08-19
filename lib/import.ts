import type { DatabaseSync } from 'node:sqlite';

export interface ImportItem {
  line: number;
  student_no: string;
  name: string;
  gender: string;
  parent_name: string;
  parent_phone: string;
  idcard: string;
  address: string;
  level: number;
  group_no: number;
  role: string;
  noon_care: number;
  breakfast: number;
  afternoon_care: number;
  remark: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

const UPDATE_SQL = `UPDATE students SET
  student_no = @student_no, name = @name, gender = @gender, parent_name = @parent_name,
  parent_phone = @parent_phone, address = @address, level = @level, group_no = @group_no,
  role = @role, noon_care = @noon_care, breakfast = @breakfast, afternoon_care = @afternoon_care,
  remark = @remark WHERE idcard = @idcard`;

const INSERT_SQL = `INSERT INTO students (student_no, name, gender, parent_name, parent_phone, idcard, address, level, group_no, role, noon_care, breakfast, afternoon_care, remark)
  VALUES (@student_no, @name, @gender, @parent_name, @parent_phone, @idcard, @address, @level, @group_no, @role, @noon_care, @breakfast, @afternoon_care, @remark)`;

export function importStudents(db: DatabaseSync, rows: ImportItem[]): ImportResult {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const find = db.prepare('SELECT id FROM students WHERE idcard = ?');
  const upd = db.prepare(UPDATE_SQL);
  const ins = db.prepare(INSERT_SQL);
  db.exec('BEGIN');
  try {
    for (const r of rows) {
      if (!r.idcard) { result.skipped++; result.errors.push({ row: r.line, message: '缺少身份证' }); continue; }
      const { line: _line, ...fields } = r; // 'line' 仅用于统计，不参与 SQL 绑定
      if (find.get(r.idcard)) { upd.run(fields); result.updated++; }
      else { ins.run(fields); result.created++; }
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return result;
}
