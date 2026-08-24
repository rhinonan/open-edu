import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyPassword, createSession, sessionCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const db = getDb();
  let username = '';
  let password = '';
  try {
    const body = await req.json();
    username = String(body?.username ?? '');
    password = String(body?.password ?? '');
  } catch {
    return NextResponse.json({ error: '请求错误' }, { status: 400 });
  }
  const user = db.prepare('SELECT id, username, password_hash, name, role, class_id FROM users WHERE username = ?').get(username) as
    { id: number; username: string; password_hash: string; name: string; role: string; class_id: number | null } | undefined;
  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
  }
  const token = createSession(db, user.id);
  return NextResponse.json(
    { user: { id: user.id, username: user.username, name: user.name, role: user.role, class_id: user.class_id } },
    { headers: { 'Set-Cookie': sessionCookie(token) } },
  );
}
