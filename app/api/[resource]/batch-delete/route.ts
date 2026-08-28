import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { removeMany, RESOURCES } from '@/lib/store';
import { currentUser } from '@/lib/auth';
import type { ResourceKey } from '@/lib/types';

type Ctx = { params: Promise<{ resource: string }> };

function isResource(v: string): v is ResourceKey {
  return v in RESOURCES;
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { resource } = await params;
  if (!isResource(resource)) return NextResponse.json({ error: '未知资源' }, { status: 404 });
  const db = getDb();
  const user = currentUser(db, req);
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!user.class_id) return NextResponse.json({ error: '当前账号无关联班级' }, { status: 400 });
  const body = await req.json().catch(() => ({ ids: [] as unknown[] }));
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((n: unknown): n is number => typeof n === 'number' && Number.isInteger(n))
    : [];
  if (ids.length === 0) return NextResponse.json({ error: '缺少 ids' }, { status: 400 });
  removeMany(db, resource, ids, user.class_id);
  return NextResponse.json({ ok: true });
}
