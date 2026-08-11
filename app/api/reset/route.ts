import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { resetData } from '@/lib/seed';

export async function POST() {
  resetData(getDb());
  return NextResponse.json({ ok: true });
}
