import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { dashboardStats } from '@/lib/dashboard';
import { currentUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const db = getDb();
  const user = currentUser(db, req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  return NextResponse.json(dashboardStats(db, user.class_id ?? 0));
}
