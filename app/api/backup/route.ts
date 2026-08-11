import { NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDb } from '@/lib/db';

export async function GET() {
  getDb().exec('PRAGMA wal_checkpoint(TRUNCATE);');
  const buf = readFileSync(join(process.cwd(), 'data', 'app.db'));
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="app-backup.db"',
    },
  });
}
