import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { deleteSession, readToken, clearCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const token = readToken(req);
  if (token) deleteSession(getDb(), token);
  return NextResponse.json({ ok: true }, { headers: { 'Set-Cookie': clearCookie() } });
}
