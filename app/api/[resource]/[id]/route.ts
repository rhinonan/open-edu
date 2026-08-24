import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { update, remove, RESOURCES } from '@/lib/store';
import { removePeriodSlot } from '@/lib/timetable';
import { currentUser } from '@/lib/auth';
import type { ResourceKey } from '@/lib/types';

type Ctx = { params: Promise<{ resource: string; id: string }> };

function isResource(v: string): v is ResourceKey {
  return v in RESOURCES;
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { resource, id } = await params;
  if (!isResource(resource)) return NextResponse.json({ error: '未知资源' }, { status: 404 });
  const db = getDb();
  const user = currentUser(db, req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (resource === 'period_slots' && user.role !== 'admin') return NextResponse.json({ error: '无权限' }, { status: 403 });
  try {
    const body = await req.json();
    if (resource === 'students' && (body as Record<string, unknown>).idcard === '') (body as Record<string, unknown>).idcard = null;
    const row = update(db, resource, Number(id), body, user.class_id ?? 0);
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { resource, id } = await params;
  if (!isResource(resource)) return NextResponse.json({ error: '未知资源' }, { status: 404 });
  const db = getDb();
  const user = currentUser(db, req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (resource === 'period_slots' && user.role !== 'admin') return NextResponse.json({ error: '无权限' }, { status: 403 });
  if (resource === 'period_slots') removePeriodSlot(db, Number(id));
  else remove(db, resource, Number(id), user.class_id ?? 0);
  return NextResponse.json({ ok: true });
}
