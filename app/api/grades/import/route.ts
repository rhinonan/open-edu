import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { importGrades, type ImportGradeItem } from '@/lib/import';
import { currentUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const db = getDb();
  const user = currentUser(db, req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!user.class_id) return NextResponse.json({ error: '当前账号无关联班级' }, { status: 400 });
  try {
    const body = (await req.json()) as { rows?: ImportGradeItem[] };
    const result = importGrades(db, user.class_id, body.rows ?? []);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}