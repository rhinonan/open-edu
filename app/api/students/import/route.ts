import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { importStudents, type ImportItem } from '@/lib/import';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { rows?: ImportItem[] };
    const result = importStudents(getDb(), body.rows ?? []);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
