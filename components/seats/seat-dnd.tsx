'use client';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { useDrag } from 'react-aria/useDrag';
import { useDrop } from 'react-aria/useDrop';
import type { DragItem, DropEvent, DropOperation } from 'react-aria';
import { SEAT_DRAG_TYPE, type SeatDragPayload, type SeatDropTarget } from '@/lib/seats-dnd';
import type { Row } from '@/lib/types';

/* 性别配色：男=蓝、女=粉，性别未知兜底灰 */
const BOY_CLS = 'border-blue-300 bg-blue-50 text-blue-700';
const GIRL_CLS = 'border-rose-300 bg-rose-50 text-rose-600';
const UNKNOWN_CLS = 'border-slate-300 bg-slate-50 text-slate-600';
const EMPTY_CLS = 'border-gray-200 bg-white text-gray-300';
const DROP_RING = 'ring-2 ring-blue-400';
const POOL_HIGHLIGHT = 'border-blue-300 bg-blue-50 ring-2 ring-blue-300/60';

/** 从 react-aria 的 drop 事件里还原拖拽 payload（DropItem 的 getText 是异步的） */
async function readPayload(e: DropEvent): Promise<SeatDragPayload | null> {
  for (const item of e.items) {
    if (item.kind === 'text' && item.types.has(SEAT_DRAG_TYPE)) {
      try {
        return JSON.parse(await item.getText(SEAT_DRAG_TYPE)) as SeatDragPayload;
      } catch {
        return null;
      }
    }
  }
  return null;
}

const seatItems = (p: SeatDragPayload): DragItem[] => [{ [SEAT_DRAG_TYPE]: JSON.stringify(p) }];
const moveOnly = (): DropOperation[] => ['move'];
const acceptSeat = (types: { has(t: string): boolean }): DropOperation =>
  types.has(SEAT_DRAG_TYPE) ? 'move' : 'cancel';

/* ------------------------------------------------------------------ */
/* 座位格子：已落座可拖出；全部格子可接收落座                          */
/* ------------------------------------------------------------------ */

interface SeatCellProps {
  row: number;
  col: number;
  seat: Row | null;
  genderByName: Map<string, string>;
  onOpen: (seat: Row) => void;
  onDropStudent: (payload: SeatDragPayload, target: SeatDropTarget) => void;
}

export function SeatCell({ row, col, seat, genderByName, onOpen, onDropStudent }: SeatCellProps) {
  const name = String(seat?.student_name ?? '');
  const occupied = name !== '';
  const gender = genderByName.get(name) ?? '';
  const ref = useRef<HTMLButtonElement | null>(null);

  const { dragProps, isDragging } = useDrag({
    getItems: () => seatItems({ kind: 'seat', name, seatId: seat ? Number(seat.id) : null, row, col }),
    getAllowedDropOperations: moveOnly,
    isDisabled: !occupied,
  });
  const { dropProps, isDropTarget } = useDrop({
    ref,
    getDropOperation: acceptSeat,
    onDrop: (e: DropEvent) => {
      void readPayload(e).then(p => {
        if (p) onDropStudent(p, { type: 'cell', row, col });
      });
    },
  });

  const color = !occupied ? EMPTY_CLS : gender === '女' ? GIRL_CLS : gender === '男' ? BOY_CLS : UNKNOWN_CLS;
  return (
    <button
      ref={ref}
      type="button"
      {...dropProps}
      {...dragProps}
      onClick={() => onOpen(seat ?? { row_index: row, col_index: col, student_name: '' })}
      className={`flex h-12 w-14 items-center justify-center rounded-md border text-xs transition-colors ${color} ${
        isDropTarget ? DROP_RING : ''
      } ${isDragging ? 'cursor-grabbing opacity-60' : ''}`}
    >
      {name || '＋'}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 待分配池：学生卡片可拖出，分男女两块且均可接收「拖回移除」          */
/* ------------------------------------------------------------------ */

function PoolChip({ name, gender }: { name: string; gender: string }) {
  const { dragProps, isDragging } = useDrag({
    getItems: () => seatItems({ kind: 'pool', name }),
    getAllowedDropOperations: moveOnly,
  });
  const color = gender === '女' ? GIRL_CLS : BOY_CLS;
  return (
    <div
      {...dragProps}
      tabIndex={0}
      className={`flex cursor-grab select-none items-center rounded-md border px-2 py-1 text-xs ${color} ${
        isDragging ? 'cursor-grabbing opacity-60' : ''
      }`}
    >
      {name}
    </div>
  );
}

interface PoolSectionProps {
  title: string;
  children: ReactNode;
  onDropStudent: (payload: SeatDragPayload, target: SeatDropTarget) => void;
}

function PoolSection({ title, children, onDropStudent }: PoolSectionProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { dropProps, isDropTarget } = useDrop({
    ref,
    getDropOperation: acceptSeat,
    onDrop: (e: DropEvent) => {
      void readPayload(e).then(p => {
        if (p) onDropStudent(p, { type: 'pool' });
      });
    },
  });
  return (
    <div
      ref={ref}
      {...dropProps}
      className={`rounded-lg border border-dashed p-2 transition-colors ${
        isDropTarget ? POOL_HIGHLIGHT : 'border-slate-200 bg-slate-50/60'
      }`}
    >
      <div className="mb-1 text-xs font-medium text-slate-500">{title}</div>
      {children}
    </div>
  );
}

interface PoolPanelProps {
  boys: Row[];
  girls: Row[];
  onDropStudent: (payload: SeatDragPayload, target: SeatDropTarget) => void;
}

export function PoolPanel({ boys, girls, onDropStudent }: PoolPanelProps) {
  return (
    <aside className="shrink-0 lg:w-64">
      <h3 className="mb-2 text-sm font-semibold text-slate-800">待分配</h3>
      <div className="space-y-2">
        <PoolSection title={`男生区 · ${boys.length}`} onDropStudent={onDropStudent}>
          {boys.length ? (
            <div className="flex flex-wrap gap-1.5">
              {boys.map(s => (
                <PoolChip key={s.id} name={String(s.name)} gender={String(s.gender)} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">暂无待分配男生</p>
          )}
        </PoolSection>
        <PoolSection title={`女生区 · ${girls.length}`} onDropStudent={onDropStudent}>
          {girls.length ? (
            <div className="flex flex-wrap gap-1.5">
              {girls.map(s => (
                <PoolChip key={s.id} name={String(s.name)} gender={String(s.gender)} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">暂无待分配女生</p>
          )}
        </PoolSection>
      </div>
    </aside>
  );
}
