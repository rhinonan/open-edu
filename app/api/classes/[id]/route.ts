import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { currentUser } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const db = getDb();
  const user = currentUser(db, req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const { id } = await params;
  const classId = Number(id);
  if (user.role !== 'admin' && user.class_id !== classId) return NextResponse.json({ error: '无权限' }, { status: 403 });
  try {
    const body = await req.json();
    const sets: string[] = [];
    const values: Record<string, string | number> = { id: classId };
    for (const k of ['name', 'head_teacher', 'grade_band']) {
      if (typeof body[k] === 'string') { sets.push(`${k} = @${k}`); values[k] = body[k] as string; }
    }
    if (sets.length === 0) return NextResponse.json({ error: '无可更新字段' }, { status: 400 });
    db.prepare(`UPDATE classes SET ${sets.join(', ')} WHERE id = @id`).run(values);
    const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
    return NextResponse.json(cls);
  } catch {
    return NextResponse.json({ error: '请求错误' }, { status: 400 });
  }
}
