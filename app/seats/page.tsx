'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { App, Button, Drawer, List, Typography } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { get, post, put } from '@/lib/api-client';
import type { Row } from '@/lib/types';
import { downloadCsv } from '@/lib/csv';

export default function SeatsPage() {
  const { message } = App.useApp();
  const [seats, setSeats] = useState<Row[]>([]);
  const [students, setStudents] = useState<Row[]>([]);
  const [cfg, setCfg] = useState({ row_count: 6, col_count: 8 });
  const [selected, setSelected] = useState<Row | null>(null);
  const reloadRef = useRef(0);

  useEffect(() => {
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
  }, [reloadRef.current]);

  const grid = useMemo(() => {
    const m = new Map<string, Row>();
    for (const s of seats) m.set(`${s.row_index}-${s.col_index}`, s);
    return m;
  }, [seats]);

  const used = useMemo(() => new Set(seats.map(x => String(x.student_name)).filter(Boolean)), [seats]);

  const assign = async (name: string) => {
    if (!selected) return;
    const seat = grid.get(`${selected.row_index}-${selected.col_index}`);
    try {
      if (seat) await put(`/api/seats/${seat.id}`, { student_name: name });
      else await post('/api/seats', { row_index: selected.row_index, col_index: selected.col_index, student_name: name });
      message.success(`已安排 ${name}`);
      setSelected(null);
      reloadRef.current += 1;
    } catch { message.error('保存失败'); }
  };

  const clearSeat = async () => {
    if (!selected) return;
    const seat = grid.get(`${selected.row_index}-${selected.col_index}`);
    if (!seat) return;
    try { await put(`/api/seats/${seat.id}`, { student_name: '' }); setSelected(null); reloadRef.current += 1; }
    catch { message.error('保存失败'); }
  };

  const exportSeats = () => {
    downloadCsv('座位表.csv', ['位置', '姓名'], seats.map(s => [`${Number(s.row_index) + 1}排${Number(s.col_index) + 1}座`, s.student_name ?? '']));
  };

  const studentNames = useMemo(() =>
    students.filter(s => !used.has(String(s.name)) || String(s.name) === String(selected?.student_name ?? '')),
    [students, used, selected]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <Typography.Title level={4} style={{ margin: 0 }}>排座位</Typography.Title>
        <Button icon={<DownloadOutlined />} onClick={exportSeats}>导出</Button>
      </div>
      <p className="mb-3 text-xs text-slate-500">点击任意座位安排学生；已落座的学生再次点击可移除。</p>
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="mx-auto mb-4 w-40 text-center py-1.5 bg-slate-800 text-white text-xs rounded">讲 台</div>
        <div className="overflow-x-auto">
          <div className="min-w-max mx-auto">
            {Array.from({ length: cfg.row_count }).map((_, r) => (
              <div key={r} className="flex justify-center gap-2 mb-2">
                {Array.from({ length: cfg.col_count }).map((_, c) => {
                  const seat = grid.get(`${r}-${c}`);
                  const name = String(seat?.student_name ?? '');
                  return (
                    <button
                      key={c}
                      onClick={() => setSelected(seat ?? { row_index: r, col_index: c, student_name: '' })}
                      className={`w-14 h-12 rounded-md border text-xs flex items-center justify-center transition-colors ${name ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-300'}`}
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

      <Drawer
        title={selected ? `${Number(selected.row_index) + 1} 排 ${Number(selected.col_index) + 1} 座（${String(selected.student_name ?? '空')}）` : '安排座位'}
        open={!!selected}
        onClose={() => setSelected(null)}
        width={320}
      >
        <List
          size="small"
          dataSource={studentNames}
          renderItem={(s) => (
            <List.Item>
              <Button block={false} onClick={() => void assign(String(s.name))}>{String(s.name)}</Button>
            </List.Item>
          )}
        />
        {selected && String(selected.student_name ?? '') && (
          <Button type="link" danger style={{ paddingLeft: 0 }} onClick={() => void clearSeat()}>移除该座位学生</Button>
        )}
      </Drawer>
    </div>
  );
}
