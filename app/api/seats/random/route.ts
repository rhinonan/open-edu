import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { randomSeatPlan } from '@/lib/seats';
import type { Row } from '@/lib/types';

function clamp(n: number, min: number, max: number) { return Math.min(max, Math.max(min, n)); }

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = (await req.json().catch(() => ({}))) as { row_count?: number; col_count?: number };
    const cfg = db.prepare('SELECT row_count, col_count FROM classroom_config ORDER BY id LIMIT 1').get() as
      { row_count: number; col_count: number } | undefined;
    const rowCount = clamp(Math.round(Number(body.row_count) || cfg?.row_count || 7), 1, 20);
    const colCount = clamp(Math.round(Number(body.col_count) || cfg?.col_count || 8), 1, 20);

    const students = db.prepare('SELECT name, level FROM students').all() as Row[];
    const { groups, placed } = randomSeatPlan(students, rowCount, colCount);

    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM seats').run();
      const ins = db.prepare('INSERT INTO seats (row_index, col_index, student_name) VALUES (?, ?, ?)');
      for (let c = 0; c < groups.length; c++) {
        for (let r = 0; r < groups[c].length; r++) ins.run(r, c, groups[c][r]);
      }
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
