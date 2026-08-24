import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { currentUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const db = getDb();
  const user = currentUser(db, req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  const cls = user.class_id ? db.prepare('SELECT * FROM classes WHERE id = ?').get(user.class_id) : null;
  return NextResponse.json({ user, class: cls ?? null });
}
