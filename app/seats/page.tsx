'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Drawer } from '@heroui/react';
import { Download, RefreshCw, Trash2 } from 'lucide-react';
import Confirm from '@/components/confirm';
import { del, get, post, put } from '@/lib/api-client';
import type { Row } from '@/lib/types';
import { downloadCsv } from '@/lib/csv';
import { toast } from '@/lib/toast';
import { PoolPanel, SeatCell } from '@/components/seats/seat-dnd';
import {
  buildSeatIdMap,
  changesToOps,
  planSeatDrag,
  type SeatChange,
  type SeatDragPayload,
  type SeatDropTarget,
} from '@/lib/seats-dnd';

const MAX_DIM = 20;

export default function SeatsPage() {
  const [seats, setSeats] = useState<Row[]>([]);
  const [students, setStudents] = useState<Row[]>([]);
  const [cfg, setCfg] = useState({ row_count: 7, col_count: 8 });
  const [cfgId, setCfgId] = useState<number | null>(null);
  const [rowDraft, setRowDraft] = useState('7');
  const [colDraft, setColDraft] = useState('8');
  const [selected, setSelected] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [confirmRandom, setConfirmRandom] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

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
        setRowDraft(String(rowCount));
        setColDraft(String(colCount));
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

  // 姓名 → 性别，用于座位分色
  const genderByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of students) m.set(String(s.name), String(s.gender));
    return m;
  }, [students]);

  // 待分配 = 未落座学生，按性别分男女两块（池是派生数据，落座/移除自动更新）
  const unassigned = useMemo(() => students.filter(s => !used.has(String(s.name))), [students, used]);
  const boys = useMemo(() => unassigned.filter(s => String(s.gender) !== '女'), [unassigned]);
  const girls = useMemo(() => unassigned.filter(s => String(s.gender) === '女'), [unassigned]);

  // ---- 拖拽：乐观更新 + 串行写库（POST 新建座位的 id 竞态用台账解决） ----
  const seatsRef = useRef(seats);
  useEffect(() => { seatsRef.current = seats; }, [seats]);
  const seatIds = useMemo(() => buildSeatIdMap(seats), [seats]);
  const seatIdsRef = useRef(seatIds);
  useEffect(() => { seatIdsRef.current = seatIds; }, [seatIds]);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const upgradeRowId = (row: number, col: number, id: number) => {
    setSeats(prev =>
      prev.map(r =>
        Number(r.row_index) === row && Number(r.col_index) === col && !(Number(r.id) > 0) ? { ...r, id } : r,
      ),
    );
  };

  const syncChanges = async (changes: SeatChange[]) => {
    const ops = changesToOps(changes, seatIdsRef.current);
    try {
      for (const op of ops) {
        const key = `${op.row}-${op.col}`;
        if (op.kind === 'put' && op.id != null) {
          const row = await put<Row>(`/api/seats/${op.id}`, { student_name: op.student_name });
          seatIdsRef.current.set(key, Number(row.id));
          upgradeRowId(op.row, op.col, Number(row.id));
        } else if (op.kind === 'post') {
          const row = await post<Row>('/api/seats', {
            row_index: op.row, col_index: op.col, student_name: op.student_name,
          });
          seatIdsRef.current.set(key, Number(row.id));
          upgradeRowId(op.row, op.col, Number(row.id));
        }
      }
    } catch {
      toast.error('保存失败');
      setReloadTick(t => t + 1);
    }
  };

  const handleDrop = (payload: SeatDragPayload, target: SeatDropTarget) => {
    const { changes, next } = planSeatDrag(seatsRef.current, payload, target);
    if (changes.length === 0) return;
    setSeats(next);
    queueRef.current = queueRef.current.then(() => syncChanges(changes));
  };

  // 抽屉手动安排/移除复用同一条拖拽写库路径
  const assign = (name: string) => {
    if (!selected) return;
    handleDrop(
      { kind: 'pool', name },
      { type: 'cell', row: Number(selected.row_index), col: Number(selected.col_index) },
    );
    toast.success(`已安排 ${name}`);
    setSelected(null);
  };

  const clearSeat = () => {
    if (!selected) return;
    const seat = grid.get(`${selected.row_index}-${selected.col_index}`);
    handleDrop(
      {
        kind: 'seat',
        name: String(seat?.student_name ?? ''),
        seatId: seat ? Number(seat.id) : null,
        row: Number(selected.row_index),
        col: Number(selected.col_index),
      },
      { type: 'pool' },
    );
    setSelected(null);
  };

  const applyConfig = async () => {
    await queueRef.current;
    const rowCount = Math.min(MAX_DIM, Math.max(1, Number(rowDraft) || 1));
    const colCount = Math.min(MAX_DIM, Math.max(1, Number(colDraft) || 1));
    setBusy(true);
    try {
      if (cfgId != null) await put(`/api/classroom_config/${cfgId}`, { row_count: rowCount, col_count: colCount });
      else {
        const row = await post<Row>('/api/classroom_config', { row_count: rowCount, col_count: colCount });
        setCfgId(Number(row.id));
      }
      const toDelete = seats.filter(s => Number(s.row_index) >= rowCount || Number(s.col_index) >= colCount);
      if (toDelete.length) await Promise.all(toDelete.map(s => del(`/api/seats/${s.id}`)));
      setCfg({ row_count: rowCount, col_count: colCount });
      setRowDraft(String(rowCount));
      setColDraft(String(colCount));
      setReloadTick(t => t + 1);
      toast.success('已应用');
    } catch { toast.error('保存失败'); }
    setBusy(false);
  };

  const randomSeat = async () => {
    await queueRef.current;
    setBusy(true);
    try {
      const res = await post<{ placed: number; total: number }>('/api/seats/random', {
        row_count: cfg.row_count, col_count: cfg.col_count,
      });
      setSelected(null);
      setConfirmRandom(false);
      setReloadTick(t => t + 1);
      if (res.placed < res.total) toast.warning(`座位不够，仅安排了 ${res.placed}/${res.total} 人`);
      else toast.success('已按规则随机排座');
    } catch { toast.error('随机排座失败'); }
    setBusy(false);
  };

  const clearAll = async () => {
    await queueRef.current;
    setBusy(true);
    try {
      await post('/api/seats/clear', {});
      setSelected(null);
      setConfirmClear(false);
      setReloadTick(t => t + 1);
      toast.success('已移除全部座位学生');
    } catch { toast.error('移除失败'); }
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-lg font-semibold text-slate-800">排座位</h2>
        <Button variant="outline" size="sm" onPress={exportSeats}><Download size={16} /> 导出</Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-slate-600">
          <span>行</span>
          <Input type="number" className="w-16" value={rowDraft} onChange={e => setRowDraft(e.target.value)} />
          <span>列</span>
          <Input type="number" className="w-16" value={colDraft} onChange={e => setColDraft(e.target.value)} />
          <Button variant="primary" size="sm" onPress={applyConfig} isDisabled={busy}>应用</Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" isDisabled={busy} onPress={() => setConfirmRandom(true)}><RefreshCw size={14} /> 随机排座</Button>
          <Button variant="danger" size="sm" isDisabled={busy} onPress={() => setConfirmClear(true)}><Trash2 size={14} /> 全部移除</Button>
        </div>
      </div>

      <p className="mb-3 text-xs text-slate-500">
        竖排为一个小组。从左侧「待分配」拖学生入座（男生蓝色、女生粉色），座位间可拖拽互换，拖回「待分配」即移除；点击座位也可手动安排。
      </p>

      <div className="flex flex-col gap-4 lg:flex-row">
        <PoolPanel boys={boys} girls={girls} onDropStudent={handleDrop} />
        <div className="flex-1 rounded-xl bg-white p-4">
          <div className="mx-auto mb-4 w-40 rounded bg-slate-800 py-1.5 text-center text-xs text-white">讲 台</div>
          <div className="overflow-x-auto">
            <div className="mx-auto min-w-max">
              <div className="mb-1 flex justify-center gap-2">
                {Array.from({ length: cfg.col_count }).map((_, c) => (
                  <div key={c} className="w-14 text-center text-xs text-slate-400">第{c + 1}组</div>
                ))}
              </div>
              {Array.from({ length: cfg.row_count }).map((_, r) => (
                <div key={r} className="mb-2 flex justify-center gap-2">
                  {Array.from({ length: cfg.col_count }).map((_, c) => (
                    <SeatCell
                      key={c}
                      row={r}
                      col={c}
                      seat={grid.get(`${r}-${c}`) ?? null}
                      genderByName={genderByName}
                      onOpen={setSelected}
                      onDropStudent={handleDrop}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Drawer isOpen={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <Drawer.Backdrop>
          <Drawer.Content placement="right">
            <Drawer.Dialog>
              <Drawer.Header>
                <Drawer.Heading>
                  {selected ? `${Number(selected.row_index) + 1} 排 ${Number(selected.col_index) + 1} 座（${String(selected.student_name ?? '空')}）` : '安排座位'}
                </Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body>
                <div className="space-y-1">
                  {studentNames.map(s => (
                    <Button key={s.id} variant="outline" size="sm" fullWidth className="justify-start" onPress={() => void assign(String(s.name))}>
                      {String(s.name)}
                    </Button>
                  ))}
                </div>
                {selected && String(selected.student_name ?? '') && (
                  <Button variant="danger-soft" size="sm" className="mt-3" onPress={() => void clearSeat()}>移除该座位学生</Button>
                )}
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>

      <Confirm open={confirmRandom} onOpenChange={setConfirmRandom} title="随机排座"
        message="将清空当前座位，并按「竖排为小组、每组均衡分配 1-6 层级」重新随机排座，确认？" confirmText="排座" onConfirm={randomSeat} />
      <Confirm open={confirmClear} onOpenChange={setConfirmClear} title="全部移除"
        message="将移除所有座位上的学生，确认？" confirmText="移除" danger onConfirm={clearAll} />
    </div>
  );
}
