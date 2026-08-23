'use client';
import { useEffect, useMemo, useState } from 'react';
import { App, Button, Drawer, InputNumber, List, Popconfirm, Typography } from 'antd';
import { DeleteOutlined, DownloadOutlined, RetweetOutlined } from '@ant-design/icons';
import { del, get, post, put } from '@/lib/api-client';
import type { Row } from '@/lib/types';
import { downloadCsv } from '@/lib/csv';

const MAX_DIM = 20;

export default function SeatsPage() {
  const { message } = App.useApp();
  const [seats, setSeats] = useState<Row[]>([]);
  const [students, setStudents] = useState<Row[]>([]);
  const [cfg, setCfg] = useState({ row_count: 7, col_count: 8 });
  const [cfgId, setCfgId] = useState<number | null>(null);
  const [rowDraft, setRowDraft] = useState(7);
  const [colDraft, setColDraft] = useState(8);
  const [selected, setSelected] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    Promise.all([
      get<Row[]>('/api/seats'),
      get<Row[]>('/api/students'),
      get<Row[]>('/api/classroom_config'),
    ]).then(([s, st, c]) => {
      setSeats(s);
      setStudents(st);
      const first = c[0];
      if (first) {
        const rowCount = Number(first.row_count) || 7;
        const colCount = Number(first.col_count) || 8;
        setCfg({ row_count: rowCount, col_count: colCount });
        setRowDraft(rowCount);
        setColDraft(colCount);
        setCfgId(Number(first.id));
      }
    });
  }, [reloadTick]);

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
      setReloadTick(t => t + 1);
    } catch { message.error('保存失败'); }
  };

  const clearSeat = async () => {
    if (!selected) return;
    const seat = grid.get(`${selected.row_index}-${selected.col_index}`);
    if (!seat) return;
    try { await put(`/api/seats/${seat.id}`, { student_name: '' }); setSelected(null); setReloadTick(t => t + 1); }
    catch { message.error('保存失败'); }
  };

  const applyConfig = async () => {
    const rowCount = Math.min(MAX_DIM, Math.max(1, rowDraft));
    const colCount = Math.min(MAX_DIM, Math.max(1, colDraft));
    setBusy(true);
    try {
      if (cfgId != null) await put(`/api/classroom_config/${cfgId}`, { row_count: rowCount, col_count: colCount });
      else {
        const row = await post<Row>('/api/classroom_config', { row_count: rowCount, col_count: colCount });
        setCfgId(Number(row.id));
      }
      // 移除缩出格子外的旧座位记录
      const toDelete = seats.filter(s => Number(s.row_index) >= rowCount || Number(s.col_index) >= colCount);
      if (toDelete.length) await Promise.all(toDelete.map(s => del(`/api/seats/${s.id}`)));
      setCfg({ row_count: rowCount, col_count: colCount });
      setRowDraft(rowCount);
      setColDraft(colCount);
      setReloadTick(t => t + 1);
      message.success('已应用');
    } catch { message.error('保存失败'); }
    setBusy(false);
  };

  const randomSeat = async () => {
    setBusy(true);
    try {
      const res = await post<{ placed: number; total: number }>('/api/seats/random', {
        row_count: cfg.row_count, col_count: cfg.col_count,
      });
      setSelected(null);
      setReloadTick(t => t + 1);
      if (res.placed < res.total) message.warning(`座位不够，仅安排了 ${res.placed}/${res.total} 人`);
      else message.success('已按规则随机排座');
    } catch { message.error('随机排座失败'); }
    setBusy(false);
  };

  const clearAll = async () => {
    setBusy(true);
    try {
      await post('/api/seats/clear', {});
      setSelected(null);
      setReloadTick(t => t + 1);
      message.success('已移除全部座位学生');
    } catch { message.error('移除失败'); }
    setBusy(false);
  };

  const exportSeats = () => {
    const headers = Array.from({ length: cfg.col_count }, (_, c) => `第${c + 1}组`);
    const rows = Array.from({ length: cfg.row_count }, (_, r) =>
      Array.from({ length: cfg.col_count }, (_, c) => String(grid.get(`${r}-${c}`)?.student_name ?? '')));
    downloadCsv('座位表.csv', headers, rows);
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

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-slate-600">
          <span>行</span>
          <InputNumber min={1} max={MAX_DIM} value={rowDraft} onChange={v => setRowDraft(Number(v) || 1)} className="w-16" />
          <span>列</span>
          <InputNumber min={1} max={MAX_DIM} value={colDraft} onChange={v => setColDraft(Number(v) || 1)} className="w-16" />
          <Button size="small" onClick={applyConfig} loading={busy}>应用</Button>
        </div>
        <div className="flex items-center gap-2">
          <Popconfirm
            title="将清空当前座位，并按「竖排为小组、每组均衡分配 1-6 层级」重新随机排座，确认？"
            onConfirm={randomSeat}
            okText="排座"
            cancelText="取消"
          >
            <Button icon={<RetweetOutlined />} loading={busy}>随机排座</Button>
          </Popconfirm>
          <Popconfirm title="将移除所有座位上的学生，确认？" onConfirm={clearAll} okText="移除" cancelText="取消">
            <Button danger icon={<DeleteOutlined />} loading={busy}>全部移除</Button>
          </Popconfirm>
        </div>
      </div>

      <p className="mb-3 text-xs text-slate-500">竖排为一个小组。点击任意座位安排学生；已落座的学生再次点击可移除。</p>
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="mx-auto mb-4 w-40 text-center py-1.5 bg-slate-800 text-white text-xs rounded">讲 台</div>
        <div className="overflow-x-auto">
          <div className="min-w-max mx-auto">
            <div className="flex justify-center gap-2 mb-1">
              {Array.from({ length: cfg.col_count }).map((_, c) => (
                <div key={c} className="w-14 text-center text-xs text-slate-400">第{c + 1}组</div>
              ))}
            </div>
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
        size={320}
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
