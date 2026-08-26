import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { updateTemplate, deleteTemplate, SLOT_KINDS, type TemplateSlot } from '@/lib/templates';

type Ctx = { params: Promise<{ id: string }> };

function adminOnly(user: { role: string } | null) {
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: '无权限' }, { status: 403 });
  return null;
}

function parseSlotsInput(v: unknown): TemplateSlot[] | null {
  if (!Array.isArray(v)) return null;
  const kinds = new Set(SLOT_KINDS);
  const out: TemplateSlot[] = [];
  for (let i = 0; i < v.length; i++) {
    const s = v[i] as Record<string, unknown>;
    if (!s || typeof s !== 'object') return null;
    const name = String(s.name ?? '');
    const start_time = String(s.start_time ?? '');
    const end_time = String(s.end_time ?? '');
    const kind = String(s.kind ?? '正课');
    if (!name || !kinds.has(kind)) return null;
    out.push({ seq: i + 1, name, start_time, end_time, kind });
  }
  return out;
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const db = getDb();
  const denied = adminOnly(currentUser(db, req));
  if (denied) return denied;
  try {
    const body = await req.json();
    const name = body?.name !== undefined ? String(body.name).trim() : undefined;
    const remark = body?.remark !== undefined ? String(body.remark).trim() : undefined;
    const slots = body?.slots !== undefined ? parseSlotsInput(body.slots) : undefined;
    if (name !== undefined && !name) return NextResponse.json({ error: '模板名称必填' }, { status: 400 });
    if (slots !== undefined && (!slots || slots.length === 0)) return NextResponse.json({ error: '请至少配置一个时段' }, { status: 400 });
    const template = updateTemplate(db, Number(id), { name, remark, slots });
    return NextResponse.json({ template });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const db = getDb();
  const denied = adminOnly(currentUser(db, req));
  if (denied) return denied;
  deleteTemplate(db, Number(id));
  return NextResponse.json({ ok: true });
}