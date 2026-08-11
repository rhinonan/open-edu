import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { dashboardStats } from '@/lib/dashboard';

export async function GET() {
  return NextResponse.json(dashboardStats(getDb()));
}
