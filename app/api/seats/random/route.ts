import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { randomSeatPlan } from '@/lib/seats';
import { currentUser } from '@/lib/auth';
import type { Row } from '@/lib/types';

function clamp(n: number, min: number, max: number) { return Math.min(max, Math.max(min, n)); }

export async function POST(req: NextRequest) {
  const db = getDb();
  const user = currentUser(db, req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!user.class_id) return NextResponse.json({ error: '当前账号无关联班级' }, { status: 400 });
  const classId = user.class_id;
  try {
    const body = (await req.json().catch(() => ({}))) as { row_count?: number; col_count?: number };
    const cfg = db.prepare('SELECT row_count, col_count FROM classroom_config WHERE class_id = ? ORDER BY id LIMIT 1').get(classId) as
      { row_count: number; col_count: number } | undefined;
    const rowCount = clamp(Math.round(Number(body.row_count) || cfg?.row_count || 7), 1, 20);
    const colCount = clamp(Math.round(Number(body.col_count) || cfg?.col_count || 8), 1, 20);

    const students = db.prepare('SELECT name, level FROM students WHERE class_id = ?').all(classId) as Row[];
    const { groups, placed } = randomSeatPlan(students, rowCount, colCount);

    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM seats WHERE class_id = ?').run(classId);
      const ins = db.prepare('INSERT INTO seats (class_id, row_index, col_index, student_name) VALUES (?, ?, ?, ?)');
      for (let c = 0; c < groups.length; c++) for (let r = 0; r < groups[c].length; r++) ins.run(classId, r, c, groups[c][r]);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return NextResponse.json({ ok: true, placed, total: students.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
