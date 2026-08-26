import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { listTemplates, createTemplate, SLOT_KINDS, type TemplateSlot } from '@/lib/templates';

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

export async function GET(req: NextRequest) {
  const db = getDb();
  const denied = adminOnly(currentUser(db, req));
  if (denied) return denied;
  return NextResponse.json({ templates: listTemplates(db) });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const denied = adminOnly(currentUser(db, req));
  if (denied) return denied;
  try {
    const body = await req.json();
    const name = String(body?.name ?? '').trim();
    const remark = String(body?.remark ?? '').trim();
    const slots = parseSlotsInput(body?.slots);
    if (!name) return NextResponse.json({ error: '模板名称必填' }, { status: 400 });
    if (!slots || slots.length === 0) return NextResponse.json({ error: '请至少配置一个时段' }, { status: 400 });
    const template = createTemplate(db, name, remark, slots);
    return NextResponse.json({ template }, { status: 201 });
  } catch {
    return NextResponse.json({ error: '请求错误' }, { status: 400 });
  }
}