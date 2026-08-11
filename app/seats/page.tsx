'use client';
import { useEffect, useMemo, useState } from 'react';
import { get, put, post } from '@/lib/api-client';
import type { Row } from '@/lib/types';
import PageHeader from '@/components/ui/page-header';
import Modal from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';

export default function SeatsPage() {
  const { toast } = useToast();
  const [seats, setSeats] = useState<Row[]>([]);
  const [students, setStudents] = useState<Row[]>([]);
  const [cfg, setCfg] = useState<{ row_count: number; col_count: number }>({ row_count: 6, col_count: 8 });
  const [selected, setSelected] = useState<Row | null>(null);
  const [reload, setReload] = useState(0);

  const load = () => {
    Promise.all([
      get<Row[]>('/api/seats'),
      get<Row[]>('/api/students'),
      get<Row[]>('/api/classroom_config'),
    ]).then(([s, st, c]) => {
      setSeats(s);
      setStudents(st);
      const first = c[0];
      if (first) setCfg({ row_count: Number(first.row_count), col_count: Number(first.col_count) });
    });
  };
  useEffect(load, [reload]);

  const grid = useMemo(() => {
    const m = new Map<string, Row>();
    for (const s of seats) m.set(`${s.row_index}-${s.col_index}`, s);
    return m;
  }, [seats]);

  const used = useMemo(() => {
    const s = new Set<string>();
    for (const x of seats) if (String(x.student_name)) s.add(String(x.student_name));
    return s;
  }, [seats]);

  const assign = async (name: string) => {
    if (!selected) return;
    try {
      const seat = grid.get(`${selected.row_index}-${selected.col_index}`);
      if (seat) {
        await put(`/api/seats/${seat.id}`, { student_name: name });
      } else {
        await post('/api/seats', { row_index: selected.row_index, col_index: selected.col_index, student_name: name });
      }
      toast(`已安排 ${name}`);
      setSelected(null);
      setReload(n => n + 1);
    } catch { toast('保存失败', 'err'); }
  };

  const clearSeat = async () => {
    if (!selected) return;
    const seat = grid.get(`${selected.row_index}-${selected.col_index}`);
    if (seat) {
      try { await put(`/api/seats/${seat.id}`, { student_name: '' }); setSelected(null); setReload(n => n + 1); }
      catch { toast('保存失败', 'err'); }
    }
  };

  return (
    <div>
      <PageHeader title="排座位" onExport={() => {
        const lines = seats.map(s => `${Number(s.row_index) + 1}排${Number(s.col_index) + 1}座,${s.student_name}`).join('\n');
        const blob = new Blob(['﻿' + `位置,姓名\n${lines}`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = '座位表.csv'; a.click(); URL.revokeObjectURL(url);
      }} />
      <div className="mb-4 text-xs text-slate-500">点击任意座位安排学生；已落座的学生再次点击可移除。</div>
      <div className="card p-4">
        <div className="mx-auto mb-4 w-40 text-center py-1.5 bg-navy text-white text-xs rounded">讲 台</div>
        <div className="overflow-x-auto">
          <div className="min-w-max mx-auto">
            {Array.from({ length: cfg.row_count }).map((_, r) => (
              <div key={r} className="flex gap-2 mb-2 justify-center">
                {Array.from({ length: cfg.col_count }).map((_, c) => {
                  const seat = grid.get(`${r}-${c}`);
                  const name = String(seat?.student_name ?? '');
                  return (
                    <button
                      key={c}
                      onClick={() => setSelected(seat ?? { row_index: r, col_index: c, student_name: '' })}
                      className={`w-14 h-12 rounded-md border text-xs flex items-center justify-center transition-colors ${
                        name ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-300'
                      }`}
                    >
                      {name || '＋'}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal title="安排座位" open={!!selected} onClose={() => setSelected(null)}>
        <p className="text-xs text-slate-500 mb-3">
          当前座位：{selected ? `${Number(selected.row_index) + 1} 排 ${Number(selected.col_index) + 1} 座` : ''}（{String(selected?.student_name ?? '空')}）
        </p>
        <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto">
          {students.filter(s => !used.has(String(s.name)) || String(selected?.student_name) === String(s.name)).map(s => (
            <button key={s.id} onClick={() => assign(String(s.name))}
              className={`px-2.5 py-1 rounded-md border text-xs ${String(s.name) === String(selected?.student_name) ? 'bg-accent text-white border-accent' : 'bg-white border-slate-300 text-slate-600 hover:bg-blue-50'}`}>
              {String(s.name)}
            </button>
          ))}
        </div>
        {String(selected?.student_name ?? '') && (
          <button onClick={clearSeat} className="mt-3 text-xs text-red-500 hover:underline">移除该座位学生</button>
        )}
      </Modal>
    </div>
  );
}
