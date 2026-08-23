import type { DatabaseSync } from 'node:sqlite';

export interface ImportItem {
  line: number; student_no: string; name: string; gender: string; parent_name: string;
  parent_phone: string; idcard: string; address: string; level: number; group_no: number;
  role: string; noon_care: number; breakfast: number; afternoon_care: number; remark: string;
}

export interface ImportResult { created: number; updated: number; skipped: number; errors: { row: number; message: string }[] }

const UPDATE_SQL = `UPDATE students SET
  student_no = CASE WHEN @student_no = '' THEN student_no ELSE @student_no END, name = @name, gender = @gender, parent_name = @parent_name,
  parent_phone = @parent_phone, address = @address, level = @level, group_no = @group_no,
  role = @role, noon_care = @noon_care, breakfast = @breakfast, afternoon_care = @afternoon_care,
  remark = @remark WHERE class_id = @classId AND idcard = @idcard`;

const INSERT_SQL = `INSERT INTO students (class_id, student_no, name, gender, parent_name, parent_phone, idcard, address, level, group_no, role, noon_care, breakfast, afternoon_care, remark)
  VALUES (@classId, @student_no, @name, @gender, @parent_name, @parent_phone, @idcard, @address, @level, @group_no, @role, @noon_care, @breakfast, @afternoon_care, @remark)`;

export function importStudents(db: DatabaseSync, classId: number, rows: ImportItem[]): ImportResult {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };
  const find = db.prepare('SELECT id FROM students WHERE class_id = ? AND idcard = ?');
  const nextNo = db.prepare('SELECT COALESCE(MAX(CAST(student_no AS INTEGER)), 0) + 1 AS next FROM students WHERE class_id = ?');
  const upd = db.prepare(UPDATE_SQL);
  const ins = db.prepare(INSERT_SQL);
  db.exec('BEGIN');
  try {
    for (const r of rows) {
      if (!r.idcard) { result.skipped++; result.errors.push({ row: r.line, message: '缺少身份证' }); continue; }
      const { line: _line, ...fields } = r; // 'line' 仅用于统计
      if (find.get(classId, r.idcard)) { upd.run({ ...fields, classId }); result.updated++; }
      else {
        if (!fields.student_no) fields.student_no = String((nextNo.get(classId) as { next: number }).next).padStart(2, '0');
        ins.run({ ...fields, classId }); result.created++;
      }
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return result;
}
