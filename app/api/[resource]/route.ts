import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { list, create, RESOURCES } from '@/lib/store';
import { currentUser } from '@/lib/auth';
import type { ResourceKey } from '@/lib/types';

type Ctx = { params: Promise<{ resource: string }> };

function isResource(v: string): v is ResourceKey {
  return v in RESOURCES;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const { resource } = await params;
  if (!isResource(resource)) return NextResponse.json({ error: '未知资源' }, { status: 404 });
  const db = getDb();
  const user = currentUser(db, req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  return NextResponse.json(list(db, resource, user.class_id ?? 0));
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { resource } = await params;
  if (!isResource(resource)) return NextResponse.json({ error: '未知资源' }, { status: 404 });
  const db = getDb();
  const user = currentUser(db, req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!user.class_id) return NextResponse.json({ error: '当前账号无关联班级' }, { status: 400 });
  try {
    const body = await req.json();
    if (resource === 'students' && (body as Record<string, unknown>).idcard === '') (body as Record<string, unknown>).idcard = null;
    const row = create(db, resource, body, user.class_id);
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
