import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { list, create, RESOURCES } from '@/lib/store';
import type { ResourceKey } from '@/lib/types';

type Ctx = { params: Promise<{ resource: string }> };

function isResource(v: string): v is ResourceKey {
  return v in RESOURCES;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { resource } = await params;
  if (!isResource(resource)) return NextResponse.json({ error: '未知资源' }, { status: 404 });
  return NextResponse.json(list(getDb(), resource));
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { resource } = await params;
  if (!isResource(resource)) return NextResponse.json({ error: '未知资源' }, { status: 404 });
  try {
    const body = await req.json();
    const row = create(getDb(), resource, body);
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
