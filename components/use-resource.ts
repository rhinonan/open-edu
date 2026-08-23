'use client';
import { useCallback, useEffect, useState } from 'react';
import { get, post, put, del } from '@/lib/api-client';
import type { ResourceKey, Row } from '@/lib/types';

export function useResourceRows(resource: ResourceKey) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    return get<Row[]>(`/api/${resource}`)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [resource]);

  // 挂载时加载：只在异步回调里 setState，避免在 effect 主体内同步更新触发级联渲染
  useEffect(() => {
    let active = true;
    get<Row[]>(`/api/${resource}`)
      .then(r => { if (active) setRows(r); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [resource]);

  const update = useCallback(async (id: number, patch: Partial<Row>) => {
    const snapshot = rows.filter(r => r.id === id)[0];
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } as Row : r));
    try {
      const u = await put<Row>(`/api/${resource}/${id}`, patch);
      setRows(prev => prev.map(r => r.id === id ? u : r));
    } catch (e) {
      if (snapshot) setRows(prev => prev.map(r => r.id === id ? snapshot : r));
      throw e;
    }
  }, [resource, rows]);

  const create = useCallback(async (data: Partial<Row>) => {
    const row = await post<Row>(`/api/${resource}`, data);
    setRows(prev => [...prev, row]);
    return row;
  }, [resource]);

  const remove = useCallback(async (id: number) => {
    await del(`/api/${resource}/${id}`);
    setRows(prev => prev.filter(r => r.id !== id));
  }, [resource]);

  return { rows, loading, reload, update, create, remove };
}
