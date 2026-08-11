import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { update, remove, RESOURCES } from '@/lib/store';
import type { ResourceKey } from '@/lib/types';

type Ctx = { params: Promise<{ resource: string; id: string }> };

function isResource(v: string): v is ResourceKey {
  return v in RESOURCES;
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { resource, id } = await params;
  if (!isResource(resource)) return NextResponse.json({ error: '未知资源' }, { status: 404 });
  try {
    const body = await req.json();
    const row = update(getDb(), resource, Number(id), body);
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { resource, id } = await params;
  if (!isResource(resource)) return NextResponse.json({ error: '未知资源' }, { status: 404 });
  remove(getDb(), resource, Number(id));
  return NextResponse.json({ ok: true });
}
