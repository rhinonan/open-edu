import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { currentUser, hashPassword } from '@/lib/auth';

function adminOnly(user: { role: string } | null) {
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: '无权限' }, { status: 403 });
  return null;
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const denied = adminOnly(currentUser(db, req));
  if (denied) return denied;
  const users = db.prepare('SELECT id, username, name, role, class_id, created_at FROM users ORDER BY id').all();
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const denied = adminOnly(currentUser(db, req));
  if (denied) return denied;
  try {
    const body = await req.json();
    const username = String(body?.username ?? '').trim();
    const password = String(body?.password ?? '');
    const name = String(body?.name ?? '').trim();
    const className = String(body?.className ?? '').trim();
    if (!username || !password) return NextResponse.json({ error: '用户名与密码必填' }, { status: 400 });
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (exists) return NextResponse.json({ error: '用户名已存在' }, { status: 400 });

    let classId: number | null = body?.classId && Number(body.classId) ? Number(body.classId) : null;
    if (!classId && className) {
      const { lastInsertRowid } = db.prepare(`INSERT INTO classes (name, head_teacher, grade_band) VALUES (?, ?, '')`).run(className, name);
      classId = Number(lastInsertRowid);
    }
    const now = new Date().toISOString();
    const { lastInsertRowid } = db.prepare(`INSERT INTO users (username, password_hash, name, role, class_id, created_at) VALUES (?, ?, ?, 'teacher', ?, ?)`)
      .run(username, hashPassword(password), name || username, classId, now);
    return NextResponse.json({ id: Number(lastInsertRowid) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: '请求错误' }, { status: 400 });
  }
}
