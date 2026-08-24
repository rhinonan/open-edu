import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { resetClass } from '@/lib/seed';
import { currentUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const db = getDb();
  const user = currentUser(db, req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!user.class_id) return NextResponse.json({ error: '当前账号无关联班级' }, { status: 400 });
  resetClass(db, user.class_id);
  return NextResponse.json({ ok: true });
}
