import type { Row } from './types';

/**
 * 排座位拖拽的纯决策逻辑（无 React、无副作用），可单测。
 *
 * 数据模型约定：座位表 `seats` 的行以 `student_name` 字符串关联学生，
 * 坐标用 `${row_index}-${col_index}` 标识；真实行的 `id > 0`，
 * 本地乐观新增的临时行用 `id <= 0`。
 */

/** 拖拽项的自定义 MIME 类型，用于 react-aria DnD 传递 payload */
export const SEAT_DRAG_TYPE = 'application/vnd.gzt-seat';

export interface SeatDragPayload {
  kind: 'pool' | 'seat';
  /** 学生姓名（student_name） */
  name: string;
  /** 来源座位 id，仅在 kind==='seat' 时有值（可能为临时负 id） */
  seatId?: number | null;
  /** 来源座位坐标，仅在 kind==='seat' 时有值 */
  row?: number;
  col?: number;
}

export type SeatDropTarget =
  | { type: 'cell'; row: number; col: number }
  | { type: 'pool' };

/** 一个座位的最终落值；student_name === '' 表示清空 */
export interface SeatChange {
  row: number;
  col: number;
  student_name: string;
}

export interface SeatOp {
  kind: 'put' | 'post';
  id?: number;
  row: number;
  col: number;
  student_name: string;
}

export interface PlanResult {
  changes: SeatChange[];
  next: Row[];
}

const key = (r: number, c: number) => `${r}-${c}`;

/**
 * 根据拖拽来源与落点，计算需要写库的变更（changes）和乐观更新后的座位表（next）。
 *
 * 语义：
 * - 池 → 空格：落座（无行则新建临时行）
 * - 池 → 已占格：替换（原学生隐式回池——池是派生数据，清掉名字即自动回池）
 * - 座位 → 空格：移动（源清空、目标填入）
 * - 座位 → 已占格：互换
 * - 座位 → 池：清空该座位（移除学生）
 * - 同一格：no-op
 */
export function planSeatDrag(seats: Row[], drag: SeatDragPayload, target: SeatDropTarget): PlanResult {
  const grid = new Map<string, Row>();
  for (const s of seats) grid.set(key(Number(s.row_index), Number(s.col_index)), s);
  const curName = (r: number, c: number) => String(grid.get(key(r, c))?.student_name ?? '');

  const final = new Map<string, string>(); // 坐标 → 目标姓名（'' 表示清空）

  if (target.type === 'pool') {
    if (drag.kind !== 'seat' || drag.row == null || drag.col == null) return { changes: [], next: seats };
    final.set(key(drag.row, drag.col), '');
  } else {
    const { row: r, col: c } = target;
    if (drag.kind === 'seat' && drag.row === r && drag.col === c) return { changes: [], next: seats };
    if (drag.kind === 'pool') {
      final.set(key(r, c), drag.name); // 替换/落座
    } else if (drag.row != null && drag.col != null) {
      const occupant = curName(r, c);
      if (occupant === '') {
        final.set(key(drag.row, drag.col), '');
        final.set(key(r, c), drag.name); // 移动
      } else {
        final.set(key(drag.row, drag.col), occupant);
        final.set(key(r, c), drag.name); // 互换
      }
    }
  }

  const changes: SeatChange[] = [];
  const next: Row[] = seats.map(s => ({ ...s }));
  for (const [k, name] of final) {
    const [rr, cc] = k.split('-').map(Number);
    const existing = grid.get(k);
    if (existing && String(existing.student_name ?? '') === name) continue;
    changes.push({ row: rr, col: cc, student_name: name });
    const idx = next.findIndex(n => Number(n.row_index) === rr && Number(n.col_index) === cc);
    if (idx >= 0) {
      if (name === '' && Number(next[idx].id) <= 0) next.splice(idx, 1); // 临时行被清空 → 移除
      else next[idx] = { ...next[idx], student_name: name };
    } else if (name !== '') {
      // 新建：临时负 id，POST 成功后再升级为真实 id
      next.push({ id: -next.length - 1, row_index: rr, col_index: cc, student_name: name } as Row);
    }
  }
  return { changes, next };
}

/** 把变更翻译成写库操作：有真实 id → PUT；无 id 且非空 → POST；无 id 且空 → 跳过 */
export function changesToOps(changes: SeatChange[], ids: Map<string, number>): SeatOp[] {
  const ops: SeatOp[] = [];
  for (const ch of changes) {
    const id = ids.get(key(ch.row, ch.col));
    if (id != null && id > 0) ops.push({ kind: 'put', id, row: ch.row, col: ch.col, student_name: ch.student_name });
    else if (ch.student_name !== '') ops.push({ kind: 'post', row: ch.row, col: ch.col, student_name: ch.student_name });
  }
  return ops;
}

/** 坐标 → 真实 id（只收录 id > 0 的行，临时行不算） */
export function buildSeatIdMap(seats: Row[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of seats) {
    const id = Number(s.id);
    if (id > 0) m.set(key(Number(s.row_index), Number(s.col_index)), id);
  }
  return m;
}
