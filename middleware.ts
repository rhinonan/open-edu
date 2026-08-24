import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC = ['/login', '/api/login'];
const API_PREFIX = '/api/';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some(p => pathname === p || pathname.startsWith(p))) return NextResponse.next();
  const hasSession = Boolean(req.cookies.get('gzt_session')?.value);
  if (!hasSession) {
    if (pathname.startsWith(API_PREFIX)) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
