import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { currentUser, hashPassword } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string }> };

function adminOnly(user: { role: string } | null) {
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: '无权限' }, { status: 403 });
  return null;
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const db = getDb();
  const denied = adminOnly(currentUser(db, req));
  if (denied) return denied;
  const { id } = await params;
  try {
    const body = await req.json();
    const sets: string[] = [];
    const values: Record<string, string | number | null> = { id: Number(id) };
    if (typeof body.name === 'string') { sets.push('name = @name'); values.name = body.name; }
    if (typeof body.role === 'string') { sets.push('role = @role'); values.role = body.role; }
    if (body.classId === null || typeof body.classId === 'number') { sets.push('class_id = @classId'); values.classId = body.classId; }
    if (body.password) { sets.push('password_hash = @hash'); values.hash = hashPassword(String(body.password)); }
    if (sets.length === 0) return NextResponse.json({ error: '无可更新字段' }, { status: 400 });
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = @id`).run(values);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '请求错误' }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const db = getDb();
  const denied = adminOnly(currentUser(db, req));
  if (denied) return denied;
  const { id } = await params;
  db.prepare('DELETE FROM users WHERE id = ?').run(Number(id));
  return NextResponse.json({ ok: true });
}
