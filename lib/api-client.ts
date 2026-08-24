import type { Row } from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (res.status === 401) {
    if (typeof window !== 'undefined' && !location.pathname.startsWith('/login')) location.href = '/login';
    throw new Error('登录已过期');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? '请求失败');
  }
  return res.json();
}

export const get = <T = Row[]>(p: string) => request<T>(p);
export const post = <T = Row>(p: string, body: unknown) => request<T>(p, { method: 'POST', body: JSON.stringify(body) });
export const put = <T = Row>(p: string, body: unknown) => request<T>(p, { method: 'PUT', body: JSON.stringify(body) });
export const del = <T = { ok: boolean }>(p: string) => request<T>(p, { method: 'DELETE' });
