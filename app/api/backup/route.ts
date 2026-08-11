import { NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export async function GET() {
  const buf = readFileSync(join(process.cwd(), 'data', 'app.db'));
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="app-backup.db"',
    },
  });
}
